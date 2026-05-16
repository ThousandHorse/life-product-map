# コメントポリシー

## 基本方針

**「なぜこう実装したか（WHY）」を書く。「何をしているか（WHAT）」は書かない。**

変数名・関数名が適切なら処理の説明は不要。以下のカテゴリに当てはまる場合のみコメントを書く。

---

## コメントを書くべき箇所

### 1. ライブラリ・フレームワークの制約

```tsx
// useEffect 内で読む理由: localStorage は同期 API だが、
// Next.js の SSR 時（サーバー側）では window が存在せずクラッシュするため
useEffect(() => {
  const saved = storage.load("goals");
  if (saved) setGoals(saved);
}, []);
```

```tsx
// base-nova (@base-ui/react) では asChild が使えないため render prop を使う。
// workspace-ui-kit と同じ基盤なのでこの制約が全コンポーネントに適用される
<Dialog.Trigger render={<Button>開く</Button>} />
```

### 2. 設計上の意図・制約

```tsx
// 年目標は最大 5 件に制限する（UI 上の可読性確保のため）。
// 6 件目以降は追加ボタンを disabled にする
const canAddGoal = goals.length < 5;
```

```tsx
// 勤怠モード時は Pane 4 を非表示にする。
// 理由: 勤怠打刻は「出勤」「退勤」の素早い操作が主なので、
// AI チャットエリアを消してデスクを広く使う設計にした
const showPane4 = mode === "goal";
```

### 3. 将来フェーズへの備え

```tsx
// Phase 2 で Supabase に移行するとき、この関数のシグネチャを変えずに
// 中身だけ差し替えられるよう抽象化している
export function storage() {
  return {
    load: (key: string) => { ... },
    save: (key: string, value: unknown) => { ... },
  };
}
```

### 4. 非自明な計算・アルゴリズム

```tsx
// 進捗ステータス計算（順調 / 注意 / 危険）:
// 単純な達成率だけでなく「残り日数が少ない」場合も危険にする。
// 達成率が低くても月末まで余裕があれば「注意」に留める設計
function computeProgressStatus(milestone, tasks, today) { ... }
```

### 5. 新人向け技術背景の補足

```tsx
// Zod の z.infer<typeof goalSchema> で TypeScript 型を自動生成している。
// スキーマ（バリデーションルール）と型を別々に書くと二重管理になるため、
// スキーマを SSoT（唯一の情報源）として両方を一か所で管理する
export type Goal = z.infer<typeof goalSchema>;
```

---

## コメントを書いてはいけない箇所

```tsx
// ❌ 変数名で分かる（削除すること）
// ゴールをセットする
setGoals(newGoals);

// ❌ 関数名で分かる（削除すること）
// goals 配列をフィルタリングする
const filtered = goals.filter(g => g.id !== id);

// ❌ 処理の流れを追っているだけ（削除すること）
// useState でモードを管理する
const [mode, setMode] = useState<"goal" | "attendance">("goal");
```

---

## ファイル先頭コメント（全ファイル必須）

```tsx
/**
 * NavPane.tsx
 *
 * Pane 1: 年目標一覧（最大5件）とモード切替（目標 / 勤怠）を表示するナビゲーションパネル。
 * 年目標の追加・削除もここで行う。
 *
 * Props:
 *   goals: Goal[] — 年目標の一覧
 *   mode: "goal" | "attendance" — 現在のモード
 *   onSelectGoal: (id: string) => void — 目標選択時のコールバック
 *   onAddGoal: () => void — 目標追加時のコールバック
 *   onChangeMode: (mode: "goal" | "attendance") => void — モード切替
 *
 * 注意: 年目標は最大5件まで。canAddGoal が false のとき追加ボタンを disabled にする
 */
```

```ts
/**
 * storage.ts
 *
 * localStorage の読み書きを抽象化するヘルパー。
 * Phase 2 で Supabase に移行するとき、このモジュールを差し替えるだけで済む設計にしている。
 *
 * 注意: read 操作は SSR で window が存在しないため、必ず useEffect 内から呼ぶこと
 */
```
