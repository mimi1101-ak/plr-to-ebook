import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/projects/[id]/analyze
 * 분석 작업을 "processing" 상태로 초기화하고 jobId를 즉시 반환.
 * 실제 Claude 호출은 /analyze/run 에서 수행.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.project.update({
    where: { id: params.id },
    data: { analysisData: JSON.stringify({ status: "processing" }) } as any,
  });

  console.log(`[ANALYZE] 작업 초기화 — ${params.id}`);
  return NextResponse.json({ jobId: params.id });
}
