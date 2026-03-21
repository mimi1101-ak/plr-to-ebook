import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/debug/supabase
 * Supabase Storage 연결 상태 진단 엔드포인트.
 * 배포 환경에서 문제를 확인한 뒤 이 파일은 삭제하세요.
 */
export async function GET() {
  const result: Record<string, unknown> = {};

  // 1. 환경변수 존재 여부 (값은 노출하지 않고 prefix만)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  result.env = {
    NEXT_PUBLIC_SUPABASE_URL: url ? url : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? anonKey.slice(0, 16) + "…" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? serviceKey.slice(0, 16) + "…" : "MISSING",
  };

  if (!url || !serviceKey) {
    return NextResponse.json({ ...result, error: "필수 환경변수 누락" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey);

  // 2. 버킷 목록 조회
  try {
    const { data: buckets, error } = await admin.storage.listBuckets();
    if (error) {
      result.listBuckets = { ok: false, error: error.message, raw: JSON.stringify(error) };
    } else {
      result.listBuckets = {
        ok: true,
        buckets: buckets.map((b) => ({ id: b.id, name: b.name, public: b.public })),
      };
    }
  } catch (e) {
    result.listBuckets = { ok: false, error: String(e) };
  }

  // 3. plr-files 버킷 내 파일 목록 (루트)
  try {
    const { data: files, error } = await admin.storage.from("plr-files").list("", { limit: 5 });
    if (error) {
      result.listFiles = { ok: false, error: error.message, raw: JSON.stringify(error) };
    } else {
      result.listFiles = { ok: true, count: files.length, files: files.map((f) => f.name) };
    }
  } catch (e) {
    result.listFiles = { ok: false, error: String(e) };
  }

  // 4. 1바이트 테스트 업로드
  try {
    const testPath = `_debug/connection-test-${Date.now()}.txt`;
    const { data, error } = await admin.storage
      .from("plr-files")
      .upload(testPath, Buffer.from("ok"), { contentType: "text/plain", upsert: true });

    if (error) {
      result.testUpload = { ok: false, error: error.message, raw: JSON.stringify(error) };
    } else {
      result.testUpload = { ok: true, path: data.path };
      // 테스트 파일 정리
      await admin.storage.from("plr-files").remove([testPath]);
    }
  } catch (e) {
    result.testUpload = { ok: false, error: String(e) };
  }

  const allOk =
    (result.listBuckets as any)?.ok &&
    (result.testUpload as any)?.ok;

  return NextResponse.json({ ...result, allOk }, { status: allOk ? 200 : 500 });
}
