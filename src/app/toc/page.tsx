"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";
import type { GeneratedToc, TocSection } from "@/types";

export default function TocPage() {
  const router = useRouter();
  const { currentProjectId, generatedToc, setGeneratedToc } = useAppStore();

  const [toc, setToc] = useState<GeneratedToc | null>(generatedToc);
  const [isGenerating, setIsGenerating] = useState(!generatedToc);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBookTitle, setEditingBookTitle] = useState(false);
  const generatedRef = useRef(false);

  useEffect(() => {
    if (!currentProjectId) {
      router.push("/upload");
      return;
    }
    if (generatedToc || generatedRef.current) return;
    generatedRef.current = true;

    const generate = async () => {
      try {
        const res = await fetch(`/api/projects/${currentProjectId}/generate-toc`, {
          method: "POST",
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message);
        }
        const data: GeneratedToc = await res.json();
        setToc(data);
        setGeneratedToc(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "목차 생성에 실패했습니다.");
        router.push("/template");
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
  }, [currentProjectId, generatedToc, router, setGeneratedToc]);

  const updateBookTitle = (title: string) => {
    if (!toc) return;
    setToc({ ...toc, bookTitle: title });
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    if (!toc) return;
    setToc({
      ...toc,
      sections: toc.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    });
  };

  const updateSubtitle = (sectionId: string, idx: number, value: string) => {
    if (!toc) return;
    setToc({
      ...toc,
      sections: toc.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const subtitles = [...s.subtitles];
        subtitles[idx] = value;
        return { ...s, subtitles };
      }),
    });
  };

  const addSubtitle = (sectionId: string) => {
    if (!toc) return;
    setToc({
      ...toc,
      sections: toc.sections.map((s) => {
        if (s.id !== sectionId) return s;
        return { ...s, subtitles: [...s.subtitles, "새 소제목"] };
      }),
    });
  };

  const removeSubtitle = (sectionId: string, idx: number) => {
    if (!toc) return;
    setToc({
      ...toc,
      sections: toc.sections.map((s) => {
        if (s.id !== sectionId) return s;
        return { ...s, subtitles: s.subtitles.filter((_, i) => i !== idx) };
      }),
    });
  };

  const moveSection = (sectionId: string, direction: "up" | "down") => {
    if (!toc) return;
    const idx = toc.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    const newSections = [...toc.sections];
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= newSections.length) return;
    [newSections[idx], newSections[target]] = [newSections[target], newSections[idx]];
    setToc({ ...toc, sections: newSections });
  };

  const handleConfirm = async () => {
    if (!toc || !currentProjectId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tocData: JSON.stringify(toc) }),
      });
      if (!res.ok) throw new Error("목차 저장에 실패했습니다.");
      setGeneratedToc(toc);
      toast.success("목차 확정!");
      router.push("/processing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const getSectionLabel = (s: TocSection) => {
    if (s.type === "prologue") return "프롤로그";
    if (s.type === "appendix") return "부록";
    return `${s.number}장.`;
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="animate-spin text-brand-600"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="32"
                  strokeDashoffset="12"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI가 목차를 생성하고 있습니다</h1>
              <p className="mt-2 text-sm text-gray-500">
                파일 내용을 분석해서 최적의 목차 구조를 만들고 있어요.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!toc) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
              3
            </span>
            목차 확인 · 수정
          </div>
          <h1 className="text-2xl font-bold text-gray-900">목차를 확인하고 수정하세요</h1>
          <p className="mt-2 text-sm text-gray-500">
            제목이나 소제목을 클릭하면 편집할 수 있습니다.
          </p>
        </div>

        {/* 목차 미리보기 카드 */}
        <div className="card mb-6">
          {/* 책 제목 */}
          <div className="mb-6 text-center">
            {editingBookTitle ? (
              <input
                autoFocus
                className="w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-center text-[17px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={toc.bookTitle}
                onChange={(e) => updateBookTitle(e.target.value)}
                onBlur={() => setEditingBookTitle(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingBookTitle(false)}
              />
            ) : (
              <button
                onClick={() => setEditingBookTitle(true)}
                className="group relative inline-block rounded-lg px-2 py-1 text-[17px] font-bold text-gray-900 hover:bg-gray-100"
              >
                『{toc.bookTitle}』
                <span className="ml-1.5 hidden text-xs font-normal text-gray-400 group-hover:inline">
                  편집
                </span>
              </button>
            )}
          </div>

          {/* 섹션 목록 */}
          <div className="space-y-4">
            {toc.sections.map((section, sIdx) => (
              <div key={section.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                {/* 섹션 헤더 */}
                <div className="mb-2 flex items-center gap-2">
                  <SectionTitleEditor
                    label={getSectionLabel(section)}
                    title={section.title}
                    onChange={(v) => updateSectionTitle(section.id, v)}
                  />
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => moveSection(section.id, "up")}
                      disabled={sIdx === 0}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
                      title="위로"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M18 15l-6-6-6 6"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveSection(section.id, "down")}
                      disabled={sIdx === toc.sections.length - 1}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 disabled:opacity-30"
                      title="아래로"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 소제목 목록 */}
                <div className="space-y-1 pl-2">
                  {section.subtitles.map((sub, subIdx) => (
                    <SubtitleEditor
                      key={subIdx}
                      value={sub}
                      onChange={(v) => updateSubtitle(section.id, subIdx, v)}
                      onRemove={() => removeSubtitle(section.id, subIdx)}
                    />
                  ))}
                  <button
                    onClick={() => addSubtitle(section.id)}
                    className="mt-1 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    소제목 추가
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 확정 버튼 */}
        <button
          onClick={handleConfirm}
          disabled={isSaving}
          className="btn-primary w-full py-3.5 text-base"
        >
          {isSaving ? (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="animate-spin"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="32"
                  strokeDashoffset="12"
                />
              </svg>
              저장 중...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              목차 확정하고 본문 생성 시작
            </>
          )}
        </button>
      </main>
    </div>
  );
}

// 섹션 제목 인라인 에디터
function SectionTitleEditor({
  label,
  title,
  onChange,
}: {
  label: string;
  title: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-1 items-center gap-1">
        <span className="whitespace-nowrap text-[13px] font-bold text-gray-700">{label}</span>
        <input
          autoFocus
          className="flex-1 rounded border border-brand-300 bg-white px-2 py-0.5 text-[13px] font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={title}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-gray-200"
    >
      <span className="text-[13px] font-bold text-gray-900">
        {label} {title}
      </span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        className="hidden text-gray-400 group-hover:block"
      >
        <path
          d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// 소제목 인라인 에디터
function SubtitleEditor({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-gray-400">•</span>
        <input
          autoFocus
          className="flex-1 rounded border border-brand-300 bg-white px-2 py-0.5 text-[11px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-400"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <span className="text-[11px] text-gray-400">•</span>
      <button
        onClick={() => setEditing(true)}
        className="flex-1 rounded px-1 py-0.5 text-left text-[11px] text-gray-700 hover:bg-gray-200"
      >
        {value}
      </button>
      <button
        onClick={onRemove}
        className="hidden rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-400 group-hover:block"
        title="삭제"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
