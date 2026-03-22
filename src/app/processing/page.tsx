"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";
import type { ChapterTask } from "@/app/api/projects/[id]/convert/start/route";

type Phase = "idle" | "starting" | "generating" | "finishing" | "done" | "failed";

const TIMEOUT_MSG = "처리 시간이 오래 걸리고 있어요. 잠시 후 다시 시도해주세요.";

async function safePost(url: string, body?: object): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch {
      return { ok: false, error: TIMEOUT_MSG };
    }
    if (!res.ok) {
      const isTimeout = res.status === 504 || res.status === 408;
      return { ok: false, error: isTimeout || !data?.message ? TIMEOUT_MSG : data.message };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: TIMEOUT_MSG };
  }
}

export default function ProcessingPage() {
  const router = useRouter();
  const { currentProjectId, uploadedFile } = useAppStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [chapters, setChapters] = useState<ChapterTask[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [doneIndexes, setDoneIndexes] = useState<Set<number>>(new Set());
  const [chapterChars, setChapterChars] = useState<Map<number, number>>(new Map());
  const [failedIndex, setFailedIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const startedRef = useRef(false);
  const chaptersRef = useRef<ChapterTask[]>([]);
  const projectIdRef = useRef<string>("");

  const totalChapters = chapters.length;
  const doneCount = doneIndexes.size;
  const progress =
    phase === "done" ? 100 :
    phase === "finishing" ? 95 :
    totalChapters > 0 ? Math.round((doneCount / totalChapters) * 90) : 0;

  useEffect(() => {
    if (!currentProjectId || startedRef.current) return;
    startedRef.current = true;
    projectIdRef.current = currentProjectId;
    run(currentProjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function run(projectId: string) {
    // 1. start
    setPhase("starting");
    const startResult = await safePost(`/api/projects/${projectId}/convert/start`);
    if (!startResult.ok) {
      setErrorMsg(startResult.error);
      setPhase("failed");
      toast.error(startResult.error);
      return;
    }
    const chapterList: ChapterTask[] = startResult.data.chapters;
    chaptersRef.current = chapterList;
    setChapters(chapterList);

    // 2. 챕터 순차 생성
    const success = await generateChapters(projectId, chapterList, 0);
    if (!success) return;

    // 3. finish
    setPhase("finishing");
    const finishResult = await safePost(`/api/projects/${projectId}/convert/finish`);
    if (!finishResult.ok) {
      setErrorMsg(finishResult.error);
      setPhase("failed");
      toast.error(finishResult.error);
      return;
    }

    setPhase("done");
    toast.success("전자책 생성 완료!");
    setTimeout(() => router.push("/editor"), 800);
  }

  async function generateChapters(projectId: string, chapterList: ChapterTask[], startIndex: number): Promise<boolean> {
    setPhase("generating");
    for (let i = startIndex; i < chapterList.length; i++) {
      const ch = chapterList[i];
      setCurrentIndex(i);

      const result = await safePost(`/api/projects/${projectId}/convert/chapter`, {
        chapterIndex: ch.index,
        type: ch.type,
        number: ch.number,
        title: ch.title,
        subtitles: ch.subtitles,
        totalChapters: chapterList.length,
      });

      if (!result.ok) {
        const msg = `${getSectionLabel(ch)} 생성 실패: ${result.error}`;
        setErrorMsg(msg);
        setFailedIndex(i);
        setPhase("failed");
        toast.error(result.error);
        await safePost(`/api/projects/${projectId}`, { status: "FAILED", errorMessage: result.error });
        return false;
      }

      const charCount = typeof result.data.content === "string" ? result.data.content.length : 0;
      setChapterChars((prev) => new Map(prev).set(i, charCount));
      setDoneIndexes((prev) => { const next = new Set(prev); next.add(i); return next; });
    }
    return true;
  }

  async function handleRetry() {
    if (failedIndex === null) return;
    const projectId = projectIdRef.current;
    const chapterList = chaptersRef.current;

    setErrorMsg("");
    setFailedIndex(null);

    const success = await generateChapters(projectId, chapterList, failedIndex);
    if (!success) return;

    // finish
    setPhase("finishing");
    const finishResult = await safePost(`/api/projects/${projectId}/convert/finish`);
    if (!finishResult.ok) {
      setErrorMsg(finishResult.error);
      setPhase("failed");
      toast.error(finishResult.error);
      return;
    }

    setPhase("done");
    toast.success("전자책 생성 완료!");
    setTimeout(() => router.push("/editor"), 800);
  }

  const isFailed = phase === "failed";
  const isDone = phase === "done";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-xl px-4 py-16">
        {/* 타이틀 */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">4</span>
            전자책 생성 중
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isDone ? "전자책 생성 완료!" :
             isFailed ? "변환에 실패했습니다" :
             "전자책을 생성하고 있습니다"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {isDone ? "에디터로 이동합니다..." :
             isFailed ? "해당 챕터만 다시 시도할 수 있습니다." :
             "챕터를 순서대로 생성하고 있습니다. 잠시만 기다려 주세요."}
          </p>
        </div>

        {/* 진행 카드 */}
        <div className="card">
          {uploadedFile && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                uploadedFile.type === "docx" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
              }`}>
                {uploadedFile.type.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-800">{uploadedFile.name}</p>
                <p className="text-xs text-gray-400">
                  {totalChapters > 0 ? `${doneCount} / ${totalChapters} 챕터 완료` : "초기화 중..."}
                </p>
              </div>
            </div>
          )}

          {/* 진행률 바 */}
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">
              {isFailed ? "변환 실패" : isDone ? "완료!" : phaseLabel(phase, currentIndex, chapters)}
            </span>
            <span className={`font-bold ${
              isFailed ? "text-red-600" : isDone ? "text-green-600" : "text-brand-600"
            }`}>
              {progress}%
            </span>
          </div>
          <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isFailed ? "bg-red-500" : isDone ? "bg-green-500" : "bg-gradient-to-r from-brand-500 to-purple-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 현재 단계 메시지 */}
          {isFailed ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs text-red-600">{errorMsg || "알 수 없는 오류가 발생했습니다."}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              {!isDone && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin text-brand-500 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              )}
              {isDone && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-500 flex-shrink-0">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <p className="text-xs text-gray-600">
                {isDone ? "모든 처리가 완료되었습니다!" : phaseLabel(phase, currentIndex, chapters)}
              </p>
            </div>
          )}
        </div>

        {/* 챕터 진행 목록 */}
        {chapters.length > 0 && (
          <div className="mt-6 space-y-1">
            {chapters.map((ch, idx) => {
              const done = doneIndexes.has(idx);
              const active = idx === currentIndex && !done && !isFailed;
              const isFail = isFailed && idx === failedIndex;
              const chars = chapterChars.get(idx);

              return (
                <div
                  key={ch.index}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-all ${
                    isFail ? "bg-red-50 text-red-700" :
                    active ? "bg-brand-50 text-brand-700 font-medium" :
                    done ? "text-gray-500" : "text-gray-300"
                  }`}
                >
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                    isFail ? "bg-red-100 text-red-500" :
                    done ? "bg-green-100 text-green-600" :
                    active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-300"
                  }`}>
                    {isFail ? (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    ) : done ? (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="text-[9px] font-bold">{idx + 1}</span>
                    )}
                  </span>
                  <span className="flex-1 truncate">{getSectionLabel(ch)} {ch.title}</span>
                  {done && chars && (
                    <span className="flex-shrink-0 text-[10px] text-gray-400">{chars.toLocaleString()}자</span>
                  )}
                  {isFail && (
                    <button
                      onClick={handleRetry}
                      className="flex-shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-200"
                    >
                      재시도
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 실패 시 하단 버튼 */}
        {isFailed && (
          <div className="mt-6 flex gap-3">
            <button onClick={() => router.push("/upload")} className="btn-secondary flex-1">
              파일 다시 업로드
            </button>
            <button onClick={handleRetry} className="btn-primary flex-1">
              이 챕터부터 재시도
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function getSectionLabel(ch: ChapterTask): string {
  if (ch.type === "prologue") return "프롤로그";
  if (ch.type === "appendix") return "부록";
  return `${ch.number}장.`;
}

function phaseLabel(phase: Phase, currentIndex: number, chapters: ChapterTask[]): string {
  if (phase === "starting") return "챕터 구조 초기화 중...";
  if (phase === "finishing") return "최종 조립 중...";
  if (phase === "generating" && chapters[currentIndex]) {
    const ch = chapters[currentIndex];
    return `${getSectionLabel(ch)} "${ch.title}" 생성 중...`;
  }
  return "준비 중...";
}
