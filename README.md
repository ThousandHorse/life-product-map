# LifeProductMap

目標管理と勤怠管理を一体化した個人生産性アプリ。

年目標 → 月マイルストーン → 週タスク → 今日のタスクへと細分化し、進捗を可視化する。
AI 壁打ちチャット・出退勤打刻・xlsx エクスポートを備えた 4 ペイン構成のワークスペース。

## 技術スタック

| 技術 | バージョン | 役割 |
|---|---|---|
| Next.js | 16 | フレームワーク（App Router） |
| React | 19 | UI ライブラリ |
| TypeScript | 5 | 型安全性 |
| Tailwind CSS | v4 | スタイリング |
| shadcn/ui | base-nova | UI コンポーネント |
| Zod | 4 | スキーマ定義・バリデーション |
| Supabase | - | データ永続化（Postgres、マルチデバイス同期） |

## 開発環境のセットアップ

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` に Supabase の `Project URL` と `anon public key`（Project Settings > API から取得）を設定する。
未設定のまま `npm run dev` を実行すると、初回のデータ読み込み時にエラーになる。

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開いてください。

## コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # 本番ビルド（型チェック含む）
```

## ブランチ運用

```
main        ← リリースブランチ（直接 push 禁止）
  └─ develop  ← 開発統合ブランチ（直接 push 禁止）
       └─ feature/step-XX-description  ← 作業ブランチ
```

- 作業は必ず `develop` ベースで `feature/` ブランチを切る
- PR は `develop` ベースで作成する
- `develop` → `main` のマージは定期的にリリースタイミングで行う

## フェーズ構成

| Phase | 内容 |
|---|---|
| 1 | Next.js セットアップ + localStorage 永続化 + 目標管理 UI |
| 2 | Supabase 移行（マルチデバイス同期） |
| 3 | Claude API (claude-haiku-4-5) AI 壁打ち機能 |
| 4 | モバイル対応 |

## 開発ガイド

実装ルール・コメントポリシー・PR テンプレートは以下を参照:

```
~/.claude/skills/dob-development/
├── SKILL.md                  # 技術スタック・規約・ワークフロー
└── reference/
    ├── steps.md              # 各 Step の完了条件
    ├── workflow.md           # PR 作成手順
    ├── pr-template.md        # PR テンプレート
    └── comment-policy.md    # コメントポリシー
```
