import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseArray, safeParseDb, JSON_ONLY } from "@/lib/safe-parse";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/analyze/targets
 * Body: { jobId: string }
 * 2단계: 타겟층 생성 (max_tokens: 420 → ~4s)
 * 완료 후 Job.status = "done"
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

    // 이미 완료됐으면 스킵
    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (job?.status === "done") return NextResponse.json({ done: true });
    }

    const analysisData = safeParseDb<Record<string, unknown>>(
      (project as any).analysisData as string | null, {}
    );
    const summary = (analysisData.summary as string) ?? "";
    if (!summary) {
      await markFailed(params.id, jobId, "요약 없음 — /analyze/run 먼저 호출하세요");
      return NextResponse.json({ message: "요약 없음" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await markFailed(params.id, jobId, "ANTHROPIC_API_KEY 없음");
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 420,
      messages: [{
        role: "user",
        content: `아래 내용의 전자책을 구매할 타겟층 3개를 JSON 배열로만 출력하라. 다른 텍스트 없이 배열만.

내용: "${summary}"

출력 형식:
[{"name":"타겟층명","characteristics":"특징(40자)","needs":"핵심니즈(35자)","purchaseMotivation":"구매동기(35자)"},{"name":"...","characteristics":"...","needs":"...","purchaseMotivation":"..."},{"name":"...","characteristics":"...","needs":"...","purchaseMotivation":"..."}]${JSON_ONLY}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const targetAudiences = safeParseArray(raw, "ANALYZE/TARGETS");

    if (targetAudiences.length === 0) {
      throw new Error("타겟층 파싱 실패: " + raw.slice(0, 100));
    }

    const finalResult = { summary, targetAudiences };

    await Promise.all([
      jobId
        ? prisma.job.update({
            where: { id: jobId },
            data: { status: "done", result: JSON.stringify(finalResult) },
          })
        : Promise.resolve(),
      prisma.project.update({
        where: { id: params.id },
        data: { analysisData: JSON.stringify({ status: "done", ...finalResult }) } as any,
      }),
    ]);

    console.log(`[ANALYZE/TARGETS] 완료 — 타겟층 ${targetAudiences.length}개`);
    return NextResponse.json({ done: true });
  } catch (error) {
    console.error("[ANALYZE/TARGETS] 오류:", error);
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
