/**
 * DetailPane.tsx
 *
 * Pane 3（目標モード）: 今日のタスク一覧・タスク詳細・進捗グラフ・日報フォームを表示する。
 *
 * 表示状態:
 *   常時             — 今日のタスク一覧（isToday: true の WeekTask）
 *   selectedTaskId   — タスク詳細（タイトル・期日・状態・優先度・メモ）のインライン編集
 *                      達成率・残日数カード・今週の進捗ドーナツグラフ
 *   日報フォーム      — 「日報を書く」ボタン押下でダイアログを開く
 *                      インライン展開だと Pane 3 が縦に長くなり視認性が下がるため、ダイアログを採用
 *   提出後            — AI フィードバック表示（Phase 1 はダミーテキスト）
 *
 * Props:
 *   tasks               — 全週タスク
 *   milestones          — 全月マイルストーン
 *   selectedTaskId      — 選択中の週タスク ID（null = 今日のタスク一覧表示）
 *   dailyReports        — 全日報
 *   onUpdateTask        — タスク更新時のコールバック
 *   onAddDailyReport    — 日報追加時のコールバック
 *   onUpdateDailyReport — 日報更新時のコールバック
 */

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LABELS } from "@/lib/labels";
import { type DailyReport, type MonthMilestone, type WeekTask } from "@/lib/schema";
import { computeProgressStatus, getTodayTasks } from "@/lib/computed/tasks";
import { ACHIEVEMENT_STATUS_CONFIG, PRIORITY_CONFIG, TASK_STATUS_CONFIG, getLocalDateString, weekLabelFromDueDate } from "@/lib/task-config";
import { cn } from "@/lib/utils";

// TODO(Phase 3): DUMMY_AI_FEEDBACK を claude-haiku-4-5 API のレスポンスに差し替える
const DUMMY_AI_FEEDBACK =
  "今日もお疲れ様でした！振り返りを読む限り、着実に前進できていますね。" +
  "学んだことを明日以降も活かして、引き続き頑張りましょう！";

type DetailPaneProps = {
  tasks: WeekTask[];
  milestones: MonthMilestone[];
  selectedTaskId: string | null;
  dailyReports: DailyReport[];
  onUpdateTask: (id: string, changes: Partial<WeekTask>) => void;
  onAddDailyReport: (date: string, reflection: string, learned: string, aiComment?: string) => void;
  onUpdateDailyReport: (id: string, reflection: string, learned: string, aiComment?: string) => void;
};

