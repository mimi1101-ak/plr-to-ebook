"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import { useAppStore } from "@/lib/store";
import { formatFileSize } from "@/lib/utils";
import type { Project } from "@/types";

export default function ResultPage() {
  const router = useRouter();
  const { currentProjectId, uploadedFile, resetProject } = useAppStore();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!currentProjectId) {
      router.push("/upload");
      return;
    }

    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${currentProjectId}`);
        if (!response.ok) throw new Error("프로젝트를 불러올 수 없습니다.");
        const data = await response.json();
        setProject(data);
      } catch (error) {
        toast.error("결과를 불러오는 데 실패했습니다.");
        router.push("/processing");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [currentProjectId, router]);

  const handleDownload = async () => {
    if (!currentProjectId) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/projects/${currentProjectId}/download`);
      if (!response.ok) throw new Error("다운로드 실패");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.ebookTitle ?? "ebook"}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("다운로드가 시작됩니다!");
    } catch (error) {
      toast.error("다운로드에 실패했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNewProject = () => {
    resetProject();
    router.push("/upload");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto animate-spin text-brand-500 mb-4">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
            <p className="text-sm text-gray-500">결과를 불러오는 중...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* 완료 헤더 */}
        <div className="mb-8 text-center">
          <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-green-600">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold">4</span>
            변환 완료
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            전자책이 완성되었습니다!
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Claude AI가 콘텐츠를 일관된 문체로 재작성했습니다.
          </p>
        </div>

        {/* 결과 카드 */}
        <div className="card mb-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 leading-tight">
                {project?.ebookTitle ?? "전자책"}
              </h2>
              {uploadedFile && (
                <p className="mt-0.5 text-xs text-gray-400">
                  원본: {uploadedFile.name}
                </p>
              )}
            </div>
            <span className="flex-shrink-0 rounded-lg bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-bold text-green-700">
              완료
            </span>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              {
                label: "예상 페이지",
                value: project?.pageCount ? `${project.pageCount}p` : "-",
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                label: "글자 수",
                value: project?.wordCount ? `${project.wordCount.toLocaleString()}자` : "-",
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <line x1="17" y1="10" x2="3" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="21" y1="6" x2="3" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="21" y1="14" x2="3" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="17" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                label: "원본 크기",
                value: uploadedFile ? formatFileSize(uploadedFile.size) : "-",
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-gray-50 p-3 text-center">
                <div className="mb-1 flex justify-center text-gray-400">{stat.icon}</div>
                <p className="text-base font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* 콘텐츠 미리보기 */}
          {project?.ebookContent && (
            <div className="mb-5 rounded-xl bg-gray-50 p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 mb-2">미리보기</p>
              <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">
                {project.ebookContent.slice(0, 800)}
                {project.ebookContent.length > 800 && "\n\n..."}
              </pre>
            </div>
          )}

          {/* 다운로드 버튼 */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="btn-primary w-full py-3.5 text-base"
          >
            {isDownloading ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                다운로드 중...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                전자책 다운로드 (.md)
              </>
            )}
          </button>
        </div>

        {/* 액션 */}
        <div className="flex gap-3">
          <button onClick={handleNewProject} className="btn-secondary flex-1">
            새 프로젝트 시작
          </button>
          <Link href="/" className="btn-ghost flex-1 text-center">
            홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}
