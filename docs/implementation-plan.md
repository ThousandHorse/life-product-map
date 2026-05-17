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

Phase 1 の全 Step は [SKILL.md](../.claude/skills/dob-development/SKILL.md) を参照。

---

## ディレクトリ構成

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

## 4 ペイン構成

### モード切替

- **目標モード**: Pane 1 → 2 → 3 → 4（4 ペイン表示）
- **勤怠モード**: Pane 1 → 2（勤怠詳細）→ 3（月カレンダー）（Pane 4 非表示）

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
- 進捗ステータスアイコン: ✅順調 / ⚠️注意 / 🔴危険（計算ロジックは [steps.md](../.claude/skills/dob-development/reference/steps.md) 参照）

### Pane 3: DetailPane（目標モード）

**今日のタスク一覧（常時表示）**:
- `isToday: true` の WeekTask を表示
- 各タスクに進捗ステータスバッジ表示

**週タスク選択時**:
- タスク詳細（名前・期限・状態・優先度・メモ）
- インライン編集

**「日報を書く」ボタン**:
- クリックで「今日の振り返り」「学んだこと」のテキストエリアを展開（再クリックで折りたたみ）
- 「提出する」ボタン押下で AI フィードバックを表示（Phase 1: ダミーテキスト、Phase 3: Claude API）
- 入力内容は state 変更後に自動で localStorage へ保存
- 今日分（当日の date）のみ表示・編集可能

### Pane 4: AiChatPane（目標モードのみ）

Phase 1 はモックチャット UI のみ（入力欄 + チャットバブル）。Phase 3 で Claude API を接続。

### Pane 2/3（勤怠モード）

- Pane 2: 出退勤打刻・月間目標稼働時間設定
- Pane 3: エクスポートボタン（上部）+ 月次打刻一覧（日付・出退勤時刻・稼働時間を行形式で表示）

---

## 検証方法

```bash
npm run dev   # localhost:3000 で動作確認
npm run build # TypeScript エラーゼロ確認
npm run lint  # ESLint パス確認
```

確認シナリオの詳細は [steps.md Step 10](../.claude/skills/dob-development/reference/steps.md) を参照。
