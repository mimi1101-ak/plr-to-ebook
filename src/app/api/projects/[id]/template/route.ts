import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { writingStyle, tocFormat, sentenceStructure } = await request.json();

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { writingStyle, tocFormat, sentenceStructure },
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("Template update error:", error);
    return NextResponse.json(
      { message: "설정 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
