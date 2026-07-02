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
 * 永続化（lib/storage.ts 経由、実体は localStorage または Supabase）:
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
  dailyReportsSchema,
  monthMilestonesSchema,
  weekTasksSchema,
  yearGoalsSchema,
} from "@/lib/schema";
import { STORAGE_KEYS, load, save } from "@/lib/storage";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import { getLocalDateString } from "@/lib/task-config";
import { exportToXlsx } from "@/lib/xlsx-export";
import { NavPane } from "./NavPane";
import { TaskListPane } from "./TaskListPane";
import { DetailPane } from "./DetailPane";
import { AiChatPane } from "./AiChatPane";
import { AttendancePane } from "./AttendancePane";
import { AttendanceListPane } from "./AttendanceListPane";

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
  // load 完了前に save が走ると初期値で localStorage を上書きしてしまうため、フラグで保護する
  const [isLoaded, setIsLoaded] = useState(false);

  // 永続化バックエンドからデータを復元する。
  // useEffect 内限定にする理由: SSR 時は window が存在せず load() が null を返すため
  // 6件を Promise.allSettled で並列実行する理由: Supabase 実装では各 load() がHTTPリクエストになるため、
  // 直列で待つと初期ロードが遅くなる。Promise.all だと1件でも失敗すると全件が
  // reject され取得済みの分も反映できなくなるため、個別に結果を見られる allSettled を使う
  useEffect(() => {
    async function loadAll() {
      const results = await Promise.allSettled([
        load(STORAGE_KEYS.goals, yearGoalsSchema),
        load(STORAGE_KEYS.milestones, monthMilestonesSchema),
        load(STORAGE_KEYS.tasks, weekTasksSchema),
        load(STORAGE_KEYS.dailyReports, dailyReportsSchema),
        load(STORAGE_KEYS.attendanceRecords, attendanceRecordsSchema),
        load(STORAGE_KEYS.attendanceSettings, attendanceSettingsSchema),
      ]);

      const [
        goalsResult,
        milestonesResult,
        tasksResult,
        dailyReportsResult,
        attendanceRecordsResult,
        attendanceSettingsResult,
      ] = results;

      if (goalsResult.status === "fulfilled" && goalsResult.value) setGoals(goalsResult.value);
      if (milestonesResult.status === "fulfilled" && milestonesResult.value) setMilestones(milestonesResult.value);
      if (tasksResult.status === "fulfilled" && tasksResult.value) setTasks(tasksResult.value);
      if (dailyReportsResult.status === "fulfilled" && dailyReportsResult.value) setDailyReports(dailyReportsResult.value);
      if (attendanceRecordsResult.status === "fulfilled" && attendanceRecordsResult.value) setAttendanceRecords(attendanceRecordsResult.value);
      if (attendanceSettingsResult.status === "fulfilled" && attendanceSettingsResult.value) setAttendanceSettings(attendanceSettingsResult.value);

      // 失敗したものがあればログに残す。一部失敗でも isLoaded は true にする
      // （永久に false のままだと保存処理自体が無効化されてしまうため）
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Failed to load workspace data:", result.reason);
        }
      });
      setIsLoaded(true);
    }
    void loadAll();
  }, []);

  // 状態変更のたびに即時保存すると、Supabase 移行後にAPI呼び出しが過剰になり、
  // 古いリクエストが新しいリクエストより後に完了してデータが先祖返りする競合状態も招くため、
  // デバウンス + 初回ロード直後のスキップを共通化したフックを使う
  useDebouncedSave(STORAGE_KEYS.goals, goals, isLoaded, save);
  useDebouncedSave(STORAGE_KEYS.milestones, milestones, isLoaded, save);
  useDebouncedSave(STORAGE_KEYS.tasks, tasks, isLoaded, save);
  useDebouncedSave(STORAGE_KEYS.dailyReports, dailyReports, isLoaded, save);
  useDebouncedSave(STORAGE_KEYS.attendanceRecords, attendanceRecords, isLoaded, save);
  useDebouncedSave(STORAGE_KEYS.attendanceSettings, attendanceSettings, isLoaded, save);

  function handleAddGoal(title: string) {
    const newGoal: YearGoal = { id: crypto.randomUUID(), title };
    setGoals((prev) => [...prev, newGoal]);
  }

  function handleDeleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (selectedGoalId === id) setSelectedGoalId(null);
  }

  function handleSelectGoal(id: string) {
    // 目標を切り替えるとき、前の目標のタスクが selectedTaskId に残ったまま
    // Pane 3 に表示され続けるのを防ぐためリセットする
    setSelectedGoalId(id);
    setSelectedTaskId(null);
  }

  function handleAddMilestone(yearMonth: string, title: string) {
    const newMilestone: MonthMilestone = {
      id: crypto.randomUUID(),
      // selectedGoalId がない場合は空文字にする（UI 側で goalId 必須にする想定）
      goalId: selectedGoalId ?? "",
      yearMonth,
      title,
      progressStatus: "ok",
    };
    setMilestones((prev) => [...prev, newMilestone]);
  }

  function handleDeleteMilestone(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    // マイルストーン削除時は紐づく週タスクも削除する。孤児タスクが残ると表示が壊れるため。
    // 削除対象タスクが選択中の場合は selectedTaskId もリセットして Pane 3 の表示崩れを防ぐ
    setTasks((prev) => {
      const hasSelected = prev.some((t) => t.milestoneId === id && t.id === selectedTaskId);
      if (hasSelected) setSelectedTaskId(null);
      return prev.filter((t) => t.milestoneId !== id);
    });
  }

  function handleAddTask(
    milestoneId: string,
    weekLabel: WeekTask["weekLabel"],
    title: string,
    dueDate: string
  ) {
    // 期日が今日と一致する場合は自動的に isToday: true にする。
    // ユーザーに明示的にフラグをセットさせると手間が増えるため、期日から自動導出する設計にした
    const today = getLocalDateString();
    const newTask: WeekTask = {
      id: crypto.randomUUID(),
      milestoneId,
      weekLabel,
      title,
      dueDate,
      status: "todo",
      priority: "medium",
      isToday: dueDate === today,
    };
    setTasks((prev) => [...prev, newTask]);
  }

  function handleDeleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTaskId === id) setSelectedTaskId(null);
  }

  function handleUpdateTask(id: string, changes: Partial<WeekTask>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }

  function handleUpdateAttendanceRecord(id: string, changes: Partial<AttendanceRecord>) {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...changes } : r))
    );
  }

  function handleClockIn(record: AttendanceRecord) {
    setAttendanceRecords((prev) => {
      // 同日レコードがある場合は clockIn だけ更新（既存データを保護するため上書きせず merge）
      const exists = prev.find((r) => r.id === record.id);
      if (exists) return prev.map((r) => r.id === record.id ? { ...r, clockIn: record.clockIn } : r);
      return [...prev, record];
    });
  }

  function handleClockOut(id: string, clockOut: string, workLog: string) {
    setAttendanceRecords((prev) =>
      prev.map((r) => r.id === id ? { ...r, clockOut, workLog } : r)
    );
  }

  /**
   * テンプレインポート（勤怠表取り込み）で確定した打刻データを一括反映する。
   * 同じ date の既存レコードがある場合は id を維持したまま取り込んだフィールドのみ上書きし、
   * 無い場合は importedRecords 側の id（crypto.randomUUID() 済み）で新規追加する。
   *
   * importedRecords 内に同じ date が複数含まれるケース（マッピングミス等で発生しうる）に
   * 対応するため、existingByDate はループ内で都度更新する。更新しないと、同date 2件目以降が
   * 1件目の追加を認識できずに「新規」判定のまま重複追加されてしまう
   */
  function handleImportAttendanceRecords(importedRecords: AttendanceRecord[]) {
    setAttendanceRecords((prev) => {
      const existingByDate = new Map(prev.map((r) => [r.date, r]));
      const merged = [...prev];

      for (const imported of importedRecords) {
        const existing = existingByDate.get(imported.date);
        if (existing) {
          const index = merged.findIndex((r) => r.id === existing.id);
          const updated = { ...existing, ...imported, id: existing.id };
          merged[index] = updated;
          existingByDate.set(imported.date, updated);
        } else {
          merged.push(imported);
          existingByDate.set(imported.date, imported);
        }
      }

      return merged;
    });
  }

  function handleAddDailyReport(date: string, reflection: string, learned: string, aiComment?: string) {
    const newReport: DailyReport = {
      id: crypto.randomUUID(),
      date,
      reflection,
      learned,
      aiComment,
    };
    setDailyReports((prev) => [...prev, newReport]);
  }

  function handleUpdateDailyReport(id: string, reflection: string, learned: string, aiComment?: string) {
    // aiComment を含めて永続化することで、リロード後も AI フィードバックが復元される
    setDailyReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reflection, learned, aiComment } : r))
    );
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
        onSelectGoal={handleSelectGoal}
        onAddGoal={handleAddGoal}
        onDeleteGoal={handleDeleteGoal}
        onChangeMode={setMode}
      />

      {/* Pane 2: TaskListPane / AttendancePane */}
      {mode === "goal" && (
        <TaskListPane
          selectedGoalId={selectedGoalId}
          milestones={milestones}
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          onAddMilestone={handleAddMilestone}
          onDeleteMilestone={handleDeleteMilestone}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
      {mode === "attendance" && (
        <AttendancePane
          attendanceRecords={attendanceRecords}
          attendanceSettings={attendanceSettings}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          onUpdateSettings={setAttendanceSettings}
        />
      )}

      {/* Pane 3: DetailPane / AttendanceListPane */}
      {mode === "goal" && (
        <DetailPane
          tasks={tasks}
          milestones={milestones}
          selectedTaskId={selectedTaskId}
          dailyReports={dailyReports}
          onUpdateTask={handleUpdateTask}
          onAddDailyReport={handleAddDailyReport}
          onUpdateDailyReport={handleUpdateDailyReport}
        />
      )}
      {mode === "attendance" && (
        <AttendanceListPane
          attendanceRecords={attendanceRecords}
          attendanceSettings={attendanceSettings}
          onUpdateRecord={handleUpdateAttendanceRecord}
          onUpdateSettings={setAttendanceSettings}
          onImportRecords={handleImportAttendanceRecords}
          onExport={(yearMonth) => exportToXlsx(yearMonth, attendanceRecords)}
        />
      )}

      {/* Pane 4: AiChatPane（勤怠モード時は非表示） */}
      {showPane4 && <AiChatPane />}
    </div>
  );
}
