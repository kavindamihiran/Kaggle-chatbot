import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qwen AI Chat — Powered by Qwen2.5-Coder",
  description:
    "A premium AI chatbot interface powered by Qwen2.5-Coder-14B-Instruct, hosted on Kaggle with GPU acceleration.",
  keywords: ["AI", "chatbot", "Qwen", "coding assistant", "LLM"],
  openGraph: {
    title: "Qwen AI Chat",
    description: "AI-powered coding assistant using Qwen2.5-Coder-14B",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
