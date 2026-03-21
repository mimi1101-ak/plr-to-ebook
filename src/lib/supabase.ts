import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ⚠️  반드시 JWT 형식 키(eyJ...)를 사용하세요.
// Supabase 대시보드 → Settings → API → "Legacy anon, service_role API keys" 탭
// → service_role 행의 "Reveal" 클릭 → 복사
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// 클라이언트용 (브라우저)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버용 — 세션 관리 비활성화 (서버사이드에서는 불필요)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

export const BUCKET_NAME = "plr-files";

export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  console.log("[SUPABASE:upload] 시작");
  console.log(`[SUPABASE:upload] url        : ${supabaseUrl || "❌ MISSING"}`);
  console.log(`[SUPABASE:upload] key set    : ${supabaseServiceKey ? "✅ yes" : "❌ MISSING"}`);
  console.log(`[SUPABASE:upload] key format : ${
    !supabaseServiceKey       ? "MISSING" :
    supabaseServiceKey.startsWith("eyJ") ? "✅ JWT (올바른 형식)" :
    supabaseServiceKey.startsWith("sb_secret_") ? "❌ sb_secret_ (잘못된 형식 — Legacy JWT 키를 사용하세요)" :
    `❓ unknown (prefix: ${supabaseServiceKey.slice(0, 10)}…)`
  }`);
  console.log(`[SUPABASE:upload] bucket     : ${BUCKET_NAME}`);
  console.log(`[SUPABASE:upload] path       : ${fileName}`);
  console.log(`[SUPABASE:upload] size       : ${file.length} bytes`);

  // 버킷 존재 여부 사전 확인
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) {
    console.error(`[SUPABASE:upload] listBuckets 실패: ${listErr.message} | ${JSON.stringify(listErr)}`);
  } else {
    const names = buckets.map((b) => b.name);
    console.log(`[SUPABASE:upload] 버킷 목록(${buckets.length}개): [${names.join(", ") || "없음"}]`);
    if (!names.includes(BUCKET_NAME)) {
      console.error(`[SUPABASE:upload] ❌ '${BUCKET_NAME}' 버킷 없음 — Supabase Storage에서 생성하세요`);
    }
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, { contentType, upsert: true });

  if (error) {
    console.error("[SUPABASE:upload] ❌ 업로드 실패");
    console.error(`[SUPABASE:upload]   message    : ${error.message}`);
    console.error(`[SUPABASE:upload]   name       : ${error.name}`);
    console.error(`[SUPABASE:upload]   statusCode : ${(error as any).statusCode ?? "N/A"}`);
    console.error(`[SUPABASE:upload]   raw        : ${JSON.stringify(error)}`);
    throw new Error(`Supabase 업로드 실패 [${(error as any).statusCode ?? "?"}] ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(data.path);
  console.log(`[SUPABASE:upload] ✅ 성공: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  console.log(`[SUPABASE:download] path: ${filePath}`);

  const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(filePath);

  if (error) {
    console.error(`[SUPABASE:download] ❌ 실패: ${error.message} | statusCode: ${(error as any).statusCode ?? "N/A"} | ${JSON.stringify(error)}`);
    throw new Error(`Supabase 다운로드 실패 [${(error as any).statusCode ?? "?"}] ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  console.log(`[SUPABASE:download] ✅ 성공: ${arrayBuffer.byteLength} bytes`);
  return Buffer.from(arrayBuffer);
}
