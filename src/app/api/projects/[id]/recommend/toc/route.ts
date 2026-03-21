import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/recommend/toc
 * 타겟층 기반 목차 구조 3개 생성 (max_tokens: 500 → ~5s)
 * 3옵션 × 5챕터 × 소제목2개 = 토큰 절감
 */
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

    const analysisData = JSON.parse(((project as any).analysisData as string | null) ?? "{}");
    const summary = analysisData.summary ?? ((project as any).originalText as string | null ?? "").slice(0, 500);

    const prompt = `"${targetAudience}"를 위한 전자책 목차 구조 3개를 JSON 배열로만 출력하세요. 설명 없이 배열만.

원고 요약: ${summary.slice(0, 300)}

[
  {"id":"1","chapters":[
    {"type":"chapter","number":1,"title":"챕터명","subtitles":["소제목1","소제목2"]},
    {"type":"chapter","number":2,"title":"챕터명","subtitles":["소제목1","소제목2"]},
    {"type":"chapter","number":3,"title":"챕터명","subtitles":["소제목1","소제목2"]},
    {"type":"chapter","number":4,"title":"챕터명","subtitles":["소제목1","소제목2"]},
    {"type":"chapter","number":5,"title":"챕터명","subtitles":["소제목1","소제목2"]}
  ]},
  {"id":"2","chapters":[...]},
  {"id":"3","chapters":[...]}
]

3개는 서로 다른 구성으로. prologue/appendix는 선택사항.`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error("JSON 배열 파싱 실패: " + raw.slice(0, 100));
    const tocOptions = JSON.parse(arrMatch[0]);

    console.log(`[RECOMMEND/TOC] 완료 — ${tocOptions.length}개 목차`);
    return NextResponse.json({ tocOptions });
  } catch (error) {
    console.error("[RECOMMEND/TOC] 오류:", error);
    return NextResponse.json({ message: "목차 생성 실패", detail: String(error) }, { status: 500 });
  }
}
