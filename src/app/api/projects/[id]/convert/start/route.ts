import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface ChapterTask {
  index: number;
  type: "prologue" | "chapter" | "appendix";
  number?: number;
  title: string;
  subtitles: string[];
}

/**
 * POST /api/projects/[id]/convert/start
 * 챕터 목록을 반환하고 PROCESSING 상태로 초기화.
 * Vercel 함수 실행 없이 즉시 반환.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });

  if (!project) {
    return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (project.status === "COMPLETED") {
    return NextResponse.json({ message: "이미 완료된 프로젝트입니다." }, { status: 400 });
  }

  // tocData에서 챕터 구조 파싱
  let chapters: ChapterTask[] = [];

  if (project.tocData) {
    const toc = JSON.parse(project.tocData);
    chapters = toc.sections.map((s: any, i: number) => ({
      index: i,
      type: s.type,
      number: s.number,
      title: s.title,
      subtitles: s.subtitles ?? [],
    }));
  } else {
    // tocData 없을 때 기본 10챕터 구조
    chapters = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      type: "chapter" as const,
      number: i + 1,
      title: `${i + 1}장`,
      subtitles: [],
    }));
  }

  await prisma.project.update({
    where: { id: params.id },
    data: {
      status: "PROCESSING",
      progress: 0,
      chaptersJson: JSON.stringify([]),
      errorMessage: null,
    },
  });

  console.log(`[START] 프로젝트 ${params.id} — ${chapters.length}개 챕터 초기화`);
  return NextResponse.json({ chapters, totalChapters: chapters.length });
}
