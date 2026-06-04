/**
 * labels.ts
 *
 * アプリ全体で使う日本語ラベルの一元管理。
 * コンポーネントに文言を直書きすると変更時に全ファイルを探す必要があるため、ここに集約する。
 */

export const LABELS = {
  mode: {
    goal: "目標",
    attendance: "勤怠",
  },

  goal: {
    add: "目標を追加",
    delete: "削除",
    placeholder: "例: TOEIC 900点取得",
    maxReached: "目標は最大5件まで",
  },

  milestone: {
    add: "マイルストーンを追加",
    delete: "削除",
    yearMonthPlaceholder: "例: 2025-06",
    titlePlaceholder: "例: TOEIC 受験",
    yearMonthLabel: "年月（YYYY-MM）",
    titleLabel: "タイトル",
  },

  progressStatus: {
    ok: "順調",
    caution: "注意",
    danger: "危険",
  },

  task: {
    today: "今日のタスク",
    add: "タスクを追加",
    status: {
      todo: "未着手",
      inProgress: "進行中",
      done: "完了",
    },
    priority: {
      high: "高",
      medium: "中",
      low: "低",
    },
    weekLabel: {
      W1: "第1週",
      W2: "第2週",
      W3: "第3週",
      W4: "第4週",
    },
  },

  dailyReport: {
    button: "日報を書く",
    reflection: "今日の振り返り",
    learned: "学んだこと",
    submit: "提出する",
    aiFeedback: "AI フィードバック",
    placeholder: {
      reflection: "今日の出来事や気づきを書いてください...",
      learned: "今日身についたことを書いてください...",
    },
  },

  attendance: {
    clockIn: "出勤",
    clockOut: "退勤",
    targetHoursPerMonth: "月間目標稼働時間",
    export: "エクスポート",
    hours: "時間",
    workDuration: "稼働時間",
  },

  common: {
    cancel: "キャンセル",
    save: "保存",
    close: "閉じる",
    add: "追加",
    confirm: "確認",
  },
} as const;
