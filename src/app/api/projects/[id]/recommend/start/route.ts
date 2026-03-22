import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseDb, JSON_ONLY } from "@/lib/safe-parse";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/recommend/start
 * Body: { targetAudience: string }
 * Job 생성 후 즉시 jobId 반환.
 * 백그라운드에서 titles 10개 + toc 3개를 messages.create() 한 번으로 생성.
 * 완료 시 job.status = "done", job.result = { titles, tocOptions }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { targetAudience }: { targetAudience: string } = await request.json();

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });

    const job = await prisma.job.create({
      data: { type: "recommend", projectId: params.id, status: "running" },
    });

    await prisma.project.update({
      where: { id: params.id },
      data: { targetAudience } as any,
    });

    console.log(`[RECOMMEND/START] Job 생성 — jobId: ${job.id}`);

    // 백그라운드 실행 (fire-and-forget)
    runRecommend(params.id, job.id, targetAudience, apiKey, project).catch(() => {});

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    console.error("[RECOMMEND/START] 오류:", error);
    return NextResponse.json({ message: String(error) }, { status: 500 });
  }
}

async function runRecommend(
  projectId: string,
  jobId: string,
  targetAudience: string,
  apiKey: string,
  project: any
) {
  try {
    const analysisData = safeParseDb<Record<string, unknown>>(
      project.analysisData as string | null, {}
    );
    const summary = (
      (analysisData.summary as string) ??
      (project.originalText as string | null ?? "")
    ).slice(0, 300);

    const client = new Anthropic({ apiKey: apiKey.trim(), timeout: 30000 });

    console.log(`[RECOMMEND/START] AI 호출 시작`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `"${targetAudience}"를 위한 전자책 제목 10개와 목차 구조 3개를 아래 형식의 JSON으로만 출력하라. 각 제목 20자 이내. 각 목차는 챕터 8~10개, 소제목 2개씩.

원고 요약: ${summary}

출력 형식:
{"titles":["제목1","제목2","제목3","제목4","제목5","제목6","제목7","제목8","제목9","제목10"],"tocOptions":[{"id":"1","chapters":[{"type":"chapter","number":1,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":2,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":3,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":4,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":5,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":6,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":7,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":8,"title":"챕터명","subtitles":["소제목1","소제목2"]}]},{"id":"2","chapters":[...]},{"id":"3","chapters":[...]}]}${JSON_ONLY}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    console.log(`[RECOMMEND/START] AI 응답 완료 — raw length: ${raw.length}`);

    const result = parseResult(raw);
    if (result.titles.length === 0) {
      console.error("[RECOMMEND/START] 제목 파싱 실패. raw 응답:\n", raw);
      throw new Error("제목 파싱 실패");
    }
    if (result.tocOptions.length === 0) {
      console.error("[RECOMMEND/START] 목차 파싱 실패. raw 응답:\n", raw);
      throw new Error("목차 파싱 실패");
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "done", result: JSON.stringify(result) },
    });

    console.log(`[RECOMMEND/START] 완료 — 제목 ${result.titles.length}개, 목차 ${result.tocOptions.length}개`);
  } catch (error) {
    console.error("[RECOMMEND/START] 백그라운드 오류:", error);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "failed", error: String(error) },
    }).catch(() => {});
  }
}

function parseResult(raw: string): { titles: string[]; tocOptions: Array<{ id: string; chapters: unknown[] }> } {
  const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  // 1. 전체 JSON 파싱 시도
  try {
    const obj = JSON.parse(stripped);
    if (Array.isArray(obj.titles) && Array.isArray(obj.tocOptions)) return obj;
  } catch {}

  // 2. titles 배열 개별 추출
  let titles: string[] = [];
  const titlesMatch = stripped.match(/"titles"\s*:\s*(\[[\s\S]*?\])/);
  if (titlesMatch) {
    try {
      const parsed = JSON.parse(titlesMatch[1]);
      if (Array.isArray(parsed)) titles = parsed.map(String).filter(Boolean);
    } catch {}
  }

  // 3. tocOptions 배열 개별 추출 (중첩 배열 포함)
  let tocOptions: Array<{ id: string; chapters: unknown[] }> = [];
  const tocMatch = stripped.match(/"tocOptions"\s*:\s*(\[[\s\S]*\])\s*\}?\s*$/);
  if (tocMatch) {
    try {
      const parsed = JSON.parse(tocMatch[1]);
      if (Array.isArray(parsed)) tocOptions = parsed;
    } catch {}
  }

  return { titles, tocOptions };
}
