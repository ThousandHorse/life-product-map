/**
 * seed.ts
 *
 * Phase 1 の動作確認用シードデータ。
 * ブラウザコンソールから `seedData()` を呼ぶと localStorage にデータを書き込む。
 *
 * 使い方:
 *   app/page.tsx に以下を一時的に追加して npm run dev を実行する。
 *   確認後は import を削除すること。
 *
 *   // app/page.tsx に追加（開発時のみ）
 *   import { seedData } from "@/data/seed";
 *   if (process.env.NODE_ENV === "development") seedData();
 *
 * 本番ビルドには含まれない（app/ から import されていない限り）。
 */

import { STORAGE_KEYS, save } from "@/lib/storage";
import {
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
 * シードデータを localStorage に書き込む。
 * 既存のデータは上書きされるため、動作確認が終わったら手動でクリアすること。
 */
export function seedData(): void {
  save(STORAGE_KEYS.goals, goals);
  save(STORAGE_KEYS.milestones, milestones);
  save(STORAGE_KEYS.tasks, tasks);
  save(STORAGE_KEYS.dailyReports, dailyReports);
  save(STORAGE_KEYS.attendanceRecords, attendanceRecords);
  save(STORAGE_KEYS.attendanceSettings, attendanceSettings);
  console.log("✅ Seed data written to localStorage. Please reload the page.");
}
