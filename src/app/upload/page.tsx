"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import DropZone from "@/components/upload/DropZone";
import FilePreview from "@/components/upload/FilePreview";
import { useAppStore } from "@/lib/store";

export default function UploadPage() {
  const router = useRouter();
  const { setUploadedFile, setCurrentProjectId } = useAppStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadProgress(0);
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // 진행률 시뮬레이션 (실제 XHR 업로드 진행률은 API Route에서 처리)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 12;
        });
      }, 200);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "업로드에 실패했습니다.");
      }

      setUploadProgress(100);
      const data = await response.json();

      setCurrentProjectId(data.projectId);
      setUploadedFile({
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.name.endsWith(".docx") ? "docx" : "pdf",
      });

      toast.success("파일 업로드 완료!");

      setTimeout(() => {
        router.push("/template");
      }, 600);
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(
        error instanceof Error ? error.message : "업로드에 실패했습니다."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-2xl px-4 py-12">
        {/* 페이지 타이틀 */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="step-badge h-5 w-5 text-xs">1</span>
            파일 업로드
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            PLR 원고 파일을 업로드하세요
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            .docx 또는 .pdf 형식, 최대 50MB
          </p>
        </div>

        {/* 업로드 영역 */}
        <div className="space-y-4">
          {!selectedFile ? (
            <DropZone onFileSelect={handleFileSelect} isUploading={isUploading} />
          ) : (
            <FilePreview
              file={selectedFile}
              onRemove={handleRemove}
              isUploading={isUploading}
              uploadProgress={Math.round(uploadProgress)}
            />
          )}

          {/* 안내 사항 */}
          {!selectedFile && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex gap-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="flex-shrink-0 text-amber-500 mt-0.5"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-semibold">업로드 전 확인하세요</p>
                  <ul className="space-y-0.5 text-amber-600">
                    <li>• 텍스트가 포함된 .docx 또는 .pdf 파일</li>
                    <li>• 스캔 이미지 PDF는 지원하지 않습니다</li>
                    <li>• 파일 크기 최대 50MB</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 다음 단계 버튼 */}
          {selectedFile && !isUploading && uploadProgress < 100 && (
            <button
              onClick={handleUpload}
              className="btn-primary w-full py-3.5 text-base"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              업로드하고 다음 단계로
            </button>
          )}

          {isUploading && (
            <button disabled className="btn-primary w-full py-3.5 text-base">
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
              업로드 중...
            </button>
          )}
        </div>

        {/* 지원 파일 설명 */}
        <div className="mt-10 grid grid-cols-2 gap-4">
          {[
            {
              type: "DOCX",
              color: "border-blue-100 bg-blue-50",
              iconColor: "text-blue-500",
              title: "Word 문서 (.docx)",
              desc: "Microsoft Word로 작성된 텍스트 문서",
            },
            {
              type: "PDF",
              color: "border-red-100 bg-red-50",
              iconColor: "text-red-500",
              title: "PDF 문서 (.pdf)",
              desc: "텍스트 레이어가 있는 PDF 파일",
            },
          ].map((item) => (
            <div
              key={item.type}
              className={`rounded-xl border p-4 ${item.color}`}
            >
              <p className={`text-xs font-extrabold ${item.iconColor} mb-1`}>
                {item.type}
              </p>
              <p className="text-xs font-semibold text-gray-700">{item.title}</p>
              <p className="mt-1 text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
