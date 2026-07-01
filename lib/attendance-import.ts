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
