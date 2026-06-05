/**
 * xlsx-export.ts
 *
 * 月次打刻データを xlsx ファイルとしてダウンロードするユーティリティ。
 * Phase 1 は固定フォーマット（列順固定）。
 * Phase 2 でテンプレート列マッピング対応予定。
 *
 * xlsx ライブラリ（SheetJS）を使用する。
 * 依存: npm install xlsx
 */

import * as XLSX from "xlsx";
import { type AttendanceRecord } from "@/lib/schema";

const DEFAULT_BREAK_START = "13:00";
const DEFAULT_BREAK_END = "14:00";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * ISO datetime 文字列から HH:MM を取得する。
 * clockIn/clockOut は ISO 8601 UTC で保存されているため、ローカル時刻に変換して計算に使う
 */
function toHHMM(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * HH:MM 形式の文字列を分に変換する。
 * 時刻の加減算を整数演算で行うため分単位に正規化する
 */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 分を小数時間（例: 90min → 1.5）に変換する。xlsx の時間列に使用する */
function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** 指定月の全日付（YYYY-MM-DD）を昇順で返す */
// 打刻のない日も含めて全日分の行を作るため、レコードの有無に関係なく月全体を生成する
function getDaysInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return `${yearMonth}-${String(d).padStart(2, "0")}`;
  });
}

type ExportRow = {
  日付: string;
  出勤時刻: string;
  退勤時刻: string;
  休憩開始: string;
  休憩終了: string;
  "稼働時間（h）": number | string;
  作業内容: string;
};

/**
 * 月次打刻データを xlsx ファイルとしてダウンロードする。
 *
 * @param yearMonth - 対象年月（YYYY-MM）
 * @param records - 全打刻レコード（当月以外も含んでいてよい）
 */
export function exportToXlsx(
  yearMonth: string,
  records: AttendanceRecord[]
): void {
  const days = getDaysInMonth(yearMonth);
  const recordMap = new Map(records.map((r) => [r.date, r]));

  const rows: ExportRow[] = days.map((dateStr) => {
    const [, , d] = dateStr.split("-").map(Number);
    const dt = new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(5, 7)) - 1,
      d
    );
    const dow = dt.getDay();
    const dateLabel = `${parseInt(dateStr.slice(5, 7))}/${d}（${WEEKDAYS[dow]}）`;

    const record = recordMap.get(dateStr);

    if (!record || !record.clockIn) {
      return {
        日付: dateLabel,
        出勤時刻: "",
        退勤時刻: "",
        休憩開始: "",
        休憩終了: "",
        "稼働時間（h）": "",
        作業内容: "",
      };
    }

    const clockInStr = toHHMM(record.clockIn);
    const clockOutStr = record.clockOut ? toHHMM(record.clockOut) : "";
    const bs = record.breakStart ?? DEFAULT_BREAK_START;
    const be = record.breakEnd ?? DEFAULT_BREAK_END;

    let workedHours: number | string = "";
    if (record.clockOut) {
      // 休憩時間が逆転（be < bs）した場合に稼働時間が過大になるのを防ぐため 0 クランプする
      const workedMin = Math.max(
        0,
        toMinutes(clockOutStr) -
          toMinutes(clockInStr) -
          Math.max(0, toMinutes(be) - toMinutes(bs))
      );
      workedHours = minutesToDecimalHours(workedMin);
    }

    return {
      日付: dateLabel,
      出勤時刻: clockInStr,
      退勤時刻: clockOutStr,
      休憩開始: bs,
      休憩終了: be,
      "稼働時間（h）": workedHours,
      作業内容: record.workLog ?? "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // 列幅を見やすく設定する。固定値にする理由: 日本語混在の自動計算が不正確なため
  ws["!cols"] = [
    { wch: 16 }, // 日付
    { wch: 10 }, // 出勤時刻
    { wch: 10 }, // 退勤時刻
    { wch: 10 }, // 休憩開始
    { wch: 10 }, // 休憩終了
    { wch: 14 }, // 稼働時間（h）
    { wch: 40 }, // 作業内容
  ];

  const wb = XLSX.utils.book_new();
  const [y, m] = yearMonth.split("-");
  XLSX.utils.book_append_sheet(wb, ws, `${y}年${parseInt(m)}月`);

  XLSX.writeFile(wb, `attendance_${yearMonth}.xlsx`);
}
