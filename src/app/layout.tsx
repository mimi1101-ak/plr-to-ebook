import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLR to eBook | AI 전자책 자동 변환기",
  description:
    "PLR 콘텐츠를 AI로 완성도 높은 전자책으로 자동 변환합니다. .docx와 .pdf를 업로드하면 일관된 문체의 전자책을 생성해 드립니다.",
  keywords: ["PLR", "전자책", "ebook", "AI 변환", "콘텐츠 변환"],
  openGraph: {
    title: "PLR to eBook | AI 전자책 자동 변환기",
    description: "PLR 콘텐츠를 AI로 완성도 높은 전자책으로 자동 변환",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1e293b",
              color: "#f8fafc",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
            },
            success: {
              iconTheme: {
                primary: "#4466ff",
                secondary: "#fff",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
