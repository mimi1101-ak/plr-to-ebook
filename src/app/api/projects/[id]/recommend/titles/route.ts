import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseDb, JSON_ONLY } from "@/lib/safe-parse";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/recommend/titles
 * Body: { jobId: string, targetAudience: string }
 * 제목 10개 생성 후 즉시 반환. job.status = "titles_done"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let jobId: string | undefined;
  try {
    const { targetAudience, jobId: jid }: { targetAudience: string; jobId?: string } =
      await request.json();
    jobId = jid;

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });

    await prisma.project.update({
      where: { id: params.id },
      data: { targetAudience } as any,
    });

    const analysisData = safeParseDb<Record<string, unknown>>(
      (project as any).analysisData as string | null, {}
    );
    const summary = (
      (analysisData.summary as string) ??
      ((project as any).originalText as string | null ?? "")
    ).slice(0, 300);

    const client = new Anthropic({ apiKey: apiKey.trim(), timeout: 45000 });

    console.log(`[RECOMMEND/TITLES] 제목 생성 시작`);
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `"${targetAudience}" 독자를 위한 전자책 제목 10개를 아래 형식의 JSON 배열로만 출력하라. 각 제목 20자 이내.

원고 요약: ${summary}

출력 형식:
["제목1","제목2","제목3","제목4","제목5","제목6","제목7","제목8","제목9","제목10"]${JSON_ONLY}`,
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const titles = parseTitles(raw);

    if (titles.length === 0) {
      console.error("[RECOMMEND/TITLES] 파싱 실패. raw:", raw);
      throw new Error("제목 파싱 실패");
    }

    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "titles_done", result: JSON.stringify({ titles }) },
      }).catch(() => {});
    }

    console.log(`[RECOMMEND/TITLES] 완료 — ${titles.length}개`);
    return NextResponse.json({ titles });
  } catch (error) {
    console.error("[RECOMMEND/TITLES] 오류:", error);
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "failed", error: String(error) },
      }).catch(() => {});
    }
    return NextResponse.json({ message: "제목 생성 실패", detail: String(error) }, { status: 500 });
  }
}

function parseTitles(raw: string): string[] {
  const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const arrMatch = stripped.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0)
        return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch {}
  }
  const lines = stripped.split("\n").map((l) => l.trim()).filter(Boolean);
  const numbered = lines.map((l) => l.match(/^\d+[.)]\s*(.+)/)).filter(Boolean).map((m) => m![1].replace(/^["']|["']$/g, "").trim());
  if (numbered.length >= 3) return numbered;
  return lines.map((l) => l.replace(/^[\d.)\-•*\s]+/, "").replace(/^["']|["']$/g, "").trim()).filter((l) => l.length > 2 && l.length < 60).slice(0, 10);
}
