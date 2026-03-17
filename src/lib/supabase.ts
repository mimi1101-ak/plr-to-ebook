import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 클라이언트용 (브라우저에서 사용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버용 (서버 액션, API 라우트에서 사용)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const BUCKET_NAME = "plr-files";

export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`파일 업로드 실패: ${error.message}`);

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error) throw new Error(`파일 다운로드 실패: ${error.message}`);

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
