import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TODO & Time Tracker",
  description: "Task manager with exclusive timer"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-6xl gap-4 px-6 py-4">
            <Link className="font-semibold text-blue-700" href="/">
              Tasks
            </Link>
            <Link className="font-semibold text-blue-700" href="/dashboard">
              Dashboard
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
