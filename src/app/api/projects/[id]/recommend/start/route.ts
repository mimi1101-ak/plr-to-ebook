import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/projects/[id]/recommend/start
 * Job 생성 후 즉시 jobId 반환.
 * 실제 AI 호출은 /recommend/titles → /recommend/toc 순으로 프론트에서 직접 호출.
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
    data: { type: "recommend", projectId: params.id, status: "running" },
  });

  console.log(`[RECOMMEND/START] Job 생성 — jobId: ${job.id}`);
  return NextResponse.json({ jobId: job.id });
}
