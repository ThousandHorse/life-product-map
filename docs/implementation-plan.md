# LifeProductMap: 個人生産性アプリ 実装プラン

## Context

「やることがたくさんあるはずなのに結局やれていない」状態を解消するため、目標管理と勤怠管理を一体化した個人生産性アプリ（LifeProductMap）を新規リポジトリで構築する。workspace-ui-kit（採用管理雛形）の 4 ペイン構成・デザインシステム・コーディング規約を踏襲しつつ、ドメインを目標管理・勤怠管理に置き換える。

---

## フェーズ構成

| Phase | 内容 |
|---|---|
| 1 | Next.js 16 セットアップ + localStorage 永続化 + 目標管理 UI |
| 2 | Supabase 移行（マルチデバイス同期） |
| 3 | Claude API (claude-haiku-4-5) AI 壁打ち機能 |
| 4 | モバイル対応 |

**このプランは Phase 1 の実装を対象とする。**

---

## ディレクトリ構成（新規リポジトリ: `life-product-map`）

```
life-product-map/
├── app/
│   ├── globals.css          # workspace-ui-kit から移植・最小化
│   ├── layout.tsx
│   └── page.tsx             # Workspace をレンダリングするだけ
├── components/
│   ├── workspace/
│   │   ├── Workspace.tsx    # SSoT: 全 state + 4 ペインの組み立て
│   │   ├── NavPane.tsx      # Pane 1: 目標一覧 / 勤怠モード切替
│   │   ├── TaskListPane.tsx # Pane 2: 月マイル + 週タスク展開
│   │   ├── DetailPane.tsx   # Pane 3: 今日のタスク一覧 or タスク詳細
│   │   └── AiChatPane.tsx   # Pane 4: AI 壁打ちチャット（目標モード時のみ表示）
│   └── primitives/          # shadcn ラッパー（必要に応じて追加）
├── lib/
│   ├── schema.ts            # Zod スキーマ + 派生型
│   ├── labels.ts            # 表示文言
│   ├── storage.ts           # localStorage read/write ヘルパー
│   └── computed/
│       └── tasks.ts         # 今日のタスク派生・進捗ステータス計算
└── data/
    └── seed.ts              # 初回起動時の初期データ
```

---

## データモデル（lib/schema.ts）

### 日報

```ts
// 日報（1日1件、今日分のみ表示）
DailyReport {
  id: string
  date: string        // ISO date "2026-05-16"（1日1件のキーになる）
  reflection: string  // 今日の振り返り（自由記述）
  learned: string     // 学んだこと
  aiComment?: string  // AI フィードバック（Phase 1 はダミー、Phase 3 で Claude API）
}
```

### 目標管理

```ts
// 年目標（最大 5 件）
YearGoal {
  id: string
  title: string
  description?: string
}

// 月マイルストーン
MonthMilestone {
  id: string
  goalId: string       // 紐づく YearGoal
  yearMonth: string    // "2026-05"
  title: string
  progressStatus: "ok" | "caution" | "danger"  // 自動計算
}

// 週タスク
WeekTask {
  id: string
  milestoneId: string
  weekLabel: string    // "W1" | "W2" | "W3" | "W4"
  title: string
  dueDate: string      // ISO date
  status: "todo" | "inProgress" | "done"
  priority: "high" | "medium" | "low"
  memo?: string
  isToday: boolean     // 今日のタスクフラグ
}
```

### 勤怠管理

```ts
AttendanceRecord {
  id: string
  date: string         // ISO date "2026-05-16"
  clockIn?: string     // ISO datetime
  clockOut?: string
}

AttendanceSettings {
  targetHoursPerDay: number  // 目標稼働時間（プルダウン: 4/5/6/7/8h）
  xlsxTemplate?: string      // アップロードされたテンプレートの base64 or 参照
  columnMapping?: Record<string, string>  // テンプレート列マッピング
}
```

---

## 4 ペイン構成

### モード切替

- **目標モード**: Pane 1 → 2 → 3 → 4（4 ペイン表示）
- **勤怠モード**: Pane 1 → 2（勤怠詳細）→ 3（月カレンダー）（Pane 4 非表示、デスク広く使う）

