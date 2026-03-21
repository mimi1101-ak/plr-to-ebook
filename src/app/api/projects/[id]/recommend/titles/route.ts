import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/recommend/titles
 * 타겟층 기반 제목 10개 생성 (max_tokens: 200 → ~2s)
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

    // 타겟층 DB 저장
    await prisma.project.update({
      where: { id: params.id },
      data: { targetAudience } as any,
    });

    const analysisData = JSON.parse(((project as any).analysisData as string | null) ?? "{}");
    const summary = analysisData.summary ?? ((project as any).originalText as string | null ?? "").slice(0, 500);

    const prompt = `"${targetAudience}" 독자를 위한 전자책 제목 10개를 JSON 배열로만 출력하세요. 설명 없이 배열만.

원고 요약: ${summary.slice(0, 300)}

["제목1","제목2","제목3","제목4","제목5","제목6","제목7","제목8","제목9","제목10"]`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error("JSON 배열 파싱 실패: " + raw.slice(0, 100));
    const titles: string[] = JSON.parse(arrMatch[0]);

    console.log(`[RECOMMEND/TITLES] 완료 — ${titles.length}개`);
    return NextResponse.json({ titles });
  } catch (error) {
    console.error("[RECOMMEND/TITLES] 오류:", error);
    return NextResponse.json({ message: "제목 생성 실패", detail: String(error) }, { status: 500 });
  }
}
