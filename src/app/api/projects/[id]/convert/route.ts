import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

async function updateProgress(projectId: string, progress: number) {
  await prisma.project.update({
    where: { id: projectId },
    data: { progress },
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });

  if (!project) {
    return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (project.status === "PROCESSING" || project.status === "COMPLETED") {
    return NextResponse.json({ message: "이미 처리 중이거나 완료된 프로젝트입니다." });
  }

  await prisma.project.update({
    where: { id: params.id },
    data: { status: "PROCESSING", progress: 5 },
  });

  convertInBackground(params.id, project).catch(async (error) => {
    console.error("Conversion background error:", error);
    await prisma.project.update({
      where: { id: params.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "알 수 없는 오류",
      },
    });
  });

  return NextResponse.json({ message: "변환이 시작되었습니다." });
}

/**
 * max_tokens에 걸려 응답이 잘릴 경우 이어서 생성하는 래퍼.
 * stop_reason === "max_tokens"이면 assistant prefill 방식으로 최대 maxContinuations회 이어쓰기.
 */
async function callWithContinuation(
  client: Anthropic,
  prompt: string,
  maxTokensPerCall = 64000,
  maxContinuations = 4
): Promise<string> {
  type Msg = { role: "user" | "assistant"; content: string };
  let messages: Msg[] = [{ role: "user", content: prompt }];
  let fullText = "";

  for (let i = 0; i <= maxContinuations; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokensPerCall,
      messages,
    });

    const chunk =
      response.content[0].type === "text" ? response.content[0].text : "";
    fullText += chunk;

    console.log(
      `[CONVERT] ${i === 0 ? "초기 생성" : `${i}번째 이어쓰기`} 완료 — ` +
        `${chunk.length}자 추가, 누적 ${fullText.length}자, stop_reason: ${response.stop_reason}`
    );

    if (response.stop_reason !== "max_tokens") break;

    if (i < maxContinuations) {
      console.log(`[CONVERT] max_tokens 도달 — ${i + 1}번째 이어쓰기 시작`);
      // 기존 응답을 assistant prefill로 붙여서 이어쓰기
      messages = [
        { role: "user", content: prompt },
        { role: "assistant", content: fullText },
      ];
    }
  }

  return fullText;
}

