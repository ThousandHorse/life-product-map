/**
 * AttendanceListPane.tsx
 *
 * Pane 3: 勤怠モード – 月次打刻一覧。
 * 指定月の全日を古い日付順（昇順）で表示し、打刻済みの行と未打刻の行を区別する。
 *
 * 稼働時間計算:
 *   退勤 - 出勤 - (休憩終了 - 休憩開始)
 *   休憩はデフォルト 13:00〜14:00 で、各行ごとにユーザーが編集可能。
 *
 * 注意:
 *   休憩時間の検証（勤務時間外の休憩や日跨ぎ）は date-fns で行う。
 *   モック（pane3.html）の単純計算をそのまま移植せず、min 0 クランプで対応。
 */

"use client";

import { useEffect, useState } from "react";
import { type AttendanceRecord, type AttendanceSettings, type ColumnMapping } from "@/lib/schema";
import { DEFAULT_BREAK_END, DEFAULT_BREAK_START, calcWorkedMinutes, formatDuration, toHHMM } from "@/lib/attendance-utils";
import { parseSpreadsheet, mapRowsToAttendanceRecords, type ParsedSpreadsheet, type MapRowsResult } from "@/lib/attendance-import";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// AttendanceRecord のフィールドのうち、列マッピングの対象とするもの。
// id・isToday相当のフィールドはインポート対象にしないため含めない
const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date", label: "日付", required: true },
  { key: "clockIn", label: "出勤時刻", required: false },
  { key: "clockOut", label: "退勤時刻", required: false },
  { key: "breakStart", label: "休憩開始", required: false },
  { key: "breakEnd", label: "休憩終了", required: false },
  { key: "workLog", label: "作業内容", required: false },
];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// 給与計算の修正対応として最大 1 年前まで遡れれば十分と判断した
const SELECT_RANGE = 12;

type Props = {
  attendanceRecords: AttendanceRecord[];
  attendanceSettings: AttendanceSettings;
  onUpdateRecord: (id: string, changes: Partial<AttendanceRecord>) => void;
  onUpdateSettings: (settings: AttendanceSettings) => void;
  onImportRecords: (records: AttendanceRecord[]) => void;
  onExport: (yearMonth: string) => void;
};

// 取り込みプレビューの1行分の分類
type ImportDiffKind = "new" | "update" | "unchanged";

type ImportDiffRow = {
  kind: ImportDiffKind;
  imported: AttendanceRecord;
  existing?: AttendanceRecord;
};

/**
 * インポートしたレコードが既存の値と実質的に同じ内容かどうかを判定する。
 * a（インポート側）で undefined のフィールドはマッピングされていない（＝取り込み対象外）
 * ことを意味し、実際のマージ処理では既存値がそのまま維持されるため、比較対象から除外する。
 * 除外しないと、マッピングしていないだけのフィールドに既存値が入っていることを理由に
 * 「上書きあり」と誤判定してしまう
 */
function isSameRecordContent(a: AttendanceRecord, existing: AttendanceRecord): boolean {
  return (
    (a.clockIn === undefined || a.clockIn === existing.clockIn) &&
    (a.clockOut === undefined || a.clockOut === existing.clockOut) &&
    (a.breakStart === undefined || a.breakStart === existing.breakStart) &&
    (a.breakEnd === undefined || a.breakEnd === existing.breakEnd) &&
    (a.workLog === undefined || a.workLog === existing.workLog)
  );
}

/** ISO datetime を HH:MM に変換する。未設定の場合は "—" を返す（プレビュー表示用） */
function toHHMM_orDash(isoString: string | undefined): string {
  return isoString ? toHHMM(isoString) : "—";
}

/**
 * インポートしたレコードと既存データを日付ベースで突き合わせ、新規/上書き/変更なしに分類する。
 * Workspace.tsx の handleImportAttendanceRecords はループ内で existingByDate を都度更新して
 * マージするため（同一date が複数あれば2件目以降は1件目の取り込み結果を上書きする）、
 * プレビューの集計・分類も同じ挙動に合わせて existingByDate を動的に更新する
 */
