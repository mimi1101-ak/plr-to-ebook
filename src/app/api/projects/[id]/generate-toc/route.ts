import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseObject, JSON_ONLY } from "@/lib/safe-parse";

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

    const originalText = (project as any).originalText as string | null;
    if (!originalText) {
      return NextResponse.json(
        { message: "원문 텍스트가 없습니다. 파일을 다시 업로드해 주세요." },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: apiKey.trim() });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `당신은 전문 편집자입니다. 아래 PLR 원고를 분석해서 한국어 전자책의 목차를 생성해주세요.

## 목차 구조 요구사항
- 프롤로그 1개 (소제목 3~5개)
- 본문 8~12장 (각 장마다 소제목 3~5개)
- 부록 1개 (소제목 3~5개)

## 출력 형식
{"bookTitle":"책 제목","sections":[{"id":"prologue","type":"prologue","title":"프롤로그 제목","subtitles":["소제목1","소제목2","소제목3"]},{"id":"chapter_1","type":"chapter","number":1,"title":"1장 제목","subtitles":["소제목1","소제목2","소제목3"]},{"id":"appendix","type":"appendix","title":"부록 제목","subtitles":["소제목1","소제목2","소제목3"]}]}

## 원본 PLR 원고
${originalText.slice(0, 8000)}${JSON_ONLY}`,
        },
      ],
    });

    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    const toc = safeParseObject(rawText, "generate-toc");

    if (!toc) {
      return NextResponse.json({ message: "목차 생성에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json(toc);
  } catch (error) {
    console.error("[generate-toc] 오류:", error);
    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
