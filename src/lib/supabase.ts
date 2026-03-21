import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// sb_secret_ 형식(신규) 또는 SUPABASE_SERVICE_ROLE_KEY(구형 JWT) 모두 지원
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function detectKeyFormat(key: string) {
  if (!key) return "MISSING";
  if (key.startsWith("sb_secret_")) return "sb_secret_ (new format)";
  if (key.startsWith("eyJ")) return "JWT (classic format)";
  return `unknown (prefix: ${key.slice(0, 8)}...)`;
}

// 클라이언트용 (브라우저)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버용 — auth 세션 관리 완전 비활성화
// sb_secret_ 형식 키는 JWT가 아니므로 auth 모듈의 토큰 파싱을 건너뜀
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      // apikey + Authorization 헤더를 명시적으로 설정
      // → SDK 내부 자동 주입에 의존하지 않고 직접 지정
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  },
});

export const BUCKET_NAME = "plr-files";

export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  // ── 진단 로그 ──────────────────────────────────────────
  console.log("[SUPABASE:upload] ── 시작 ──────────────────────");
  console.log(`[SUPABASE:upload] url         : ${supabaseUrl || "MISSING"}`);
  console.log(`[SUPABASE:upload] key format  : ${detectKeyFormat(supabaseServiceKey)}`);
  console.log(`[SUPABASE:upload] key prefix  : ${supabaseServiceKey ? supabaseServiceKey.slice(0, 20) + "…" : "MISSING"}`);
  console.log(`[SUPABASE:upload] bucket      : ${BUCKET_NAME}`);
  console.log(`[SUPABASE:upload] path        : ${fileName}`);
  console.log(`[SUPABASE:upload] size        : ${file.length} bytes`);
  console.log(`[SUPABASE:upload] contentType : ${contentType}`);
  // ─────────────────────────────────────────────────────

  // 버킷 존재 여부 사전 확인
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
  if (listErr) {
    console.error(`[SUPABASE:upload] listBuckets 오류: ${listErr.message} | ${JSON.stringify(listErr)}`);
  } else {
    const names = buckets.map((b) => b.name);
    console.log(`[SUPABASE:upload] 버킷 목록(${buckets.length}개): [${names.join(", ")}]`);
    if (!names.includes(BUCKET_NAME)) {
      console.error(`[SUPABASE:upload] ❌ '${BUCKET_NAME}' 버킷이 없습니다! Supabase Storage에서 버킷을 생성하세요.`);
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
    console.error(`[SUPABASE:upload]   status     : ${(error as any).status ?? "N/A"}`);
    console.error(`[SUPABASE:upload]   raw        : ${JSON.stringify(error)}`);
    throw new Error(
      `Supabase 업로드 실패 [${(error as any).statusCode ?? "?"}] ${error.message}`
    );
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  console.log(`[SUPABASE:upload] ✅ 성공: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  console.log(`[SUPABASE:download] path: ${filePath}`);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .download(filePath);

  if (error) {
    console.error(`[SUPABASE:download] ❌ 실패: ${error.message} | statusCode: ${(error as any).statusCode ?? "N/A"} | ${JSON.stringify(error)}`);
    throw new Error(
      `Supabase 다운로드 실패 [${(error as any).statusCode ?? "?"}] ${error.message}`
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  console.log(`[SUPABASE:download] ✅ 성공: ${arrayBuffer.byteLength} bytes`);
  return Buffer.from(arrayBuffer);
}