export function DetailPane({
  tasks,
  milestones,
  selectedTaskId,
  dailyReports,
  onUpdateTask,
  onAddDailyReport,
  onUpdateDailyReport,
}: DetailPaneProps) {
  // 日報ダイアログの開閉状態。インライン展開より Pane 3 の縦幅を圧迫しないためダイアログを採用
  const [reportOpen, setReportOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [learned, setLearned] = useState("");
  const [aiComment, setAiComment] = useState<string | null>(null);

  // getLocalDateString を使うことで toISOString() の UTC ズレを回避する
  const today = useMemo(() => getLocalDateString(), []);

  const todayTasks = useMemo(() => getTodayTasks(tasks), [tasks]);
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  // 選択タスクが属するマイルストーンを取得して進捗計算に使う
  const selectedMilestone = useMemo(
    () => milestones.find((m) => m.id === selectedTask?.milestoneId) ?? null,
    [milestones, selectedTask]
  );
  const milestoneTasks = useMemo(
    () => tasks.filter((t) => t.milestoneId === selectedMilestone?.id),
    [tasks, selectedMilestone]
  );

  // 達成率・残日数・進捗ステータスを算出する
  const achievementRate = useMemo(() => {
    if (!milestoneTasks.length) return 0;
    return Math.round((milestoneTasks.filter((t) => t.status === "done").length / milestoneTasks.length) * 100);
  }, [milestoneTasks]);

  const remainingDays = useMemo(() => {
    if (!selectedMilestone) return 0;
    const [year, month] = selectedMilestone.yearMonth.split("-").map(Number);
    // 月末日と今日をどちらも 00:00:00 に揃えて計算する。
    // 時刻を含めた単純なミリ秒差分では夏時間の影響を受けるうえ、
    // 月末日当日に残日数が 0 になってしまうため +1 して当日分を含める
    const lastDay = new Date(year, month, 0);
    lastDay.setHours(0, 0, 0, 0);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const diffDays = Math.round((lastDay.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays + 1);
  }, [selectedMilestone]);

  const progressStatus = useMemo(() => {
    if (!selectedMilestone) return "ok" as const;
    return computeProgressStatus(selectedMilestone, milestoneTasks);
  }, [selectedMilestone, milestoneTasks]);

  // 今週（月〜日）の日付リストと各日のタスク完了状況を計算する
  const weekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=日, 1=月 ... 6=土
    // 月曜始まりにするため日曜（0）は 6 とする
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - mondayOffset + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayTasks = milestoneTasks.filter((t) => t.dueDate === dateStr);
      const doneTasks = dayTasks.filter((t) => t.status === "done");
      return {
        date: dateStr,
        label: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
        total: dayTasks.length,
        done: doneTasks.length,
      };
    });
  }, [milestoneTasks]);

  // 今週全体の完了率（ドーナツグラフ中央に表示する値）
  const weekTotal = weekDays.reduce((s, d) => s + d.total, 0);
  const weekDone  = weekDays.reduce((s, d) => s + d.done, 0);
  const weekPct   = weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100);

  // SVG ドーナツグラフの円周と塗りつぶし量を計算する
  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 276.5
  const dashArray = `${(weekPct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`;

  // 今日の日報を取得する（1日1件）
  const todayReport = useMemo(
    () => dailyReports.find((r) => r.date === today) ?? null,
    [dailyReports, today]
  );

  // ダイアログを開くとき既存の日報内容を読み込む。閉じるときは入力中の内容をリセットしない
  function handleOpenChange(open: boolean) {
    if (open && todayReport) {
      setReflection(todayReport.reflection);
      setLearned(todayReport.learned);
      setAiComment(todayReport.aiComment ?? null);
    }
    if (!open) {
      setAiComment(null);
    }
    setReportOpen(open);
  }

  function handleSubmitReport() {
    // TODO(Phase 3): DUMMY_AI_FEEDBACK を claude-haiku-4-5 API のレスポンスに差し替え、aiComment に格納する
    if (todayReport) {
      onUpdateDailyReport(todayReport.id, reflection, learned, DUMMY_AI_FEEDBACK);
    } else {
      onAddDailyReport(today, reflection, learned, DUMMY_AI_FEEDBACK);
    }
    setAiComment(DUMMY_AI_FEEDBACK);
  }

  const statusConfig = ACHIEVEMENT_STATUS_CONFIG[progressStatus];

  return (
    <section className="flex flex-1 flex-col overflow-y-auto border-r border-border bg-background">
      <div className="flex flex-col gap-5 p-5">

        {/* ── タスク詳細エリア（タスク選択時のみ表示） ── */}
        {selectedTask && selectedMilestone && (
          <div className="flex flex-col gap-4">
            {/* タスクタイトル（インライン編集） */}
            <Input
              className="border-none bg-transparent px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
              value={selectedTask.title}
              onChange={(e) => onUpdateTask(selectedTask.id, { title: e.target.value })}
            />

            {/* 達成率・残日数カード */}
            <div className="flex gap-3">
              <div className={cn("flex flex-1 flex-col gap-1 rounded-lg p-4", statusConfig.bg)}>
                <span className="text-xs tracking-widest text-muted-foreground">達成率</span>
                <div className="flex items-center justify-between">
                  <span className={cn("text-3xl font-bold", statusConfig.text)}>{achievementRate}%</span>
                  <span className="text-2xl">{statusConfig.icon}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 rounded-lg bg-canvas p-4">
                <span className="text-xs tracking-widest text-muted-foreground">残日数</span>
                <span className="text-3xl font-bold text-primary">{remainingDays}</span>
              </div>
            </div>

            {/* 今週の進捗ドーナツグラフ */}
            <div className="flex flex-col gap-3">
              <span className="text-base font-bold text-foreground">今週の進捗</span>
              <div className="rounded-lg bg-canvas p-4">
                <div className="flex items-center gap-5">
                  {/* ドーナツグラフ */}
                  <div className="flex-shrink-0">
                    <svg viewBox="0 0 100 100" width={110} height={110}>
                      <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="10" className="stroke-border" />
                      <circle
                        cx="50" cy="50" r={RADIUS}
                        fill="none" strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={dashArray}
                        transform="rotate(-90 50 50)"
                        className="stroke-primary transition-all duration-300"
                      />
                      <text x="50" y="54" textAnchor="middle" dominantBaseline="middle"
                        className="fill-primary text-[22px] font-bold"
                        style={{ fontSize: "22px", fontWeight: 700 }}>
                        {weekPct}%
                      </text>
                    </svg>
                  </div>

                  {/* 日別バー */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    {weekDays.map((day) => {
                      const pct = day.total === 0 ? 0 : (day.done / day.total) * 100;
                      const badgeState = day.total === 0 ? "none" : day.done === day.total ? "done" : "partial";
                      return (
                        <div key={day.date} className="flex items-center gap-1.5">
                          <span className="w-11 flex-shrink-0 text-[11px] text-muted-foreground">{day.label}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={cn(
                            "w-7 flex-shrink-0 text-right text-[10px] font-semibold",
                            badgeState === "done"    ? "text-primary" :
                            badgeState === "partial" ? "text-muted-foreground" : "text-border"
                          )}>
                            {day.total === 0 ? "-" : `${day.done}/${day.total}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* タスク詳細フォーム */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex gap-3">
                {/* 状態 */}
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-muted-foreground">状態</label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => onUpdateTask(selectedTask.id, { status: e.target.value as WeekTask["status"] })}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    {(["todo", "inProgress", "done"] as const).map((s) => (
                      <option key={s} value={s}>{LABELS.task.status[s]}</option>
                    ))}
                  </select>
                </div>
                {/* 優先度 */}
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-xs text-muted-foreground">優先度</label>
                  <select
                    value={selectedTask.priority}
                    onChange={(e) => onUpdateTask(selectedTask.id, { priority: e.target.value as WeekTask["priority"] })}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    {(["high", "medium", "low"] as const).map((p) => (
                      <option key={p} value={p}>{LABELS.task.priority[p]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 期日 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">期日</label>
                <Input
                  type="date"
                  value={selectedTask.dueDate}
                  onChange={(e) => {
                    const dueDate = e.target.value;
                    // 空文字のままだと schema バリデーション（YYYY-MM-DD 形式）に失敗して
                    // localStorage の tasks 配列が消失するため、空文字は保存しない
                    if (!dueDate) return;
                    // 期日変更時に weekLabel・isToday を再計算して整合性を保つ
                    onUpdateTask(selectedTask.id, {
                      dueDate,
                      weekLabel: weekLabelFromDueDate(dueDate),
                      isToday: dueDate === getLocalDateString(),
                    });
                  }}
                />
              </div>

              {/* メモ */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">メモ</label>
                <Textarea
                  placeholder="メモを入力..."
                  value={selectedTask.memo ?? ""}
                  onChange={(e) => onUpdateTask(selectedTask.id, { memo: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TODAY'S TASKS（常時表示） ── */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-widest text-muted-foreground">
            TODAY&apos;S TASKS
          </span>
          {todayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">今日のタスクはありません</p>
          ) : (
            <div className="flex flex-col gap-2">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-border px-3 py-2",
                    task.status === "done" && "opacity-60"
                  )}
                >
                  <span className={cn("text-sm", task.status === "done" && "line-through text-muted-foreground")}>
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_CONFIG[task.priority].className)}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TASK_STATUS_CONFIG[task.status].className)}>
                      {TASK_STATUS_CONFIG[task.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 日報ダイアログ ── */}
        {/* インライン展開だと Pane 3 が縦に長くなり視認性が下がるためダイアログを採用 */}
        <div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleOpenChange(true)}
          >
            {LABELS.dailyReport.button}
          </Button>

          {/* disablePointerDismissal: 外側クリックでは閉じないようにする。
              Esc キーも onOpenChange で無視し、バツ・閉じるボタンのみで閉じる設計にした。
              誤操作で入力内容が消えるのを防ぐため */}
          <Dialog
            open={reportOpen}
            onOpenChange={(open, details) => {
              // Esc キーや外側クリックによるクローズは無視する
              if (!open && details.reason !== "close-press") return;
              handleOpenChange(open);
            }}
            disablePointerDismissal
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{LABELS.dailyReport.button}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{LABELS.dailyReport.reflection}</label>
                  <Textarea
                    placeholder={LABELS.dailyReport.placeholder.reflection}
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{LABELS.dailyReport.learned}</label>
                  <Textarea
                    placeholder={LABELS.dailyReport.placeholder.learned}
                    value={learned}
                    onChange={(e) => setLearned(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* AI フィードバック（提出後に表示）。Phase 1 はダミーテキスト */}
                {aiComment && (
                  <div className="rounded-lg bg-primary/10 p-3">
                    <p className="mb-1 text-xs font-semibold text-primary">{LABELS.dailyReport.aiFeedback}</p>
                    <p className="text-sm text-foreground">{aiComment}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  {LABELS.common.close}
                </DialogClose>
                <Button
                  onClick={handleSubmitReport}
                  disabled={!reflection.trim() || !learned.trim()}
                >
                  {LABELS.dailyReport.submit}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      </div>
    </section>
  );
}
