"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAppStore } from "@/lib/store";
import {
  parseMarkdownToChapters,
  chaptersToMarkdown,
  calculateQualityScore,
} from "@/lib/markdown-utils";
import type { Chapter, QualityScore } from "@/types";

type DownloadFormat = "md" | "docx" | "pdf" | "epub";

const FORMAT_OPTIONS: { format: DownloadFormat; label: string; icon: string }[] = [
  { format: "md", label: "마크다운 (.md)", icon: "📝" },
  { format: "docx", label: "워드 (.docx)", icon: "📄" },
  { format: "pdf", label: "PDF (.pdf)", icon: "📕" },
  { format: "epub", label: "전자책 (.epub)", icon: "📚" },
];

export default function EditorPage() {
  const router = useRouter();
  const { currentProjectId, templateSettings } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [ebookTitle, setEbookTitle] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const activeChapter = useMemo(
    () => chapters.find((ch) => ch.id === activeChapterId) ?? null,
    [chapters, activeChapterId]
  );

  const qualityScore: QualityScore = useMemo(
    () => calculateQualityScore(chapters),
    [chapters]
  );

  const totalChars = useMemo(
    () => chapters.reduce((sum, ch) => sum + ch.content.length, 0),
    [chapters]
  );

  // 프로젝트 로드
  useEffect(() => {
    if (!currentProjectId) {
      router.push("/upload");
      return;
    }

    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${currentProjectId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (data.status !== "COMPLETED" || !data.ebookContent) {
          router.push("/processing");
          return;
        }

        const { title, chapters: parsed } = parseMarkdownToChapters(data.ebookContent);
        setEbookTitle(data.ebookTitle ?? title);
        setChapters(parsed);
        if (parsed.length > 0) setActiveChapterId(parsed[0].id);
      } catch {
        toast.error("프로젝트를 불러오는 데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [currentProjectId, router]);

  // 다운로드 메뉴 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(e.target as Node)
      ) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const updateChapterContent = (id: string, content: string) =>
    setChapters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, content } : ch)));

  const updateChapterTitle = (id: string, title: string) =>
    setChapters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, title } : ch)));

  const addChapter = () => {
    const newId = `ch-new-${Date.now()}`;
    const newChapter: Chapter = {
      id: newId,
      number: chapters.length + 1,
      title: `새 챕터 ${chapters.length + 1}`,
      content: "",
    };
    setChapters((prev) => [...prev, newChapter]);
    setActiveChapterId(newId);
  };

  const deleteChapter = (id: string) => {
    if (chapters.length <= 1) {
      toast.error("마지막 챕터는 삭제할 수 없습니다.");
      return;
    }
    const idx = chapters.findIndex((ch) => ch.id === id);
    const next = chapters
      .filter((ch) => ch.id !== id)
      .map((ch, i) => ({ ...ch, number: i + 1 }));
    setChapters(next);
    const newIdx = Math.min(idx, next.length - 1);
    setActiveChapterId(next[newIdx]?.id ?? null);
  };

  const handleSave = async () => {
    if (!currentProjectId) return;
    setIsSaving(true);
    try {
      const content = chaptersToMarkdown(ebookTitle, chapters);
      const res = await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebookTitle, ebookContent: content }),
      });
      if (!res.ok) throw new Error();
      toast.success("저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenChapter = async () => {
    if (!currentProjectId || !activeChapter) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(
        `/api/projects/${currentProjectId}/regenerate-chapter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterTitle: activeChapter.title,
            chapterNumber: activeChapter.number,
            totalChapters: chapters.length,
            ebookTitle,
            writingStyle: templateSettings.writingStyle,
            sentenceStructure: templateSettings.sentenceStructure,
          }),
        }
      );
      if (!res.ok) throw new Error();
      const { content } = await res.json();
      updateChapterContent(activeChapter.id, content);
      toast.success("챕터가 재생성되었습니다.");
    } catch {
      toast.error("챕터 재생성에 실패했습니다.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownload = async (format: DownloadFormat) => {
    if (!currentProjectId) return;
    setIsDownloading(true);
    setShowDownloadMenu(false);

    // 저장 후 다운로드
    const content = chaptersToMarkdown(ebookTitle, chapters);
    try {
      await fetch(`/api/projects/${currentProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebookTitle, ebookContent: content }),
      });
    } catch {}

    try {
      const res = await fetch(
        `/api/projects/${currentProjectId}/download?format=${format}`
      );
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ebookTitle}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("다운로드가 시작됩니다!");
    } catch {
      toast.error("다운로드에 실패했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  // 점수별 색상
  const scoreColor = (s: number) =>
    s >= 80 ? "text-green-600" : s >= 60 ? "text-orange-500" : "text-red-500";

  const scoreBg = (s: number) =>
    s >= 80
      ? "bg-green-50 border-green-200"
      : s >= 60
      ? "bg-orange-50 border-orange-200"
      : "bg-red-50 border-red-200";

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            className="mx-auto animate-spin text-brand-500 mb-4"
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
          <p className="text-sm text-gray-500">편집기를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
      {/* ── 헤더 바 ── */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b bg-white px-4">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-1.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 group-hover:bg-brand-700 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-xs font-bold text-gray-900">
            PLR<span className="text-brand-600">to</span>eBook
          </span>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">전자책 편집기</span>

        {/* 품질 점수 */}
        <div className="ml-4 hidden md:flex items-center gap-2">
          {[
            {
              label: "분량",
              score: qualityScore.volumeScore,
              detail: `${qualityScore.chaptersAbove3000}/${qualityScore.totalChapters}챕터`,
            },
            { label: "현지화", score: qualityScore.localizationScore },
            { label: "트렌드", score: qualityScore.trendScore },
          ].map(({ label, score, detail }) => (
            <div
              key={label}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${scoreBg(score)}`}
            >
              <span className="text-gray-500">{label}</span>
              <span className={`font-bold ${scoreColor(score)}`}>{score}</span>
              {detail && (
                <span className="text-gray-400 text-[10px]">({detail})</span>
              )}
            </div>
          ))}
          <div
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${scoreBg(qualityScore.overallScore)}`}
          >
            <span className="text-gray-500">종합</span>
            <span className={scoreColor(qualityScore.overallScore)}>
              {qualityScore.overallScore}
            </span>
            {qualityScore.overallScore >= 80 ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-green-500">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span className="text-orange-500 text-[10px]">!</span>
            )}
          </div>
        </div>

        {/* 재생성 권장 알림 */}
        {qualityScore.overallScore < 80 && qualityScore.totalChapters > 0 && (
          <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-2 py-0.5">
            재생성 권장
          </span>
        )}
      </div>

      {/* ── 메인 에디터 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 목차 패널 */}
        <aside className="flex w-60 flex-shrink-0 flex-col overflow-hidden border-r bg-white">
          {/* 전자책 제목 편집 */}
          <div className="border-b px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              전자책 제목
            </p>
            <input
              value={ebookTitle}
              onChange={(e) => setEbookTitle(e.target.value)}
              className="w-full text-xs font-semibold text-gray-800 focus:outline-none bg-transparent"
              placeholder="제목 입력..."
            />
            <p className="mt-1 text-[10px] text-gray-400">
              {chapters.length}챕터 · {totalChars.toLocaleString()}자
            </p>
          </div>

          {/* 챕터 목록 */}
          <div className="flex-1 overflow-y-auto py-1">
            {chapters.map((ch, i) => (
              <button
                key={ch.id}
                onClick={() => setActiveChapterId(ch.id)}
                className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                  activeChapterId === ch.id
                    ? "bg-brand-50 border-r-2 border-brand-500"
                    : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0 text-[10px] font-bold text-gray-400 w-4">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs leading-snug line-clamp-2 ${
                        activeChapterId === ch.id
                          ? "text-brand-700 font-semibold"
                          : "text-gray-700"
                      }`}
                    >
                      {ch.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span
                        className={`text-[10px] ${
                          ch.content.length >= 3000
                            ? "text-green-500"
                            : "text-orange-400"
                        }`}
                      >
                        {ch.content.length.toLocaleString()}자
                      </span>
                      {ch.content.length < 3000 && (
                        <span className="text-[10px] text-orange-400">⚠</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* 챕터 추가 */}
          <div className="border-t p-3">
            <button
              onClick={addChapter}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              챕터 추가
            </button>
          </div>
        </aside>

        {/* 오른쪽: 본문 편집 영역 */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeChapter ? (
            <>
              {/* 챕터 헤더 */}
              <div className="flex flex-shrink-0 items-center gap-3 border-b bg-white px-6 py-3">
                <input
                  value={activeChapter.title}
                  onChange={(e) =>
                    updateChapterTitle(activeChapter.id, e.target.value)
                  }
                  className="flex-1 text-base font-bold text-gray-900 focus:outline-none bg-transparent"
                  placeholder="챕터 제목"
                />
                <span
                  className={`flex-shrink-0 text-xs ${
                    activeChapter.content.length >= 3000
                      ? "text-green-600"
                      : "text-orange-500"
                  }`}
                >
                  {activeChapter.content.length.toLocaleString()}자
                  {activeChapter.content.length < 3000 && " · 3,000자 미달"}
                </span>
                <button
                  onClick={() => deleteChapter(activeChapter.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="챕터 삭제"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* 텍스트 편집기 */}
              <div className="flex-1 overflow-hidden p-4">
                <textarea
                  value={activeChapter.content}
                  onChange={(e) =>
                    updateChapterContent(activeChapter.id, e.target.value)
                  }
                  className="h-full w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-sm font-mono leading-relaxed text-gray-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  placeholder="챕터 내용을 작성하세요 (마크다운 형식)..."
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400">
              <div className="text-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mx-auto mb-3 opacity-30"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="14 2 14 8 20 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm">왼쪽 목차에서 챕터를 선택하세요</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── 하단 액션 바 ── */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-t bg-white px-4">
        <span className="flex-1 text-xs text-gray-400">
          총 {totalChars.toLocaleString()}자 · {chapters.length}챕터
        </span>

        {/* AI 재생성 */}
        <button
          onClick={handleRegenChapter}
          disabled={!activeChapterId || isRegenerating}
          className="btn-ghost text-xs gap-1.5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRegenerating ? (
            <>
              <svg
                width="12"
                height="12"
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
              재생성 중...
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 16H3v5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              AI 재생성
            </>
          )}
        </button>

        {/* 저장 */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-secondary text-xs py-2 px-4"
        >
          {isSaving ? "저장 중..." : "저장"}
        </button>

        {/* 다운로드 드롭다운 */}
        <div className="relative" ref={downloadMenuRef}>
          <button
            onClick={() => setShowDownloadMenu((prev) => !prev)}
            disabled={isDownloading}
            className="btn-primary text-xs py-2 px-4 gap-1.5"
          >
            {isDownloading ? (
              <>
                <svg
                  width="12"
                  height="12"
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
                다운로드 중...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                다운로드
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>

          {showDownloadMenu && (
            <div className="absolute bottom-full right-0 mb-2 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
              {FORMAT_OPTIONS.map(({ format, label, icon }) => (
                <button
                  key={format}
                  onClick={() => handleDownload(format)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <span className="text-base">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
