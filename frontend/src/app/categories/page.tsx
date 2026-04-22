"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, Category } from "@/lib/api";
import { formatTokyoDate } from "@/lib/datetime";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<Category | null>(null);

  async function refreshCategories() {
    const data = await api.listCategories();
    setCategories(data);
  }

  useEffect(() => {
    void (async () => {
      try {
        setError("");
        await refreshCategories();
      } catch (err) {
        setError(err instanceof Error ? err.message : "カテゴリ一覧の取得に失敗しました");
      }
    })();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError("");
    try {
      await api.createCategory({ name: name.trim() });
      setName("");
      await refreshCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "カテゴリの追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(categoryId: number): Promise<boolean> {
    setLoading(true);
    setError("");
    try {
      await api.deleteCategory(categoryId);
      await refreshCategories();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "カテゴリの削除に失敗しました");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!deleteConfirmCategory) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDeleteConfirmCategory(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmCategory]);

  return (
    <div className="space-y-6">
      {deleteConfirmCategory ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setDeleteConfirmCategory(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            className="w-full max-w-md rounded-[28px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-confirm-title"
              className="text-xl font-semibold text-[color:var(--text)]"
            >
              カテゴリを削除しますか
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              「{deleteConfirmCategory.name}」を削除します。利用中のカテゴリは削除できません。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white/8"
                disabled={loading}
                onClick={() => setDeleteConfirmCategory(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-full bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={loading}
                onClick={async () => {
                  const ok = await handleDelete(deleteConfirmCategory.id);
                  if (ok) setDeleteConfirmCategory(null);
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-2">
            <h1 className="text-[32px] font-semibold tracking-[-0.04em] text-[color:var(--text)]">
              カテゴリ
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              タスクで使うカテゴリを管理します。
            </p>
          </div>

          <form
            className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-3">
              <input
                className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--bg-soft)] px-4 py-3 text-sm text-[color:var(--text)]"
                placeholder="例: 開発"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                カテゴリを追加
              </button>
            </div>
          </form>
        </div>

        {error ? (
          <p className="mt-5 rounded-[22px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--text)]">
              登録済みカテゴリ
            </h2>
          </div>
          <p className="text-sm text-[color:var(--muted)]">{categories.length} 件</p>
        </div>

        <div className="mt-6 space-y-3">
          {categories.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-soft)] px-4 py-12 text-center text-sm text-[color:var(--muted)]">
              まだカテゴリは登録されていません
            </div>
          ) : (
            categories.map((category) => (
              <article
                key={category.id}
                className="flex flex-col gap-3 rounded-[22px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold text-[color:var(--text)]">{category.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    登録日 {formatTokyoDate(category.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setDeleteConfirmCategory(category)}
                >
                  削除
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
