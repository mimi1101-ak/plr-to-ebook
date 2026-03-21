import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/recommend
 * 타겟층 기반으로 제목 10개 + 목차 구조 5개를 추천.
 * max_tokens: 2000 → ~6-8s 이내
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { targetAudience }: { targetAudience: string } = await request.json();

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    // 타겟층 저장
    await prisma.project.update({
      where: { id: params.id },
      data: { targetAudience } as any,
    });

    const originalText = ((project as any).originalText as string | null) ?? "";
    const analysisData = ((project as any).analysisData as string | null);
    const summary = analysisData ? (JSON.parse(analysisData).summary ?? "") : "";
    const textSample = originalText.slice(0, 2000);

    const prompt = `PLR 원고를 "${targetAudience}" 타겟층에 맞는 한국어 전자책으로 변환합니다.

## 원고 요약
${summary || textSample}

## 요청
아래 JSON 형식으로 제목 10개와 목차 구조 5개를 추천하세요. JSON만 출력하세요.

{
  "titles": [
    "제목1 (타겟층 니즈를 담은 구체적이고 매력적인 제목)",
    "제목2",
    "제목3",
    "제목4",
    "제목5",
    "제목6",
    "제목7",
    "제목8",
    "제목9",
    "제목10"
  ],
  "tocOptions": [
    {
      "id": "1",
      "chapters": [
        { "type": "prologue", "title": "시작하며", "subtitles": ["소제목1", "소제목2", "소제목3"] },
        { "type": "chapter", "number": 1, "title": "챕터 제목", "subtitles": ["소제목1", "소제목2", "소제목3"] },
        { "type": "chapter", "number": 2, "title": "챕터 제목", "subtitles": ["소제목1", "소제목2", "소제목3"] },
        { "type": "chapter", "number": 3, "title": "챕터 제목", "subtitles": ["소제목1", "소제목2", "소제목3"] },
        { "type": "chapter", "number": 4, "title": "챕터 제목", "subtitles": ["소제목1", "소제목2", "소제목3"] },
        { "type": "chapter", "number": 5, "title": "챕터 제목", "subtitles": ["소제목1", "소제목2", "소제목3"] },
        { "type": "appendix", "title": "부록", "subtitles": ["소제목1", "소제목2"] }
      ]
    },
    { "id": "2", "chapters": [ ... ] },
    { "id": "3", "chapters": [ ... ] },
    { "id": "4", "chapters": [ ... ] },
    { "id": "5", "chapters": [ ... ] }
  ]
}

각 목차 구조는 서로 다른 구성이어야 합니다. 프롤로그/부록은 선택사항입니다.`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON 파싱 실패: " + raw.slice(0, 200));
    }
    const result = JSON.parse(jsonMatch[0]);

    console.log(`[RECOMMEND] 추천 완료 — 제목 ${result.titles?.length ?? 0}개, 목차 ${result.tocOptions?.length ?? 0}개`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[RECOMMEND] 오류:", error);
    return NextResponse.json(
      { message: "추천 생성 실패", detail: String(error) },
      { status: 500 }
    );
  }
}
