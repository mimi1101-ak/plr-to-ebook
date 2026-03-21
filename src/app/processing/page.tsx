"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";
import type { ProcessingStatus } from "@/types";

const STAGE_MESSAGES = [
  "파일 내용 추출 중...",
  "콘텐츠 구조 분석 중...",
  "목차 생성 중...",
  "챕터별 재작성 중...",
  "문체 일관성 검토 중...",
  "전자책 포맷 적용 중...",
  "최종 완성 중...",
];

export default function ProcessingPage() {
  const router = useRouter();
  const { currentProjectId, uploadedFile, templateSettings } = useAppStore();

  const [status, setStatus] = useState<ProcessingStatus>({
    status: "PROCESSING",
    progress: 0,
    message: "변환을 시작합니다...",
  });
  const [stageIndex, setStageIndex] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startedRef = useRef(false);

  // 변환 시작
  useEffect(() => {
    if (!currentProjectId || startedRef.current) return;
    startedRef.current = true;

    const startConversion = async () => {
      try {
        const response = await fetch(`/api/projects/${currentProjectId}/convert`, {
          method: "POST",
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "변환 시작 실패");
        router.push("/template");
      }
    };

    startConversion();
  }, [currentProjectId, router]);

  // 진행 상태 폴링
  useEffect(() => {
    if (!currentProjectId) return;

    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${currentProjectId}/status`);
        if (!response.ok) return;

        const data: ProcessingStatus = await response.json();
        setStatus(data);

        // 스테이지 메시지 업데이트
        const stageIdx = Math.floor((data.progress / 100) * STAGE_MESSAGES.length);
        setStageIndex(Math.min(stageIdx, STAGE_MESSAGES.length - 1));

        if (data.status === "COMPLETED") {
          clearInterval(pollingRef.current!);
          toast.success("전자책 생성 완료!");
          setTimeout(() => router.push("/editor"), 800);
        } else if (data.status === "FAILED") {
          clearInterval(pollingRef.current!);
          toast.error(data.errorMessage || "변환에 실패했습니다.");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollingRef.current = setInterval(poll, 2000);
    poll(); // 즉시 1회 실행

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentProjectId, router]);

  const isFailed = status.status === "FAILED";
  const isCompleted = status.status === "COMPLETED";
  const progress = Math.round(status.progress);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-xl px-4 py-16">
        {/* 타이틀 */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">4</span>
            AI 변환 중
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCompleted
              ? "전자책 생성 완료!"
              : isFailed
              ? "변환에 실패했습니다"
              : "전자책을 생성하고 있습니다"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {isCompleted
              ? "결과 페이지로 이동합니다..."
              : isFailed
              ? "다시 시도하거나 파일을 확인해 주세요."
              : "잠시만 기다려 주세요. Claude AI가 콘텐츠를 재작성 중입니다."}
          </p>
        </div>

        {/* 진행 카드 */}
        <div className="card">
          {/* 파일 정보 */}
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
                  {templateSettings.writingStyle === "professional" ? "전문적" :
                   templateSettings.writingStyle === "casual" ? "친근한" :
                   templateSettings.writingStyle === "academic" ? "학술적" : "스토리텔링"} 문체
                </p>
              </div>
            </div>
          )}

          {/* 진행률 */}
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700">
              {isFailed ? "변환 실패" : isCompleted ? "완료!" : "변환 진행"}
            </span>
            <span className={`font-bold ${
              isFailed ? "text-red-600" : isCompleted ? "text-green-600" : "text-brand-600"
            }`}>
              {progress}%
            </span>
          </div>

          {/* 진행 바 */}
          <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                isFailed
                  ? "bg-red-500"
                  : isCompleted
                  ? "bg-green-500"
                  : "bg-gradient-to-r from-brand-500 to-purple-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 현재 단계 메시지 */}
          {!isFailed && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
              {!isCompleted && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin text-brand-500 flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              )}
              {isCompleted && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-500 flex-shrink-0">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <p className="text-xs text-gray-600">
                {isCompleted ? "모든 처리가 완료되었습니다!" : STAGE_MESSAGES[stageIndex]}
              </p>
            </div>
          )}

          {isFailed && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs text-red-600">
                {status.errorMessage || "알 수 없는 오류가 발생했습니다."}
              </p>
            </div>
          )}
        </div>

        {/* 단계 목록 */}
        <div className="mt-6 space-y-2">
          {STAGE_MESSAGES.map((msg, idx) => {
            const done = idx < stageIndex || isCompleted;
            const active = idx === stageIndex && !isCompleted && !isFailed;
            return (
              <div
                key={idx}
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
                {msg}
              </div>
            );
          })}
        </div>

        {/* 실패 시 재시도 */}
        {isFailed && (
          <div className="mt-6 flex gap-3">
            <button onClick={() => router.push("/upload")} className="btn-secondary flex-1">
              파일 다시 업로드
            </button>
            <button onClick={() => router.push("/template")} className="btn-primary flex-1">
              다시 시도
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
