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
  yearMonth: z.string(), // "2026-05" 形式
  title: z.string(),
  progressStatus: z.enum(["ok", "caution", "danger"]),
});

// 週タスク
export const weekTaskSchema = z.object({
  id: z.string(),
  milestoneId: z.string(),
  weekLabel: z.enum(["W1", "W2", "W3", "W4"]),
  title: z.string(),
  dueDate: z.string(), // ISO date "2026-05-16"
  status: z.enum(["todo", "inProgress", "done"]),
  priority: z.enum(["high", "medium", "low"]),
  memo: z.string().optional(),
  // 今日のタスクフラグ。Pane 3 のデフォルト表示に使う
  isToday: z.boolean(),
});

// 勤怠打刻
export const attendanceRecordSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date "2026-05-16"
  clockIn: z.string().optional(),  // ISO datetime
  clockOut: z.string().optional(), // ISO datetime
});

// 勤怠設定
// xlsxTemplate と columnMapping は Phase 2 でテンプレートアップロード機能を実装する際に使う
export const attendanceSettingsSchema = z.object({
  targetHoursPerDay: z.number(),
  xlsxTemplate: z.string().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
});

// z.infer でスキーマから TypeScript 型を自動生成
// 型定義を手書きするとスキーマとの二重管理になるため、必ずこの方法を使う
export type YearGoal = z.infer<typeof yearGoalSchema>;
export type MonthMilestone = z.infer<typeof monthMilestoneSchema>;
export type WeekTask = z.infer<typeof weekTaskSchema>;
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type AttendanceSettings = z.infer<typeof attendanceSettingsSchema>;

// 各エンティティの配列スキーマ（localStorage の保存形式のバリデーションに使う）
export const yearGoalsSchema = z.array(yearGoalSchema);
export const monthMilestonesSchema = z.array(monthMilestoneSchema);
export const weekTasksSchema = z.array(weekTaskSchema);
export const attendanceRecordsSchema = z.array(attendanceRecordSchema);
