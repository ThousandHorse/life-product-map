/**
 * storage-local.ts
 *
 * localStorage の読み書きを抽象化するヘルパー。
 * storage.ts のファサードから呼ばれる実装の一つ（ロールバック用）。
 *
 * 注意事項:
 *   - load は window の存在チェックが必要。Next.js の SSR 時は window が存在しないため、
 *     サーバー側で実行されると ReferenceError になる。useEffect 内から呼ぶこと。
 *   - parse に失敗した場合は null を返す。破損データでアプリがクラッシュしないようにするため。
 *   - load/save は async だが、内部処理自体は同期。storage-supabase.ts と
 *     シグネチャを揃えるために Promise でラップしている
 */

import { z } from "zod";

/**
 * localStorage からデータを読み込む。
 * スキーマでバリデーションし、不正なデータは null を返す。
 */
export async function load<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  // SSR 環境では window が存在しないため早期リターン
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return schema.parse(JSON.parse(raw));
  } catch {
    // JSON パース失敗またはスキーマ検証失敗。壊れたデータは無視して null を返す
    return null;
  }
}

/**
 * localStorage にデータを保存する。
 * QuotaExceededError（ストレージ容量不足）や private mode での書き込み制限など、
 * setItem が例外をスローするケースがあるため try-catch で保護する
 */
export async function save<T>(key: string, data: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage (key: ${key}):`, error);
  }
}

// localStorage のキー名を一元管理
// キー名が散らばると衝突リスクがあるため、このファイルで定義する
export const STORAGE_KEYS = {
  goals: "lpm_goals",
  milestones: "lpm_milestones",
  tasks: "lpm_tasks",
  dailyReports: "lpm_daily_reports",
  attendanceRecords: "lpm_attendance_records",
  attendanceSettings: "lpm_attendance_settings",
} as const;
