"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "作業場" },
  { href: "/time-entries", label: "時間ログ" },
  { href: "/categories", label: "カテゴリ" },
  { href: "/dashboard", label: "集計" }
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRootRef = useRef<HTMLDivElement | null>(null);

  const items = navItems.map((item) => {
    const active = isActivePath(pathname, item.href);
    return { ...item, active };
  });

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!mobileRootRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      <nav className="hidden items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-soft)] p-1.5 shadow-[var(--shadow)] backdrop-blur md:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={[
              "relative rounded-full px-4 py-2 text-sm font-semibold transition",
              item.active
                ? "bg-[color:var(--accent)]/12 text-[color:var(--accent-strong)] shadow-[inset_0_0_0_1px_rgba(79,124,255,0.18)]"
                : "text-[color:var(--muted)] hover:bg-white/10 hover:text-[color:var(--text)]"
            ].join(" ")}
          >
            <span className="relative z-10">{item.label}</span>
            {item.active ? (
              <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-[color:var(--accent)]/70" />
            ) : null}
          </Link>
        ))}
      </nav>

      <div ref={mobileRootRef} className="relative z-50 md:hidden">
        <button
          type="button"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-soft)] text-[color:var(--text)] shadow-[var(--shadow)]"
          aria-label="メニューを開く"
          aria-expanded={mobileOpen}
          aria-controls="mobile-site-nav"
          onClick={() => setMobileOpen((current) => !current)}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none">
            <path
              d="M3.5 5.5H16.5M3.5 10H16.5M3.5 14.5H16.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {mobileOpen ? (
          <div
            id="mobile-site-nav"
            className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(18rem,calc(100vw-2rem))] rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-2.5 shadow-[var(--shadow)]"
          >
            <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
              現在の画面
            </p>
            <div className="mt-2 grid gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={[
                    "rounded-[18px] border px-4 py-3 text-sm font-semibold",
                    item.active
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                      : "border-transparent bg-transparent text-[color:var(--text)] hover:border-[color:var(--line)] hover:bg-[color:var(--surface-soft)]"
                  ].join(" ")}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
