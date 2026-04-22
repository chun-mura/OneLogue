"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, Category } from "@/lib/api";

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
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--danger)]">
              Delete Category
            </p>
            <h2
              id="delete-confirm-title"
              className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]"
            >
              カテゴリを削除しますか
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              「{deleteConfirmCategory.name}」を削除します。利用中のカテゴリは削除できません。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white/80"
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

      <section className="overflow-hidden rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--accent)]">
              Categories
            </p>
            <h1 className="max-w-2xl font-[family-name:var(--font-serif)] text-4xl leading-tight text-[color:var(--text)] sm:text-5xl">
              タスクで使うカテゴリを、先に整えておく。
            </h1>
            <p className="max-w-xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
              ここで登録したカテゴリだけが、タスク作成時に選択できます。集計の粒度を安定させたいときに有効です。
            </p>
          </div>

          <form
            className="rounded-[30px] border border-[color:var(--line)] bg-white/70 p-5"
            onSubmit={handleSubmit}
          >
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">
              New Category
            </p>
            <div className="mt-4 grid gap-3">
              <input
                className="rounded-[20px] border border-[color:var(--line)] bg-white px-4 py-3 text-sm text-[color:var(--text)]"
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
          <p className="mt-5 rounded-[22px] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-[36px] border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow)] backdrop-blur lg:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--accent)]">Library</p>
            <h2 className="mt-2 font-[family-name:var(--font-serif)] text-3xl text-[color:var(--text)]">
              登録済みカテゴリ
            </h2>
          </div>
          <p className="text-sm text-[color:var(--muted)]">{categories.length} items</p>
        </div>

        <div className="mt-6 space-y-3">
          {categories.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-[color:var(--line-strong)] bg-white/50 px-4 py-12 text-center text-sm text-[color:var(--muted)]">
              まだカテゴリは登録されていません
            </div>
          ) : (
            categories.map((category) => (
              <article
                key={category.id}
                className="flex flex-col gap-3 rounded-[28px] border border-[color:var(--line)] bg-white/72 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-lg font-semibold text-[color:var(--text)]">{category.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    登録日 {new Date(category.created_at).toLocaleDateString("ja-JP")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  className="rounded-full border border-[color:var(--line-strong)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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
