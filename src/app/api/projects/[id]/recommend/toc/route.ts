import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseDb, JSON_ONLY } from "@/lib/safe-parse";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { targetAudience }: { targetAudience: string } = await request.json();

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const analysisData = safeParseDb<Record<string, unknown>>(
      (project as any).analysisData as string | null,
      {}
    );
    const summary = ((analysisData.summary as string) ?? ((project as any).originalText as string | null ?? "")).slice(0, 300);

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `"${targetAudience}"를 위한 전자책 목차 구조 3개를 아래 형식의 JSON 배열로만 출력하라. 각 구조는 챕터 5개, 소제목 2개씩.

원고 요약: ${summary}

출력 형식:
[{"id":"1","chapters":[{"type":"chapter","number":1,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":2,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":3,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":4,"title":"챕터명","subtitles":["소제목1","소제목2"]},{"type":"chapter","number":5,"title":"챕터명","subtitles":["소제목1","소제목2"]}]},{"id":"2","chapters":[...]},{"id":"3","chapters":[...]}]${JSON_ONLY}`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const tocOptions = parseTocOptions(raw);

    if (tocOptions.length === 0) {
      throw new Error(`목차 파싱 실패. 원문: ${raw.slice(0, 150)}`);
    }

    console.log(`[RECOMMEND/TOC] 완료 — ${tocOptions.length}개 목차`);
    return NextResponse.json({ tocOptions });
  } catch (error) {
    console.error("[RECOMMEND/TOC] 오류:", error);
    return NextResponse.json({ message: "목차 생성 실패", detail: String(error) }, { status: 500 });
  }
}

function parseTocOptions(raw: string): Array<{ id: string; chapters: unknown[] }> {
  const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

  // 1. 전체 배열 파싱
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  // 2. 완성된 TocOption 객체 하나씩 추출
  const results: Array<{ id: string; chapters: unknown[] }> = [];
  const objRegex = /\{"id"\s*:\s*"(\d+)"\s*,\s*"chapters"\s*:\s*(\[(?:[^[\]]*|\[(?:[^[\]]*|\[[^\]]*\])*\])*\])\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(stripped)) !== null) {
    try {
      const chapters = JSON.parse(m[2]);
      if (Array.isArray(chapters) && chapters.length > 0) {
        results.push({ id: m[1], chapters });
      }
    } catch {}
  }
  if (results.length > 0) return results;

  // 3. 최후 수단: 기본 5챕터 구조 반환
  console.warn("[RECOMMEND/TOC] 파싱 실패 — 기본 구조 반환");
  return [{
    id: "1",
    chapters: [1, 2, 3, 4, 5].map((n) => ({
      type: "chapter",
      number: n,
      title: `${n}장`,
      subtitles: ["소제목 1", "소제목 2"],
    })),
  }];
}
