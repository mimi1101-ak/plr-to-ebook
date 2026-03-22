import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const styleDescriptions: Record<string, string> = {
  professional: "명확하고 격식 있는 비즈니스 문체로 작성하세요.",
  casual: "친근하고 대화하듯 편안한 문체로 작성하세요.",
  academic: "학술적이고 체계적인 문체로 작성하세요.",
  storytelling: "이야기처럼 흥미롭게 서술하세요.",
};

/**
 * POST /api/projects/[id]/convert/subtitle
 * 소제목 1개 내용 생성. max_tokens: 1500 → ~25초 이내.
 */
export async function POST(
  request: NextRequest,
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

    const {
      chapterTitle,
      subtitle,
      subtitleIndex,
      totalSubtitles,
      sectionLabel,
    }: {
      chapterTitle: string;
      subtitle: string;
      subtitleIndex: number;
      totalSubtitles: number;
      sectionLabel: string;
    } = await request.json();

    const originalText = ((project as any).originalText as string | null) ?? "";
    const writingStyle = (project as any).writingStyle as string | null ?? "professional";

    const prompt = `한국의 전문 전자책 작가입니다.
챕터: ${sectionLabel} "${chapterTitle}"
소제목 (${subtitleIndex + 1}/${totalSubtitles}): ${subtitle}

작성 기준:
- 분량: 900~1,100자
- 구체적 사례와 불렛 포인트 포함
- 문체: ${styleDescriptions[writingStyle] ?? styleDescriptions.professional}
- 한국 플랫폼(인스타그램, 유튜브, 카카오톡, 네이버, 쿠팡) 사례 포함
- 2026년 AI·숏폼·1인 창작 경제 트렌드 반영
- 모든 문장은 완전하게 마무리

참고 자료:
${originalText.slice(0, 800)}

"### ${subtitle}" 헤더부터 시작해서 마크다운으로만 출력하라.`;

    console.log(`[SUBTITLE] "${subtitle}" 생성 시작`);

    const client = new Anthropic({ apiKey: apiKey.trim(), timeout: 25000 });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const section = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    console.log(`[SUBTITLE] "${subtitle}" 완료 — ${section.length}자`);

    return NextResponse.json({ section });
  } catch (error) {
    console.error("[SUBTITLE] 생성 실패:", error);
    return NextResponse.json(
      { message: "소제목 생성 실패", detail: String(error) },
      { status: 500 }
    );
  }
}
