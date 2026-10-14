import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoreAPI Starter",
  description:
    "A tiny open-source chat UI for LoreAPI, the OpenAI-compatible AI API for roleplay and creative apps.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
