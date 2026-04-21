import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Manrope, Newsreader } from "next/font/google";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "OneLogue",
  description: "Focused task manager with exclusive timer"
};

const navItems = [
  { href: "/", label: "Workspace" },
  { href: "/dashboard", label: "Insights" }
];

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${sans.variable} ${serif.variable} font-[family-name:var(--font-sans)]`}>
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white/55 to-transparent" />
          <header className="relative z-10">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] text-sm font-bold tracking-[0.2em] text-[color:var(--accent)] shadow-[var(--shadow)]">
                  OL
                </span>
                <div>
                  <p className="font-[family-name:var(--font-serif)] text-2xl leading-none text-[color:var(--text)]">
                    OneLogue
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
                    Focus Workspace
                  </p>
                </div>
              </Link>

              <nav className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1.5 shadow-[var(--shadow)] backdrop-blur">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--muted)] hover:bg-white/70 hover:text-[color:var(--text)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
