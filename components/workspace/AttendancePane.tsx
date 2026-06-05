/**
 * AttendancePane.tsx
 *
 * Pane 2: 勤怠モード – 出退勤打刻 + 今月の稼働サマリ。
 * 退勤時は作業内容入力ダイアログを挟み、確定後に clockOut と workLog を記録する。
 *
 * 稼働時間計算:
 *   clockOut - clockIn - (breakEnd - breakStart)
 *   休憩はデフォルト 13:00〜14:00。AttendanceListPane で行ごとに編集可能。
 */

"use client";

import { useState } from "react";
import { type AttendanceRecord, type AttendanceSettings } from "@/lib/schema";
import { getLocalDateString } from "@/lib/task-config";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const TARGET_HOURS_OPTIONS = [40, 60, 80, 100, 120, 140, 160, 180] as const;

const DEFAULT_BREAK_START = "13:00";
const DEFAULT_BREAK_END = "14:00";

type Props = {
  attendanceRecords: AttendanceRecord[];
  attendanceSettings: AttendanceSettings;
  onClockIn: (record: AttendanceRecord) => void;
  onClockOut: (id: string, clockOut: string, workLog: string) => void;
  onUpdateSettings: (settings: AttendanceSettings) => void;
};

/** HH:MM 形式の文字列を分に変換する */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
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

/** 今月の打刻レコードから累計稼働時間（分）を算出する */
function calcMonthTotalMinutes(
  records: AttendanceRecord[],
  yearMonth: string
): number {
  return records
    .filter((r) => r.date.startsWith(yearMonth) && r.clockIn && r.clockOut)
    .reduce((sum, r) => {
      const bs = r.breakStart ?? DEFAULT_BREAK_START;
      const be = r.breakEnd ?? DEFAULT_BREAK_END;
      const worked =
        toMinutes(toHHMM(r.clockOut!)) -
        toMinutes(toHHMM(r.clockIn!)) -
        (toMinutes(be) - toMinutes(bs));
      return sum + Math.max(0, worked);
    }, 0);
}

export function AttendancePane({
  attendanceRecords,
  attendanceSettings,
  onClockIn,
  onClockOut,
  onUpdateSettings,
}: Props) {
  const [workLogInput, setWorkLogInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const today = getLocalDateString();
  const todayRecord = attendanceRecords.find((r) => r.date === today);

  const isClockedIn = !!todayRecord?.clockIn;
  const isClockedOut = !!todayRecord?.clockOut;

  const workedMinutes = (() => {
    if (!todayRecord?.clockIn || !todayRecord?.clockOut) return 0;
    const bs = todayRecord.breakStart ?? DEFAULT_BREAK_START;
    const be = todayRecord.breakEnd ?? DEFAULT_BREAK_END;
    return Math.max(
      0,
      toMinutes(toHHMM(todayRecord.clockOut)) -
        toMinutes(toHHMM(todayRecord.clockIn)) -
        (toMinutes(be) - toMinutes(bs))
    );
  })();

  const yearMonth = today.slice(0, 7);
  const monthTotalMinutes = calcMonthTotalMinutes(attendanceRecords, yearMonth);
  const monthTotalHours = Math.floor(monthTotalMinutes / 60);
  const target = attendanceSettings.targetHoursPerMonth;
  const progressRate = Math.min(100, Math.round((monthTotalHours / target) * 100));

  // 曜日配列を IIFE スコープに閉じ込め、他の処理に漏れないようにしている
  const todayLabel = (() => {
    const d = new Date();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
  })();

  function handleClockIn() {
    const now = new Date().toISOString();
    const record: AttendanceRecord = {
      id: todayRecord?.id ?? crypto.randomUUID(),
      date: today,
      clockIn: now,
    };
    onClockIn(record);
  }

  function handleOpenClockOutDialog() {
    setWorkLogInput("");
    setDialogOpen(true);
  }

  function handleClockOut() {
    if (!todayRecord) return;
    const now = new Date().toISOString();
    onClockOut(todayRecord.id, now, workLogInput.trim());
    setDialogOpen(false);
  }

  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-border bg-canvas">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {/* 今日の打刻カード */}
          <div className="rounded-lg border border-border bg-card p-[18px]">
            <div className="mb-3 text-[13px] text-muted-foreground">{todayLabel}</div>

            {/* 打刻ボタン */}
            <div className="mb-4 flex gap-3">
              <Button
                disabled={isClockedIn}
                onClick={handleClockIn}
                className="h-10 flex-1"
              >
                出勤
              </Button>
              <Button
                variant="outline"
                disabled={!isClockedIn || isClockedOut}
                onClick={handleOpenClockOutDialog}
                className="h-10 flex-1"
              >
                退勤
              </Button>
            </div>

            <div className="h-px bg-border" />

            {/* 打刻結果 */}
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">出勤時刻</span>
                <span className="text-[13px] font-medium text-foreground">
                  {todayRecord?.clockIn ? toHHMM(todayRecord.clockIn) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">退勤時刻</span>
                <span className="text-[13px] font-medium text-foreground">
                  {todayRecord?.clockOut ? toHHMM(todayRecord.clockOut) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">稼働時間</span>
                <span className="text-[13px] font-medium text-foreground">
                  {formatDuration(workedMinutes)}
                </span>
              </div>
            </div>
          </div>

          {/* 今月累計カード */}
          <div className="rounded-lg border border-border bg-card p-[18px]">
            <div className="text-[11px] font-semibold tracking-widest text-muted-foreground">
              今月累計
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {monthTotalHours}h
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressRate}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">目標 {target}h</span>
                <span className="text-[12px] text-muted-foreground">{progressRate}%</span>
              </div>
            </div>
          </div>

          {/* 目標時間設定 */}
          <div className="rounded-lg border border-border bg-card p-[18px]">
            <div className="text-[11px] font-semibold tracking-widest text-muted-foreground">
              月間目標稼働時間
            </div>
            <div className="mt-2">
              <select
                value={attendanceSettings.targetHoursPerMonth}
                onChange={(e) =>
                  onUpdateSettings({
                    ...attendanceSettings,
                    targetHoursPerMonth: Number(e.target.value),
                  })
                }
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
              >
                {TARGET_HOURS_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}時間
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 退勤ダイアログ: 作業内容入力 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>退勤 – 作業内容を入力</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">本日の作業内容を記録してください。</p>
          <Textarea
            value={workLogInput}
            onChange={(e) => setWorkLogInput(e.target.value)}
            placeholder="例: APIエンドポイント実装、コードレビュー"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleClockOut}>退勤する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
