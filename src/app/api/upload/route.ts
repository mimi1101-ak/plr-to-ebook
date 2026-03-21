import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueFileName, MAX_FILE_SIZE } from "@/lib/utils";

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
    const contentType = isDocx
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
    const uniqueFileName = generateUniqueFileName(file.name);
    console.log(`[UPLOAD] fileType=${fileType}, uniqueFileName=${uniqueFileName}`);

    // 4. Buffer 변환
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
      console.log(`[UPLOAD] Buffer 변환 완료: ${buffer.length} bytes`);
    } catch (e) {
      console.error("[UPLOAD] Buffer 변환 실패:", e);
      return NextResponse.json({ message: "파일 읽기에 실패했습니다.", detail: String(e) }, { status: 500 });
    }

    // 5. Supabase Storage 업로드
    console.log("[UPLOAD] Supabase 업로드 시도...");
    let fileUrl: string;
    try {
      const { uploadFile } = await import("@/lib/supabase");
      fileUrl = await uploadFile(buffer, `originals/${uniqueFileName}`, contentType);
      console.log(`[UPLOAD] Supabase 업로드 성공: ${fileUrl}`);
    } catch (e) {
      console.error("[UPLOAD] Supabase 업로드 실패:", e);
      return NextResponse.json(
        { message: "파일 업로드에 실패했습니다.", detail: String(e) },
        { status: 500 }
      );
    }

    // 6. DB에 프로젝트 생성
    console.log("[UPLOAD] DB 프로젝트 생성 중...");
    let project: Awaited<ReturnType<typeof prisma.project.create>>;
    try {
      project = await prisma.project.create({
        data: {
          originalFileName: file.name,
          originalFileUrl: fileUrl,
          fileType,
          fileSize: file.size,
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
      fileUrl,
      fileSize: file.size,
      fileType,
    });
  } catch (error) {
    console.error("[UPLOAD] 예상치 못한 오류:", error);
    return NextResponse.json(
      { message: "서버 오류가 발생했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}
