# Mock UI 仕様書

## 概要

`mock/` ディレクトリは LifeProductMap の UI 確認用モックアップ（HTML + CSS + JS）。  
実際のデータは `mock/data/mock-data.json` に集約し、`mock/scripts/render.js` が fetch して各 Pane に描画する。

### 起動方法

```bash
cd /path/to/life-product-map
python3 -m http.server 5500
# → http://localhost:5500/mock/ をブラウザで開く
```

---

## ファイル構成

```
mock/
├── index.html                    # エントリポイント。各コンポーネントを fetch で読み込む
├── data/
│   └── mock-data.json            # 全モックデータの単一ソース
├── components/
│   ├── sidebar.html              # Pane 1: NavPane（モード切替・年目標一覧）
│   ├── goal/
│   │   ├── pane2.html            # Pane 2（目標モード）: タスクリスト
│   │   ├── pane3.html            # Pane 3（目標モード）: 詳細・進捗・今日のタスク
│   │   └── pane4.html            # Pane 4: AI コーチチャット
│   └── attendance/
│       ├── pane2.html            # Pane 2（勤怠モード）: 打刻・今月累計
│       └── pane3.html            # Pane 3（勤怠モード）: 月次打刻一覧
├── scripts/
│   ├── main.js                   # モード切替・ダイアログなど UI ロジック
│   └── render.js                 # mock-data.json → DOM レンダリング
└── styles/
    ├── tokens.css                # デザイントークン（CSS変数）
    ├── layout.css                # 全体レイアウト（4ペイン構成）
    ├── components.css            # 共通コンポーネント（card, badge, progress-bar 等）
    ├── sidebar.css               # Pane 1 スタイル
    ├── goal/
    │   ├── pane2.css
    │   ├── pane3.css
    │   └── pane4.css
    └── attendance/
        ├── pane2.css
        └── pane3.css
```

---

## データ構造（mock-data.json）

### goals[]

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | 一意ID（例: `"g1"`） |
| `title` | string | 年目標タイトル |
| `achievementRate` | number | 達成率（0〜100） |
| `daysLeft` | number | 残日数 |
| `weeklyProgress.done` | number | 今週の完了タスク数 |
| `weeklyProgress.total` | number | 今週の総タスク数 |
| `weeklyProgress.days[]` | array | 日別進捗（date / weekday / done / total） |
| `tasks[]` | array | 週タスク一覧（title / priority / progress） |
| `todayTasks[]` | array | 今日のタスク一覧（title / done） |
| `aiChat[]` | array | AI チャット履歴（role: "ai"\|"user" / text） |

#### tasks[].priority

| 値 | バッジ | 意味 |
|---|---|---|
| `"high"` | HIGH（赤） | 優先度高 |
| `"mid"` | MID（黄） | 優先度中 |
| `"done"` | DONE（緑） | 完了 |

### attendance

| フィールド | 型 | 説明 |
|---|---|---|
| `today.date` | string | 今日の日付（YYYY-MM-DD） |
| `today.dateLabel` | string | 表示用ラベル（例: `"2026年5月17日（土）"`） |
| `today.clockIn` | string\|null | 出勤時刻（HH:MM） |
| `today.clockOut` | string\|null | 退勤時刻（HH:MM）。未退勤は null |
| `today.workedMinutes` | number | 現在の稼働分数 |
| `monthSummary.totalHours` | number | 今月累計稼働時間（h） |
| `monthSummary.targetHours` | number | 月間目標時間（h）。選択肢: 40/60/80/100/120/140/160/180 |
| `monthSummary.progressRate` | number | 達成率（0〜100） |
| `records["YYYY-MM"][]` | array | 月別打刻レコード |

#### records の各行