### Pane 1: NavPane

- 「目標」「勤怠」2 項目を縦に並べたナビゲーション
- 年目標を最大 5 件リスト表示（目標モード時）
- 年目標の追加・削除
- 「目標」クリック → 目標モード、「勤怠」クリック → 勤怠モード

### Pane 2: TaskListPane（目標モード）

```
[今日のタスク] ← ボタン（デフォルトでアクティブ）

── 5月: TOEIC受験 ✅順調 ──
  W1: 単語300語
  W2: リスニング
── 6月: ... ──
```

- 月マイルストーンは `<Collapsible>` で展開
- 週タスク行クリック → Pane 3 でタスク詳細表示
- 「今日のタスク」ボタンクリック → Pane 3 で今日のタスク一覧表示
- 進捗ステータスアイコン: ✅順調 / ⚠️注意 / 🔴危険（`lib/computed/tasks.ts` で自動計算）

### Pane 3: DetailPane（目標モード）

今日のタスク一覧は常に表示。その下に「日報を書く」ボタンを置き、クリックでフォームを展開する。

**今日のタスク一覧（常時表示）**:
- 今日のタスク一覧（`isToday: true` の WeekTask）
- 各タスクに進捗ステータスバッジ表示

**週タスク選択時**:
- タスク詳細（名前・期限・状態・優先度・メモ）
- インライン編集（shadcn 標準フォーム、`InlineEdit` パターン踏襲）

**「日報を書く」ボタンクリックで展開**:
- 「今日の振り返り」テキストエリア（自由記述）
- 「学んだこと」テキストエリア
- 「提出する」ボタンを押すと AI フィードバックを表示
- 入力内容は自動保存（state 変更後に localStorage へ書き込み）
- 今日分（当日の date）のみ表示・編集可能
- ボタンを再度クリックで折りたたみ

**AI フィードバック（提出後にフォームの下に表示）**:
- Phase 1: 固定のダミーテキストを返す（モック）
- Phase 3: Claude API（claude-haiku-4-5）に振り返りと学んだことを送信し、アドバイス・解説を返す
- DailyReport にフィードバック文字列 `aiComment?: string` を保持し localStorage に保存

### Pane 4: AiChatPane（目標モード のみ）

Phase 1 はモックチャット UI のみ実装（入力欄 + チャットバブル表示）。Phase 3 で Claude API を接続。

AI 機能（Phase 3 で実装予定）:
- タスク追加時の自動提案（年目標との紐付け確認）
- 自分から相談したときの壁打ち対応
- タスク必要性の評価・取捨選択支援
- 月マイルストーン→週タスク細分化支援

---

## 勤怠モード（Pane 2/3）

### Pane 2（勤怠モード）

- 出勤ボタン / 退勤ボタン（ワンタップ打刻）
- 今日の打刻状況表示
- 目標稼働時間の設定（プルダウン: 4/5/6/7/8h）
- xlsx エクスポートボタン

### Pane 3（勤怠モード）

- 月次カレンダービュー
- 各日の出退勤時刻・稼働時間表示

---

## 状態管理（Workspace.tsx）

workspace-ui-kit の Workspace.tsx パターンを踏襲:

```ts
// SSoT: Workspace コンポーネントで保持
const [goals, setGoals] = useState<YearGoal[]>(...)
const [milestones, setMilestones] = useState<MonthMilestone[]>(...)
const [tasks, setTasks] = useState<WeekTask[]>(...)
const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(...)
const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(...)

// 表示制御
const [mode, setMode] = useState<"goal" | "attendance">("goal")
const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)  // null = 今日のタスク表示
```

- 全 state を Workspace で保持し、各 Pane に props + callback で渡す（単方向データフロー）
- localStorage 永続化: state 変更時に `lib/storage.ts` で自動保存（useEffect）

---

## 進捗ステータス自動計算（lib/computed/tasks.ts）

```ts
// 月マイルストーンの進捗ステータスを自動計算
// 達成率（done タスク数 / 全タスク数）× 残日数を考慮
function computeProgressStatus(milestone, tasks, today): "ok" | "caution" | "danger"
```

