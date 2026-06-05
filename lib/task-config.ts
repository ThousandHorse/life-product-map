/**
 * task-config.ts
 *
 * タスク・マイルストーンの表示設定（アイコン・ラベル・色クラス）を一元管理する。
 * TaskListPane と DetailPane の両方で同じ定義を使うため、共通ファイルに切り出した。
 */

import { LABELS } from "@/lib/labels";
import { type WeekTask } from "@/lib/schema";

/**
 * 期日（YYYY-MM-DD）から weekLabel を自動計算する。
 * 1〜7日→W1 / 8〜14日→W2 / 15〜21日→W3 / 22日以降→W4
 *
 * new Date("YYYY-MM-DD") は UTC 基準で解釈されるため、文字列を直接 split して日付を取得する。
 */
export function weekLabelFromDueDate(dueDate: string): WeekTask["weekLabel"] {
  const day = parseInt(dueDate.split("-")[2], 10);
  if (day <= 7)  return "W1";
  if (day <= 14) return "W2";
  if (day <= 21) return "W3";
  return "W4";
}

/**
 * ローカル日付を YYYY-MM-DD 形式で返す。
 * toISOString() は UTC 基準のためタイムゾーンがズレる問題を回避する。
 */
export function getLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 月マイルストーンの進捗ステータスに対応するアイコン・ラベル・背景色 */
export const PROGRESS_STATUS_CONFIG = {
  ok:      { icon: "✅", label: LABELS.progressStatus.ok,      bg: "bg-success/10" },
  caution: { icon: "⚠️", label: LABELS.progressStatus.caution, bg: "bg-warning/10" },
  danger:  { icon: "🔴", label: LABELS.progressStatus.danger,  bg: "bg-destructive/10" },
} as const;

/** 達成率カードのステータスに応じた色設定 */
export const ACHIEVEMENT_STATUS_CONFIG = {
  ok:      { bg: "bg-success/20",     text: "text-success",     icon: "✅" },
  caution: { bg: "bg-warning/20",     text: "text-warning",     icon: "⚠️" },
  danger:  { bg: "bg-destructive/20", text: "text-destructive", icon: "🔴" },
} as const;

/** 週タスクの優先度に対応するラベル・色クラス */
export const PRIORITY_CONFIG = {
  high:   { label: LABELS.task.priority.high,   className: "bg-destructive/15 text-destructive" },
  medium: { label: LABELS.task.priority.medium, className: "bg-warning/15 text-warning" },
  low:    { label: LABELS.task.priority.low,    className: "bg-success/15 text-success" },
} as const;

/** 週タスクのステータスに対応するラベル・色クラス */
export const TASK_STATUS_CONFIG = {
  todo:       { label: LABELS.task.status.todo,       className: "bg-muted text-muted-foreground" },
  inProgress: { label: LABELS.task.status.inProgress, className: "bg-primary/15 text-primary" },
  done:       { label: LABELS.task.status.done,       className: "bg-success/15 text-success" },
} as const;
