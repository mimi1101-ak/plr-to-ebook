import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseDb } from "@/lib/safe-parse";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/analyze/run
 * Body: { jobId: string }
 * 1단계: 요약만 생성 (max_tokens: 180 → ~2s)
 * 완료 후 Job.status = "summary_done"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let jobId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    jobId = body.jobId as string | undefined;

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });
    }

    // 이미 완료된 Job이면 스킵
    if (jobId) {
      const existing = safeParseDb<Record<string, unknown>>(
        (project as any).analysisData as string | null, {}
      );
      if (existing.status === "summary_done" || existing.status === "done") {
        return NextResponse.json({ done: true });
      }
      await prisma.job.update({ where: { id: jobId }, data: { status: "running" } }).catch(() => {});
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await markFailed(params.id, jobId, "ANTHROPIC_API_KEY 없음");
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const originalText = ((project as any).originalText as string | null) ?? "";
    const textSample = originalText.slice(0, 1500);

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 180,
      messages: [{
        role: "user",
        content: `아래 PLR 원고를 200자 이내로 요약해주세요. 핵심 주제만. 요약문만 출력, 부연 설명 없이.\n\n${textSample}`,
      }],
    });

    const summary = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Job + project 동시 업데이트
    await Promise.all([
      jobId
        ? prisma.job.update({
            where: { id: jobId },
            data: { status: "summary_done", result: JSON.stringify({ summary }) },
          })
        : Promise.resolve(),
      prisma.project.update({
        where: { id: params.id },
        data: { analysisData: JSON.stringify({ status: "summary_done", summary }) } as any,
      }),
    ]);

    console.log(`[ANALYZE/RUN] 요약 완료 — ${summary.length}자`);
    return NextResponse.json({ done: true });
  } catch (error) {
    console.error("[ANALYZE/RUN] 오류:", error);
    await markFailed(params.id, jobId, String(error));
    return NextResponse.json({ message: String(error) }, { status: 500 });
  }
}

async function markFailed(projectId: string, jobId: string | undefined, error: string) {
  await Promise.all([
    jobId
      ? prisma.job.update({ where: { id: jobId }, data: { status: "failed", error } }).catch(() => {})
      : Promise.resolve(),
    prisma.project.update({
      where: { id: projectId },
      data: { analysisData: JSON.stringify({ status: "failed", error }) } as any,
    }).catch(() => {}),
  ]);
}
