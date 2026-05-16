# ファイル構成ガイド

LifeProductMap のディレクトリ構成と、各ファイルの役割を説明するドキュメント。
新しくファイルを追加するときは、このガイドに沿った場所に置くこと。

---

## 全体構成（完成形）

```
life-product-map/
│
├── app/                        # Next.js App Router のルートディレクトリ
│   ├── globals.css             # デザイントークン（色・フォント・角丸）の定義
│   ├── layout.tsx              # 全ページ共通レイアウト（フォント・html タグ）
│   └── page.tsx                # トップページ（/ ルート）
│
├── components/                 # UI コンポーネント
│   ├── ui/                     # shadcn が自動生成する部品（直接編集しない）
│   │   ├── button.tsx          # ボタン
│   │   ├── dialog.tsx          # モーダルダイアログ
│   │   └── ...
│   ├── workspace/              # アプリ固有の画面コンポーネント
│   │   ├── Workspace.tsx       # ★ 画面全体の SSoT（全 state をここで管理）
│   │   ├── NavPane.tsx         # Pane 1: 目標一覧・モード切替ナビゲーション
│   │   ├── TaskListPane.tsx    # Pane 2: 月マイルストーン・週タスク一覧
│   │   ├── DetailPane.tsx      # Pane 3: 今日のタスク一覧 / タスク詳細
│   │   ├── AiChatPane.tsx      # Pane 4: AI 壁打ちチャット（目標モードのみ）
│   │   ├── AttendancePane.tsx  # Pane 2（勤怠モード）: 打刻・稼働時間設定
│   │   └── CalendarPane.tsx    # Pane 3（勤怠モード）: 月次カレンダー
│   └── primitives/             # プロジェクト固有の再利用部品（必要に応じて追加）
│
├── lib/                        # ロジック・型定義・ユーティリティ
│   ├── schema.ts               # ★ Zod スキーマ + TypeScript 型定義（データの SSoT）
│   ├── labels.ts               # 表示文言（日本語ラベルの一元管理）
│   ├── storage.ts              # localStorage 読み書きヘルパー
│   ├── utils.ts                # cn() ユーティリティ（Tailwind クラス結合）
│   └── computed/
│       └── tasks.ts            # 進捗ステータス計算（順調・注意・危険）
│
├── data/
│   └── seed.ts                 # 初回起動時のサンプルデータ
│
├── docs/
│   └── file-structure.md       # このファイル（ファイル構成ガイド）
│
├── public/                     # 静的ファイル（画像・アイコン等）
│
├── components.json             # shadcn/ui の設定（スタイル・エイリアス等）
├── package.json                # 依存パッケージ一覧・npm スクリプト定義
├── tsconfig.json               # TypeScript コンパイラ設定
├── postcss.config.mjs          # Tailwind CSS を処理するための PostCSS 設定
├── next.config.ts              # Next.js の設定（現時点はほぼデフォルト）
├── next-env.d.ts               # Next.js が自動生成する型定義（編集しない）
├── README.md                   # プロジェクト概要・起動方法・ブランチ運用
└── .gitignore                  # Git 管理から除外するファイルの一覧
```

---

## 各ディレクトリの詳細

### `app/` — ページのエントリポイント

Next.js App Router の規約に従ったディレクトリ。**ページ定義のみ**を置く。
ロジックや UI コンポーネントはここには書かず、`components/` や `lib/` に分離する。

| ファイル | 役割 |
|---|---|
| `globals.css` | CSS 変数でデザイントークンを定義。色・フォント・角丸はここが唯一の情報源（SSoT） |
| `layout.tsx` | `<html>` と `<body>` を定義。フォント設定・メタデータ・lang 属性はここで管理 |
| `page.tsx` | `/` ルートのページ。Workspace コンポーネントを呼び出すだけ |

**なぜ globals.css でトークン管理するのか？**
`--color-primary` のような役割名を使うことで、コンポーネント側では色番号を知らなくて済む。
将来テーマを変えるとき、このファイルだけ変更すれば全体に反映される。

---

### `components/workspace/` — 4 ペイン構成の画面

アプリのメイン画面を構成する 4 ペインの実装。

```
┌─────────┬──────────────────┬───────────────────┬──────────────────┐
│ Pane 1  │     Pane 2       │      Pane 3       │     Pane 4       │
│ NavPane │ TaskListPane /   │ DetailPane /      │ AiChatPane       │
│         │ AttendancePane   │ CalendarPane      │ （目標モードのみ）│
└─────────┴──────────────────┴───────────────────┴──────────────────┘
```

