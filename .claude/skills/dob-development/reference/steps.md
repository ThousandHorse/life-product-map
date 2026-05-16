# Phase 1 実装 Step 仕様

各 Step の完了条件・作成ファイル・注意事項を記載する。
実装前に対象 Step のセクションを必ず読むこと。

---

## Step 1: Next.js + shadcn/ui 初期設定

**作成・変更ファイル:**
- `package.json`（create-next-app で生成）
- `app/globals.css`（workspace-ui-kit から移植・最小化）
- `components.json`（shadcn 設定）
- `tailwind.config.ts`（v4 設定）

**完了条件:**
- [ ] `npx create-next-app@latest life-product-map --typescript --tailwind --app` が成功する
- [ ] `npx shadcn@latest init` で base-nova が選択されセットアップされる
- [ ] `app/globals.css` に `@theme` ブロックでデザイントークン（`--color-primary` 等）が定義されている
- [ ] `npm run dev` で `localhost:3000` が表示される
- [ ] `npm run build` でエラーがない

**注意事項:**
- shadcn の style は `base` (base-nova / @base-ui/react) を選択する（workspace-ui-kit と同じ）
- globals.css は workspace-ui-kit の `app/globals.css` を参考に最小限のトークンを移植する

---

## Step 2: データスキーマと localStorage 永続化

**作成ファイル:**
- `lib/schema.ts`
- `lib/storage.ts`
- `lib/labels.ts`
- `lib/computed/tasks.ts`

**スキーマ定義（lib/schema.ts）:**

```ts
// 年目標（最大5件）
YearGoal { id, title, description? }

// 月マイルストーン
MonthMilestone { id, goalId, yearMonth, title, progressStatus }
// progressStatus: "ok" | "caution" | "danger"（自動計算）

// 週タスク
WeekTask { id, milestoneId, weekLabel, title, dueDate, status, priority, memo?, isToday }
// status: "todo" | "inProgress" | "done"
// priority: "high" | "medium" | "low"
// weekLabel: "W1" | "W2" | "W3" | "W4"

// 日報（1日1件）
DailyReport { id, date, reflection, learned, aiComment? }
// aiComment: Phase 1 はダミーテキスト、Phase 3 で Claude API から取得

// 勤怠打刻
AttendanceRecord { id, date, clockIn?, clockOut? }

// 勤怠設定
AttendanceSettings { targetHoursPerDay, xlsxTemplate?, columnMapping? }
```

**進捗ステータス計算（lib/computed/tasks.ts）:**

| 条件 | ステータス |
|---|---|
| 達成率 > 70% または 残日数 > 14日 | "ok"（✅ 順調） |
| 達成率 40〜70% かつ 残日数 7〜14日 | "caution"（⚠️ 注意） |
| 達成率 < 40% または 残日数 < 7日 | "danger"（🔴 危険） |

**完了条件:**
- [ ] `lib/schema.ts` の全スキーマ（DailyReport を含む）が Zod で定義され、`z.infer` で型が生成されている
- [ ] `lib/storage.ts` の `load` / `save` 関数が `localStorage` の読み書きをラップしている
- [ ] `lib/storage.ts` の read は SSR 対策で window 存在チェックがある
- [ ] `lib/computed/tasks.ts` の `computeProgressStatus` が正しいステータスを返す
- [ ] TypeScript のコンパイルエラーがない

---

## Step 3: Workspace 骨格と NavPane

**作成ファイル:**
- `app/page.tsx`（Workspace をレンダリングするだけ）
- `components/workspace/Workspace.tsx`
- `components/workspace/NavPane.tsx`

**Workspace.tsx の state 設計:**

```ts
const [goals, setGoals] = useState<YearGoal[]>([])
const [milestones, setMilestones] = useState<MonthMilestone[]>([])
const [tasks, setTasks] = useState<WeekTask[]>([])
const [dailyReports, setDailyReports] = useState<DailyReport[]>([])
const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS)

// 表示制御
const [mode, setMode] = useState<"goal" | "attendance">("goal")
const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
// selectedTaskId === null のとき Pane 3 は「今日のタスク一覧」を表示
```

**NavPane の機能:**
- 「目標」「勤怠」の 2 項目を縦に表示
- 年目標を最大 5 件リスト表示（目標モード時）
- 年目標の追加（ダイアログ）・削除
- モード切替: 目標モード ↔ 勤怠モード

**完了条件:**
- [ ] Workspace.tsx が全 state を保持し、各 Pane にプレースホルダーを配置している
- [ ] 勤怠モード時は Pane 4 が非表示になる（`showPane4 = mode === "goal"`）
- [ ] NavPane に「目標」「勤怠」が表示される
- [ ] NavPane で年目標を追加・削除できる
- [ ] 年目標が 5 件以上のとき追加ボタンが disabled になる
- [ ] ページリロード後も localStorage からデータが復元される

---

## Step 4: 目標モード TaskListPane

**作成ファイル:**
- `components/workspace/TaskListPane.tsx`

**表示内容:**

```
[今日のタスク] ← ボタン（デフォルトでアクティブ）

── 5月: TOEIC受験 ✅順調 ──  ← Collapsible ヘッダー
  W1: 単語300語               ← 週タスク行（クリックで Pane 3 に詳細）
  W2: リスニング
  + タスクを追加
── 6月: ... ──
```

**完了条件:**
- [ ] 月マイルストーンが `<Collapsible>` で展開・折りたたみできる
- [ ] 月マイルストーンのヘッダーに進捗ステータスアイコン（✅ ⚠️ 🔴）が表示される
- [ ] 週タスク行をクリックすると `onSelectTask(taskId)` が呼ばれる
- [ ] 「今日のタスク」ボタンをクリックすると `onSelectTask(null)` が呼ばれる
- [ ] 週タスクを追加・削除できる

