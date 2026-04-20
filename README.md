# TODO & Time Tracker (MVP)

FastAPI + Next.js + SQLite + Docker で動作する、タスク管理と排他タイマーのMVPです。

## 起動手順

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API Docs: `http://localhost:8000/docs`

## 主なAPI

- `POST /tasks` タスク作成
- `GET /tasks` タスク一覧
- `PATCH /tasks/{id}` タスク更新
- `DELETE /tasks/{id}` タスク削除
- `POST /tasks/{id}/start` タイマー開始（他タスクが稼働中なら自動停止）
- `POST /tasks/{id}/stop` タイマー停止
- `GET /stats/summary?range=daily|weekly|monthly|custom&from=&to=` カテゴリ別集計

## 最小E2E確認手順

1. Task A を作成して Start
2. Task B を作成して Start
3. `POST /tasks/{A}/start` で開始された計測が、Task B 開始時に自動で終了していることを確認
4. Dashboard でカテゴリ別集計が表示されることを確認

## テスト

```bash
cd backend
python -m pytest -q
```

## 既知制約

- SQLite 前提の単一ユーザーMVP
- 進行中タイマー状態はフロント側でメモリ保持（リロードで再同期は未実装）
# OneLogue