function buildImportDiff(
  importedRecords: AttendanceRecord[],
  existingRecords: AttendanceRecord[]
): ImportDiffRow[] {
  const existingByDate = new Map(existingRecords.map((r) => [r.date, r]));
  return importedRecords.map((imported) => {
    const existing = existingByDate.get(imported.date);
    if (!existing) {
      existingByDate.set(imported.date, imported);
      return { kind: "new", imported };
    }
    if (isSameRecordContent(imported, existing)) {
      return { kind: "unchanged", imported, existing };
    }
    existingByDate.set(imported.date, imported);
    return { kind: "update", imported, existing };
  });
}

/** 今月から過去 n ヶ月の YYYY-MM 一覧を降順で返す */
function buildMonthOptions(n: number): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return options;
}

/** YYYY-MM を "YYYY年M月" に変換する */
function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

/** 指定月の日付一覧（YYYY-MM-DD）を昇順で返す */
function getDaysInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return `${yearMonth}-${String(d).padStart(2, "0")}`;
  });
}

export function AttendanceListPane({
  attendanceRecords,
  attendanceSettings,
  onUpdateRecord,
  onUpdateSettings,
  onImportRecords,
  onExport,
}: Props) {
  // サーバーとクライアントで new Date() の結果が異なるとハイドレーションエラーになるため、
  // マウント後にのみ日付依存のUIを描画する
  const [mounted, setMounted] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  // ファイル選択後にパースしたヘッダー・データ行（マッピングUI表示用）
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  // 各フィールドに対応させる列見出し。プルダウンの選択状態を保持する
  const [mapping, setMapping] = useState<ColumnMapping>({});
  // ファイル読み込み・パース失敗時のエラーメッセージ
  const [importError, setImportError] = useState<string | null>(null);
  // 「このマッピングを保存する」チェックボックスの状態（デフォルトON）
  const [saveMapping, setSaveMapping] = useState(true);
  // マッピング確定後の変換結果（プレビュー表示・取り込み確定に使う）
  const [mapResult, setMapResult] = useState<MapRowsResult | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedYM, setSelectedYM] = useState(currentYM);

  if (!mounted) {
    return <div className="flex flex-1 flex-col border-r border-border bg-background" />;
  }

  const monthOptions = buildMonthOptions(SELECT_RANGE);
  const days = getDaysInMonth(selectedYM);

  /** 日付から AttendanceRecord を引く */
  function getRecord(dateStr: string): AttendanceRecord | undefined {
    return attendanceRecords.find((r) => r.date === dateStr);
  }

  /** 休憩時間の変更を上位 state に反映する */
  function handleBreakChange(
    record: AttendanceRecord,
    field: "breakStart" | "breakEnd",
    value: string
  ) {
    // 空文字をそのまま保存すると schema の HH:MM バリデーションに失敗し、
    // 次回ロード時に localStorage 全体が消失するため undefined に変換する
    onUpdateRecord(record.id, { [field]: value || undefined });
  }

  /** ヘッダー文字列から保存済みマッピングの初期値を引く。一致しない場合は未選択のままにする */
  function buildInitialMapping(headers: string[]): ColumnMapping {
    const saved = attendanceSettings.columnMapping;
    if (!saved) return {};
    const initial: ColumnMapping = {};
    for (const { key } of MAPPING_FIELDS) {
      const savedHeader = saved[key];
      if (savedHeader && headers.includes(savedHeader)) {
        initial[key] = savedHeader;
      }
    }
    return initial;
  }

  /** ファイル選択時にパースし、ヘッダーからマッピングUIの初期値を組み立てる */
  async function handleFileSelect(file: File) {
    setSelectedFileName(file.name);
    setImportError(null);
    setParsed(null);
    setMapping({});
    try {
      const result = await parseSpreadsheet(file);
      if (result.headers.length === 0) {
        setImportError("ヘッダー行が見つかりませんでした。1行目に列名があるファイルを選択してください。");
        return;
      }
      setParsed(result);
      setMapping(buildInitialMapping(result.headers));
    } catch (error) {
      console.error("Failed to parse spreadsheet:", error);
      setImportError("ファイルの読み込みに失敗しました。ファイル形式を確認してください。");
    }
  }

  /** 必須フィールド（date）が選択されているか */
  const isMappingValid = Boolean(mapping.date);

  /**
   * マッピングを確定する。保存チェックがONなら attendanceSettings にも反映し、
   * parsed をマッピングに従って AttendanceRecord[] に変換してプレビュー画面に進む。
   */
  function handleConfirmMapping() {
    if (!isMappingValid || !parsed) return;
    if (saveMapping) {
      onUpdateSettings({ ...attendanceSettings, columnMapping: mapping });
    }
    setMapResult(mapRowsToAttendanceRecords(parsed, mapping));
  }

  /** プレビュー確認後、「取り込む」で一括反映する */
  function handleConfirmImport() {
    if (!mapResult) return;
    onImportRecords(mapResult.records);
    handleDialogOpenChange(false);
  }

  /** ダイアログを閉じる際に状態をリセットする */
  function handleDialogOpenChange(open: boolean) {
    setTemplateDialogOpen(open);
    if (!open) {
      setSelectedFileName(null);
      setParsed(null);
      setMapping({});
      setImportError(null);
      setMapResult(null);
      // saveMapping もデフォルト(ON)に戻す。リセットしないと、一度チェックを外して
      // 確定した後は次回ダイアログを開いてもOFFのままになり、ドキュメント通りの
      // 「デフォルトON」という前提が崩れ、ユーザーが気づかないままマッピングが
      // 保存されなくなる（Codexレビュー指摘）
      setSaveMapping(true);
    }
  }

  return (
    <div className="flex flex-1 flex-col border-r border-border bg-background">
      {/* ヘッダーバー */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedYM}
            onChange={(e) => setSelectedYM(e.target.value)}
            className="border-none bg-transparent text-lg font-bold text-foreground outline-none focus:border-primary"
          >
            {monthOptions.map((ym) => (
              <option key={ym} value={ym}>
                {formatYearMonth(ym)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport(selectedYM)}
          >
            エクスポート
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-primary text-primary hover:bg-primary/5"
            onClick={() => {
              setSelectedFileName(null);
              setParsed(null);
              setMapping({});
              setImportError(null);
              setMapResult(null);
              setTemplateDialogOpen(true);
            }}
          >
            テンプレ読み込み
          </Button>
        </div>
      </div>

      {/* 列ヘッダー */}
      <div className="flex flex-shrink-0 items-center border-b border-border px-5 py-2">
        <span className="w-[84px] flex-shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground">
          日付
        </span>
        <span className="w-[52px] flex-shrink-0 text-center text-[10px] font-semibold tracking-wider text-muted-foreground">
          出勤
        </span>
        <span className="w-[52px] flex-shrink-0 text-center text-[10px] font-semibold tracking-wider text-muted-foreground">
          退勤
        </span>
        <span className="w-[72px] flex-shrink-0 text-center text-[10px] font-semibold tracking-wider text-muted-foreground">
          休憩開始
        </span>
        <span className="w-[72px] flex-shrink-0 text-center text-[10px] font-semibold tracking-wider text-muted-foreground">
          休憩終了
        </span>
        <span className="w-[68px] flex-shrink-0 text-right text-[10px] font-semibold tracking-wider text-muted-foreground">
          稼働
        </span>
        <span className="min-w-0 flex-1 pl-4 text-[10px] font-semibold tracking-wider text-muted-foreground">
          作業内容
        </span>
      </div>

      {/* 日付一覧 */}
      <div className="flex flex-col overflow-y-auto">
        {days.map((dateStr) => {
          const record = getRecord(dateStr);
          const [y, m, d] = dateStr.split("-").map(Number);
          const dt = new Date(y, m - 1, d);
          const dow = dt.getDay();
          const label = `${m}/${d}（${WEEKDAYS[dow]}）`;

          // 土日祝のカラーは tokens.css の --weekday-sat / --weekday-sun に対応
          const dateColorClass =
            dow === 6
              ? "text-weekday-sat font-semibold"
              : dow === 0
              ? "text-weekday-sun font-semibold"
              : "font-semibold";

          if (!record || (!record.clockIn && !record.clockOut)) {
            return (
              <div
                key={dateStr}
                className="flex items-center border-b border-border px-5 py-2.5 opacity-45 transition-colors hover:bg-canvas"
              >
                <span className={`w-[84px] flex-shrink-0 text-[13px] ${dateColorClass}`}>
                  {label}
                </span>
                <span className="w-[52px] flex-shrink-0 text-center text-[13px] text-muted-foreground">—</span>
                <span className="w-[52px] flex-shrink-0 text-center text-[13px] text-muted-foreground">—</span>
                <span className="w-[72px] flex-shrink-0 text-center text-[13px] text-muted-foreground">—</span>
                <span className="w-[72px] flex-shrink-0 text-center text-[13px] text-muted-foreground">—</span>
                <span className="w-[68px] flex-shrink-0 text-right text-[13px] text-muted-foreground">—</span>
                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis pl-4 text-[13px] text-muted-foreground">—</span>
              </div>
            );
          }

          const bs = record.breakStart ?? DEFAULT_BREAK_START;
          const be = record.breakEnd ?? DEFAULT_BREAK_END;
          const workedMin =
            record.clockIn && record.clockOut
              ? calcWorkedMinutes(record.clockIn, record.clockOut, bs, be)
              : 0;

          return (
            <div
              key={dateStr}
              className="flex items-center border-b border-border px-5 py-2.5 transition-colors hover:bg-canvas"
            >
              <span className={`w-[84px] flex-shrink-0 text-[13px] ${dateColorClass}`}>
                {label}
              </span>
              {/* 出勤・退勤は読み取り専用（打刻は AttendancePane で行う） */}
              <span className="w-[52px] flex-shrink-0 text-center text-[13px] text-foreground">
                {record.clockIn ? toHHMM(record.clockIn) : "—"}
              </span>
              <span className="w-[52px] flex-shrink-0 text-center text-[13px] text-foreground">
                {record.clockOut ? toHHMM(record.clockOut) : "—"}
              </span>
              {/* 休憩時間は行ごとに編集可能 */}
              <input
                type="time"
                value={bs}
                onChange={(e) => handleBreakChange(record, "breakStart", e.target.value)}
                className="w-[72px] flex-shrink-0 cursor-pointer border-none bg-transparent text-center text-[13px] text-muted-foreground outline-none hover:bg-muted/60 focus:rounded focus:border focus:border-primary focus:bg-card focus:text-foreground"
              />
              <input
                type="time"
                value={be}
                onChange={(e) => handleBreakChange(record, "breakEnd", e.target.value)}
                className="w-[72px] flex-shrink-0 cursor-pointer border-none bg-transparent text-center text-[13px] text-muted-foreground outline-none hover:bg-muted/60 focus:rounded focus:border focus:border-primary focus:bg-card focus:text-foreground"
              />
              <span className="w-[68px] flex-shrink-0 text-right text-[13px] font-semibold text-primary">
                {formatDuration(workedMin)}
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis pl-4 text-[13px] text-muted-foreground">
                {record.workLog ?? ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* テンプレ読み込みダイアログ: ファイル選択 → 列マッピング確認 の2ステップ構成 */}
      <Dialog open={templateDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>勤務表テンプレを読み込む</DialogTitle>
          </DialogHeader>

          {!parsed && (
            <>
              <p className="text-[13px] text-muted-foreground">
                CSVまたはExcelファイルを選択してください。
              </p>
              <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-border bg-canvas px-4 py-6 text-center">
                <span className="text-2xl">📄</span>
                <span className="text-[13px] leading-relaxed text-muted-foreground">
                  ファイルをここにドロップ
                  <br />
                  または
                </span>
                <label className="cursor-pointer rounded border border-primary px-3 py-1 text-[12px] text-primary hover:bg-primary/5">
                  ファイルを選択
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileSelect(file);
                      // 同じファイルを再選択した場合でも onChange が発火するよう
                      // value をクリアする（クリアしないと value が変化せずイベントが発生しない）
                      e.target.value = "";
                    }}
                  />
                </label>
                {selectedFileName && (
                  <span className="text-[12px] text-foreground">{selectedFileName}</span>
                )}
                <span className="text-[11px] text-border">.csv / .xlsx / .xls</span>
              </div>
              {importError && (
                <p className="text-[12px] text-destructive">{importError}</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  キャンセル
                </Button>
              </DialogFooter>
            </>
          )}

          {parsed && !mapResult && (
            <>
              <p className="text-[13px] text-muted-foreground">
                「{selectedFileName}」の各列が、どの項目に対応するか選択してください。
              </p>
              <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto">
                {MAPPING_FIELDS.map(({ key, label, required }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label htmlFor={`mapping-${key}`} className="w-[88px] flex-shrink-0 text-[13px] text-foreground">
                      {label}
                      {required && <span className="ml-0.5 text-destructive">*</span>}
                    </label>
                    <select
                      id={`mapping-${key}`}
                      value={mapping[key] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [key]: e.target.value || undefined,
                        }))
                      }
                      className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[13px] text-foreground outline-none focus:border-primary"
                    >
                      <option value="">（対応する列なし）</option>
                      {parsed.headers.map((header, i) => (
                        <option key={`${header}-${i}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveMapping}
                  onChange={(e) => setSaveMapping(e.target.checked)}
                />
                このマッピングを保存する（次回から自動適用されます）
              </label>
              {!isMappingValid && (
                <p className="text-[12px] text-destructive">
                  「日付」は必須項目です。対応する列を選択してください。
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setParsed(null);
                    setSelectedFileName(null);
                  }}
                >
                  戻る
                </Button>
                <Button disabled={!isMappingValid} onClick={handleConfirmMapping}>
                  読み込む
                </Button>
              </DialogFooter>
            </>
          )}

          {mapResult && (
            <>
              {(() => {
                const diff = buildImportDiff(mapResult.records, attendanceRecords);
                const newCount = diff.filter((d) => d.kind === "new").length;
                const updateCount = diff.filter((d) => d.kind === "update").length;
                const unchangedCount = diff.filter((d) => d.kind === "unchanged").length;
                const updateRows = diff.filter((d) => d.kind === "update");

                return (
                  <>
                    <p className="text-[13px] text-muted-foreground">
                      新規追加 {newCount}件・上書き {updateCount}件・変更なし {unchangedCount}件
                    </p>

                    {updateRows.length > 0 && (
                      <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto rounded-md border border-border p-2">
                        {updateRows.map(({ imported, existing }) => (
                          <div key={imported.date} className="text-[12px] text-muted-foreground">
                            <span className="font-semibold text-foreground">{imported.date}</span>
                            {": "}
                            {toHHMM_orDash(existing?.clockIn)} → {toHHMM_orDash(imported.clockIn)}
                            {" / "}
                            {toHHMM_orDash(existing?.clockOut)} → {toHHMM_orDash(imported.clockOut)}
                          </div>
                        ))}
                      </div>
                    )}

                    {mapResult.errors.length > 0 && (
                      <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto rounded-md border border-destructive/40 bg-destructive/5 p-2">
                        <p className="text-[12px] font-semibold text-destructive">
                          スキップされた行（{mapResult.errors.length}件）
                        </p>
                        {mapResult.errors.map((e, i) => (
                          <p key={i} className="text-[12px] text-destructive">
                            {e.row}行目: {e.reason}
                          </p>
                        ))}
                      </div>
                    )}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMapResult(null)}>
                        戻る
                      </Button>
                      <Button disabled={mapResult.records.length === 0} onClick={handleConfirmImport}>
                        取り込む
                      </Button>
                    </DialogFooter>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