| フィールド | 型 | 説明 |
|---|---|---|
| `date` | string | YYYY-MM-DD |
| `clockIn` | string | HH:MM |
| `clockOut` | string | HH:MM |
| `breakStart` | string | 休憩開始 HH:MM（デフォルト `"13:00"`） |
| `breakEnd` | string | 休憩終了 HH:MM（デフォルト `"14:00"`） |
| `workLog` | string | 作業内容メモ |

---

### ステータスバッジ判定ロジック（Pane 3）

| 条件 | ステータス |
|---|---|
| 達成率 < 40% または 残日数 < 7日 | 🚨 danger（赤） |
| 達成率 < 70% かつ 残日数 < 14日 | ⚠️ caution（黄） |
| それ以外 | ✅ ok（緑） |

---

## レンダリングフロー

```
index.html 読み込み
  └─ Promise.all([fetch components...])
       └─ initMock()          ← render.js
            ├─ fetch mock-data.json
            ├─ renderSidebar(goals)          → .nav-goals を生成
            ├─ selectGoalById(goals[0].id)
            │    ├─ renderGoalPane2(goal)    → .task-list を生成
            │    ├─ renderGoalPane3(goal)    → ドーナツ・日別バー・今日のタスクを生成
            │    └─ renderAiChat(goal)       → .chat-body を生成
            └─ renderAttendancePane2(attendance)
```

年目標クリック時（`selectGoal(el)` in main.js）:
```
selectGoal(el)
  └─ selectGoalById(goalId, window.__mockData)   ← render.js の関数を呼び出す
```

勤怠 Pane 3 の打刻一覧は `pane3.html` 内 `<script>` が `ATT_MOCK_RECORDS` を直接参照して描画する（JSON 移行は React 実装時に行う）。

---

## デザイントークン（tokens.css）

| 変数 | 用途 |
|---|---|
| `--primary` | メインカラー（紺） |
| `--background` | ページ背景 |
| `--canvas` | カード背景 |
| `--sidebar` | サイドバー背景 |
| `--border` | ボーダー・区切り線 |
| `--muted` | 薄いテキスト・ラベル |
| `--destructive` | エラー・警告（赤） |
| `--weekday-sat` | 土曜フォントカラー（青） |
| `--weekday-sun` | 日曜フォントカラー（赤） |
| `--badge-high-bg/fg` | HIGH バッジ |
| `--badge-mid-bg/fg` | MID バッジ |
| `--badge-done-bg/fg` | DONE バッジ |

色番号の直書き禁止。必ずトークン変数を使う。

---

## コーディング規約

- HTML 内のハードコードデータは禁止。データは `mock-data.json` に集約する
- CSS 色番号直書き禁止 → `tokens.css` のトークン変数を使う
- JS は `main.js`（UI ロジック）と `render.js`（データ→DOM）に分離する
- `render.js` の各関数は React 移行時に対応コンポーネントに 1:1 で置き換える想定
- 曜日カラー: 土曜 → `.is-sat`、日曜 → `.is-sun` クラスを付与

---

## 勤怠 Pane 3 の注意事項

- 稼働時間計算は `退勤 - 出勤 - (休憩終了 - 休憩開始)` の単純計算
- 休憩が勤務時間外にかかる場合の重複チェックは未実装（React 実装時に `date-fns` 等で対応）
- 日跨ぎ勤務（例: 22:00〜02:00）は未対応（同上）

### 月切替プルダウン

- 左右矢印ではなく `<select>` プルダウンで月を切替（年月タイトルの右隣に配置）
- 今月を基準に過去 12ヶ月分を降順で表示（`buildMonthSelect(year, month)` が生成）
- 選択時に `attNavMonthSelect(val)` を呼び出し `attYear`・`attMonth` を更新して再描画

### テンプレ読み込みボタン

- エクスポートボタンの右隣に「テンプレ読み込み」ボタンを配置
- クリックでファイル選択ダイアログ（`#template-overlay`）を開く
- 受け付けフォーマット: `.csv` / `.xlsx` / `.xls`
- 実際のファイルパース処理は React 実装時に対応（モックではファイル選択のみ）
