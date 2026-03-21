import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch {
    return NextResponse.json({ message: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { ebookTitle, ebookContent, tocData } = body;

    const data: Record<string, unknown> = {};
    if (ebookTitle !== undefined) data.ebookTitle = ebookTitle;
    if (tocData !== undefined) data.tocData = tocData;
    if (ebookContent !== undefined) {
      data.ebookContent = ebookContent;
      data.wordCount = ebookContent.length;
      data.pageCount = Math.ceil(ebookContent.length / 600);
    }

    await prisma.project.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "저장에 실패했습니다." }, { status: 500 });
  }
}
