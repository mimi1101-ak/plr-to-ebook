import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/projects/[id]/convert/finish
 * chaptersJson을 읽어 최종 마크다운으로 조립하고 COMPLETED로 저장.
 * AI 호출 없음 → 즉시 반환.
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

    const rawChapters = JSON.parse(
      ((project as any).chaptersJson as string | null) ?? "[]"
    ) as Array<{
      index: number;
      type: string;
      number?: number;
      title: string;
      content: string;
    }>;

    // 인덱스 순서대로 정렬, undefined 슬롯 필터
    const chapters = rawChapters
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);

    if (chapters.length === 0) {
      return NextResponse.json({ message: "생성된 챕터가 없습니다." }, { status: 400 });
    }

    const tocData = project.tocData ? JSON.parse(project.tocData) : null;
    const bookTitle =
      tocData?.bookTitle ??
      project.originalFileName.replace(/\.(docx|pdf)$/i, "");

    // 목차 섹션
    const tocLines = chapters.map((ch) => {
      if (ch.type === "prologue") return `프롤로그: ${ch.title}`;
      if (ch.type === "appendix") return `부록: ${ch.title}`;
      return `${ch.number}장. ${ch.title}`;
    });
    const tocSection = `## 목차\n${tocLines.join("\n")}`;

    // 본문 섹션
    const bodySections = chapters.map((ch) => {
      const header =
        ch.type === "prologue" ? `## 프롤로그: ${ch.title}` :
        ch.type === "appendix" ? `## 부록: ${ch.title}` :
        `## ${ch.number}장. ${ch.title}`;
      return `${header}\n\n${ch.content}`;
    });

    const ebookContent = [
      `# ${bookTitle}`,
      tocSection,
      "---",
      bodySections.join("\n\n---\n\n"),
    ].join("\n\n");

    const wordCount = ebookContent.length;
    const pageCount = Math.ceil(wordCount / 600);

    await prisma.project.update({
      where: { id: params.id },
      data: {
        status: "COMPLETED",
        progress: 100,
        ebookTitle: bookTitle,
        ebookContent,
        wordCount,
        pageCount,
      },
    });

    console.log(`[FINISH] 완성 — "${bookTitle}" ${wordCount}자 ${pageCount}페이지`);
    return NextResponse.json({ ebookTitle: bookTitle, wordCount, pageCount });
  } catch (error) {
    console.error("[FINISH] 오류:", error);
    return NextResponse.json(
      { message: "최종 조립 실패", detail: String(error) },
      { status: 500 }
    );
  }
}
