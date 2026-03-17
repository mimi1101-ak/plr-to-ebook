import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const styleDescriptions: Record<string, string> = {
  professional:
    "명확하고 격식 있는 비즈니스 문체로 작성하세요. 전문 용어를 적절히 활용하되 독자가 이해하기 쉽게 설명합니다.",
  casual:
    "친근하고 대화하듯 편안한 문체로 작성하세요. 독자에게 직접 말하는 것처럼 편안하게 서술합니다.",
  academic:
    "학술적이고 체계적인 문체로 작성하세요. 근거와 논리를 중심으로 객관적으로 서술하며 통계나 데이터를 포함합니다.",
  storytelling:
    "이야기처럼 흥미롭게 서술하세요. 실제 사례와 비유를 풍부하게 활용하여 독자의 몰입을 유도합니다.",
};

const sentenceDescriptions: Record<string, string> = {
  short: "문장을 짧고 간결하게 씁니다. 한 문장이 15자 내외가 되도록 합니다.",
  medium: "적당한 길이의 문장을 씁니다. 한 문장이 30자 내외가 되도록 합니다.",
  long: "풍부한 설명이 담긴 문장을 씁니다. 한 문장이 50자 내외가 되도록 합니다.",
};

/**
 * max_tokens 도달 시 assistant prefill로 이어쓰기
 */
async function callWithContinuation(
  client: Anthropic,
  prompt: string,
  maxTokensPerCall = 16000,
  maxContinuations = 3
): Promise<string> {
  type Msg = { role: "user" | "assistant"; content: string };
  let messages: Msg[] = [{ role: "user", content: prompt }];
  let fullText = "";

  for (let i = 0; i <= maxContinuations; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokensPerCall,
      messages,
    });

    const chunk =
      response.content[0].type === "text" ? response.content[0].text : "";
    fullText += chunk;

    console.log(
      `[REGEN] ${i === 0 ? "초기 생성" : `${i}번째 이어쓰기`} 완료 — ` +
        `${chunk.length}자, 누적 ${fullText.length}자, stop_reason: ${response.stop_reason}`
    );

    if (response.stop_reason !== "max_tokens") break;

    if (i < maxContinuations) {
      messages = [
        { role: "user", content: prompt },
        { role: "assistant", content: fullText },
      ];
    }
  }

  return fullText;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, writingStyle: true, sentenceStructure: true },
    });

    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    const {
      chapterTitle,
      chapterNumber,
      totalChapters,
      ebookTitle,
      writingStyle,
      sentenceStructure,
    } = await request.json();

    const style = writingStyle ?? project.writingStyle ?? "professional";
    const sentence = sentenceStructure ?? project.sentenceStructure ?? "medium";

    const prompt = `한국의 전문 전자책 작가로서, 아래 전자책의 특정 챕터를 새로 작성해주세요.

## 전자책 정보
- 제목: ${ebookTitle}
- 챕터 번호: ${chapterNumber} / ${totalChapters}
- 챕터 제목: ${chapterTitle}

## 분량 목표 (최소치가 아닌 목표치에 맞춰 충분히 작성하세요)
- **목표 분량**: 4,000~6,000자. **목표: 5,500자**
- ### 소제목 3개 이상 사용
- 각 소제목 아래에 구체적인 사례, 실제 예시, 불렛 포인트(- 항목) 풍부하게 포함

## 필수 품질 기준
1. 전문적이고 자연스러운 한국어 사용
2. ${sentenceDescriptions[sentence] ?? sentenceDescriptions.medium}
3. 모든 문장은 반드시 완전한 문장으로 끝내세요. 문장이 중간에 끊기면 안 됩니다.
4. 인스타그램, 유튜브, 카카오톡, 네이버 등 한국 플랫폼 사례 반드시 포함
5. 2026년 AI·숏폼·1인 창작 경제 트렌드 반영
6. 외래어 남발 금지, 한국어로 풀어 설명
7. **챕터 마지막 소제목 본문이 끝난 뒤**, 별도 서식(blockquote, 제목 등) 없이 일반 문장으로 다음 챕터로 자연스럽게 이어지는 한두 문장을 작성하세요.

## 문체
${styleDescriptions[style] ?? styleDescriptions.professional}

## 출력 형식
챕터 본문만 작성하세요. "## 챕터 제목"은 생략하고 ### 소제목부터 시작하세요.
마크다운 형식으로만 작성하고 JSON은 절대 사용하지 마세요.`;

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const content = await callWithContinuation(client, prompt);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Chapter regeneration error:", error);
    return NextResponse.json({ message: "챕터 재생성에 실패했습니다." }, { status: 500 });
  }
}
