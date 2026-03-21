import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * POST /api/projects/[id]/recommend/titles
 * 타겟층 기반 제목 10개 생성 (max_tokens: 350 → 한국어 제목 10개 충분)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { targetAudience }: { targetAudience: string } = await request.json();

    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트 없음" }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "ANTHROPIC_API_KEY 없음" }, { status: 500 });
    }

    await prisma.project.update({
      where: { id: params.id },
      data: { targetAudience } as any,
    });

    const analysisData = JSON.parse(((project as any).analysisData as string | null) ?? "{}");
    const summary = (analysisData.summary ?? ((project as any).originalText as string | null ?? "")).slice(0, 300);

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 350,
      messages: [
        {
          role: "user",
          content: `"${targetAudience}" 독자를 위한 전자책 제목 10개를 아래 형식의 JSON 배열로만 출력하라. 다른 텍스트 없이 배열만. 각 제목 20자 이내.

원고 요약: ${summary}

출력 형식:
["제목1","제목2","제목3","제목4","제목5","제목6","제목7","제목8","제목9","제목10"]`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    const titles = parseTitles(raw);

    if (titles.length === 0) {
      throw new Error(`제목 파싱 실패. 원문: ${raw.slice(0, 150)}`);
    }

    console.log(`[RECOMMEND/TITLES] 완료 — ${titles.length}개`);
    return NextResponse.json({ titles });
  } catch (error) {
    console.error("[RECOMMEND/TITLES] 오류:", error);
    return NextResponse.json({ message: "제목 생성 실패", detail: String(error) }, { status: 500 });
  }
}

/**
 * 다양한 형식의 Claude 응답에서 제목 목록을 추출.
 * 1순위: JSON 배열 파싱
 * 2순위: 마크다운 코드블록 내 JSON
 * 3순위: 번호 목록 (1. 제목)
 * 4순위: 따옴표로 감싼 줄 ("제목")
 * 5순위: 불릿 목록 (- 제목)
 * 6순위: 빈 줄 구분 텍스트 (줄당 하나)
 */
function parseTitles(raw: string): string[] {
  // 1. JSON 배열 추출 시도
  const arrMatch = raw.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      // JSON이 잘린 경우 — 따옴표로 감싼 문자열들 직접 추출
      const quoted = arrMatch[0].match(/"([^"]+)"/g);
      if (quoted && quoted.length > 0) {
        return quoted.map((s) => s.replace(/"/g, "").trim()).filter(Boolean);
      }
    }
  }

  // 2. 마크다운 코드블록 내 JSON
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try {
      const parsed = JSON.parse(codeBlock[1].trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {}
  }

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  // 3. 번호 목록: "1. 제목" 또는 "1) 제목"
  const numbered = lines
    .map((l) => l.match(/^\d+[.)]\s*(.+)/))
    .filter(Boolean)
    .map((m) => m![1].replace(/^["']|["']$/g, "").trim());
  if (numbered.length >= 3) return numbered;

  // 4. 따옴표로 감싼 줄: "제목" 또는 '제목'
  const quoted = lines
    .map((l) => l.match(/^["'](.+)["']$/))
    .filter(Boolean)
    .map((m) => m![1].trim());
  if (quoted.length >= 3) return quoted;

  // 5. 불릿 목록: "- 제목" 또는 "• 제목"
  const bullets = lines
    .map((l) => l.match(/^[-•*]\s*(.+)/))
    .filter(Boolean)
    .map((m) => m![1].replace(/^["']|["']$/g, "").trim());
  if (bullets.length >= 3) return bullets;

  // 6. 마지막 수단: 빈 줄 아닌 모든 줄 (숫자·기호 제거)
  const plain = lines
    .map((l) => l.replace(/^[\d.)\-•*\s]+/, "").replace(/^["']|["']$/g, "").trim())
    .filter((l) => l.length > 2 && l.length < 60);
  return plain.slice(0, 10);
}
