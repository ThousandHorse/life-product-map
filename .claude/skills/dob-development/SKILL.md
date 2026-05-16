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
Pane 3 (DetailPane / CalendarPane)
  ← 今日のタスク一覧（常時）・タスク詳細・日報入力・AI フィードバック（目標モード）
  ← 月次カレンダー（勤怠モード）
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

各 Step の実装詳細: [reference/steps.md](reference/steps.md)

## コード規約

### コメントポリシー

**「なぜこう実装したか」を書く。「何をしているか」は書かない。**

新人エンジニアが疑問を持ちそうな技術的判断・ライブラリ制約・将来フェーズへの備えを明記する。
変数名・関数名で分かる処理の説明（WHAT）は書かない。

詳細と記述例: [reference/comment-policy.md](reference/comment-policy.md)

### ファイル先頭コメント（必須）

```tsx
/**
 * ComponentName.tsx
 *
 * このコンポーネントの役割を1〜2文で説明する。
 *
 * Props:
 *   propName: 型 — 説明
 *
 * 注意事項（設計上の制約・将来フェーズへの備えなど、ある場合のみ）:
 */
```

### レイアウト

```tsx
// ✅ 子要素の間隔は親の flex gap で管理する
<div className="flex flex-col gap-4">
  <Item />
  <Item />
</div>

// ❌ space-y-* は使わない（先頭要素にも margin が付くため）
```

### 色・トークン

```tsx
// ✅ 役割名のトークンを使う（globals.css の @theme で定義）
<div className="bg-primary text-primary-foreground" />

// ❌ 色番号直書き禁止
<div className="bg-blue-500" />
```

### shadcn (base-nova)

```tsx
// ✅ base-nova では render prop を使う
<Dialog.Trigger render={<Button>開く</Button>} />

// ❌ asChild は @base-ui/react では動作しない
<Dialog.Trigger asChild><Button /></Dialog.Trigger>
```

### 状態管理

- **派生 state を useEffect で複製しない**（レンダー中に計算する）
- **localStorage への read は useEffect 内**（SSR で window が存在しないため）
- **localStorage への write は state 変更後の useEffect 内**で自動保存

## 実装ワークフロー

```
Step 1: reference/steps.md で対象 Step の仕様確認
Step 2: 実装（完了条件を全て満たす）
Step 3: コードレビュー（reference/workflow.md の観点で自己確認）
Step 4: git push origin feature/step-XX-description → gh pr create --base develop
Step 5: ユーザーのマージを待つ ← 次の Step はマージ確認後に開始
```

- **1 Step ずつ進める**（複数 Step を一度に実装しない）
- **PR マージはユーザーが手動**（`gh pr merge` は使わない）
- **main / develop への直接 push 禁止**（必ず feature ブランチ経由）
- **PR のベースは develop**（`gh pr create --base develop` を必ず指定）

サブエージェントの詳細: [reference/workflow.md](reference/workflow.md)

## Git 運用

```bash
# develop を最新化してから feature ブランチを切る
git checkout develop && git pull origin develop
git checkout -b feature/step-XX-description

# PR 作成前にリモートへ push
git push origin feature/step-XX-description

# PR 作成（必ず --base develop を指定）
gh pr create --base develop --title "Step-XX: タイトル"

# マージ確認後に develop を最新化して次の feature ブランチへ
git checkout develop && git pull origin develop
```

⛔ 禁止事項:
- `git push origin main` / `git push origin develop`（直接 push 禁止）
- `gh pr merge`（CLI でのマージ操作禁止。GitHub 上でユーザーが手動マージ）

PR 概要の書き方: [reference/pr-template.md](reference/pr-template.md)

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
| 8 | `feat: 勤怠モード - 月次カレンダー` | CalendarPane.tsx（月次カレンダー・打刻表示） |
| 9 | `feat: 勤怠モード - xlsx エクスポート` | lib/xlsx-export.ts（月次データ xlsx ダウンロード） |
| 10 | `feat: シードデータと E2E 動作確認` | data/seed.ts・全シナリオ手動確認 |

## スキルの更新ルール

仕様・運用方法に変更があった場合は、以下のファイルを必ず更新すること。

| 変更内容 | 更新するファイル |
|---|---|
| データモデルの追加・変更 | `reference/steps.md`（スキーマ定義・Workspace state）、`SKILL.md`（アーキテクチャ） |
| Pane の仕様変更 | `reference/steps.md`（該当 Step の表示状態・完了条件）、`SKILL.md`（アーキテクチャ）、`docs/file-structure.md` |
| Step の追加・分割 | `reference/steps.md`、`SKILL.md`（Phase 1 実装 Step 一覧）、`reference/pr-template.md` |
| Git・PR 運用ルールの変更 | `reference/workflow.md`、`SKILL.md`（実装ワークフロー） |

**更新したスキルファイルは必ずコミット対象に含めること。**
スキルファイルはコードと同じくバージョン管理するため、実装コミットと同じ feature ブランチにまとめてコミットする。

**プロジェクト内と `~/.claude/skills/` の両方を常に同じ内容に保つこと。**
片方を変更したら、必ずもう片方にも同じ変更を加える（同期漏れ禁止）。

対象ファイル（両方を必ず同時に更新する）：
- `.claude/skills/dob-development/SKILL.md`
- `.claude/skills/dob-development/reference/steps.md`
- `.claude/skills/dob-development/reference/workflow.md`
- `.claude/skills/dob-development/reference/pr-template.md`
- `.claude/skills/dob-development/reference/comment-policy.md`
