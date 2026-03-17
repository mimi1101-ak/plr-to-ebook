import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateUniqueFileName, MAX_FILE_SIZE } from "@/lib/utils";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "파일이 없습니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "파일 크기가 50MB를 초과합니다." },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isDocx =
      fileName.endsWith(".docx") ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isPdf = fileName.endsWith(".pdf") || file.type === "application/pdf";

    if (!isDocx && !isPdf) {
      return NextResponse.json(
        { message: ".docx 또는 .pdf 파일만 지원합니다." },
        { status: 400 }
      );
    }

    const fileType = isDocx ? "docx" : "pdf";
    const uniqueFileName = generateUniqueFileName(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    let fileUrl = `/uploads/${uniqueFileName}`;

    const useSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== "your-supabase-url-here";

    if (useSupabase) {
      try {
        const { uploadFile } = await import("@/lib/supabase");
        fileUrl = await uploadFile(buffer, `originals/${uniqueFileName}`, file.type);
      } catch (storageError) {
        console.warn("Supabase 업로드 실패, 로컬 저장으로 전환:", storageError);
        await saveLocal(buffer, uniqueFileName);
        fileUrl = `/uploads/${uniqueFileName}`;
      }
    } else {
      // Supabase 미설정: 로컬 디스크에 저장
      await saveLocal(buffer, uniqueFileName);
    }

    const project = await prisma.project.create({
      data: {
        originalFileName: file.name,
        originalFileUrl: fileUrl,
        fileType,
        fileSize: file.size,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      projectId: project.id,
      fileName: file.name,
      fileUrl,
      fileSize: file.size,
      fileType,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

async function saveLocal(buffer: Buffer, uniqueFileName: string) {
  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, uniqueFileName), buffer);
}
