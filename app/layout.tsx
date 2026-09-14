import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "회의없는회의",
  description: "모이지 않고, 질문과 답변으로 결론까지",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
