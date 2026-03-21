import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/debug/supabase
 * Supabase Storage 연결 상태 진단 엔드포인트.
 * 문제 확인 후 이 파일은 삭제하세요.
 */
export async function GET() {
  const result: Record<string, unknown> = {};

  // 1. 환경변수 확인
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  function keyInfo(key: string) {
    if (!key) return "❌ MISSING";
    let format = "unknown";
    if (key.startsWith("sb_secret_")) format = "sb_secret_ (new)";
    else if (key.startsWith("sb_publishable_")) format = "sb_publishable_ (new)";
    else if (key.startsWith("eyJ")) format = "JWT (classic)";
    return `✅ set | format: ${format} | prefix: ${key.slice(0, 20)}…`;
  }

  result.env = {
    NEXT_PUBLIC_SUPABASE_URL: url || "❌ MISSING",
    SUPABASE_SERVICE_ROLE_KEY: keyInfo(serviceKey),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keyInfo(anonKey),
  };

  if (!url || !serviceKey) {
    return NextResponse.json(
      { ...result, verdict: "❌ 필수 환경변수 누락 — Vercel Settings > Environment Variables 확인" },
      { status: 500 }
    );
  }

  // 2. admin 클라이언트 (서버용, auth 비활성화)
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  });

  // 3. 버킷 목록
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) {
      result.listBuckets = {
        ok: false,
        error: error.message,
        statusCode: (error as any).statusCode,
        raw: JSON.stringify(error),
        hint: error.message.includes("Invalid JWT") || error.message.includes("invalid")
          ? "키 형식 또는 권한 문제. Supabase 대시보드에서 service_role 키를 재발급하세요."
          : undefined,
      };
    } else {
      result.listBuckets = {
        ok: true,
        count: data.length,
        buckets: data.map((b) => ({ name: b.name, public: b.public, id: b.id })),
        hasPlrFiles: data.some((b) => b.name === "plr-files"),
      };
    }
  } catch (e) {
    result.listBuckets = { ok: false, error: String(e) };
  }

  // 4. plr-files 버킷 파일 목록
  try {
    const { data, error } = await admin.storage.from("plr-files").list("originals", { limit: 5 });
    if (error) {
      result.listFiles = {
        ok: false,
        error: error.message,
        statusCode: (error as any).statusCode,
        raw: JSON.stringify(error),
      };
    } else {
      result.listFiles = { ok: true, count: data.length, sample: data.map((f) => f.name) };
    }
  } catch (e) {
    result.listFiles = { ok: false, error: String(e) };
  }

  // 5. 1바이트 테스트 업로드
  try {
    const testPath = `_debug/connection-test-${Date.now()}.txt`;
    const { data, error } = await admin.storage
      .from("plr-files")
      .upload(testPath, Buffer.from("ok"), { contentType: "text/plain", upsert: true });

    if (error) {
      result.testUpload = {
        ok: false,
        error: error.message,
        statusCode: (error as any).statusCode,
        name: error.name,
        raw: JSON.stringify(error),
        hint:
          error.message === "Bucket not found"
            ? "plr-files 버킷이 없습니다. Supabase Storage에서 버킷을 생성하세요."
            : error.message.includes("row-level") || error.message.includes("RLS")
            ? "RLS 정책이 업로드를 막고 있습니다. Supabase Storage > Policies 확인"
            : error.message.includes("Invalid") || error.message.includes("JWT")
            ? "인증 실패. service_role 키가 올바른지 확인하세요."
            : undefined,
      };
    } else {
      result.testUpload = { ok: true, path: data.path };
      await admin.storage.from("plr-files").remove([testPath]);
    }
  } catch (e) {
    result.testUpload = { ok: false, error: String(e) };
  }

  const allOk =
    (result.listBuckets as any)?.ok &&
    (result.listBuckets as any)?.hasPlrFiles &&
    (result.testUpload as any)?.ok;

  const verdict = allOk
    ? "✅ Supabase Storage 정상"
    : !(result.listBuckets as any)?.ok
    ? "❌ 버킷 목록 조회 실패 — 키 또는 URL 문제"
    : !(result.listBuckets as any)?.hasPlrFiles
    ? "❌ plr-files 버킷 없음 — Supabase Storage에서 버킷 생성 필요"
    : "❌ 테스트 업로드 실패 — 로그의 hint 참고";

  return NextResponse.json({ ...result, verdict }, { status: allOk ? 200 : 500 });
}
