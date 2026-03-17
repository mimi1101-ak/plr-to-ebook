"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  { href: "/upload", label: "업로드", step: 1 },
  { href: "/template", label: "템플릿", step: 2 },
  { href: "/processing", label: "변환", step: 3 },
  { href: "/result", label: "다운로드", step: 4 },
];

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const currentStep = steps.findIndex((s) => pathname.startsWith(s.href));

  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-sm group-hover:bg-brand-700 transition-colors">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="text-white"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">
              PLR<span className="text-brand-600">to</span>eBook
            </span>
          </Link>

          {/* 스텝 인디케이터 (홈 제외) */}
          {!isHome && (
            <nav className="hidden md:flex items-center gap-1">
              {steps.map((step, idx) => {
                const isDone = idx < currentStep;
                const isActive = idx === currentStep;

                return (
                  <div key={step.href} className="flex items-center">
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        isActive &&
                          "bg-brand-50 text-brand-700",
                        isDone && "text-gray-400",
                        !isActive && !isDone && "text-gray-300"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                          isActive && "bg-brand-600 text-white",
                          isDone && "bg-green-500 text-white",
                          !isActive && !isDone && "bg-gray-100 text-gray-400"
                        )}
                      >
                        {isDone ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M20 6L9 17l-5-5"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          step.step
                        )}
                      </span>
                      {step.label}
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={cn(
                          "mx-1 h-px w-4",
                          idx < currentStep ? "bg-green-300" : "bg-gray-200"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </nav>
          )}

          {/* CTA */}
          {isHome && (
            <Link href="/upload" className="btn-primary text-xs px-4 py-2">
              무료로 시작하기
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
