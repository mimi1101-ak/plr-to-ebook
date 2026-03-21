import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseDb } from "@/lib/safe-parse";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/analyze/run
 * 1단계: 요약만 생성 (max_tokens: 180 → ~2s, 타임아웃 안전)
 * 완료 후 status = "summary_done"으로 저장.
 * 프론트가 이 상태를 감지하면 /analyze/targets 호출.
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

    const existing = safeParseDb<Record<string, unknown>>((project as any).analysisData as string | null, {});
    if (existing.status === "summary_done" || existing.status === "done") {
      return NextResponse.json({ done: true });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await markFailed(params.id, "ANTHROPIC_API_KEY 없음");
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const originalText = ((project as any).originalText as string | null) ?? "";
    // 1500자만 사용 → 프롬프트 토큰 절감
    const textSample = originalText.slice(0, 1500);

    const prompt = `아래 PLR 원고를 200자 이내로 요약해주세요. 핵심 주제만. 요약문만 출력, 부연 설명 없이.

${textSample}`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 180,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    await prisma.project.update({
      where: { id: params.id },
      data: { analysisData: JSON.stringify({ status: "summary_done", summary }) } as any,
    });

    console.log(`[ANALYZE/RUN] 요약 완료 — ${summary.length}자`);
    return NextResponse.json({ done: true });
  } catch (error) {
    console.error("[ANALYZE/RUN] 오류:", error);
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
