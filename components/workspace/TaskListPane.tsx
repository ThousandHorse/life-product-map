/**
 * TaskListPane.tsx
 *
 * Pane 2（目標モード）: 月マイルストーンと週タスクの一覧を表示する。
 * Collapsible で月ごとに展開・折りたたみでき、タスク行クリックで Pane 3 に詳細を表示する。
 *
 * Props:
 *   milestones      — 全月マイルストーン
 *   tasks           — 全週タスク
 *   selectedTaskId  — 選択中の週タスク ID（null = 今日のタスク一覧）
 *   onSelectTask    — タスク選択時のコールバック（null で今日のタスク一覧に戻る）
 *   onAddMilestone  — マイルストーン追加時のコールバック
 *   onDeleteMilestone — マイルストーン削除時のコールバック
 *   onAddTask       — タスク追加時のコールバック
 *   onDeleteTask    — タスク削除時のコールバック
 */

"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LABELS } from "@/lib/labels";
import { type MonthMilestone, type WeekTask } from "@/lib/schema";
import { computeProgressStatus } from "@/lib/computed/tasks";
import { cn } from "@/lib/utils";

// 進捗ステータスに対応するアイコン・ラベル・背景色クラス。
// 絵文字だけでは視認性が低いため、カード全体の背景色でもステータスを表現する
const STATUS_CONFIG = {
  ok:      { icon: "✅", label: LABELS.progressStatus.ok,      bg: "bg-success/10" },
  caution: { icon: "⚠️", label: LABELS.progressStatus.caution, bg: "bg-warning/10" },
  danger:  { icon: "🔴", label: LABELS.progressStatus.danger,  bg: "bg-destructive/10" },
} as const;

/**
 * 期日（YYYY-MM-DD）から weekLabel を自動計算する。
 * 週と期日は役割が重複するため、期日だけ入力してもらい weekLabel は導出する設計にした。
 *   1〜7日  → W1 / 8〜14日 → W2 / 15〜21日 → W3 / 22日以降 → W4
 */
function weekLabelFromDueDate(dueDate: string): WeekTask["weekLabel"] {
  const day = new Date(dueDate).getDate();
  if (day <= 7)  return "W1";
  if (day <= 14) return "W2";
  if (day <= 21) return "W3";
  return "W4";
}

/**
 * 今月から過去12ヶ月分の YYYY-MM 文字列を降順で返す。
 * 将来月を含めると計画段階のマイルストーンも追加できるが、
 * Phase 1 は実績管理に絞るため今月以前のみ対象とする。
 */
function generateYearMonthOptions(now: Date): string[] {
  const options: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    options.push(`${yyyy}-${mm}`);
  }
  return options;
}

