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
  console.log(`[SUPABASE] uploadFile 시작`);
  console.log(`[SUPABASE]   url     : ${supabaseUrl ?? "MISSING"}`);
  console.log(`[SUPABASE]   key     : ${supabaseServiceKey ? supabaseServiceKey.slice(0, 16) + "…" : "MISSING"}`);
  console.log(`[SUPABASE]   bucket  : ${BUCKET_NAME}`);
  console.log(`[SUPABASE]   path    : ${fileName}`);
  console.log(`[SUPABASE]   size    : ${file.length} bytes`);
  console.log(`[SUPABASE]   type    : ${contentType}`);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, { contentType, upsert: true });

  if (error) {
    console.error(`[SUPABASE] upload error:`);
    console.error(`[SUPABASE]   message   : ${error.message}`);
    console.error(`[SUPABASE]   name      : ${error.name}`);
    console.error(`[SUPABASE]   status    : ${(error as any).statusCode ?? (error as any).status ?? "N/A"}`);
    console.error(`[SUPABASE]   raw       : ${JSON.stringify(error)}`);
    throw new Error(`Supabase 업로드 실패 [${(error as any).statusCode ?? "?"}] ${error.message}`);
  }

  console.log(`[SUPABASE] upload 성공: path=${data.path}`);

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  console.log(`[SUPABASE] publicUrl: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  console.log(`[SUPABASE] downloadFile: ${filePath}`);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error) {
    console.error(`[SUPABASE] download error: ${error.message} | ${JSON.stringify(error)}`);
    throw new Error(`Supabase 다운로드 실패 [${(error as any).statusCode ?? "?"}] ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
