import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/analyze/targets
 * 2단계: 타겟층 3개 생성 (max_tokens: 380 → ~4s, 타임아웃 안전)
 * /analyze/run 완료(status: summary_done) 후 호출.
 * 완료 후 status = "done"으로 저장.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });
    }

    const existing = JSON.parse(((project as any).analysisData as string | null) ?? "{}");
    if (existing.status === "done") {
      return NextResponse.json({ done: true });
    }

    const summary: string = existing.summary ?? "";
    if (!summary) {
      await markFailed(params.id, "요약 없음 — /analyze/run 먼저 호출하세요");
      return NextResponse.json({ message: "요약 없음" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await markFailed(params.id, "ANTHROPIC_API_KEY 없음");
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 420,
      messages: [
        {
          role: "user",
          content: `"${summary}" 내용의 전자책을 구매할 타겟층 3개를 JSON 배열로 출력하라. name(10자), characteristics(40자), needs(35자), purchaseMotivation(35자).`,
        },
        {
          role: "assistant",
          content: "[",
        },
      ],
    });

    const partial = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const raw = "[" + partial;

    // JSON 배열 파싱 (잘린 경우 완성된 객체만 추출)
    let targetAudiences: unknown[] = [];
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        targetAudiences = JSON.parse(arrMatch[0]);
      } catch {
        // 잘린 JSON — 완성된 객체만 추출
        const objMatches = raw.match(/\{[^{}]+\}/g) ?? [];
        targetAudiences = objMatches.flatMap((s) => { try { return [JSON.parse(s)]; } catch { return []; } });
      }
    }
    if (targetAudiences.length === 0) throw new Error("타겟층 파싱 실패: " + raw.slice(0, 100));

    await prisma.project.update({
      where: { id: params.id },
      data: {
        analysisData: JSON.stringify({ status: "done", summary, targetAudiences }),
      } as any,
    });

    console.log(`[ANALYZE/TARGETS] 완료 — 타겟층 ${targetAudiences.length}개`);
    return NextResponse.json({ done: true });
  } catch (error) {
    console.error("[ANALYZE/TARGETS] 오류:", error);
    await markFailed(params.id, String(error));
    return NextResponse.json({ message: String(error) }, { status: 500 });
  }
}

async function markFailed(id: string, error: string) {
  await prisma.project.update({
    where: { id },
    data: { analysisData: JSON.stringify({ status: "failed", error }) } as any,
  }).catch(() => {});
}
