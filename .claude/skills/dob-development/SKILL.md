---
name: dob-development
description: >-
  LifeProductMap（個人生産性アプリ: 目標管理 + 勤怠管理）の実装ガイド。
  LifeProductMap リポジトリ（life-product-map/）でコードを書くとき・PR を作るとき・デバッグするときに使用する。
  「Step-X を実装して」「NavPane を作って」「PR 作成して」などの操作で自動的に適用する。
---

# LifeProductMap 開発スキル

## アーキテクチャ

```
Pane 1 (NavPane)
  ← 目標一覧（最大5件）/ 勤怠モード切替
Pane 2 (TaskListPane / AttendancePane)
  ← 月マイルストーン + 週タスク展開（目標モード）
  ← 出退勤打刻 + 稼働時間設定（勤怠モード）
Pane 3 (DetailPane / AttendanceListPane)
  ← 今日のタスク一覧（常時）・タスク詳細・日報入力・AI フィードバック（目標モード）
  ← 月次打刻一覧（勤怠モード）
Pane 4 (AiChatPane)
  ← AI 壁打ちチャット（目標モードのみ表示。勤怠モード時は非表示）
```

状態は Workspace.tsx が全て保持し、各 Pane に props + callback で渡す（単方向データフロー）。

## 技術的決定事項

| 決定 | 採用内容 | 理由 |
|---|---|---|
| フレームワーク | Next.js 16 App Router | Phase 2 の Supabase 連携でも設計を変えずに済む |
| UI コンポーネント | shadcn/ui (base-nova / @base-ui/react) | workspace-ui-kit と同じ基盤。asChild ではなく render prop を使う |
| スキーマ定義 | Zod | 型定義とランタイム検証を1か所で管理。localStorage 検証にも使う |
| 永続化 (Phase 1) | localStorage | 外部サービス不要でオフライン動作。Phase 2 で Supabase に差し替え |
| AI (Phase 3) | claude-haiku-4-5 | コスト最小（約0.01-0.02円/コール） |
| スタイリング | Tailwind CSS v4 + @theme | CSS 変数でデザイントークンを一元管理。色番号直書き禁止 |
| 曜日カラー | 土曜: `--weekday-sat`（青）、日祝: `--weekday-sun`（赤） | `tokens.css` で定義。祝日は React 実装時にライブラリで対応 |

## Phase 1 実装 Step 一覧

| Step | PR タイトル | 主な作業 |
|---|---|---|
| 1 | `setup: Next.js + shadcn/ui 初期設定` | create-next-app、shadcn、globals.css |
| 2 | `feat: データスキーマと localStorage 永続化` | lib/schema.ts、lib/storage.ts、lib/computed/tasks.ts |
| 3 | `feat: Workspace 骨格と NavPane` | Workspace.tsx（state 全体）、NavPane.tsx |
| 4 | `feat: 目標モード TaskListPane` | TaskListPane.tsx（月マイル・週タスク・進捗バッジ） |
| 5 | `feat: 目標モード DetailPane` | DetailPane.tsx（今日のタスク一覧・タスク詳細・日報・AI フィードバック） |
| 6 | `feat: AI チャットモック（AiChatPane）` | AiChatPane.tsx（Phase 3 接続前のモック UI） |
| 7 | `feat: 勤怠モード - 打刻 UI` | AttendancePane.tsx（出退勤打刻・稼働時間設定） |
| 8 | `feat: 勤怠モード - 月次一覧` | AttendanceListPane.tsx（月次打刻一覧・打刻表示） |
| 9 | `feat: 勤怠モード - xlsx エクスポート` | lib/xlsx-export.ts（月次データ xlsx ダウンロード） |
| 10 | `feat: シードデータと E2E 動作確認` | data/seed.ts・全シナリオ手動確認 |

## 参照ドキュメント

| ファイル | 用途 |
|---|---|
| [reference/steps.md](reference/steps.md) | 各 Step の完了条件・作成ファイル・スキーマ定義。実装前に必ず読む |
| [reference/workflow.md](reference/workflow.md) | 実装→PR→レビュー対応→マージ待ちの詳細手順。コード規約・サブエージェントの使い方も記載 |
| [reference/pr-template.md](reference/pr-template.md) | PR 概要の書き方・Step 別記載ポイント |
| [reference/comment-policy.md](reference/comment-policy.md) | コメントの書き方（WHY を書く・WHAT は書かない）の詳細と記述例 |
| [mock/index.html](../../../mock/index.html) | UI デザイン確認用モックアップ（HTML + CSS + JS）。各 Pane の見た目・構造の参考に使う。`python3 -m http.server 5500` で起動し `http://localhost:5500/mock/` でアクセス。コンポーネントは `mock/components/goal/` と `mock/components/attendance/` に分割されている |

## スキルの更新ルール

仕様・運用方法に変更があった場合は、以下の対応表に従って必ず更新すること。

| 変更内容 | 更新するファイル |
|---|---|
| データモデルの追加・変更 | `reference/steps.md`（スキーマ定義・Workspace state）、`SKILL.md`（アーキテクチャ） |
| Pane の仕様変更 | `reference/steps.md`（該当 Step の表示状態・完了条件）、`SKILL.md`（アーキテクチャ）、`docs/file-structure.md` |
| Step の追加・分割 | `reference/steps.md`、`SKILL.md`（Phase 1 実装 Step 一覧）、`reference/pr-template.md` |
| Git・PR 運用ルールの変更 | `reference/workflow.md` |

**更新したスキルファイルは必ずコミット対象に含めること。**
スキルファイルはコードと同じくバージョン管理するため、実装コミットと同じ feature ブランチにまとめてコミットする。
