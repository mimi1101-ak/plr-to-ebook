"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";

interface TargetAudience {
  name: string;
  characteristics: string;
  needs: string;
  purchaseMotivation: string;
}

interface AnalysisResult {
  summary: string;
  targetAudiences: TargetAudience[];
}

const POLL_INTERVAL = 2000; // 2초마다 폴링

export default function AnalysisPage() {
  const router = useRouter();
  const { currentProjectId, setTargetAudience } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("분석 작업 초기화 중...");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [showFullSummary, setShowFullSummary] = useState(false);

  const calledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentProjectId) { router.push("/upload"); return; }
    if (calledRef.current) return;
    calledRef.current = true;

    startAnalysis(currentProjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function startAnalysis(projectId: string) {
    // 1단계: 작업 초기화 (즉시 반환)
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "초기화 실패");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "초기화 실패");
      router.push("/upload");
      return;
    }

    setLoadingMsg("요약 생성 중...");

    // 2단계: 요약 생성 (fire-and-forget)
    fetch(`/api/projects/${projectId}/analyze/run`, { method: "POST" }).catch(() => {});

    // 3단계: 폴링 시작
    pollStatus(projectId, false);
  }

  // targetsTriggered: 타겟층 API를 이미 호출했는지 여부 (중복 호출 방지)
  function pollStatus(projectId: string, targetsTriggered: boolean) {
    const check = async (alreadyTriggered: boolean) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/analyze/status`);
        if (!res.ok) throw new Error("폴링 실패");
        const data = await res.json();

        if (data.status === "done") {
          setResult({ summary: data.summary, targetAudiences: data.targetAudiences });
          setIsLoading(false);
          return; // 폴링 종료
        }

        if (data.status === "failed") {
          toast.error(data.error ?? "내용 분석에 실패했습니다.");
          router.push("/upload");
          return; // 폴링 종료
        }

        // 요약 완료 → 타겟층 생성 트리거 (한 번만)
        if (data.status === "summary_done" && !alreadyTriggered) {
          setLoadingMsg("타겟층 분석 중...");
          fetch(`/api/projects/${projectId}/analyze/targets`, { method: "POST" }).catch(() => {});
          pollTimerRef.current = setTimeout(() => check(true), POLL_INTERVAL);
          return;
        }

        // "processing" 또는 "summary_done" 상태 → 계속 폴링
        pollTimerRef.current = setTimeout(() => check(alreadyTriggered), POLL_INTERVAL);
      } catch {
        pollTimerRef.current = setTimeout(() => check(alreadyTriggered), POLL_INTERVAL);
      }
    };

    check(targetsTriggered);
  }

  const handleNext = () => {
    const audience = useCustom
      ? customInput.trim()
      : (result?.targetAudiences[selectedIdx!]?.name ?? "");
    if (!audience) {
      toast.error("타겟층을 선택하거나 직접 입력해 주세요.");
      return;
    }
    setTargetAudience(audience);
    router.push("/toc");
  };

  const canProceed =
    (useCustom && customInput.trim().length > 0) ||
    (!useCustom && selectedIdx !== null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-20">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-brand-100 animate-ping opacity-30" />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin text-brand-600">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI가 파일 내용을 분석하고 있습니다</h1>
              <p className="mt-2 text-sm text-gray-500">{loadingMsg}</p>
              <p className="mt-1 text-xs text-gray-400">최대 30초 정도 소요될 수 있습니다</p>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap justify-center">
              {[
                { label: "원고 내용 파악", done: loadingMsg.includes("타겟층") || loadingMsg.includes("완료") },
                { label: "핵심 주제 요약", done: loadingMsg.includes("타겟층") || loadingMsg.includes("완료") },
                { label: "타겟층 분석", done: false },
              ].map(({ label, done }, i) => (
                <span
                  key={i}
                  className={`rounded-full px-3 py-1 text-xs flex items-center gap-1 ${
                    done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
                  }`}
                  style={done ? undefined : { animation: `pulse 1.5s ease-in-out ${i * 0.4}s infinite` }}
                >
                  {done && "✓ "}
                  {label}
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!result) return null;

  const summaryPreview =
    result.summary.length > 300
      ? result.summary.slice(0, 300) + "..."
      : result.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">2</span>
            내용 분석
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI가 파일 내용을 분석했습니다</h1>
          <p className="mt-2 text-sm text-gray-500">타겟 독자층을 선택하면 맞춤형 전자책을 생성합니다.</p>
        </div>

        {/* 요약 카드 */}
        <div className="card mb-6">
          <h2 className="mb-2 text-sm font-bold text-gray-800">📄 원고 내용 요약</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {showFullSummary ? result.summary : summaryPreview}
          </p>
          {result.summary.length > 300 && (
            <button
              onClick={() => setShowFullSummary((v) => !v)}
              className="mt-2 text-xs font-medium text-brand-600 hover:underline"
            >
              {showFullSummary ? "접기" : "더 보기"}
            </button>
          )}
        </div>

        {/* 타겟층 선택 */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-bold text-gray-800">🎯 추천 타겟층 선택</h2>
          <div className="space-y-3">
            {result.targetAudiences.map((audience, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedIdx(idx); setUseCustom(false); }}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                  !useCustom && selectedIdx === idx
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-100 bg-white hover:border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    !useCustom && selectedIdx === idx
                      ? "border-brand-500 bg-brand-500"
                      : "border-gray-300"
                  }`}>
                    {!useCustom && selectedIdx === idx && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 mb-1">{audience.name}</p>
                    <p className="text-xs text-gray-600 mb-2">{audience.characteristics}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-gray-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold text-gray-500 mb-0.5">핵심 니즈</p>
                        <p className="text-xs text-gray-700">{audience.needs}</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-semibold text-amber-600 mb-0.5">구매 동기</p>
                        <p className="text-xs text-gray-700">{audience.purchaseMotivation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {/* 직접 입력 */}
            <button
              onClick={() => setUseCustom(true)}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                useCustom
                  ? "border-brand-500 bg-brand-50"
                  : "border-dashed border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  useCustom ? "border-brand-500 bg-brand-500" : "border-gray-300"
                }`}>
                  {useCustom && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-600">직접 입력</span>
              </div>
              {useCustom && (
                <input
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="예: 30대 직장인 투자 초보자"
                  className="mt-3 w-full rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              )}
            </button>
          </div>
        </div>

        {/* 다음 버튼 */}
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          제목 및 목차 설정하기
        </button>
      </main>
    </div>
  );
}
