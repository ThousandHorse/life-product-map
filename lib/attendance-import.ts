/**
 * attendance-import.ts
 *
 * 勤怠表テンプレート（xlsx/xls/csv）を読み込み、アプリの AttendanceRecord に
 * 変換するためのパース基盤。
 *
 * 設計上の注意事項:
 *   - ヘッダー行は常に1行目固定とする。タイトル行や空行が上部にあるフォーマットは
 *     現時点ではスコープ外（要望が出た場合に拡張する）
 *   - xlsx（SheetJS）は xlsx/xls/csv いずれの形式も同一APIで読み込めるため、
 *     拡張子による分岐は行わない
 *   - このファイルではパース結果を中間形式（ヘッダー配列 + 行配列）で返すところまでを扱う。
 *     AttendanceRecord への変換・列マッピングの適用は Step 17 で実装する
 *   - ヘッダーの重複除去は行わない。同名列が複数存在するファイルの場合、
 *     columnMapping は列見出し文字列で列を特定するため（Step 15 の設計）、
 *     マッピングUI上でどちらの列を指しているか区別できない。現状は稀なケースとして
 *     許容している（要望が出た場合、列インデックスも保持する形に拡張する）
 */

import * as XLSX from "xlsx";
import { type AttendanceRecord, type ColumnMapping } from "./schema";
import { DEFAULT_BREAK_END, DEFAULT_BREAK_START } from "./attendance-utils";

export type ParsedSpreadsheet = {
  headers: string[];
  rows: string[][];
};

/**
 * ファイルを読み込み、1行目をヘッダー、2行目以降をデータ行として返す。
 * セルは文字列として扱う（日付・時刻の型変換は呼び出し側の変換処理で行う）。
 *
 * ファイルが破損している・空である等の理由で XLSX.read() が例外を投げた場合、
 * その例外はそのまま呼び出し側に伝播する。呼び出し側で try-catch し、
 * ユーザーにエラー内容を表示すること。
 */
export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  // SheetNames に名前が存在しても、ワークブック構造が壊れている場合に Sheets 側に
  // 実体が無いケースがありうるため、undefined チェックを入れてクラッシュを防ぐ
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  // header: 1 で「配列の配列」形式にする（オブジェクト変換だと同名列の重複や空ヘッダーの扱いが煩雑なため）
  // defval: "" で空セルを undefined ではなく空文字にし、後続処理での undefined チェック漏れを防ぐ
  const table = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const [headerRow, ...dataRows] = table;
  // ヘッダー行が存在しない、または全セルが空文字（空行）の場合はヘッダーなしとして扱う
  const hasHeader = headerRow != null && headerRow.some((cell) => String(cell ?? "").trim() !== "");
  if (!hasHeader) {
    return { headers: [], rows: [] };
  }

  const headers = headerRow.map((cell) => String(cell ?? "").trim());

  // データ行の列数がヘッダーより多い場合、はみ出したセルは破棄される。
  // サイレントにデータを失わないよう、破棄が発生した行番号を警告に出す
  dataRows.forEach((row, i) => {
    if (row.length > headers.length) {
      console.warn(
        `parseSpreadsheet: row ${i + 2} has ${row.length} columns but only ${headers.length} header(s) exist. Extra columns will be discarded.`
      );
    }
  });

  // 全セルが空文字の行（空行）はデータとして扱わない
  const rows = dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => headers.map((_, i) => String(row[i] ?? "")));

  return { headers, rows };
}

export type MapRowsResult = {
  records: AttendanceRecord[];
  // スキップした行番号（データ行基準、1始まり）とスキップ理由
  errors: { row: number; reason: string }[];
};

/**
 * y/m/d が実在する日付かどうかを検証する（2/30 のような形式は合うが実在しない日付を弾く）。
 * new Date(y, m-1, d) はオーバーフローした値を翌月にロールオーバーするため、
 * 生成後の年月日を読み戻して入力値と一致するかで実在性を判定する。
 */
function isValidCalendarDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * 日付表記のゆれ（YYYY-MM-DD, YYYY/MM/DD, M/D/YY 等）を YYYY-MM-DD に正規化する。
 * parseSpreadsheet は raw: false でセルを読むため、Excelの日付シリアル値は
 * SheetJS のデフォルト書式（多くは M/D/YY 形式）で文字列化されて渡ってくる。
 * 形式に一致しても実在しない日付（2/30 等）の場合は null を返す。
 *
 * TODO(既知の制約・対応なし): SheetJS は日付らしきセル（日付型セル、または日付として
 * 解釈できる文字列）を読み込み時点で自動的に日付として正規化する。このとき
 * "2026-02-30" のような実在しない日付は、SheetJS 側でロールオーバーされ別の実在する日付
 * （例: "3/2/26"）に変換された状態でこの関数に渡ってくるため、ここでの実在性チェックでは
 * 検出できない。会社の勤怠表で実在しない日付が入力されるケースは稀と判断し、
 * parseSpreadsheet（Step 15）側の読み込みオプション変更を伴う対応は見送っている
 */
function normalizeDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  function format(y: number, m: number, d: number): string | null {
    if (!isValidCalendarDate(y, m, d)) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // YYYY-MM-DD 形式は new Date() のタイムゾーン解釈でずれることがあるため最優先で直接判定する
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return format(Number(y), Number(m), Number(d));
  }

  // YYYY/MM/DD 形式
  const slashIsoMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashIsoMatch) {
    const [, y, m, d] = slashIsoMatch;
    return format(Number(y), Number(m), Number(d));
  }

  // M/D/YY, M/D/YYYY 形式（SheetJSのデフォルト日付書式）
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (usMatch) {
    const [, m, d, yRaw] = usMatch;
    const y = yRaw.length === 2 ? Number(`20${yRaw}`) : Number(yRaw);
    return format(y, Number(m), Number(d));
  }

  return null;
}

/**
 * 時刻表記のゆれ（H:MM, HH:MM, HH:MM:SS 等）を HH:MM に正規化する。
 * パースできない場合は null を返す。
 */
function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const [, h, m] = match;
  const hNum = Number(h);
  if (hNum < 0 || hNum > 23) return null;

  return `${h.padStart(2, "0")}:${m}`;
}

/**
 * date（YYYY-MM-DD）と time（HH:MM）を合成し、ISO datetime 文字列にする。
 * AttendanceRecord.clockIn/clockOut は z.string().datetime() で UTC の "Z" 終端のみ
 * 許可するため、ローカルタイムから明示的に変換する。
 */
function toIsoDatetime(date: string, time: string): string | null {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/**
 * Step 15 の中間形式（headers/rows）と列マッピングを受け取り、AttendanceRecord[] に変換する。
 * 必須列（date）が欠落・パース不能な行はスキップし、errors に理由を記録する。
 * 休憩開始・終了はマッピングが無い、または値が空の場合デフォルト値（13:00-14:00）を適用する。
 */
export function mapRowsToAttendanceRecords(
  parsed: ParsedSpreadsheet,
  mapping: ColumnMapping
): MapRowsResult {
  const columnIndex = new Map(parsed.headers.map((h, i) => [h, i]));

  function getCell(row: string[], mappingKey: keyof ColumnMapping): string {
    const header = mapping[mappingKey];
    if (!header) return "";
    const index = columnIndex.get(header);
    if (index === undefined) return "";
    return row[index] ?? "";
  }

  const records: AttendanceRecord[] = [];
  const errors: MapRowsResult["errors"] = [];

  parsed.rows.forEach((row, i) => {
    // errors の行番号はユーザーがファイルを開いたときの行数と一致させるため、
    // ヘッダー行(1行目)分の +1 をして1始まりにする
    const rowNumber = i + 2;

    const rawDate = getCell(row, "date");
    if (!rawDate) {
      errors.push({ row: rowNumber, reason: "日付が空です" });
      return;
    }
    const date = normalizeDate(rawDate);
    if (!date) {
      errors.push({ row: rowNumber, reason: `日付「${rawDate}」を解釈できませんでした` });
      return;
    }

    const rawClockIn = getCell(row, "clockIn");
    const rawClockOut = getCell(row, "clockOut");
    const clockInTime = rawClockIn ? normalizeTime(rawClockIn) : null;
    const clockOutTime = rawClockOut ? normalizeTime(rawClockOut) : null;

    if (rawClockIn && !clockInTime) {
      errors.push({ row: rowNumber, reason: `出勤時刻「${rawClockIn}」を解釈できませんでした` });
      return;
    }
    if (rawClockOut && !clockOutTime) {
      errors.push({ row: rowNumber, reason: `退勤時刻「${rawClockOut}」を解釈できませんでした` });
      return;
    }

    const rawBreakStart = getCell(row, "breakStart");
    const rawBreakEnd = getCell(row, "breakEnd");
    const parsedBreakStart = rawBreakStart ? normalizeTime(rawBreakStart) : null;
    const parsedBreakEnd = rawBreakEnd ? normalizeTime(rawBreakEnd) : null;

    if (rawBreakStart && !parsedBreakStart) {
      errors.push({ row: rowNumber, reason: `休憩開始「${rawBreakStart}」を解釈できませんでした` });
      return;
    }
    if (rawBreakEnd && !parsedBreakEnd) {
      errors.push({ row: rowNumber, reason: `休憩終了「${rawBreakEnd}」を解釈できませんでした` });
      return;
    }

    // breakStart/breakEnd は片方だけ値がある状態でもう片方にデフォルト値を補完すると、
    // 例えば breakStart="15:00" に breakEnd デフォルト値"14:00"を組み合わせて
    // 終了<開始という論理矛盾が生じうる。そのため両方揃っている場合のみそれぞれの値を使い、
    // どちらか一方でも欠けている場合は両方ともデフォルト値（13:00-14:00）にフォールバックする
    const [breakStart, breakEnd] =
      parsedBreakStart && parsedBreakEnd
        ? [parsedBreakStart, parsedBreakEnd]
        : [DEFAULT_BREAK_START, DEFAULT_BREAK_END];

    const workLog = getCell(row, "workLog");

    const record: AttendanceRecord = {
      id: crypto.randomUUID(),
      date,
      ...(clockInTime ? { clockIn: toIsoDatetime(date, clockInTime) ?? undefined } : {}),
      ...(clockOutTime ? { clockOut: toIsoDatetime(date, clockOutTime) ?? undefined } : {}),
      breakStart,
      breakEnd,
      ...(workLog ? { workLog } : {}),
    };

    records.push(record);
  });

  return { records, errors };
}
