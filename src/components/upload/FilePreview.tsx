"use client";

import { formatFileSize } from "@/lib/utils";

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

export default function FilePreview({
  file,
  onRemove,
  isUploading,
  uploadProgress = 0,
}: FilePreviewProps) {
  const isDocx = file.name.endsWith(".docx");
  const isPdf = file.name.endsWith(".pdf");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {/* 파일 아이콘 */}
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
            isDocx
              ? "bg-blue-50 text-blue-600"
              : isPdf
              ? "bg-red-50 text-red-600"
              : "bg-gray-50 text-gray-600"
          }`}
        >
          {isDocx ? "DOCX" : isPdf ? "PDF" : "FILE"}
        </div>

        {/* 파일 정보 */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {file.name}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {formatFileSize(file.size)}
          </p>

          {/* 업로드 진행 바 */}
          {isUploading && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-gray-500">서버에 업로드 중...</span>
                <span className="font-semibold text-brand-600">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 삭제 버튼 */}
        {!isUploading && (
          <button
            onClick={onRemove}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="파일 제거"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* 완료 아이콘 */}
        {!isUploading && uploadProgress === 100 && (
          <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
