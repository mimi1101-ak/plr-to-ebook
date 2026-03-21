import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/projects/[id]/analyze/status
 * status: "processing" | "summary_done" | "done" | "failed"
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });
  }

  const data = JSON.parse(((project as any).analysisData as string | null) ?? "{}");

  if (data.status === "done") {
    return NextResponse.json({
      status: "done",
      summary: data.summary ?? "",
      targetAudiences: data.targetAudiences ?? [],
    });
  }
  if (data.status === "summary_done") {
    return NextResponse.json({ status: "summary_done", summary: data.summary ?? "" });
  }
  if (data.status === "failed") {
    return NextResponse.json({ status: "failed", error: data.error ?? "알 수 없는 오류" });
  }

  return NextResponse.json({ status: "processing" });
}