---

## Step 5: 目標モード DetailPane

**作成ファイル:**
- `components/workspace/DetailPane.tsx`

**表示状態:**

| 状態 | 表示内容 |
|---|---|
| 常時 | 今日のタスク一覧（`isToday: true` の WeekTask）を上部に表示 |
| `selectedTaskId !== null` | タスク詳細（名前・期限・状態・優先度・メモ）|
| 「日報を書く」ボタン押下 | 日報フォーム（振り返り・学んだこと）を展開。再押下で折りたたみ |
| 日報「提出する」押下 | フォーム下部に AI フィードバックを表示（Phase 1 はダミーテキスト） |

**完了条件:**
- [ ] 今日のタスク一覧が常時表示される
- [ ] 各タスクに進捗ステータスバッジ（✅ ⚠️ 🔴）が表示される
- [ ] `selectedTaskId !== null` のときタスク詳細が表示される
- [ ] タスク詳細の各フィールドをインライン編集できる
- [ ] 編集内容が Workspace の state に反映される
- [ ] 「日報を書く」ボタンで日報フォームが展開・折りたたみできる
- [ ] 日報フォームに「今日の振り返り」「学んだこと」のテキストエリアがある
- [ ] 「提出する」ボタンを押すと AI フィードバック（Phase 1 はダミーテキスト）が表示される
- [ ] 日報の入力内容が localStorage に保存され、リロード後も復元される

---

## Step 6: AI チャットモック（AiChatPane）

**作成ファイル:**
- `components/workspace/AiChatPane.tsx`

**Phase 1 の実装範囲（モック UI のみ）:**
- テキスト入力欄
- チャットバブル表示（ユーザーメッセージ + AI メッセージ）
- 送信ボタン（押してもダミーレスポンスを返す）

**完了条件:**
- [ ] Pane 4 にチャット UI が表示される
- [ ] メッセージを入力して送信するとバブルに追加される
- [ ] 送信後にダミーの AI レスポンス（固定文字列）が表示される
- [ ] 目標モード時のみ表示、勤怠モード時は非表示

---

## Step 7: 勤怠モード - 打刻 UI（AttendancePane）

**作成ファイル:**
- `components/workspace/AttendancePane.tsx`（Pane 2 の勤怠モード）

**実装内容:**
- 出勤ボタン / 退勤ボタン（ワンタップ打刻）
- 今日の打刻状況表示（出勤時刻・退勤時刻・稼働時間）
- 目標稼働時間の設定（プルダウン: 4 / 5 / 6 / 7 / 8 時間）

**完了条件:**
- [ ] 出勤ボタンをタップすると現在時刻が `clockIn` に記録される
- [ ] 退勤ボタンをタップすると現在時刻が `clockOut` に記録される
- [ ] 出勤中は「出勤ボタン」が disabled になり「退勤ボタン」が有効になる
- [ ] 今日の稼働時間（clockOut - clockIn）が表示される
- [ ] 目標稼働時間をプルダウンで変更でき、`attendanceSettings` に反映される
- [ ] ページリロード後も打刻データが localStorage から復元される

---

## Step 8: 勤怠モード - 月次カレンダー（CalendarPane）

**作成ファイル:**
- `components/workspace/CalendarPane.tsx`（Pane 3 の勤怠モード）

**実装内容:**
- 月次カレンダービュー（`react-day-picker` を使用）
- 各日に出勤時刻・退勤時刻・稼働時間を表示
- 打刻済みの日にマーカーを表示（未打刻と区別）

**完了条件:**
- [ ] 勤怠モード時に Pane 3 に月次カレンダーが表示される
- [ ] 各日に当日の打刻データ（出勤・退勤・稼働時間）が表示される
- [ ] 打刻済みの日と未打刻の日がビジュアルで区別できる
- [ ] 前月・次月へのナビゲーションができる

---

## Step 9: 勤怠モード - xlsx エクスポート

**作成ファイル:**
- `lib/xlsx-export.ts`（xlsx 生成ロジック）

**実装内容:**
- 月次の打刻データを xlsx 形式でダウンロードする
- Phase 1 は固定フォーマット（日付・出勤・退勤・稼働時間の列）
- AttendancePane の「エクスポート」ボタンから呼び出す

**注意事項:**
- xlsx の会社指定フォーマット対応（テンプレートアップロード + 列マッピング）は Phase 2 以降のスコープ
- Phase 1 では汎用的な固定フォーマットで出力する

**完了条件:**
- [ ] 「エクスポート」ボタンをクリックすると xlsx ファイルがダウンロードされる
- [ ] xlsx に「日付」「出勤時刻」「退勤時刻」「稼働時間（時間）」の列が含まれる
- [ ] 当月の全打刻データが行として含まれる
- [ ] 打刻のない日は空行になる

---

## Step 10: シードデータと E2E 動作確認

**作成ファイル:**
- `data/seed.ts`

**確認シナリオ（全て手動確認）:**
- [ ] 起動時に Pane 3 が「今日のタスク一覧」を表示している
- [ ] 週タスク行をクリックすると Pane 3 がタスク詳細に切り替わる
- [ ] 「今日のタスク」ボタンをクリックすると Pane 3 が一覧に戻る
- [ ] 出勤ボタン → 退勤ボタンで打刻が記録される
- [ ] ページリロード後も localStorage からデータが復元される
- [ ] 年目標 5 件まで追加でき、6 件目の追加ボタンが disabled になる
- [ ] 勤怠モードでは Pane 4 が非表示になる
- [ ] `npm run build` でエラーがない
- [ ] `npm run lint` でエラーがない
