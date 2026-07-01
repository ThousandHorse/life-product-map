/**
 * storage-supabase.ts
 *
 * Supabase（Postgres）の読み書きを抽象化するヘルパー。
 * storage.ts のファサードから呼ばれる実装の一つ。
 *
 * 設計上の注意事項:
 *   - テーブルのカラム名は snake_case（Postgres 慣例）、アプリ内は camelCase（JS 慣例）。
 *     toSnakeCase / toCamelCase でエンティティごとに変換する
 *   - 削除の反映は「差分削除 + upsert」を Postgres RPC 関数内でトランザクション実行する。
 *     全削除→再挿入だとアトミック性がなく、削除後に insert が失敗するとデータが消える。
 *     RPC 関数は Supabase SQL Editor で事前に作成しておく（docs/database-schema.md 参照）
 *   - attendanceSettings のみ1行シングルトン（id: "singleton"）のため upsert のみ。削除ロジック不要
 *   - load は select().order() で全件取得し、Zod スキーマでバリデーションして返す
 */

import { z } from "zod";
import { getSupabase } from "./supabase";
import {
  yearGoalsSchema,
  monthMilestonesSchema,
  weekTasksSchema,
  dailyReportsSchema,
  attendanceRecordsSchema,
  attendanceSettingsSchema,
  type YearGoal,
  type MonthMilestone,
  type WeekTask,
  type DailyReport,
  type AttendanceRecord,
  type AttendanceSettings,
} from "./schema";

export const STORAGE_KEYS = {
  goals: "goals",
  milestones: "milestones",
  tasks: "tasks",
  dailyReports: "daily_reports",
  attendanceRecords: "attendance_records",
  attendanceSettings: "attendance_settings",
} as const;

// ---- camelCase ⇄ snake_case 変換 ----

function goalToRow(g: YearGoal) {
  return { id: g.id, title: g.title, description: g.description ?? null };
}

function rowToGoal(r: Record<string, unknown>): YearGoal {
  return {
    id: r.id as string,
    title: r.title as string,
    ...(r.description != null ? { description: r.description as string } : {}),
  };
}

function milestoneToRow(m: MonthMilestone) {
  return {
    id: m.id,
    goal_id: m.goalId,
    year_month: m.yearMonth,
    title: m.title,
    progress_status: m.progressStatus,
  };
}

function rowToMilestone(r: Record<string, unknown>): MonthMilestone {
  return {
    id: r.id as string,
    goalId: r.goal_id as string,
    yearMonth: r.year_month as string,
    title: r.title as string,
    progressStatus: r.progress_status as MonthMilestone["progressStatus"],
  };
}

function taskToRow(t: WeekTask) {
  return {
    id: t.id,
    milestone_id: t.milestoneId,
    week_label: t.weekLabel,
    title: t.title,
    due_date: t.dueDate,
    status: t.status,
    priority: t.priority,
    memo: t.memo ?? null,
    is_today: t.isToday,
  };
}

function rowToTask(r: Record<string, unknown>): WeekTask {
  return {
    id: r.id as string,
    milestoneId: r.milestone_id as string,
    weekLabel: r.week_label as WeekTask["weekLabel"],
    title: r.title as string,
    dueDate: r.due_date as string,
    status: r.status as WeekTask["status"],
    priority: r.priority as WeekTask["priority"],
    ...(r.memo != null ? { memo: r.memo as string } : {}),
    isToday: r.is_today as boolean,
  };
}

function dailyReportToRow(d: DailyReport) {
  return {
    id: d.id,
    date: d.date,
    reflection: d.reflection,
    learned: d.learned,
    ai_comment: d.aiComment ?? null,
  };
}

function rowToDailyReport(r: Record<string, unknown>): DailyReport {
  return {
    id: r.id as string,
    date: r.date as string,
    reflection: r.reflection as string,
    learned: r.learned as string,
    ...(r.ai_comment != null ? { aiComment: r.ai_comment as string } : {}),
  };
}

function attendanceRecordToRow(a: AttendanceRecord) {
  return {
    id: a.id,
    date: a.date,
    clock_in: a.clockIn ?? null,
    clock_out: a.clockOut ?? null,
    break_start: a.breakStart ?? null,
    break_end: a.breakEnd ?? null,
    work_log: a.workLog ?? null,
  };
}

