/**
 * Workspace.tsx
 *
 * アプリ全体の state SSoT（Single Source of Truth）。
 * 全 Pane に props + callback で渡す単方向データフロー設計。
 *
 * State:
 *   goals / milestones / tasks / dailyReports / attendanceRecords / attendanceSettings
 *   mode            — "goal" | "attendance"
 *   selectedGoalId  — 選択中の年目標 ID（null = 未選択）
 *   selectedTaskId  — 選択中の週タスク ID（null = 今日のタスク一覧を表示）
 *
 * localStorage 連携:
 *   初回マウント時に useEffect で load()、各 state 変更時に useEffect で save()
 *   SSR で window が存在しない場合は load() が null を返すため、useEffect 内限定で呼ぶ
 */

"use client";

import { useEffect, useState } from "react";
import {
  type AttendanceRecord,
  type AttendanceSettings,
  type DailyReport,
  type MonthMilestone,
  type WeekTask,
  type YearGoal,
  attendanceRecordsSchema,
  attendanceSettingsSchema,
  monthMilestonesSchema,
  weekTasksSchema,
  yearGoalsSchema,
} from "@/lib/schema";
import { STORAGE_KEYS, load, save } from "@/lib/storage";
import { NavPane } from "./NavPane";

const DEFAULT_SETTINGS: AttendanceSettings = {
  targetHoursPerMonth: 160,
};

export function Workspace() {
  const [goals, setGoals] = useState<YearGoal[]>([]);
  const [milestones, setMilestones] = useState<MonthMilestone[]>([]);
  const [tasks, setTasks] = useState<WeekTask[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<"goal" | "attendance">("goal");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // localStorage からデータを復元する。
  // useEffect 内限定にする理由: SSR 時は window が存在せず load() が null を返すため
  useEffect(() => {
    const savedGoals = load(STORAGE_KEYS.goals, yearGoalsSchema);
    const savedMilestones = load(STORAGE_KEYS.milestones, monthMilestonesSchema);
    const savedTasks = load(STORAGE_KEYS.tasks, weekTasksSchema);
    const savedAttendanceRecords = load(STORAGE_KEYS.attendanceRecords, attendanceRecordsSchema);
    const savedAttendanceSettings = load(STORAGE_KEYS.attendanceSettings, attendanceSettingsSchema);

    if (savedGoals) setGoals(savedGoals);
    if (savedMilestones) setMilestones(savedMilestones);
    if (savedTasks) setTasks(savedTasks);
    if (savedAttendanceRecords) setAttendanceRecords(savedAttendanceRecords);
    if (savedAttendanceSettings) setAttendanceSettings(savedAttendanceSettings);
  }, []);

  useEffect(() => { save(STORAGE_KEYS.goals, goals); }, [goals]);
  useEffect(() => { save(STORAGE_KEYS.milestones, milestones); }, [milestones]);
  useEffect(() => { save(STORAGE_KEYS.tasks, tasks); }, [tasks]);
  useEffect(() => { save(STORAGE_KEYS.dailyReports, dailyReports); }, [dailyReports]);
  useEffect(() => { save(STORAGE_KEYS.attendanceRecords, attendanceRecords); }, [attendanceRecords]);
  useEffect(() => { save(STORAGE_KEYS.attendanceSettings, attendanceSettings); }, [attendanceSettings]);

  function handleAddGoal(title: string) {
    const newGoal: YearGoal = { id: crypto.randomUUID(), title };
    setGoals((prev) => [...prev, newGoal]);
  }

  function handleDeleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (selectedGoalId === id) setSelectedGoalId(null);
  }

  // 勤怠モード時は Pane 4（AI チャット）を非表示にする。
  // 勤怠打刻は素早い操作が主なので、AI チャットエリアを消してデスクを広く使う設計
  const showPane4 = mode === "goal";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Pane 1: NavPane */}
      <NavPane
        goals={goals}
        mode={mode}
        selectedGoalId={selectedGoalId}
        onSelectGoal={setSelectedGoalId}
        onAddGoal={handleAddGoal}
        onDeleteGoal={handleDeleteGoal}
        onChangeMode={setMode}
      />

      {/* Pane 2: TaskListPane / AttendancePane（Step 4・7 で実装） */}
      <section className="flex w-70 flex-shrink-0 flex-col border-r border-border bg-canvas" />

      {/* Pane 3: DetailPane / AttendanceListPane（Step 5・8 で実装） */}
      <section className="flex flex-1 flex-col border-r border-border bg-background" />

      {/* Pane 4: AiChatPane（Step 6 で実装、勤怠モード時は非表示） */}
      {showPane4 && (
        <section className="flex w-80 flex-shrink-0 flex-col bg-canvas" />
      )}
    </div>
  );
}
