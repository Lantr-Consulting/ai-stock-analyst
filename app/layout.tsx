import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display voice for the marketing landing (FORGE, matching lantr.site).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "AI Stock Analyst｜Lantr 往届学生作品",
  description:
    "一位 Lantr 往届学生完成的 AI 投资研究助手：查看实时行情、整理交易建议，并在用户确认后进行模拟交易。课程结束后由 Lantr 继续托管。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-screen">
        <Script
          id="analyst-preferences"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light";var l=document.cookie.match(/(?:^|; )lantr-lang=(en|zh)/)?.[1]||localStorage.getItem("lantr-lang");document.documentElement.lang=l==="en"?"en":"zh-CN"}catch(e){}',
          }}
        />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
