"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import StyleCard from "@/components/template/StyleCard";
import { useAppStore } from "@/lib/store";
import {
  STYLE_LABELS,
  STYLE_DESCRIPTIONS,
  TOC_LABELS,
  SENTENCE_LABELS,
  type WritingStyle,
  type TocFormat,
  type SentenceStructure,
} from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

const styleIcons: Record<WritingStyle, React.ReactNode> = {
  professional: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  casual: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  academic: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  storytelling: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function TemplatePage() {
  const router = useRouter();
  const {
    currentProjectId,
    uploadedFile,
    templateSettings,
    setWritingStyle,
    setTocFormat,
    setSentenceStructure,
  } = useAppStore();

  const [isSaving, setIsSaving] = useState(false);

  const handleStartConversion = async () => {
    if (!currentProjectId) {
      toast.error("업로드된 파일이 없습니다. 파일을 먼저 업로드해 주세요.");
      router.push("/upload");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${currentProjectId}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateSettings),
      });

      if (!response.ok) throw new Error("설정 저장에 실패했습니다.");

      toast.success("템플릿 설정 완료!");
      router.push("/toc");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* 타이틀 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">2</span>
            템플릿 설정
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            전자책 스타일을 설정하세요
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            AI가 선택한 스타일로 전체 콘텐츠를 일관성 있게 재작성합니다.
          </p>
        </div>

        {/* 업로드된 파일 정보 */}
        {uploadedFile && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-green-800">
                {uploadedFile.name}
              </p>
              <p className="text-xs text-green-600">업로드 완료</p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* 1. 문체 선택 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white">1</span>
              문체 선택
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.keys(STYLE_LABELS) as WritingStyle[]).map((style) => (
                <StyleCard
                  key={style}
                  value={style}
                  selected={templateSettings.writingStyle === style}
                  label={STYLE_LABELS[style]}
                  description={STYLE_DESCRIPTIONS[style]}
                  icon={styleIcons[style]}
                  onSelect={setWritingStyle}
                />
              ))}
            </div>
          </section>

          {/* 2. 목차 형식 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white">2</span>
              목차 형식
            </h2>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(TOC_LABELS) as TocFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setTocFormat(format)}
                  className={cn(
                    "rounded-xl border-2 px-5 py-2.5 text-sm font-semibold transition-all duration-150",
                    templateSettings.tocFormat === format
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  )}
                >
                  {TOC_LABELS[format]}
                </button>
              ))}
            </div>
          </section>

          {/* 3. 문장 구조 */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white">3</span>
              문장 길이
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                {(Object.keys(SENTENCE_LABELS) as SentenceStructure[]).map(
                  (structure, idx, arr) => (
                    <div key={structure} className="flex flex-1 flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSentenceStructure(structure)}
                        className={cn(
                          "h-10 w-full rounded-lg border-2 text-xs font-semibold transition-all",
                          templateSettings.sentenceStructure === structure
                            ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                            : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        {SENTENCE_LABELS[structure]}
                      </button>
                      {/* 시각적 막대 */}
                      <div
                        className={cn(
                          "rounded-full transition-all",
                          templateSettings.sentenceStructure === structure
                            ? "bg-brand-400"
                            : "bg-gray-200"
                        )}
                        style={{
                          height: "4px",
                          width: `${(idx + 1) * 33}%`,
                          maxWidth: "100%",
                        }}
                      />
                      <p className="text-center text-xs text-gray-400 leading-tight">
                        {structure === "short"
                          ? "빠른 호흡"
                          : structure === "medium"
                          ? "균형"
                          : "깊은 설명"}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>

          {/* 설정 요약 */}
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
            <p className="mb-2 text-xs font-bold text-brand-800">선택된 설정 요약</p>
            <div className="flex flex-wrap gap-2">
              {[
                STYLE_LABELS[templateSettings.writingStyle],
                TOC_LABELS[templateSettings.tocFormat],
                SENTENCE_LABELS[templateSettings.sentenceStructure] + " 문장",
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-lg bg-white border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* 변환 시작 버튼 */}
          <button
            onClick={handleStartConversion}
            disabled={isSaving}
            className="btn-primary w-full py-3.5 text-base"
          >
            {isSaving ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                저장 중...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                다음 단계: 목차 생성
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
