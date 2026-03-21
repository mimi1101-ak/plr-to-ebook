import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/projects/[id]/analyze/status
 * 분석 작업 상태를 반환. 프론트에서 폴링용.
 * status: "processing" | "done" | "failed"
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });
  }

  const raw = ((project as any).analysisData as string | null) ?? "{}";
  const data = JSON.parse(raw);

  if (data.status === "done") {
    return NextResponse.json({
      status: "done",
      summary: data.summary ?? "",
      targetAudiences: data.targetAudiences ?? [],
    });
  }

  if (data.status === "failed") {
    return NextResponse.json({ status: "failed", error: data.error ?? "알 수 없는 오류" });
  }

  return NextResponse.json({ status: "processing" });
}
