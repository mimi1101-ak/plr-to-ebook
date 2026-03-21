import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project) {
      return NextResponse.json({ message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // 원본 파일 텍스트 추출
    let originalText = "";
    try {
      const buffer = await loadFileBuffer(project.originalFileUrl);
      if (project.fileType === "docx") {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        originalText = result.value.trim();
      } else {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        originalText = data.text.trim();
      }
    } catch (err) {
      console.error("[generate-toc] 파일 추출 실패:", err);
      return NextResponse.json({ message: "파일 텍스트 추출에 실패했습니다." }, { status: 400 });
    }

    if (!originalText) {
      return NextResponse.json({ message: "파일에서 텍스트를 추출할 수 없습니다." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: apiKey.trim() });

    const prompt = `당신은 전문 편집자입니다. 아래 PLR 원고를 분석해서 한국어 전자책의 목차를 생성해주세요.

## 목차 구조 요구사항
- 프롤로그 1개 (소제목 3~5개)
- 본문 8~12장 (각 장마다 소제목 3~5개)
- 부록 1개 (소제목 3~5개)
- 각 장 제목은 핵심 내용을 담은 흥미로운 제목으로
- 소제목은 해당 장에서 다룰 구체적인 내용

## 출력 형식 (반드시 이 JSON 형식만 출력, 설명 텍스트 없음)
{
  "bookTitle": "책 제목",
  "sections": [
    {
      "id": "prologue",
      "type": "prologue",
      "title": "프롤로그 제목",
      "subtitles": ["소제목1", "소제목2", "소제목3"]
    },
    {
      "id": "chapter_1",
      "type": "chapter",
      "number": 1,
      "title": "1장 제목",
      "subtitles": ["소제목1", "소제목2", "소제목3"]
    },
    {
      "id": "appendix",
      "type": "appendix",
      "title": "부록 제목",
      "subtitles": ["소제목1", "소제목2", "소제목3"]
    }
  ]
}

## 원본 PLR 원고
${originalText.slice(0, 8000)}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[generate-toc] JSON 파싱 실패. 원문:", rawText.slice(0, 500));
      return NextResponse.json({ message: "목차 생성에 실패했습니다." }, { status: 500 });
    }

    const toc = JSON.parse(jsonMatch[0]);
    return NextResponse.json(toc);
  } catch (error) {
    console.error("[generate-toc] 오류:", error);
    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

async function loadFileBuffer(fileUrl: string): Promise<Buffer> {
  const { downloadFile } = await import("@/lib/supabase");
  const urlPath = new URL(fileUrl).pathname;
  const filePath = urlPath.split("/plr-files/")[1];
  return downloadFile(filePath);
}