| 条件 | ステータス |
|---|---|
| 達成率 > 70% または 残日数 > 14 日 | ✅ 順調 |
| 達成率 40–70% かつ 残日数 7–14 日 | ⚠️ 注意 |
| 達成率 < 40% または 残日数 < 7 日 | 🔴 危険 |

---

## 実装順序（ステップ別 PR）

各ステップ完了後に PR を作成する。詳細なルールは SKILL.md 参照。

| Step | PR タイトル | 主な作業 |
|---|---|---|
| 1 | `setup: Next.js + shadcn/ui 初期設定` | create-next-app、shadcn、globals.css |
| 2 | `feat: データスキーマと localStorage 永続化` | lib/schema.ts、lib/storage.ts、lib/computed/tasks.ts |
| 3 | `feat: Workspace 骨格と NavPane` | Workspace.tsx（state 全体）、NavPane.tsx |
| 4 | `feat: 目標モード TaskListPane` | TaskListPane.tsx（月マイル・週タスク・進捗バッジ） |
| 5 | `feat: 目標モード DetailPane` | DetailPane.tsx（今日のタスク一覧・タスク詳細・日報） |
| 6 | `feat: AI チャットモック` | AiChatPane.tsx（Phase 3 接続前のモック UI） |
| 7 | `feat: 勤怠モード - 打刻 UI` | AttendancePane.tsx（出退勤打刻・稼働時間設定） |
| 8 | `feat: 勤怠モード - 月次カレンダー` | CalendarPane.tsx（月次カレンダー・打刻表示） |
| 9 | `feat: 勤怠モード - xlsx エクスポート` | lib/xlsx-export.ts（月次データ xlsx ダウンロード） |
| 10 | `feat: シードデータと E2E 動作確認` | data/seed.ts・全シナリオ手動確認 |

## コメントポリシー

**「なぜこう実装したか」を書く。「何をしているか」は書かない。**

- 新人エンジニアが疑問を持ちそうな技術的判断には背景を書く
- ライブラリの制約・将来フェーズへの備え・設計上の意図を明記する
- 処理の説明（変数名・関数名で分かること）は書かない

詳細な例と禁止例: `/Users/chibatakuma/.claude/skills/dob-development/reference/comment-policy.md`

---

## 参照リソース

### スキルファイル構成

```
~/.claude/skills/dob-development/
├── SKILL.md                      # エントリポイント。技術スタック・コード規約・Git 運用・Step 一覧
└── reference/
    ├── steps.md                  # Phase 1 全 Step の完了条件・作成ファイル・注意事項
    ├── workflow.md               # PR 作成〜マージ待ちの詳細手順
    ├── pr-template.md            # PR 概要の書き方・Step 別記載ポイント
    └── comment-policy.md         # コメントポリシーの詳細と記述例
```

| ファイル | 用途 |
|---|---|
| `SKILL.md` | どの AI でも最初に読む。規約・ワークフロー・Step 一覧 |
| `reference/steps.md` | 各 Step 実装前に読む。完了条件を確認する |
| `reference/workflow.md` | PR 作成・レビュー対応の詳細手順 |
| `reference/pr-template.md` | PR 概要を書くときに使うテンプレート |
| `reference/comment-policy.md` | コメントの書き方（良い例・悪い例付き） |

### その他

- 雛形（workspace-ui-kit）: `/Users/chibatakuma/Documents/Project/Sample/workspace-ui-kit/`

---

## 検証方法

```bash
npm run dev   # localhost:3000 で動作確認
npm run build # TypeScript エラーゼロ確認
npm run lint  # ESLint パス確認
```

### 確認シナリオ

1. 起動時に Pane 3 が「今日のタスク一覧」を表示している
2. 週タスク行をクリックすると Pane 3 がタスク詳細に切り替わる
3. 「今日のタスク」ボタンをクリックすると Pane 3 が一覧に戻る
4. 出勤ボタン → 退勤ボタンで打刻が記録される
5. ページリロード後も localStorage からデータが復元される
6. 年目標 5 件まで追加でき、6 件目は追加不可
7. 勤怠モードでは Pane 4 が非表示になる
