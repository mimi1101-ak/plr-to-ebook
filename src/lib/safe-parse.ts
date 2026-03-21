/**
 * AI 응답에서 JSON을 안전하게 추출·파싱.
 * 마크다운 코드블록, 설명 텍스트 등이 포함되어도 동작.
 */
export function safeParseObject<T = Record<string, unknown>>(raw: string, label: string): T | null {
  if (!raw) return null;
  // 1. 마크다운 코드블록 제거
  const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  // 2. 첫 번째 { ... } 블록 추출 (greedy)
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error(`[${label}] JSON 객체를 찾지 못했습니다. 원문:`, raw.slice(0, 200));
    return null;
  }
  try {
    return JSON.parse(match[0]) as T;
  } catch (e) {
    console.error(`[${label}] JSON.parse 실패:`, e, "원문:", match[0].slice(0, 200));
    return null;
  }
}

export function safeParseArray<T = unknown>(raw: string, label: string): T[] {
  if (!raw) return [];
  const stripped = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  // 1. [ ... ] 블록 추출
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error(`[${label}] JSON 배열을 찾지 못했습니다. 원문:`, raw.slice(0, 200));
    return [];
  }
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (e) {
    console.error(`[${label}] JSON.parse 실패:`, e, "원문:", match[0].slice(0, 200));
    // 잘린 JSON — 완성된 객체들만 추출
    const objects = match[0].match(/\{[^{}]*\}/g) ?? [];
    const results: T[] = [];
    for (const obj of objects) {
      try { results.push(JSON.parse(obj) as T); } catch {}
    }
    if (results.length > 0) {
      console.warn(`[${label}] 잘린 JSON fallback — ${results.length}개 객체 추출`);
    }
    return results;
  }
}

/** DB에 저장된 JSON 문자열을 안전하게 파싱 */
export function safeParseDb<T = unknown>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** AI JSON 전용 프롬프트 접미사 */
export const JSON_ONLY = "\n\n반드시 JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요.";