function rowToAttendanceRecord(r: Record<string, unknown>): AttendanceRecord {
  return {
    id: r.id as string,
    date: r.date as string,
    ...(r.clock_in != null ? { clockIn: r.clock_in as string } : {}),
    ...(r.clock_out != null ? { clockOut: r.clock_out as string } : {}),
    ...(r.break_start != null ? { breakStart: r.break_start as string } : {}),
    ...(r.break_end != null ? { breakEnd: r.break_end as string } : {}),
    ...(r.work_log != null ? { workLog: r.work_log as string } : {}),
  };
}

function attendanceSettingsToRow(s: AttendanceSettings) {
  return {
    id: "singleton" as const,
    target_hours_per_month: s.targetHoursPerMonth,
    xlsx_template: s.xlsxTemplate ?? null,
    column_mapping: s.columnMapping ?? null,
  };
}

function rowToAttendanceSettings(r: Record<string, unknown>): AttendanceSettings {
  return {
    targetHoursPerMonth: r.target_hours_per_month as number,
    ...(r.xlsx_template != null ? { xlsxTemplate: r.xlsx_template as string } : {}),
    ...(r.column_mapping != null ? { columnMapping: r.column_mapping as Record<string, string> } : {}),
  };
}

// ---- load / save ----

export async function load<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  const supabase = getSupabase();

  try {
    if (key === STORAGE_KEYS.attendanceSettings) {
      const { data, error } = await supabase
        .from(key)
        .select("*")
        .eq("id", "singleton")
        .maybeSingle();
      if (error) throw error;
      if (data == null) return null;
      const settings = rowToAttendanceSettings(data as Record<string, unknown>);
      return schema.parse(settings);
    }

    const { data, error } = await supabase.from(key).select("*").order("created_at");
    if (error) throw error;
    if (!data || data.length === 0) return null;

    const rows = data as Record<string, unknown>[];
    let parsed: unknown;

    if (key === STORAGE_KEYS.goals) {
      parsed = rows.map(rowToGoal);
    } else if (key === STORAGE_KEYS.milestones) {
      parsed = rows.map(rowToMilestone);
    } else if (key === STORAGE_KEYS.tasks) {
      parsed = rows.map(rowToTask);
    } else if (key === STORAGE_KEYS.dailyReports) {
      parsed = rows.map(rowToDailyReport);
    } else if (key === STORAGE_KEYS.attendanceRecords) {
      parsed = rows.map(rowToAttendanceRecord);
    } else {
      return null;
    }

    return schema.parse(parsed);
  } catch (error) {
    console.error(`Failed to load from Supabase (table: ${key}):`, error);
    return null;
  }
}

export async function save<T>(key: string, data: T): Promise<void> {
  const supabase = getSupabase();

  try {
    if (key === STORAGE_KEYS.attendanceSettings) {
      const row = attendanceSettingsToRow(data as AttendanceSettings);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from(key).upsert(row as any);
      if (error) throw error;
      return;
    }

    const rows = (() => {
      if (key === STORAGE_KEYS.goals) return (data as YearGoal[]).map(goalToRow);
      if (key === STORAGE_KEYS.milestones) return (data as MonthMilestone[]).map(milestoneToRow);
      if (key === STORAGE_KEYS.tasks) return (data as WeekTask[]).map(taskToRow);
      if (key === STORAGE_KEYS.dailyReports) return (data as DailyReport[]).map(dailyReportToRow);
      if (key === STORAGE_KEYS.attendanceRecords) return (data as AttendanceRecord[]).map(attendanceRecordToRow);
      return [];
    })();

    // RPC でトランザクション内に「差分削除 + upsert」を実行する。
    // 関数名のマッピング: STORAGE_KEYS の値（テーブル名）→ sync_{テーブル名} の RPC 関数
    const rpcName = `sync_${key}` as
      | "sync_goals"
      | "sync_milestones"
      | "sync_tasks"
      | "sync_daily_reports"
      | "sync_attendance_records";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc(rpcName, { rows } as any);
    if (error) throw error;
  } catch (error) {
    console.error(`Failed to save to Supabase (table: ${key}):`, error);
  }
}
