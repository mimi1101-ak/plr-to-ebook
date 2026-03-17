"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn, formatFileSize, MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from "@/lib/utils";

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
}

export default function DropZone({ onFileSelect, isUploading }: DropZoneProps) {
  const [dragError, setDragError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setDragError(null);

      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0];
        if (error.code === "file-too-large") {
          setDragError("파일 크기가 50MB를 초과합니다.");
        } else if (error.code === "file-invalid-type") {
          setDragError(".docx 또는 .pdf 파일만 지원합니다.");
        } else {
          setDragError("파일을 업로드할 수 없습니다.");
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxSize: MAX_FILE_SIZE,
      maxFiles: 1,
      disabled: isUploading,
    });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200",
        isDragActive && !isDragReject
          ? "border-brand-400 bg-brand-50 scale-[1.01]"
          : "border-gray-200 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/50",
        isDragReject && "border-red-400 bg-red-50",
        isUploading && "cursor-not-allowed opacity-60",
        dragError && "border-red-300 bg-red-50"
      )}
    >
      <input {...getInputProps()} />

      {/* 아이콘 */}
      <div
        className={cn(
          "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
          isDragActive && !isDragReject
            ? "bg-brand-100 text-brand-600"
            : "bg-white text-gray-400 shadow-sm",
          isDragReject && "bg-red-100 text-red-500",
          dragError && "bg-red-100 text-red-500"
        )}
      >
        {isDragReject || dragError ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : isDragActive ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* 텍스트 */}
      {dragError ? (
        <>
          <p className="text-sm font-semibold text-red-600">{dragError}</p>
          <p className="mt-1 text-xs text-red-400">다시 시도해 주세요</p>
        </>
      ) : isDragActive ? (
        <p className="text-sm font-semibold text-brand-700">여기에 놓으세요!</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-gray-700">
            파일을 드래그하거나{" "}
            <span className="text-brand-600 underline underline-offset-2">
              클릭하여 선택
            </span>
          </p>
          <p className="mt-2 text-xs text-gray-400">
            .docx, .pdf 지원 · 최대 50MB
          </p>
        </>
      )}

      {/* 파일 타입 뱃지 */}
      <div className="mt-6 flex items-center justify-center gap-3">
        {[
          { ext: "DOCX", color: "bg-blue-50 text-blue-600 border-blue-200" },
          { ext: "PDF", color: "bg-red-50 text-red-600 border-red-200" },
        ].map(({ ext, color }) => (
          <span
            key={ext}
            className={cn(
              "rounded-lg border px-3 py-1 text-xs font-bold tracking-wide",
              color
            )}
          >
            {ext}
          </span>
        ))}
      </div>
    </div>
  );
}
