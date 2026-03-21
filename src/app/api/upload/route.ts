import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_FILE_SIZE } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // 1. FormData 파싱
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      console.error("[UPLOAD] FormData 파싱 실패:", e);
      return NextResponse.json({ message: "요청 파싱에 실패했습니다.", detail: String(e) }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ message: "파일이 없습니다." }, { status: 400 });
    }

    console.log(`[UPLOAD] 파일 수신: name=${file.name}, size=${file.size}, type="${file.type}"`);

    // 2. 파일 크기 검사
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "파일 크기가 50MB를 초과합니다." }, { status: 400 });
    }

    // 3. 파일 형식 검사
    const fileName = file.name.toLowerCase();
    const isDocx =
      fileName.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isPdf = fileName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isDocx && !isPdf) {
      return NextResponse.json({ message: ".docx 또는 .pdf 파일만 지원합니다." }, { status: 400 });
    }

    const fileType = isDocx ? "docx" : "pdf";

    // 4. Buffer 변환
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
      console.log(`[UPLOAD] Buffer 변환 완료: ${buffer.length} bytes`);
    } catch (e) {
      console.error("[UPLOAD] Buffer 변환 실패:", e);
      return NextResponse.json({ message: "파일 읽기에 실패했습니다.", detail: String(e) }, { status: 500 });
    }

    // 5. 메모리에서 텍스트 추출 (파일 저장 없음)
    console.log(`[UPLOAD] 텍스트 추출 시작 (${fileType})`);
    let originalText = "";
    try {
      if (isDocx) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        originalText = result.value.trim();
      } else {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        originalText = data.text.trim();
      }
      console.log(`[UPLOAD] 텍스트 추출 완료: ${originalText.length}자`);
    } catch (e) {
      console.error("[UPLOAD] 텍스트 추출 실패:", e);
      return NextResponse.json(
        { message: "파일에서 텍스트를 추출할 수 없습니다. 스캔 이미지 PDF이거나 손상된 파일일 수 있습니다.", detail: String(e) },
        { status: 422 }
      );
    }

    if (!originalText) {
      return NextResponse.json(
        { message: "파일에서 텍스트를 추출할 수 없습니다. 텍스트 레이어가 없는 파일입니다." },
        { status: 422 }
      );
    }

    // 6. DB에 프로젝트 생성 (텍스트 포함, 파일 URL 없음)
    console.log("[UPLOAD] DB 프로젝트 생성 중...");
    let project: Awaited<ReturnType<typeof prisma.project.create>>;
    try {
      project = await prisma.project.create({
        data: {
          originalFileName: file.name,
          originalFileUrl: "",
          fileType,
          fileSize: file.size,
          originalText,
          status: "PENDING",
        },
      });
      console.log(`[UPLOAD] DB 프로젝트 생성 완료: id=${project.id}`);
    } catch (e) {
      console.error("[UPLOAD] DB 프로젝트 생성 실패:", e);
      return NextResponse.json(
        { message: "프로젝트 생성에 실패했습니다.", detail: String(e) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      projectId: project.id,
      fileName: file.name,
      fileSize: file.size,
      fileType,
      textLength: originalText.length,
    });
  } catch (error) {
    console.error("[UPLOAD] 예상치 못한 오류:", error);
    return NextResponse.json(
      { message: "서버 오류가 발생했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}
