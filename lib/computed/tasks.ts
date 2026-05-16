/**
 * tasks.ts
 *
 * 月マイルストーンの進捗ステータスを自動計算する純粋関数。
 * UI に依存しないロジックを分離することで、テストしやすい状態を保つ。
 *
 * ステータスの判定基準:
 *   ok      : 達成率 > 70% または 残日数 > 14日
 *   caution : 達成率 40〜70% かつ 残日数 7〜14日
 *   danger  : 達成率 < 40% または 残日数 < 7日
 *
 * 注意事項:
 *   - progressStatus は MonthMilestone に保存されるが、表示前に再計算して上書きする。
 *     保存値はキャッシュ扱いであり、常に最新の週タスク状態から算出した値を使う。
 */

import type { MonthMilestone, WeekTask } from "@/lib/schema";

type ProgressStatus = "ok" | "caution" | "danger";

/**
 * 月マイルストーンの進捗ステータスを計算する。
 *
 * @param milestone  対象の月マイルストーン
 * @param tasks      そのマイルストーンに紐づく週タスク一覧
 * @param today      基準日（テスト時に任意の日付を渡せるよう引数で受け取る）
 */
export function computeProgressStatus(
  milestone: MonthMilestone,
  tasks: WeekTask[],
  today: Date = new Date()
): ProgressStatus {
  // 月末日を計算して残日数を求める
  const [year, month] = milestone.yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0); // month は 1-indexed なので 0 日 = 前月末
  const remainingDays = Math.max(
    0,
    Math.ceil((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  // タスクがない場合は残日数だけで判定する
  if (tasks.length === 0) {
    if (remainingDays > 14) return "ok";
    if (remainingDays >= 7) return "caution";
    return "danger";
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const achievementRate = doneCount / tasks.length;

  // 達成率が高い、または余裕がある場合は順調
  if (achievementRate > 0.7 || remainingDays > 14) return "ok";

  // 達成率が中程度かつ残日数が7〜14日は注意
  if (achievementRate >= 0.4 && remainingDays >= 7) return "caution";

  // 達成率が低い、または残日数が少ない場合は危険
  return "danger";
}

/**
 * 今日のタスク一覧を返す。
 * isToday フラグが立っているタスクを抽出する。
 */
export function getTodayTasks(tasks: WeekTask[]): WeekTask[] {
  return tasks.filter((t) => t.isToday);
}
