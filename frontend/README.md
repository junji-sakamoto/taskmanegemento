# タスク管理アプリ 画面（フロントエンド）

React + TypeScript + Vite で作った画面。サーバー（`backend/`）の窓口からボードを読み込んで表示する。

## 起動のしかた

先に、データベースとサーバーを起動しておく。

```bash
# リポジトリの一番上のフォルダで、データベースを起動する
docker compose up -d

# backend フォルダで、サーバーを起動する
.\gradlew.bat bootRun
```

そのあと、この `frontend` フォルダで次を実行する。

```bash
# 最初の1回だけ：必要な部品を入れる
npm install

# 画面を起動する
npm run dev
```

ブラウザで <http://localhost:5173> を開く。止めるときは、ターミナルで `Ctrl + C` を押す。

画面からの `/api` への通信は、Vite が `http://127.0.0.1:8080`（Spring Boot）へ取り次ぐ（`vite.config.ts`）。

## そのほかのコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run build` | 型のチェックをして、公開用のファイルを `dist/` に作る |
| `npm run lint` | コードを点検する（Oxlint） |
