# PR 概要の書き方

## タイトル形式

```
Step-XX: [コンポーネント/モジュール名] [動詞] - [一言説明]
```

**例:**
- `Step-1: Next.js + shadcn/ui 初期設定`
- `Step-3: Workspace.tsx / NavPane.tsx 実装 - 骨格と目標ナビゲーション`
- `Step-7: 勤怠モード実装 - 打刻・カレンダー・xlsx エクスポート`

---

## 本文テンプレート

```markdown
## 概要

[このStepで何を実装したかを2〜3文で説明する。なぜこの実装方法を選んだかも一言添える]

## 実装内容

| ファイル | 変更種別 | 変更理由・内容 |
|---|---|---|
| `components/workspace/XxxPane.tsx` | 新規作成 | [なぜこのファイルを作ったか・何を実装したか] |
| `lib/schema.ts` | 変更 | [なぜ変更が必要だったか・何を追加/修正したか] |
| `package.json` | 変更 | [追加した依存パッケージとその理由] |

## 完了条件チェックリスト

- [ ] [完了条件1]
- [ ] [完了条件2]
- [ ] [完了条件3]

## 動作確認方法

```bash
npm run dev
# → localhost:3000 で [確認すべき動作] を確認
```

## 関連情報

- 実装詳細: reference/steps.md Step-XX
- 依存する Step: Step-XX（マージ済み）
```

---

## セクション別の書き方ガイド

### 概要
- 「何を・なぜ・どうやって」の順に書く
- 実装の背景にある設計判断があれば一言添える
- 例: `Workspace.tsx を SSoT として全 state を集中管理し、各 Pane に props + callback で渡す単方向データフロー設計を採用した。`

### 実装内容
- ファイルごとに「変更種別（新規作成/変更/削除）」と「なぜそのファイルを変更したか」を必ず書く
- 「何を変更したか」だけでなく「なぜその実装を選んだか」の理由も一言添える
- 追加した npm パッケージは `npm install xxx` コマンドも記載

### 完了条件チェックリスト
- `reference/steps.md` に記載の完了条件をそのまま転記する
- PR 作成時点で全てチェック済みであること（未完了の場合は Draft PR にする）

### 動作確認方法
- レビュアーが手元で再現できるコマンドを書く
- `npm run dev` 後に何を確認するか具体的に書く

---

## Step 別の記載ポイント

### Step 1: 初期設定
- shadcn セットアップ完了のスクリーンショット（`localhost:3000` のデフォルト画面）を添付すると良い

### Step 2: スキーマ + 永続化
- `localStorage` に保存されるデータの JSON サンプルをコードブロックで貼る
- `storage.ts` の Phase 2 差し替え設計の意図を概要に明記する

### Step 3〜6: 各 Pane 実装
- UI スクリーンショット（`localhost:3000` の実際の画面）を添付する
- Pane 間の状態連携が正しく動いているか確認コマンドを記載する

### Step 5: DetailPane
- 日報フォームの展開・折りたたみ、提出後の AI フィードバック表示を動作確認する
- リロード後に日報データが復元されるか確認する

### Step 7: 勤怠モード
- 出勤 → 退勤 → xlsx エクスポートの一連の操作スクリーンショットを添付する

### Step 8: シードデータ + E2E
- 全確認シナリオのチェックリストを完了条件に転記して全チェック済みにする

---

## 記入例（Step-3）

```markdown
## 概要

Workspace.tsx を SSoT として全 state（goals / milestones / tasks / attendanceRecords）を集中管理する骨格を実装した。
各 Pane に props + callback で渡す単方向データフロー設計を採用しており、
workspace-ui-kit の Workspace.tsx と同じパターンを踏襲している。

NavPane.tsx では年目標の一覧表示・追加・削除、および目標 ↔ 勤怠モードの切替を実装した。

## 実装内容

| ファイル | 変更種別 | 変更理由・内容 |
|---|---|---|
| `components/workspace/Workspace.tsx` | 新規作成 | 全 state の SSoT として Workspace に集約することで Pane 間の状態共有をシンプルにするため |
| `components/workspace/NavPane.tsx` | 新規作成 | Pane 1 として目標一覧・モード切替を独立コンポーネントに分離し、Workspace から props を受け取るだけの設計にするため |

## 完了条件チェックリスト

- [x] Workspace.tsx が goals / milestones / tasks を useState で保持している
- [x] NavPane に年目標が最大5件表示される
- [x] 目標 ↔ 勤怠のモード切替ができる
- [x] 勤怠モード時に Pane 4 が非表示になる
- [x] ページリロード後も localStorage からデータが復元される

## 動作確認方法

```bash
npm run dev
# → localhost:3000 で以下を確認:
#   1. NavPane に「目標」「勤怠」が表示される
#   2. 「勤怠」クリックで Pane 4 が非表示になる
#   3. 目標を追加してリロードしてもデータが残る
```

## 関連情報

- 実装詳細: reference/steps.md Step-3
- 依存する Step: Step-2（localStorage ヘルパー実装済み）
```