async function convertInBackground(projectId: string, project: any) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  const client = new Anthropic({ apiKey: apiKey.trim() });

  try {
    await updateProgress(projectId, 10);

    // 1. DB에서 업로드 시 추출된 원문 텍스트 읽기
    const originalText = (project as any).originalText as string | null;
    if (!originalText) {
      throw new Error("원문 텍스트가 없습니다. 파일을 다시 업로드해 주세요.");
    }
    console.log(`[CONVERT] originalText 로드 완료 — ${originalText.length}자`);

    await updateProgress(projectId, 25);

    // 2. 문체·형식 설명
    const styleDescriptions: Record<string, string> = {
      professional:
        "명확하고 격식 있는 비즈니스 문체로 작성하세요. 전문 용어를 적절히 활용하되 독자가 이해하기 쉽게 설명합니다.",
      casual:
        "친근하고 대화하듯 편안한 문체로 작성하세요. 독자에게 직접 말하는 것처럼 편안하게 서술합니다.",
      academic:
        "학술적이고 체계적인 문체로 작성하세요. 근거와 논리를 중심으로 객관적으로 서술하며 통계나 데이터를 포함합니다.",
      storytelling:
        "이야기처럼 흥미롭게 서술하세요. 실제 사례와 비유를 풍부하게 활용하여 독자의 몰입을 유도합니다.",
    };

    const tocDescriptions: Record<string, string> = {
      numbered: "목차는 번호형(1. 2. 3.)으로 작성하세요.",
      bulleted: "목차는 글머리표(•) 형식으로 작성하세요.",
      none: "별도의 목차 섹션 없이 작성하세요.",
    };

    const sentenceDescriptions: Record<string, string> = {
      short: "문장을 짧고 간결하게 씁니다. 한 문장이 15자 내외가 되도록 합니다.",
      medium: "적당한 길이의 문장을 씁니다. 한 문장이 30자 내외가 되도록 합니다.",
      long: "풍부한 설명이 담긴 문장을 씁니다. 한 문장이 50자 내외가 되도록 합니다.",
    };

    await updateProgress(projectId, 35);

    // 3. 확정 목차 파싱 (있을 경우)
    let confirmedToc: { bookTitle: string; sections: Array<{ type: string; number?: number; title: string; subtitles: string[] }> } | null = null;
    if (project.tocData) {
      try {
        confirmedToc = JSON.parse(project.tocData as string);
      } catch {
        console.warn("[CONVERT] tocData 파싱 실패, 자동 생성으로 진행");
      }
    }

    // 확정 목차 → 마크다운 목차 문자열 구성
    let tocSection = "";
    let structureGuide = "";
    if (confirmedToc) {
      const bookTitle = confirmedToc.bookTitle;
      const tocLines = confirmedToc.sections.map((s) => {
        if (s.type === "prologue") return `- 프롤로그: ${s.title}`;
        if (s.type === "appendix") return `- 부록: ${s.title}`;
        return `- ${s.number}장. ${s.title}`;
      });
      tocSection = `## 확정된 목차 (반드시 이 구조 그대로 작성)\n책 제목: ${bookTitle}\n${tocLines.join("\n")}`;

      const structureLines = confirmedToc.sections.map((s) => {
        const label =
          s.type === "prologue" ? "프롤로그" : s.type === "appendix" ? "부록" : `${s.number}장`;
        const subList = s.subtitles.map((st) => `  - ### ${st}`).join("\n");
        return `### ${label}: ${s.title}\n${subList}`;
      });
      structureGuide = `## 각 장별 소제목 구조 (반드시 이 소제목을 사용)\n${structureLines.join("\n\n")}`;
    }

    // 4. Claude API 호출 — 이어쓰기 포함
    const prompt = `당신은 한국의 전문 전자책 작가입니다. 아래 원본 PLR 콘텐츠를 바탕으로 완성도 높은 한국어 전자책을 작성해주세요.

## 분량 및 구성 목표 (목표치에 맞춰 충분히 작성하세요 — 최소치가 아닌 목표치 기준)
1. **챕터 수**: 8~12챕터 작성. **목표: 10챕터**
2. **챕터당 분량**: 4,000~6,000자. **목표: 5,500자**
3. **전체 분량**: **목표: 55,000자 이상**
4. **소제목**: 챕터당 ### 소제목 3개 이상 사용

## 작성 품질 기준 (반드시 준수)
- **출력 형식**: 마크다운(.md)만 사용. JSON 절대 금지.
- **충분한 서술**: 각 소제목 아래에 구체적인 사례, 실제 예시, 불렛 포인트(- 항목)를 풍부하게 포함하세요. 단순 나열이 아니라 맥락과 설명을 충분히 작성합니다.
- **완전한 문장**: 모든 문장은 반드시 완전하게 끝내야 합니다. 문장이 중간에 끊기면 안 됩니다.
- **챕터 마무리**: 각 챕터의 마지막 소제목 본문이 끝난 뒤, 별도 서식(blockquote, 제목 등) 없이 일반 문장으로 다음 챕터로 자연스럽게 이어지는 한두 문장을 작성하세요. "다음 챕터에서는 ~" 식의 연결 문장이 적절합니다.
- **문체**: ${styleDescriptions[project.writingStyle] ?? styleDescriptions.professional}
- **문장 길이**: ${sentenceDescriptions[project.sentenceStructure] ?? sentenceDescriptions.medium}
- **한국 현지화**:
  - 한국 독자에게 익숙한 사례와 예시를 반드시 사용
  - 외래어 남발 금지, 영어 단어는 한국어로 풀어 설명
  - 인스타그램, 유튜브, 카카오톡, 네이버, 쿠팡 등 한국 플랫폼 사례 포함
  - 한국 시장 기준 통계와 데이터 우선 인용
- **2026 트렌드 반영**:
  - AI 활용, 숏폼 콘텐츠, 1인 창작 경제 등 최신 키워드 반영
  - 구시대적 사례 배제, 2026년 기준 최신 트렌드 반영
  - 퍼스널 브랜딩, 알고리즘 최적화, 디지털 자동화 등 현재 키워드 활용

## 형식 지침
- ${tocDescriptions[project.tocFormat] ?? tocDescriptions.numbered}
- 전문적이고 자연스러운 한국어 사용

${tocSection}

${structureGuide}

## 출력 마크다운 구조 (이 형식을 정확히 따르세요)

# [전자책 제목]

## 목차
프롤로그: [제목]
1장. [챕터 1 제목]
2장. [챕터 2 제목]
...
부록: [제목]

---

## 프롤로그: [제목]

### [소제목 1]
[본문 내용 — 구체적 사례·예시·불렛 포인트 포함, 충분히 서술]

### [소제목 2]
[본문 내용]

### [소제목 3]
[본문 내용]

[다음 장으로 자연스럽게 이어지는 한두 문장]

---

## 1장. [챕터 1 제목]

### [소제목 1-1]
[본문 내용 — 구체적 사례·예시·불렛 포인트 포함, 충분히 서술]

### [소제목 1-2]
[본문 내용]

### [소제목 1-3]
[본문 내용]

[마지막 소제목 본문 끝. 이어서 다음 챕터로 자연스럽게 연결되는 한두 문장을 일반 텍스트로 작성.]

---

## 부록: [제목]
(위와 동일한 구조로 모든 장 완성. 각 챕터마다 목표 5,500자를 채우세요.)

---

## 원본 PLR 콘텐츠
${originalText.slice(0, 12000)}`;

    await updateProgress(projectId, 45);

    // 이어쓰기 포함 생성 (max_tokens 도달 시 자동으로 이어씀)
    const ebookContent = await callWithContinuation(client, prompt);

    await updateProgress(projectId, 85);

    if (!ebookContent) {
      throw new Error("AI 응답이 비어있습니다.");
    }

    // 4. 제목 추출
    let ebookTitle = project.originalFileName.replace(/\.(docx|pdf)$/i, "");
    const titleMatch = ebookContent.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      ebookTitle = titleMatch[1].trim();
    }

    const wordCount = ebookContent.length;
    const pageCount = Math.ceil(wordCount / 600);

    console.log(`[CONVERT] 최종 완성 — 총 ${wordCount}자, ${pageCount}페이지`);

    await updateProgress(projectId, 95);

    // 5. 결과 저장
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "COMPLETED",
        progress: 100,
        ebookTitle,
        ebookContent,
        wordCount,
        pageCount,
      },
    });
  } catch (error) {
    throw error;
  }
}