type TaskListPaneProps = {
  selectedGoalId: string | null;
  milestones: MonthMilestone[];
  tasks: WeekTask[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onAddMilestone: (yearMonth: string, title: string) => void;
  onDeleteMilestone: (id: string) => void;
  onAddTask: (milestoneId: string, weekLabel: WeekTask["weekLabel"], title: string, dueDate: string) => void;
  onDeleteTask: (id: string) => void;
};

export function TaskListPane({
  selectedGoalId,
  milestones,
  tasks,
  selectedTaskId,
  onSelectTask,
  onAddMilestone,
  onDeleteMilestone,
  onAddTask,
  onDeleteTask,
}: TaskListPaneProps) {
  // 展開中のマイルストーン ID セット（複数同時展開を許可する）
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // マイルストーン追加ダイアログの状態
  // useMemo で基準日（今月）を記憶することで、月またぎ時に useState の初期値がズレる問題を解消する。
  // new Date() をレンダリングのたびに呼ぶと月またぎ直後に選択肢と初期値が不一致になるため、
  // マウント時点の日付を依存配列なし（[]）で固定する。
  const yearMonthOptions = useMemo(() => generateYearMonthOptions(new Date()), []);
  // 選択中の年目標に紐づくマイルストーンのみ表示する。
  // 全マイルストーンをそのまま渡すと別の目標に切り替えても全件表示されてしまうため
  const filteredMilestones = useMemo(
    () => milestones.filter((m) => m.goalId === selectedGoalId),
    [milestones, selectedGoalId]
  );
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  // 初期値は今月（選択肢の先頭）
  const [milestoneYearMonth, setMilestoneYearMonth] = useState(() => yearMonthOptions[0]);
  const [milestoneTitle, setMilestoneTitle] = useState("");

  // タスク追加ダイアログの状態（どのマイルストーン配下かも保持する）
  // weekLabel は期日から自動計算するため state として持たない
  const [taskDialogMilestoneId, setTaskDialogMilestoneId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAddMilestoneSubmit() {
    const title = milestoneTitle.trim();
    if (!milestoneYearMonth || !title) return;
    onAddMilestone(milestoneYearMonth, title);
    setMilestoneYearMonth(yearMonthOptions[0]);
    setMilestoneTitle("");
    setMilestoneOpen(false);
  }

  function handleAddTaskSubmit() {
    if (!taskDialogMilestoneId) return;
    const title = taskTitle.trim();
    const due = taskDueDate.trim();
    if (!title || !due) return;
    // 期日から weekLabel を自動計算して渡す（ユーザーに週を選ばせない設計）
    onAddTask(taskDialogMilestoneId, weekLabelFromDueDate(due), title, due);
    setTaskTitle("");
    setTaskDueDate("");
    setTaskDialogMilestoneId(null);
  }

  // yearMonth を「YYYY年MM月」形式に変換して表示する
  function formatYearMonth(yearMonth: string) {
    const [year, month] = yearMonth.split("-");
    return `${year}年${month}月`;
  }

  // 今日のタスク件数を算出して件数バッジに表示する
  const todayTaskCount = tasks.filter((t) => t.isToday).length;

  // 目標が未選択の場合は goalId が空文字になるデータが作られるのを防ぐためプレースホルダーを表示する
  if (!selectedGoalId) {
    return (
      <section className="flex w-[280px] flex-shrink-0 flex-col items-center justify-center border-r border-border bg-canvas p-4 text-center text-sm text-muted-foreground">
        目標を選択してください
      </section>
    );
  }

  return (
    <section className="flex w-[280px] flex-shrink-0 flex-col border-r border-border bg-canvas">
      {/* 今日のタスクボタン: 選択中タスクをリセットして Pane 3 をデフォルト表示に戻す */}
      <div className="flex-shrink-0 border-b border-border p-2">
        <button
          type="button"
          onClick={() => onSelectTask(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            selectedTaskId === null
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-accent"
          )}
        >
          <span>{LABELS.task.today}</span>
          {/* 件数バッジ: 0件でも表示して「今日のタスクがない」ことを伝える */}
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-xs",
            selectedTaskId === null
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}>
            {todayTaskCount}
          </span>
        </button>
      </div>

      {/* マイルストーン一覧 */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {filteredMilestones.map((milestone) => {
          // W1→W2→W3→W4 の順に表示するため追加順ではなく weekLabel でソートする
          const WEEK_ORDER: Record<WeekTask["weekLabel"], number> = { W1: 0, W2: 1, W3: 2, W4: 3 };
          const milestoneTasks = tasks
            .filter((t) => t.milestoneId === milestone.id)
            .sort((a, b) => WEEK_ORDER[a.weekLabel] - WEEK_ORDER[b.weekLabel]);
          // 保存値はキャッシュ扱いのため、表示前に最新のタスク状態で再計算する
          const status = computeProgressStatus(milestone, milestoneTasks);
          const statusConfig = STATUS_CONFIG[status];
          const isOpen = openIds.has(milestone.id);

          return (
            <Collapsible
              key={milestone.id}
              open={isOpen}
              onOpenChange={() => toggleOpen(milestone.id)}
            >
              {/* マイルストーンヘッダー: ステータスに応じた背景色でカード全体を色分けする */}
              <div className={cn("flex items-center gap-1 rounded-md", statusConfig.bg)}>
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent/50 transition-colors"
                    />
                  }
                >
                  {isOpen
                    ? <ChevronDown className="size-3 flex-shrink-0 text-muted-foreground" />
                    : <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground" />
                  }
                  <span className="flex-1 truncate">{formatYearMonth(milestone.yearMonth)}: {milestone.title}</span>
                  <span title={statusConfig.label}>{statusConfig.icon}</span>
                </CollapsibleTrigger>

                {/* マイルストーン削除ボタン */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onDeleteMilestone(milestone.id)}
                  aria-label={`${milestone.title}を削除`}
                >
                  <Trash2 />
                </Button>
              </div>

              <CollapsibleContent>
                <div className="flex flex-col gap-0.5 pb-1 pl-4">
                  {/* 週タスク一覧 */}
                  {milestoneTasks.map((task) => (
                    <div key={task.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectTask(task.id)}
                        className={cn(
                          "flex-1 truncate rounded-md px-2 py-1 text-left text-xs transition-colors",
                          task.status === "done" && "text-muted-foreground line-through",
                          selectedTaskId === task.id
                            ? "bg-accent font-medium text-accent-foreground"
                            : "text-foreground hover:bg-accent"
                        )}
                      >
                        <span className="mr-1 text-muted-foreground">{task.weekLabel}</span>
                        {task.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 focus:opacity-100 group-hover:opacity-100"
                        onClick={() => onDeleteTask(task.id)}
                        aria-label={`${task.title}を削除`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}

                  {/* タスク追加ボタン。
                      DialogTrigger を Collapsible 内に置くと select の選択操作が
                      ダイアログ外クリックと誤検知されて閉じてしまうため、
                      onClick で state をセットするだけにして DialogContent は外側に置く */}
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
                    onClick={() => setTaskDialogMilestoneId(milestone.id)}
                  >
                    <Plus className="size-3" />
                    {LABELS.task.add}
                  </button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* マイルストーン追加ダイアログ */}
        <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
              />
            }
          >
            <Plus className="size-3" />
            {LABELS.milestone.add}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{LABELS.milestone.add}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{LABELS.milestone.yearMonthLabel}</label>
                <select
                  value={milestoneYearMonth}
                  onChange={(e) => setMilestoneYearMonth(e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  autoFocus
                >
                  {yearMonthOptions.map((ym) => (
                    <option key={ym} value={ym}>{formatYearMonth(ym)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">{LABELS.milestone.titleLabel}</label>
                <Input
                  placeholder={LABELS.milestone.titlePlaceholder}
                  maxLength={40}
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddMilestoneSubmit()}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                {LABELS.common.cancel}
              </DialogClose>
              <Button
                onClick={handleAddMilestoneSubmit}
                disabled={!milestoneYearMonth.trim() || !milestoneTitle.trim()}
              >
                {LABELS.common.add}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* タスク追加ダイアログ（マイルストーン選択後に開く） */}
      <Dialog
        open={taskDialogMilestoneId !== null}
        onOpenChange={(open) => { if (!open) setTaskDialogMilestoneId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{LABELS.task.add}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">タイトル</label>
              <Input
                placeholder="例: 単語300語を覚える"
                maxLength={60}
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddTaskSubmit()}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">期日</label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {LABELS.common.cancel}
            </DialogClose>
            <Button
              onClick={handleAddTaskSubmit}
              disabled={!taskTitle.trim() || !taskDueDate.trim()}
            >
              {LABELS.common.add}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
