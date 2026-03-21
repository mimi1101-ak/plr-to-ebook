import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseDb } from "@/lib/safe-parse";

/**
 * GET /api/jobs/[jobId]/status
 * 모든 백그라운드 AI 작업의 공통 폴링 엔드포인트.
 * 반환: { status, result?, error? }
 *
 * status 값:
 *   analyze:   pending → running → summary_done → done | failed
 *   recommend: pending → running → titles_done  → done | failed
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = await prisma.job.findUnique({ where: { id: params.jobId } });
  if (!job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }

  const result = safeParseDb<Record<string, unknown>>(job.result, {});
  return NextResponse.json({
    status: job.status,
    result: Object.keys(result).length > 0 ? result : undefined,
    error: job.error ?? undefined,
  });
}
