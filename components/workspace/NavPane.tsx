/**
 * NavPane.tsx
 *
 * Pane 1: 年目標一覧（最大5件）とモード切替（目標 / 勤怠）を表示するナビゲーションパネル。
 * 年目標の追加（ダイアログ）・削除（確認ダイアログ）もここで行う。
 * サイドバーの折りたたみ状態は他 Pane に影響しないため NavPane ローカル state で管理する。
 *
 * Props:
 *   goals           — 年目標の一覧
 *   mode            — 現在のモード（"goal" | "attendance"）
 *   selectedGoalId  — 選択中の年目標 ID
 *   onSelectGoal    — 年目標選択時のコールバック
 *   onAddGoal       — 年目標追加時のコールバック（title を受け取る）
 *   onDeleteGoal    — 年目標削除時のコールバック（id を受け取る）
 *   onChangeMode    — モード切替時のコールバック
 */

"use client";

import { useState } from "react";
import { ChevronLeft, Clock, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { type YearGoal } from "@/lib/schema";
import { cn } from "@/lib/utils";

type NavPaneProps = {
  goals: YearGoal[];
  mode: "goal" | "attendance";
  selectedGoalId: string | null;
  onSelectGoal: (id: string) => void;
  onAddGoal: (title: string) => void;
  onDeleteGoal: (id: string) => void;
  onChangeMode: (mode: "goal" | "attendance") => void;
};

export function NavPane({
  goals,
  mode,
  selectedGoalId,
  onSelectGoal,
  onAddGoal,
  onDeleteGoal,
  onChangeMode,
}: NavPaneProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<YearGoal | null>(null);
  const [hoveredGoalId, setHoveredGoalId] = useState<string | null>(null);

  // 年目標は最大5件に制限する（UI 上の可読性確保のため）
  const canAddGoal = goals.length < 5;

  function handleAddSubmit() {
    const trimmed = addTitle.trim();
    if (!trimmed) return;
    onAddGoal(trimmed);
    setAddTitle("");
    setAddOpen(false);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    onDeleteGoal(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <aside
      className={cn(
        "flex flex-shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-12" : "w-60"
      )}
    >
      <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border px-3">
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground">
            LifeProductMap
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed((v) => !v)}
          className={cn("ml-auto text-muted-foreground", collapsed && "mx-auto")}
          aria-label={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
        >
          <ChevronLeft
            className={cn("transition-transform duration-200", collapsed && "rotate-180")}
          />
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">

        {/* 目標モード */}
        <button
          type="button"
          onClick={() => onChangeMode("goal")}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
            mode === "goal"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Target className="size-4 flex-shrink-0" />
          {!collapsed && <span>{LABELS.mode.goal}</span>}
        </button>

        {/* 年目標リスト（折りたたみ時は非表示） */}
        {!collapsed && (
          <div className="flex flex-col gap-0.5 pl-2">
            <div className="flex items-center justify-between py-1 pr-1">
              <span className="text-xs text-muted-foreground">年目標</span>

              {/* 追加ダイアログ */}
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={!canAddGoal}
                      aria-label={LABELS.goal.add}
                      title={canAddGoal ? LABELS.goal.add : LABELS.goal.maxReached}
                    />
                  }
                >
                  <span className="text-base leading-none">+</span>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{LABELS.goal.add}</DialogTitle>
                  </DialogHeader>
                  <Input
                    placeholder={LABELS.goal.placeholder}
                    maxLength={40}
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                    autoFocus
                  />
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      {LABELS.common.cancel}
                    </DialogClose>
                    <Button onClick={handleAddSubmit} disabled={!addTitle.trim()}>
                      追加
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {goals.map((goal) => (
              <div
                key={goal.id}
                className="group relative flex items-center"
                onMouseEnter={() => setHoveredGoalId(goal.id)}
                onMouseLeave={() => setHoveredGoalId(null)}
              >
                <button
                  type="button"
                  onClick={() => onSelectGoal(goal.id)}
                  className={cn(
                    "flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    selectedGoalId === goal.id
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  {goal.title}
                </button>

                {/* ホバー時に削除ボタンを表示 */}
                {hoveredGoalId === goal.id && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(goal)}
                    aria-label={`${goal.title}を削除`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="my-1 border-t border-border" />

        {/* 勤怠モード */}
        <button
          type="button"
          onClick={() => onChangeMode("attendance")}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
            mode === "attendance"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Clock className="size-4 flex-shrink-0" />
          {!collapsed && <span>{LABELS.mode.attendance}</span>}
        </button>
      </nav>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>年目標を削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            「{deleteTarget?.title}」を削除します。この操作は取り消せません。
          </p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {LABELS.common.cancel}
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {LABELS.goal.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
