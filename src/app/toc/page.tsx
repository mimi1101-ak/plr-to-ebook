"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";

interface TocChapter {
  type: "prologue" | "chapter" | "appendix";
  number?: number;
  title: string;
  subtitles: string[];
}

interface TocOption {
  id: string;
  chapters: TocChapter[];
}

type LoadPhase = "starting" | "titles" | "toc" | "done";

const POLL_INTERVAL = 5000; // 5초마다 폴링

export default function TocPage() {
  const router = useRouter();
  const { currentProjectId, targetAudience } = useAppStore();

  const [loadPhase, setLoadPhase] = useState<LoadPhase>("starting");
  const [titles, setTitles] = useState<string[]>([]);
  const [tocOptions, setTocOptions] = useState<TocOption[]>([]);
  const isLoading = loadPhase !== "done";

  const [selectedTitleIdx, setSelectedTitleIdx] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [useCustomTitle, setUseCustomTitle] = useState(false);
  const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
  const [expandedTocId, setExpandedTocId] = useState<string | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editChapters, setEditChapters] = useState<TocChapter[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const calledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentProjectId) { router.push("/upload"); return; }
    if (!targetAudience) { router.push("/analysis"); return; }
    if (calledRef.current) return;
    calledRef.current = true;
    startRecommend(currentProjectId, targetAudience);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId, targetAudience]);

  async function startRecommend(projectId: string, audience: string) {
    // 1. Job 생성 → jobId 즉시 반환
    let jobId: string;
    try {
      const res = await fetch(`/api/projects/${projectId}/recommend/start`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "초기화 실패");
      }
      const data = await res.json();
      jobId = data.jobId;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "초기화 실패");
      router.push("/analysis");
      return;
    }

    setLoadPhase("titles");

    // 2. 제목 생성 (fire-and-forget)
    fetch(`/api/projects/${projectId}/recommend/titles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, targetAudience: audience }),
    }).catch(() => {});

    // 3. /api/jobs/[jobId]/status 폴링 시작
    pollJobStatus(projectId, jobId, audience, false);
  }

  function pollJobStatus(
    projectId: string,
    jobId: string,
    audience: string,
    tocTriggered: boolean
  ) {
    const check = async (alreadyTriggered: boolean) => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`);
        if (!res.ok) throw new Error("폴링 실패");
        const data = await res.json();

        if (data.status === "done") {
          const r = data.result as { titles: string[]; tocOptions: TocOption[] };
          setTitles(r.titles ?? []);
          setTocOptions(r.tocOptions ?? []);
          setLoadPhase("done");
          return;
        }

        if (data.status === "failed") {
          toast.error(data.error ?? "추천 생성에 실패했습니다.");
          router.push("/analysis");
          return;
        }

        // 제목 완료 → 목차 생성 트리거 (한 번만)
        if (data.status === "titles_done" && !alreadyTriggered) {
          setLoadPhase("toc");
          fetch(`/api/projects/${projectId}/recommend/toc`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, targetAudience: audience }),
          }).catch(() => {});
          pollTimerRef.current = setTimeout(() => check(true), POLL_INTERVAL);
          return;
        }

        pollTimerRef.current = setTimeout(() => check(alreadyTriggered), POLL_INTERVAL);
      } catch {
        pollTimerRef.current = setTimeout(() => check(alreadyTriggered), POLL_INTERVAL);
      }
    };

    check(tocTriggered);
  }

  // 제목 선택 시 editTitle 동기화
  useEffect(() => {
    if (useCustomTitle) {
      setEditTitle(customTitle);
    } else if (selectedTitleIdx !== null) {
      setEditTitle(titles[selectedTitleIdx] ?? "");
    }
  }, [selectedTitleIdx, useCustomTitle, customTitle, titles]);

  // TOC 선택 시 editChapters 동기화
  useEffect(() => {
    if (!selectedTocId) return;
    const opt = tocOptions.find((o) => o.id === selectedTocId);
    if (opt) setEditChapters(opt.chapters.map((ch) => ({ ...ch, subtitles: [...ch.subtitles] })));
  }, [selectedTocId, tocOptions]);

  const handleConfirm = async () => {
    if (!currentProjectId) return;
    const finalTitle = editTitle.trim();
    if (!finalTitle) { toast.error("제목을 입력해 주세요."); return; }
    if (editChapters.length === 0) { toast.error("목차 구조를 선택해 주세요."); return; }

    setIsSaving(true);
    try {
      const tocData = {
        bookTitle: finalTitle,
        sections: editChapters.map((ch, i) => ({
          id: `sec-${i}`,
          type: ch.type,
          number: ch.number,
          title: ch.title,
          subtitles: ch.subtitles,
        })),
      };
      const res = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tocData: JSON.stringify(tocData) }),
      });
      if (!res.ok) throw new Error("저장 실패");
      toast.success("목차 확정!");
      router.push("/processing");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateChapterTitle = (idx: number, title: string) =>
    setEditChapters((prev) => prev.map((ch, i) => (i === idx ? { ...ch, title } : ch)));

  const updateSubtitle = (chIdx: number, subIdx: number, val: string) =>
    setEditChapters((prev) =>
      prev.map((ch, i) => {
        if (i !== chIdx) return ch;
        const subs = [...ch.subtitles];
        subs[subIdx] = val;
        return { ...ch, subtitles: subs };
      })
    );

  const addSubtitle = (chIdx: number) =>
    setEditChapters((prev) =>
      prev.map((ch, i) => (i === chIdx ? { ...ch, subtitles: [...ch.subtitles, "새 소제목"] } : ch))
    );

  const removeSubtitle = (chIdx: number, subIdx: number) =>
    setEditChapters((prev) =>
      prev.map((ch, i) =>
        i === chIdx ? { ...ch, subtitles: ch.subtitles.filter((_, si) => si !== subIdx) } : ch
      )
    );

  const getSectionLabel = (ch: TocChapter) => {
    if (ch.type === "prologue") return "프롤로그";
    if (ch.type === "appendix") return "부록";
    return `${ch.number}장.`;
  };

  const canProceed =
    (useCustomTitle ? customTitle.trim().length > 0 : selectedTitleIdx !== null) &&
    selectedTocId !== null;

  if (isLoading) {
    const phaseLabel =
      loadPhase === "starting" ? "초기화 중..." :
      loadPhase === "titles" ? "제목 10개 생성 중..." :
      "목차 구조 생성 중...";
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="mx-auto max-w-2xl px-4 py-20">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin text-purple-600">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                <span className="text-purple-600">"{targetAudience}"</span> 타겟층에 맞는<br />제목과 목차를 추천하고 있습니다
              </h1>
              <p className="mt-2 text-sm text-gray-500">{phaseLabel}</p>
            </div>
            <div className="flex gap-3">
              {[
                { label: "제목 10개", done: loadPhase === "toc" },
                { label: "목차 구조", done: false },
              ].map(({ label, done }, i) => (
                <span key={i} className={`rounded-full px-3 py-1 text-xs flex items-center gap-1 ${done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}
                  style={done ? undefined : { animation: `pulse 1.5s ease-in-out ${i * 0.4}s infinite` }}>
                  {done ? "✓ " : ""}{label}
                </span>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold">3</span>
            제목 및 목차 설정
          </div>
          <h1 className="text-2xl font-bold text-gray-900">제목과 목차를 선택하세요</h1>
          <p className="mt-2 text-sm text-gray-500">
            <span className="font-medium text-purple-600">"{targetAudience}"</span> 타겟층 기반 추천 결과입니다.
          </p>
        </div>

        {/* ── 1. 제목 선택 ── */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white text-[10px] font-bold">1</span>
            제목 선택
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {titles.map((title, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedTitleIdx(idx); setUseCustomTitle(false); }}
                className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-medium transition-all ${
                  !useCustomTitle && selectedTitleIdx === idx
                    ? "border-purple-500 bg-purple-50 text-purple-800"
                    : "border-gray-100 bg-white text-gray-700 hover:border-gray-200"
                }`}
              >
                {title}
              </button>
            ))}
            <button
              onClick={() => setUseCustomTitle(true)}
              className={`col-span-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                useCustomTitle ? "border-purple-500 bg-purple-50" : "border-dashed border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {useCustomTitle ? (
                <input
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="직접 제목을 입력하세요..."
                  className="w-full bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
                />
              ) : (
                <span className="text-sm font-medium text-gray-400">✏️ 직접 입력</span>
              )}
            </button>
          </div>
        </section>

        {/* ── 2. 목차 선택 ── */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white text-[10px] font-bold">2</span>
            목차 구조 선택
          </h2>
          <div className="space-y-2">
            {tocOptions.map((opt) => {
              const isSelected = selectedTocId === opt.id;
              const isExpanded = expandedTocId === opt.id;
              const preview = opt.chapters.filter((ch) => ch.type === "chapter").slice(0, 3);
              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border-2 overflow-hidden transition-all ${
                    isSelected ? "border-purple-500" : "border-gray-100 bg-white"
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isSelected ? "bg-purple-50" : "hover:bg-gray-50"}`}
                    onClick={() => { setSelectedTocId(opt.id); setExpandedTocId(isExpanded ? null : opt.id); }}
                  >
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? "border-purple-500 bg-purple-500" : "border-gray-300"
                    }`}>
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 mb-0.5">목차 구조 {opt.id}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {preview.map((ch) => ch.title).join(" · ")}
                        {opt.chapters.filter((ch) => ch.type === "chapter").length > 3 && " ..."}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400">{opt.chapters.length}개 섹션</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-white">
                      <div className="space-y-2">
                        {opt.chapters.map((ch, ci) => (
                          <div key={ci} className="text-xs">
                            <p className="font-semibold text-gray-700 mb-1">
                              {getSectionLabel(ch)} {ch.title}
                            </p>
                            {ch.subtitles.length > 0 && (
                              <ul className="pl-3 space-y-0.5">
                                {ch.subtitles.map((sub, si) => (
                                  <li key={si} className="text-gray-400">• {sub}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. 편집 ── */}
        {canProceed && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white text-[10px] font-bold">3</span>
              확인 및 수정
              <span className="ml-1 text-xs font-normal text-gray-400">(클릭해서 편집)</span>
            </h2>
            <div className="card">
              <div className="mb-5 text-center">
                <InlineEdit
                  value={editTitle}
                  onChange={setEditTitle}
                  className="text-[17px] font-bold text-gray-900"
                  display={(v) => `『${v}』`}
                />
              </div>
              <div className="space-y-4">
                {editChapters.map((ch, ci) => (
                  <div key={ci} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-500 flex-shrink-0">{getSectionLabel(ch)}</span>
                      <InlineEdit
                        value={ch.title}
                        onChange={(v) => updateChapterTitle(ci, v)}
                        className="text-[13px] font-bold text-gray-900"
                      />
                    </div>
                    <div className="space-y-1 pl-2">
                      {ch.subtitles.map((sub, si) => (
                        <SubtitleRow
                          key={si}
                          value={sub}
                          onChange={(v) => updateSubtitle(ci, si, v)}
                          onRemove={() => removeSubtitle(ci, si)}
                        />
                      ))}
                      <button
                        onClick={() => addSubtitle(ci)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-200 hover:text-gray-600 mt-1"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                        소제목 추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canProceed || isSaving}
          className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              목차 확정하고 전자책 생성 시작
            </>
          )}
        </button>
        {!canProceed && (
          <p className="mt-2 text-center text-xs text-gray-400">
            {(useCustomTitle ? customTitle.trim().length === 0 : selectedTitleIdx === null)
              ? "제목을 선택해 주세요"
              : "목차 구조를 선택해 주세요"}
          </p>
        )}
      </main>
    </div>
  );
}

function InlineEdit({
  value,
  onChange,
  className,
  display,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  display?: (v: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        className={`rounded border border-brand-300 bg-white px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={`rounded px-1 py-0.5 hover:bg-gray-200 ${className}`}
    >
      {display ? display(value) : value}
    </button>
  );
}

function SubtitleRow({
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
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
