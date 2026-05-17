/**
 * schema.ts
 *
 * アプリ全体のデータ構造を Zod スキーマで定義する。
 * TypeScript の型は z.infer で自動生成し、スキーマと型の二重管理を防ぐ。
 *
 * 注意事項:
 *   - Phase 2 で Supabase に移行する際も、このスキーマは変更しない。
 *     storage.ts だけを差し替えることで移行できる設計にしている。
 *   - localStorage に保存されたデータは .parse() でバリデーションする。
 *     アプリのバージョンアップ時に壊れたデータを早期検出するため。
 */

import { z } from "zod";

// 年目標（最大5件）
export const yearGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

// 月マイルストーン
// progressStatus は週タスクの達成率と残日数から自動計算する（lib/computed/tasks.ts）
export const monthMilestoneSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  // regex で形式を強制する。computeProgressStatus が split("-") で分解するため、
  // 不正な文字列が渡ると NaN になりステータス計算が silent に失敗する
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM 形式で入力してください"),
  title: z.string(),
  progressStatus: z.enum(["ok", "caution", "danger"]),
});

// 週タスク
export const weekTaskSchema = z.object({
  id: z.string(),
  milestoneId: z.string(),
  weekLabel: z.enum(["W1", "W2", "W3", "W4"]),
  title: z.string(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください"),
  status: z.enum(["todo", "inProgress", "done"]),
  priority: z.enum(["high", "medium", "low"]),
  memo: z.string().optional(),
  // 今日のタスクフラグ。Pane 3 のデフォルト表示に使う
  isToday: z.boolean(),
});

// 勤怠打刻
export const attendanceRecordSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください"),
  // .datetime() で ISO 8601 形式（例: "2026-05-16T09:00:00.000Z"）を強制する
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  // 休憩時間（分）。稼働時間 = clockOut - clockIn - breakMinutes
  breakMinutes: z.number().int().min(0).optional(),
});

// 日報（1日1件）
// date をキーとして1日1件に制限する。複数件の保存は storage.ts 側で防ぐ
export const dailyReportSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください"),
  reflection: z.string(), // 今日の振り返り
  learned: z.string(),    // 学んだこと
  // Phase 3 で Claude API から取得したフィードバックを保存する。Phase 1 はダミーテキスト
  aiComment: z.string().optional(),
});

// 勤怠設定
// xlsxTemplate と columnMapping は Phase 2 でテンプレートアップロード機能を実装する際に使う
export const attendanceSettingsSchema = z.object({
  // プルダウンの選択肢は 40〜180h（月単位）だが、スキーマは 0〜744 の範囲で受け入れる
  // UI 側で選択肢を制限しているため、実際に範囲外の値が入ることはない
  targetHoursPerMonth: z.number().min(0).max(744),
  xlsxTemplate: z.string().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
});

// z.infer でスキーマから TypeScript 型を自動生成
// 型定義を手書きするとスキーマとの二重管理になるため、必ずこの方法を使う
export type YearGoal = z.infer<typeof yearGoalSchema>;
export type MonthMilestone = z.infer<typeof monthMilestoneSchema>;
export type WeekTask = z.infer<typeof weekTaskSchema>;
export type DailyReport = z.infer<typeof dailyReportSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceSettings = z.infer<typeof attendanceSettingsSchema>;

// 各エンティティの配列スキーマ（localStorage の保存形式のバリデーションに使う）
// .max(5) でスキーマレベルから「最大5件」の制約を強制する
// NavPane の UI でも 5 件制限をするが、storage からの復元時にも検証が効く
export const yearGoalsSchema = z.array(yearGoalSchema).max(5);
export const monthMilestonesSchema = z.array(monthMilestoneSchema);
export const weekTasksSchema = z.array(weekTaskSchema);
export const attendanceRecordsSchema = z.array(attendanceRecordSchema);
