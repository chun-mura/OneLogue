import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

import { AppTimeProvider } from "@/components/app-time-provider";
import { getTokyoTodayDateString } from "@/lib/datetime";

export const metadata: Metadata = {
  title: "OneLogue",
  description: "Focused task manager with exclusive timer"
};

const navItems = [
  { href: "/", label: "作業場" },
  { href: "/time-entries", label: "時間ログ" },
  { href: "/categories", label: "カテゴリ" },
  { href: "/dashboard", label: "集計" }
];

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialTodayKey = getTokyoTodayDateString();
  const initialNowIso = new Date().toISOString();

  return (
    <html lang="ja" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="notranslate font-[family-name:var(--font-sans)]" suppressHydrationWarning>
        <AppTimeProvider initialTodayKey={initialTodayKey} initialNowIso={initialNowIso}>
          <div className="relative min-h-screen overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/5 to-transparent" />
            <header className="relative z-10">
              <div className="mx-auto flex max-w-[1800px] items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] text-sm font-bold tracking-[0.2em] text-[color:var(--accent)] shadow-[var(--shadow)]">
                    OL
                  </span>
                  <div>
                    <p className="font-[family-name:var(--font-serif)] text-xl font-semibold leading-none text-[color:var(--text)] sm:text-2xl">
                      OneLogue
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
                      Task Flow
                    </p>
                  </div>
                </Link>

                <nav className="hidden items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-soft)] p-1.5 shadow-[var(--shadow)] backdrop-blur md:flex">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--muted)] hover:bg-white/10 hover:text-[color:var(--text)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </header>

            <main className="relative z-10 mx-auto max-w-[1800px] px-5 pb-14 pt-2 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </AppTimeProvider>
      </body>
    </html>
  );
}
