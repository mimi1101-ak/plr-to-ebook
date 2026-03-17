import Link from "next/link";
import Header from "@/components/layout/Header";

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="14 2 14 8 20 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: ".docx / .pdf 업로드",
    description: "최대 50MB 파일을 드래그앤드롭 또는 클릭으로 간편하게 업로드",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "문체·구조 템플릿 설정",
    description: "전문적·친근한·학술적 등 4가지 문체와 목차 형식을 자유롭게 선택",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <polygon
          points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: "AI 원클릭 변환",
    description: "Claude AI가 콘텐츠 전체를 일관된 문체로 재작성·구조화",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="7 10 12 15 17 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="12"
          y1="15"
          x2="12"
          y2="3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    title: "즉시 다운로드",
    description: "변환 완료 즉시 완성된 전자책 파일을 다운로드",
  },
];

const steps = [
  {
    step: "01",
    title: "파일 업로드",
    description: "PLR 원고 파일(.docx 또는 .pdf)을 업로드합니다.",
    color: "bg-brand-50 text-brand-700 border-brand-200",
  },
  {
    step: "02",
    title: "템플릿 선택",
    description: "원하는 문체, 목차 구조, 문장 길이를 설정합니다.",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    step: "03",
    title: "AI 자동 변환",
    description: "Claude AI가 전체 내용을 일관성 있게 재작성합니다.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    step: "04",
    title: "다운로드",
    description: "완성된 전자책 파일을 즉시 다운로드합니다.",
    color: "bg-green-50 text-green-700 border-green-200",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="gradient-hero pt-20 pb-24 px-4">
        <div className="mx-auto max-w-4xl text-center">
          {/* 배지 */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold text-brand-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600"></span>
            </span>
            Claude AI 기반 · 원클릭 변환
          </div>

          {/* 헤드라인 */}
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            PLR 원고를
            <br />
            <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">
              완성도 높은 전자책
            </span>
            으로
          </h1>

          <p className="mb-10 mx-auto max-w-2xl text-lg text-gray-500 leading-relaxed">
            .docx 또는 .pdf 파일을 업로드하고 원하는 문체를 선택하면,
            <br className="hidden sm:block" />
            AI가 전체 콘텐츠를 일관성 있게 재작성해 전자책을 완성합니다.
          </p>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/upload" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-brand-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              파일 업로드하기
            </Link>
            <a
              href="#how-it-works"
              className="btn-ghost text-base px-6 py-3.5"
            >
              작동 방식 보기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          {/* 서브텍스트 */}
          <p className="mt-6 text-sm text-gray-400">
            무료로 시작 · 회원가입 불필요 · 최대 50MB 지원
          </p>
        </div>

        {/* Hero 미리보기 카드 */}
        <div className="mx-auto mt-16 max-w-3xl">
          <div className="relative rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-100 overflow-hidden">
            {/* 가짜 브라우저 바 */}
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
              <div className="mx-auto flex-1 max-w-xs rounded-md bg-gray-200 px-3 py-1 text-center text-xs text-gray-400">
                plr-to-ebook.vercel.app
              </div>
            </div>

            {/* 업로드 영역 미리보기 */}
            <div className="p-8">
              <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-brand-600"
                  >
                    <path
                      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-brand-700 mb-1">
                  .docx 또는 .pdf 파일을 여기에 드롭하세요
                </p>
                <p className="text-xs text-gray-400">또는 클릭하여 파일 선택 · 최대 50MB</p>
              </div>

              {/* 진행 바 (예시) */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium">AI 변환 중...</span>
                  <span className="text-brand-600 font-semibold">72%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all"
                    style={{ width: "72%" }}
                  />
                </div>
                <p className="text-xs text-gray-400">챕터 5/7 재작성 중...</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 카드 섹션 */}
      <section className="py-20 px-4 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              왜 PLR to eBook인가요?
            </h2>
            <p className="mt-3 text-gray-500">
              반복적인 편집 작업 없이, AI가 모든 것을 처리합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="card hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-sm font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              4단계로 완성
            </h2>
            <p className="mt-3 text-gray-500">
              복잡한 설정 없이 누구나 쉽게 사용할 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((item, idx) => (
              <div key={item.step} className="relative">
                {/* 연결선 */}
                {idx < steps.length - 1 && (
                  <div className="absolute right-0 top-8 hidden h-px w-8 bg-gray-200 lg:block translate-x-4" />
                )}
                <div className={`card border ${item.color} bg-opacity-40`}>
                  <div
                    className={`mb-3 inline-flex rounded-lg border px-2 py-0.5 text-xs font-bold ${item.color}`}
                  >
                    STEP {item.step}
                  </div>
                  <h3 className="mb-2 text-sm font-bold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-500">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 최종 CTA */}
          <div className="mt-12 text-center">
            <Link href="/upload" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-brand-200">
              지금 바로 시작하기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8 px-4">
        <div className="mx-auto max-w-5xl flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600">
              <svg
                width="12"
                height="12"
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
            <span className="text-xs font-semibold text-gray-600">
              PLRtoeBook
            </span>
          </div>
          <p className="text-xs text-gray-400">
            © 2025 PLR to eBook. Powered by Claude AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
