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

import { useState } from "react";
import { type AttendanceRecord } from "@/lib/schema";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const DEFAULT_BREAK_START = "13:00";
const DEFAULT_BREAK_END = "14:00";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

// 給与計算の修正対応として最大 1 年前まで遡れれば十分と判断した
const SELECT_RANGE = 12;

type Props = {
  attendanceRecords: AttendanceRecord[];
  onUpdateRecord: (id: string, changes: Partial<AttendanceRecord>) => void;
  onExport: (yearMonth: string) => void;
};

/** HH:MM 形式の文字列を分に変換する。空文字や不正な入力は 0 を返す */
function toMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** 分を "Xh Ym" 形式に変換する */
function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** ISO datetime 文字列から HH:MM を取得する */
function toHHMM(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 稼働時間（分）を計算する。
 * toHHMM 経由の計算は日跨ぎ勤務で負値になるため、ISO タイムスタンプのミリ秒差分から直接計算する。
 * 休憩が逆転（終了 < 開始）した場合に稼働時間が過大になるのを防ぐため、休憩時間も 0 クランプする
 */
function calcWorkedMinutes(
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
  onUpdateRecord,
  onExport,
}: Props) {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedYM, setSelectedYM] = useState(currentYM);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

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

      {/* テンプレ読み込みダイアログ（Phase 1 はファイル選択のみ、パース未実装） */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>勤務表テンプレを読み込む</DialogTitle>
          </DialogHeader>
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
                onChange={(e) =>
                  setSelectedFileName(e.target.files?.[0]?.name ?? null)
                }
              />
            </label>
            {selectedFileName && (
              <span className="text-[12px] text-foreground">{selectedFileName}</span>
            )}
            <span className="text-[11px] text-border">.csv / .xlsx / .xls</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              キャンセル
            </Button>
            {/* Phase 2 でパース処理を実装するまで読み込みボタンは無効 */}
            <Button disabled={!selectedFileName}>読み込む</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
