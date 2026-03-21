import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/analyze/run
 * 실제 Claude 분석 호출 (max_tokens: 600 → ~5-7s, Vercel 10s 이내).
 * 프론트에서 fire-and-forget으로 호출 후 /analyze/status 폴링으로 결과 확인.
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

    // 이미 완료된 경우 재실행 방지
    const existing = ((project as any).analysisData as string | null) ?? "{}";
    const parsed = JSON.parse(existing);
    if (parsed.status === "done") {
      return NextResponse.json({ done: true });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await prisma.project.update({
        where: { id: params.id },
        data: { analysisData: JSON.stringify({ status: "failed", error: "ANTHROPIC_API_KEY 없음" }) } as any,
      });
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const originalText = ((project as any).originalText as string | null) ?? "";
    // 토큰 절약을 위해 원고 앞부분 2000자만 사용
    const textSample = originalText.slice(0, 2000);

    // 간결한 출력을 유도하는 프롬프트 (max_tokens: 600 → ~5s)
    const prompt = `PLR 원고 내용을 분석해서 JSON만 출력하세요. 설명 없이 JSON만.

원고 (일부):
${textSample}

출력 형식:
{
  "summary": "핵심 주제와 내용 (300자 이내)",
  "targetAudiences": [
    { "name": "타겟층명 (10자 이내)", "characteristics": "특징 (50자 이내)", "needs": "핵심 니즈 (40자 이내)", "purchaseMotivation": "구매 동기 (40자 이내)" },
    { ... },
    { ... }
  ]
}`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");
    const result = JSON.parse(jsonMatch[0]);

    await prisma.project.update({
      where: { id: params.id },
      data: {
        analysisData: JSON.stringify({ status: "done", ...result }),
      } as any,
    });

    console.log(`[ANALYZE/RUN] 완료 — 요약 ${result.summary?.length ?? 0}자`);
    return NextResponse.json({ done: true });
  } catch (error) {
    console.error("[ANALYZE/RUN] 오류:", error);
    await prisma.project.update({
      where: { id: params.id },
      data: {
        analysisData: JSON.stringify({ status: "failed", error: String(error) }),
      } as any,
    }).catch(() => {});
    return NextResponse.json({ message: String(error) }, { status: 500 });
  }
}