| ファイル | ペイン | 役割 |
|---|---|---|
| `Workspace.tsx` | 全体 | **★ 最重要**。全 state を管理し、各 Pane に props で渡す。このファイルが画面の SSoT |
| `NavPane.tsx` | Pane 1 | 年目標一覧（最大5件）・目標モード↔勤怠モードの切替 |
| `TaskListPane.tsx` | Pane 2（目標） | 月マイルストーン + 週タスクの展開表示・進捗バッジ |
| `AttendancePane.tsx` | Pane 2（勤怠） | 出退勤打刻ボタン・今日の稼働時間・目標稼働時間設定 |
| `DetailPane.tsx` | Pane 3（目標） | 今日のタスク一覧（常時表示）・タスク詳細・日報入力と AI フィードバック |
| `CalendarPane.tsx` | Pane 3（勤怠） | 月次カレンダー・各日の打刻データ表示 |
| `AiChatPane.tsx` | Pane 4 | AI 壁打ちチャット（Phase 1 はモック、Phase 3 で Claude API 接続） |

**Workspace.tsx が全 state を管理する理由**
各 Pane が独自に state を持つと、「Pane 2 で選んだタスクを Pane 3 に表示する」といった
ペイン間の連携が複雑になる。Workspace に state を集約し、各 Pane は
「データを受け取って表示するだけ」にすることでシンプルに保てる（単方向データフロー）。

---

### `components/ui/` — shadcn の部品置き場

`npx shadcn add <コンポーネント名>` で自動追加されるファイルが置かれる。
**直接編集しない**（shadcn の更新時に上書きされる可能性があるため）。
見た目のカスタマイズは `components/primitives/` に独自ラッパーを作って行う。

---

### `lib/` — ロジックと型定義

UI に依存しない純粋なロジックをここに置く。

| ファイル | 役割 |
|---|---|
| `schema.ts` | **★ データモデルの SSoT**。Zod でスキーマを定義し、TypeScript 型を自動生成する |
| `labels.ts` | 日本語ラベルの一元管理。「書類選考」「一次面接」などの表示文言はここに集約 |
| `storage.ts` | localStorage の read/write をラップ。Phase 2 で Supabase に差し替えるときはこのファイルだけ変更する |
| `utils.ts` | `cn()` 関数のみ。Tailwind クラスを条件付きで結合するときに全コンポーネントから使う |
| `computed/tasks.ts` | 月マイルストーンの進捗ステータス（順調・注意・危険）を自動計算する純粋関数 |

**なぜ schema.ts で型を定義するのか？**
TypeScript の型を手書きすると、バリデーションロジックと二重管理になる。
Zod のスキーマ（`goalSchema`）から `z.infer<typeof goalSchema>` で型を自動生成することで、
「スキーマと型が必ず一致する」状態を保てる。

---

### `data/` — サンプルデータ

| ファイル | 役割 |
|---|---|
| `seed.ts` | 初回起動時に localStorage に投入するサンプルデータ。開発・デモ用 |

---

### `docs/` — ドキュメント

| ファイル | 役割 |
|---|---|
| `file-structure.md` | このファイル。ディレクトリ構成と各ファイルの役割を説明する |

---

### 設定ファイル群（ルート直下）

| ファイル | 役割 | 触る頻度 |
|---|---|---|
| `components.json` | shadcn/ui の設定。スタイル（base-nova）・ファイル置き場・エイリアスを定義 | ほぼ触らない |
| `package.json` | 依存パッケージの一覧と npm スクリプト（`dev` / `build` / `lint` 等） | パッケージ追加時 |
| `tsconfig.json` | TypeScript の strict モード・パスエイリアス（`@/` → プロジェクトルート）を設定 | ほぼ触らない |
| `postcss.config.mjs` | Tailwind CSS v4 を CSS として処理するための設定。Next.js が自動で読む | 触らない |
| `next.config.ts` | Next.js 固有の設定（現時点はほぼデフォルト） | 必要時のみ |
| `next-env.d.ts` | Next.js が自動生成する TypeScript 型定義ファイル。**編集禁止** | 触らない |
| `.gitignore` | `node_modules/` や `.next/`（ビルド成果物）を Git から除外する設定 | 触らない |

---

## データの流れ

```
lib/schema.ts         ← データ構造の定義（唯一の情報源）
    ↓ 型を提供
lib/storage.ts        ← localStorage ↔ アプリ間のデータ読み書き
    ↓ データを渡す
Workspace.tsx         ← 全 state を保持・管理（画面の唯一の情報源）
    ↓ props で渡す
NavPane / TaskListPane / DetailPane / AiChatPane / AttendancePane / CalendarPane
                      ← 受け取ったデータを表示するだけ
```

---

## ファイルを追加するときのルール

| 追加するもの | 置く場所 |
|---|---|
| 新しいページ（URL） | `app/新しいページ名/page.tsx` |
| 画面を構成する大きな部品 | `components/workspace/` |
| shadcn で追加した UI 部品 | `components/ui/`（自動生成） |
| 複数コンポーネントで使う小さな部品 | `components/primitives/` |
| データ処理・計算ロジック | `lib/computed/` |
| 型定義・スキーマ追加 | `lib/schema.ts` に追記 |
| 表示文言 | `lib/labels.ts` に追記 |
| 静的画像・アイコン | `public/` |
