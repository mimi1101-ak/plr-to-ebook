import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: "변환 대기 중...",
  PROCESSING: "AI가 콘텐츠를 재작성 중입니다...",
  COMPLETED: "전자책 생성이 완료되었습니다!",
  FAILED: "변환에 실패했습니다.",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: {
        status: true,
        progress: true,
        ebookTitle: true,
        ebookFileUrl: true,
        pageCount: true,
        wordCount: true,
        errorMessage: true,
      },
    });

    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      status: project.status,
      progress: project.progress,
      message: STATUS_MESSAGES[project.status] ?? "",
      ebookTitle: project.ebookTitle,
      ebookFileUrl: project.ebookFileUrl,
      pageCount: project.pageCount,
      wordCount: project.wordCount,
      errorMessage: project.errorMessage,
    });
  } catch (error) {
    console.error("Status fetch error:", error);
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  }
}
