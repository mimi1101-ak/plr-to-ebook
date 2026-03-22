import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseDb } from "@/lib/safe-parse";

// Pro 이상에서 최대 60초 허용 (Hobby는 10초 고정)
export const maxDuration = 60;

const styleDescriptions: Record<string, string> = {
  professional: "명확하고 격식 있는 비즈니스 문체로 작성하세요.",
  casual: "친근하고 대화하듯 편안한 문체로 작성하세요.",
  academic: "학술적이고 체계적인 문체로 작성하세요.",
  storytelling: "이야기처럼 흥미롭게 서술하세요.",
};

/**
 * POST /api/projects/[id]/convert/chapter
 * 챕터 하나를 생성하고 DB에 저장 후 즉시 반환.
 * max_tokens: 1000 → 생성 시간 ~3-6초 → Vercel 10초 이내.
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
      chapterIndex,
      type,
      number,
      title,
      subtitles,
      totalChapters,
    }: {
      chapterIndex: number;
      type: string;
      number?: number;
      title: string;
      subtitles: string[];
      totalChapters: number;
    } = await request.json();

    const originalText = ((project as any).originalText as string | null) ?? "";
    const sectionLabel =
      type === "prologue" ? "프롤로그" :
      type === "appendix" ? "부록" :
      `${number}장`;

    const subtitleLines =
      subtitles.length > 0
        ? subtitles.map((s) => `\n- ${s}`).join("")
        : "\n(소제목 3개를 자유롭게 구성하세요)";

    const prompt = `한국의 전문 전자책 작가입니다. 전자책의 ${sectionLabel}을 작성해주세요.

## 챕터 정보
- 제목: ${title}
- 소제목 구성:${subtitleLines}

## 작성 기준
- 분량: 4,000~6,000자 (목표: 5,500자)
- 각 소제목(###)마다 구체적 사례와 불렛 포인트 포함
- 문체: ${styleDescriptions[project.writingStyle] ?? styleDescriptions.professional}
- 한국 플랫폼(인스타그램, 유튜브, 카카오톡, 네이버, 쿠팡) 사례 포함
- 2026년 AI·숏폼·1인 창작 경제 트렌드 반영
- 모든 문장은 완전하게 마무리

## 원본 PLR 참고 자료
${originalText.slice(0, 2000)}

## 출력 형식
마크다운만 사용. "## 챕터제목" 헤더는 쓰지 말고 ### 소제목부터 시작.`;

    console.log(`[CHAPTER] ${sectionLabel} "${title}" 생성 시작`);

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    console.log(`[CHAPTER] ${sectionLabel} "${title}" 완료 — ${content.length}자`);

    // 기존 chaptersJson에 추가
    const existing = safeParseDb<any[]>((project as any).chaptersJson as string | null, []);
    existing[chapterIndex] = { index: chapterIndex, type, number, title, content };

    const progress = Math.round(((chapterIndex + 1) / totalChapters) * 90);

    await prisma.project.update({
      where: { id: params.id },
      data: {
        chaptersJson: JSON.stringify(existing),
        progress,
      },
    });

    return NextResponse.json({ content, chapterIndex, progress });
  } catch (error) {
    console.error("[CHAPTER] 생성 실패:", error);
    return NextResponse.json(
      { message: "챕터 생성 실패", detail: String(error) },
      { status: 500 }
    );
  }
}
