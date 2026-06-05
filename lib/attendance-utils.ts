/**
 * attendance-utils.ts
 *
 * 勤怠計算の共通ユーティリティ。
 * AttendancePane / AttendanceListPane / xlsx-export で同じ計算ロジックが重複するため一元化した。
 */

/** HH:MM 形式の文字列を分に変換する。空文字や不正な入力は 0 を返す */
export function toMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** ISO datetime 文字列からローカル時刻の HH:MM を取得する */
export function toHHMM(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 分を "Xh Ym" 形式に変換する */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * 稼働時間（分）を計算する。
 * toHHMM 経由の計算は日跨ぎ勤務で負値になるため、ISO タイムスタンプのミリ秒差分から直接計算する。
 * 休憩が逆転（終了 < 開始）した場合に稼働時間が過大になるのを防ぐため、休憩時間も 0 クランプする
 */
export function calcWorkedMinutes(
  clockIn: string,
  clockOut: string,
  breakStart: string,
  breakEnd: string
): number {
  const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const breakMin = Math.max(0, toMinutes(breakEnd) - toMinutes(breakStart));
  return Math.max(0, diffMin - breakMin);
}
