import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/analyze
 * 원본 텍스트를 분석해 요약 + 타겟층 3개를 반환.
 * max_tokens: 1200 → ~5s 이내
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const originalText = ((project as any).originalText as string | null) ?? "";
    const textSample = originalText.slice(0, 3000);

    const prompt = `다음은 PLR(Private Label Rights) 원고의 내용입니다. 아래 작업을 수행하고 반드시 JSON만 출력하세요.

## 원본 내용 (일부)
${textSample}

## 출력 형식 (JSON만, 다른 텍스트 없이)
{
  "summary": "원고 내용 요약 (2000자 이내, 핵심 주제와 내용 설명)",
  "targetAudiences": [
    {
      "name": "타겟층 이름 (예: 직장인 부업 희망자)",
      "characteristics": "특징 설명 (2-3문장)",
      "needs": "이 타겟층의 핵심 니즈 (1-2문장)",
      "purchaseMotivation": "이 전자책을 구매할 동기 (1-2문장)"
    },
    { ... },
    { ... }
  ]
}

타겟층 3개는 서로 다른 유형의 독자여야 합니다.`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    // JSON 블록 추출
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON 파싱 실패: " + raw.slice(0, 200));
    }
    const result = JSON.parse(jsonMatch[0]);

    await prisma.project.update({
      where: { id: params.id },
      data: { analysisData: JSON.stringify(result) } as any,
    });

    console.log(`[ANALYZE] 분석 완료 — 요약 ${result.summary?.length ?? 0}자, 타겟층 ${result.targetAudiences?.length ?? 0}개`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ANALYZE] 오류:", error);
    return NextResponse.json(
      { message: "내용 분석 실패", detail: String(error) },
      { status: 500 }
    );
  }
}
