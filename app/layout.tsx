import type { Metadata } from "next";
import { Hahmlet, IBM_Plex_Sans_KR } from "next/font/google";
import Masthead from "@/app/components/Masthead";
import "./globals.css";

// 서체는 DESIGN.md 참고. next/font 가 빌드 때 받아 자체 호스팅하므로 런타임에 구글 요청이 없다.
const sans = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Hahmlet({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "회의없는회의",
  description: "모이지 않고, 질문과 답변으로 결론까지",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        <Masthead />
        {children}
      </body>
    </html>
  );
}
