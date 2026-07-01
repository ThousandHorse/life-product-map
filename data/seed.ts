/**
 * seed.ts
 *
 * 動作確認用シードデータ。
 * ブラウザコンソールから `await seedData()` を呼ぶと永続化バックエンド
 * （localStorage または Supabase。lib/storage.ts のファサード経由）にデータを書き込む。
 *
 * 使い方:
 *   クライアントコンポーネント（例: Workspace.tsx）の useEffect 内で呼び出す。
 *   app/page.tsx は Server Component のため直接呼ぶと反映されない。
 *   確認後は呼び出しコードを削除すること。
 *
 *   // Workspace.tsx などのクライアントコンポーネントの useEffect 内で実行（開発時のみ）
 *   useEffect(() => {
 *     if (process.env.NODE_ENV === "development") void seedData();
 *   }, []);
 *
 * 本番ビルドには含まれない（app/ から import されていない限り）。
 */

import { STORAGE_KEYS, load, save } from "@/lib/storage";
import {
  yearGoalsSchema,
  type AttendanceRecord,
  type AttendanceSettings,
  type DailyReport,
  type MonthMilestone,
  type WeekTask,
  type YearGoal,
} from "@/lib/schema";

// 今日の日付を基準にシードデータを生成する
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const thisYearMonth = todayStr.slice(0, 7);

// 先月の YYYY-MM
const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

// ── 年目標 ──────────────────────────────────────────────────────
const goals: YearGoal[] = [
  { id: "goal-1", title: "英語力向上（TOEIC 800点）" },
  { id: "goal-2", title: "副業収入を月3万円達成" },
];

// ── 月マイルストーン ────────────────────────────────────────────
const milestones: MonthMilestone[] = [
  {
    id: "ms-1",
    goalId: "goal-1",
    yearMonth: thisYearMonth,
    title: "リスニング集中特訓",
    progressStatus: "ok",
  },
  {
    id: "ms-2",
    goalId: "goal-1",
    yearMonth: lastYearMonth,
    title: "単語3000語マスター",
    progressStatus: "caution",
  },
  {
    id: "ms-3",
    goalId: "goal-2",
    yearMonth: thisYearMonth,
    title: "ランサーズで案件3件受注",
    progressStatus: "danger",
  },
];

// ── 週タスク ──────────────────────────────────────────────────
const tasks: WeekTask[] = [
  {
    id: "task-1",
    milestoneId: "ms-1",
    weekLabel: "W1",
    title: "公式問題集 Part2 20問",
    dueDate: todayStr,
    status: "inProgress",
    priority: "high",
    memo: "毎朝出勤前の30分で取り組む",
    isToday: true,
  },
  {
    id: "task-2",
    milestoneId: "ms-1",
    weekLabel: "W1",
    title: "シャドーイング 15分",
    dueDate: todayStr,
    status: "todo",
    priority: "medium",
    isToday: true,
  },
  {
    id: "task-3",
    milestoneId: "ms-1",
    weekLabel: "W2",
    title: "公式問題集 Part3 30問",
    dueDate: `${thisYearMonth}-14`,
    status: "todo",
    priority: "high",
    isToday: false,
  },
  {
    id: "task-4",
    milestoneId: "ms-3",
    weekLabel: "W1",
    title: "ポートフォリオサイトを更新",
    dueDate: todayStr,
    status: "inProgress",
    priority: "high",
    isToday: true,
  },
  {
    id: "task-5",
    milestoneId: "ms-3",
    weekLabel: "W2",
    title: "ランサーズにプロフィール登録",
    dueDate: `${thisYearMonth}-10`,
    status: "todo",
    priority: "medium",
    isToday: false,
  },
];

// ── 日報 ──────────────────────────────────────────────────────
const dailyReports: DailyReport[] = [
  {
    id: "report-1",
    date: todayStr,
    reflection: "リスニングの Part2 に取り組んだ。接続詞の聞き取りが弱いと気づいた。",
    learned: "選択肢の先読みが有効だとわかった。次回は先読み時間を意識する。",
    aiComment:
      "よい気づきですね。選択肢の先読みは TOEIC のコアスキルです。毎日少しずつ積み重ねていきましょう！",
  },
];

// ── 勤怠打刻 ──────────────────────────────────────────────────
const attendanceRecords: AttendanceRecord[] = [
  {
    id: "att-1",
    date: todayStr,
    clockIn: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      9, 5
    ).toISOString(),
    breakStart: "13:00",
    breakEnd: "14:00",
  },
  // 先月のサンプルデータ（稼働実績確認用）
  {
    id: "att-2",
    date: `${lastYearMonth}-10`,
    clockIn: new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth(),
      10, 9, 0
    ).toISOString(),
    clockOut: new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth(),
      10, 18, 0
    ).toISOString(),
    breakStart: "13:00",
    breakEnd: "14:00",
    workLog: "機能設計・ドキュメント整理",
  },
  {
    id: "att-3",
    date: `${lastYearMonth}-15`,
    clockIn: new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth(),
      15, 9, 15
    ).toISOString(),
    clockOut: new Date(
      lastMonthDate.getFullYear(),
      lastMonthDate.getMonth(),
      15, 17, 30
    ).toISOString(),
    breakStart: "13:00",
    breakEnd: "14:00",
    workLog: "API エンドポイント実装・コードレビュー",
  },
];

// ── 勤怠設定 ──────────────────────────────────────────────────
const attendanceSettings: AttendanceSettings = {
  targetHoursPerMonth: 160,
};

/**
 * シードデータを永続化バックエンド（localStorage または Supabase）に書き込む。
 * 既存のデータは上書きされるため、動作確認が終わったら手動でクリアすること。
 *
 * Supabase 実装（sync_* RPC）は「渡した配列に無い ID を削除 + upsert」をトランザクション内で
 * アトミックに行うため、投入前に空配列で明示的にクリアする必要はない（そのシードデータの内容が
 * そのままテーブルの最終状態になる）。事前クリアを挟むと、クリア後に投入が失敗した場合に
 * テーブルが空のまま残るリスクや、親子関係のあるテーブル間で外部キー制約に違反するリスクがある
 */
export async function seedData(force = false): Promise<void> {
  // SSR（Server Component）では window が存在しないため早期リターン
  if (typeof window === "undefined") return;

  const existingGoals = await load(STORAGE_KEYS.goals, yearGoalsSchema);
  const hasExistingData = existingGoals !== null && existingGoals.length > 0;
  if (hasExistingData && !force) {
    console.log("ℹ️ Seed data already exists. Skipping. Use seedData(true) to force overwrite.");
    return;
  }

  await save(STORAGE_KEYS.goals, goals);
  await save(STORAGE_KEYS.milestones, milestones);
  await save(STORAGE_KEYS.tasks, tasks);
  await save(STORAGE_KEYS.dailyReports, dailyReports);
  await save(STORAGE_KEYS.attendanceRecords, attendanceRecords);
  await save(STORAGE_KEYS.attendanceSettings, attendanceSettings);
  console.log("✅ Seed data written. Please reload the page.");
}
