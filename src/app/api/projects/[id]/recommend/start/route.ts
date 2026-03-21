import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/projects/[id]/recommend/start
 * 제목/목차 추천 Job을 생성하고 즉시 jobId 반환.
 * 실제 Claude 호출은 /recommend/titles → /recommend/toc 에서 수행.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  const job = await prisma.job.create({
    data: { type: "recommend", projectId: params.id, status: "pending" },
  });

  console.log(`[RECOMMEND/START] Job 생성 — jobId: ${job.id}`);
  return NextResponse.json({ jobId: job.id });
}
