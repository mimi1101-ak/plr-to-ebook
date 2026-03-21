"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";
import type { ChapterTask } from "@/app/api/projects/[id]/convert/start/route";

type Phase = "idle" | "starting" | "generating" | "finishing" | "done" | "failed";

export default function ProcessingPage() {
  const router = useRouter();
  const { currentProjectId, uploadedFile, templateSettings } = useAppStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [chapters, setChapters] = useState<ChapterTask[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [doneIndexes, setDoneIndexes] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const startedRef = useRef(false);

  const totalChapters = chapters.length;
  const doneCount = doneIndexes.size;
  const progress =
    phase === "done" ? 100 :
    phase === "finishing" ? 95 :
    totalChapters > 0 ? Math.round((doneCount / totalChapters) * 90) : 0;

  useEffect(() => {
    if (!currentProjectId || startedRef.current) return;
    startedRef.current = true;
    run(currentProjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function run(projectId: string) {
    // 1. start
    setPhase("starting");
    let chapterList: ChapterTask[] = [];
    try {
      const res = await fetch(`/api/projects/${projectId}/convert/start`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).message ?? "초기화 실패");
      const data = await res.json();
      chapterList = data.chapters;
      setChapters(chapterList);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "초기화 실패";
      setErrorMsg(msg);
      setPhase("failed");
      toast.error(msg);
      return;
    }

    // 2. 챕터별 순차 생성
    setPhase("generating");
    for (let i = 0; i < chapterList.length; i++) {
      const ch = chapterList[i];
      setCurrentIndex(i);
      try {
        const res = await fetch(`/api/projects/${projectId}/convert/chapter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterIndex: ch.index,
            type: ch.type,
            number: ch.number,
            title: ch.title,
            subtitles: ch.subtitles,
            totalChapters: chapterList.length,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).message ?? "챕터 생성 실패");
        setDoneIndexes((prev) => { const next = new Set(prev); next.add(i); return next; });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "챕터 생성 실패";
        setErrorMsg(`${getSectionLabel(ch)} 생성 실패: ${msg}`);
        setPhase("failed");
        toast.error(msg);
        // FAILED 상태로 DB 업데이트
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "FAILED", errorMessage: msg }),
        }).catch(() => {});
        return;
      }
    }

    // 3. finish
    setPhase("finishing");
    try {
      const res = await fetch(`/api/projects/${projectId}/convert/finish`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).message ?? "조립 실패");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "최종 조립 실패";
      setErrorMsg(msg);
      setPhase("failed");
      toast.error(msg);
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
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
              4
            </span>
            전자책 생성 중
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isDone ? "전자책 생성 완료!" :
             isFailed ? "변환에 실패했습니다" :
             "전자책을 생성하고 있습니다"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {isDone ? "에디터로 이동합니다..." :
             isFailed ? "다시 시도하거나 파일을 확인해 주세요." :
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
              return (
                <div
                  key={ch.index}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-all ${
                    active ? "bg-brand-50 text-brand-700 font-medium" :
                    done ? "text-gray-400" : "text-gray-300"
                  }`}
                >
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-green-100 text-green-600" :
                    active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-300"
                  }`}>
                    {done ? (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="text-[9px] font-bold">{idx + 1}</span>
                    )}
                  </span>
                  <span className="truncate">{getSectionLabel(ch)} {ch.title}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 실패 시 재시도 */}
        {isFailed && (
          <div className="mt-6 flex gap-3">
            <button onClick={() => router.push("/upload")} className="btn-secondary flex-1">
              파일 다시 업로드
            </button>
            <button onClick={() => router.push("/analysis")} className="btn-primary flex-1">
              처음부터 다시
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
