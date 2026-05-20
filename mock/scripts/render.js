/**
 * render.js
 * mock-data.json を fetch して各 Pane の DOM を生成するレンダラー。
 * main.js のモード切替ロジックとは分離し、データ→表示の責務のみを持つ。
 * React 移行時はこのファイルを削除し、各コンポーネントに置き換える。
 */

const CIRCUMFERENCE = 2 * Math.PI * 44; // ドーナツ r=44 の周長 ≈ 276.5

// ── ユーティリティ ──────────────────────────────────────────

function formatDur(min) {
  if (min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// ── Sidebar: 年目標リスト ────────────────────────────────────

function renderSidebar(goals) {
  const container = document.querySelector('.nav-goals');
  if (!container) return;
  container.innerHTML = '';

  goals.forEach((goal, i) => {
    const item = document.createElement('div');
    item.className = 'goal-item' + (i === 0 ? ' active' : '');
    item.dataset.goalId = goal.id;
    item.setAttribute('onclick', 'selectGoal(this)');
    item.innerHTML = `
      <span class="goal-arrow">▶</span>
      <span class="goal-item-text sidebar-expanded-only">${escapeHtml(goal.title)}</span>
      <span class="goal-item-menu sidebar-expanded-only">…</span>
    `;
    container.appendChild(item);
  });

  const addBtn = document.getElementById('goal-add-btn');
  if (addBtn) addBtn.disabled = goals.length >= 5;
}

// ── Pane 2（目標モード）: タスクリスト ──────────────────────

function renderGoalPane2(goal) {
  const titleEl = document.querySelector('#pane2-goal .pane2-month');
  if (titleEl) titleEl.textContent = goal.title;

  const listEl = document.querySelector('#pane2-goal .task-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  goal.tasks.forEach(task => {
    const badgeClass = { high: 'badge-high', mid: 'badge-mid', done: 'badge-done' }[task.priority] || 'badge-mid';
    const badgeLabel = { high: 'HIGH', mid: 'MID', done: 'DONE' }[task.priority] || task.priority.toUpperCase();
    const doneClass  = task.priority === 'done' ? ' task-done' : '';
    const div = document.createElement('div');
    div.className = `card task-card${doneClass}`;
    div.innerHTML = `
      <div class="task-card-top">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <span class="task-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${task.progress}%;"></div>
      </div>
    `;
    listEl.appendChild(div);
  });
}

// ── Pane 3（目標モード）: 詳細・進捗・今日のタスク ──────────

function renderGoalPane3(goal) {
  // タイトル
  setText('#pane3-goal .detail-title', goal.title);

  // ステータス（達成率・残日数から ok/caution/danger を判定）
  // バッジ要素とその親カードの両方にクラスを付与してカード全体を色付けする
  const badge = document.getElementById('goal-status-badge');
  if (badge) {
    const rate     = goal.achievementRate;
    const daysLeft = goal.daysLeft;
    let status, label;
    if (rate < 40 || daysLeft < 7) {
      status = 'danger'; label = '🚨 危険';
    } else if (rate < 70 && daysLeft < 14) {
      status = 'caution'; label = '⚠️ 注意';
    } else {
      status = 'ok'; label = '✅ 順調';
    }
    badge.className = 'goal-status-badge';
    badge.textContent = label;
    // 親の stat-card に status クラスを付与してカード背景を変える
    const card = badge.closest('.stat-card');
    if (card) card.className = `stat-card status-${status}`;
  }

  // 達成率・残日数
  setText('#pane3-goal .stat-achievementRate', `${goal.achievementRate}%`);
  setText('#pane3-goal .stat-daysLeft', String(goal.daysLeft));

  // ドーナツ（完了率のみ、「完了」テキストなし）
  const pct    = goal.weeklyProgress.done / (goal.weeklyProgress.total || 1);
  const filled = CIRCUMFERENCE * pct;
  const pctText = Math.round(pct * 100) + '%';

  const fillEl = document.querySelector('#pane3-goal .donut-fill');
  if (fillEl) fillEl.setAttribute('stroke-dasharray', `${filled.toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`);
  setText('#pane3-goal .donut-pct-main', pctText);

  // 日別バー
  const dayList = document.querySelector('#pane3-goal .donut-day-list');
  if (dayList) {
    dayList.innerHTML = '';
    goal.weeklyProgress.days.forEach(day => {
      const ratio  = day.total > 0 ? day.done / day.total : 0;
      const status = day.total === 0 ? 'none' : ratio === 1 ? 'done' : ratio > 0 ? 'partial' : 'none';
      const badge  = day.total === 0 ? '未' : `${day.done}/${day.total}`;
      const row = document.createElement('div');
      row.className = `donut-day-row ${status}`;
      row.innerHTML = `
        <span class="donut-day-date">${day.date} ${day.weekday}</span>
        <div class="donut-day-bar-bg"><div class="donut-day-bar-fill" style="width:${Math.round(ratio * 100)}%"></div></div>
        <span class="donut-day-badge ${status}">${badge}</span>
      `;
      dayList.appendChild(row);
    });
  }

  // 今日のタスク
  const taskList = document.querySelector('#pane3-goal .today-task-list');
  if (taskList) {
    taskList.innerHTML = '';
    goal.todayTasks.forEach(task => {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:14px 18px;';
      div.innerHTML = `
        <input type="checkbox" ${task.done ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary);" />
        <span style="font-size:14px;">${escapeHtml(task.title)}</span>
      `;
      taskList.appendChild(div);
    });
  }
}

// ── Pane 4: AI チャット ──────────────────────────────────────

function renderAiChat(goal) {
  const body = document.querySelector('.chat-body');
  if (!body) return;
  body.innerHTML = '';
  goal.aiChat.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-bubble ${msg.role}`;
    div.textContent = msg.text;
    body.appendChild(div);
  });
}

// ── Pane 2（勤怠モード）: 今日の打刻状況 ──────────────────

function renderAttendancePane2(attendance) {
  const t = attendance.today;
  setText('#pane2-attendance .att-date-label', t.dateLabel);
  setText('#pane2-attendance .att-clockIn-value',  t.clockIn  || '—');
  setText('#pane2-attendance .att-clockOut-value', t.clockOut || '—');
  setText('#pane2-attendance .att-worked-value',   formatDur(t.workedMinutes));

  const s = attendance.monthSummary;
  setText('#pane2-attendance .att-total-value', `${s.totalHours}h`);
  setText('#pane2-attendance .att-target-label', `目標 ${s.targetHours}h`);
  setText('#pane2-attendance .att-progress-pct', `${s.progressRate}%`);
  const bar = document.querySelector('#pane2-attendance .att-month-bar');
  if (bar) bar.style.width = `${s.progressRate}%`;
}

// ── 目標選択時の全 Pane 更新 ────────────────────────────────

function selectGoalById(goalId, data) {
  const goal = data.goals.find(g => g.id === goalId) || data.goals[0];
  renderGoalPane2(goal);
  renderGoalPane3(goal);
  renderAiChat(goal);
}

// ── helpers ─────────────────────────────────────────────────

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── エントリポイント ─────────────────────────────────────────

async function initMock() {
  const res  = await fetch('data/mock-data.json');
  const data = await res.json();

  // グローバルに保持（main.js の selectGoal から参照するため）
  window.__mockData = data;

  renderSidebar(data.goals);
  selectGoalById(data.goals[0].id, data);
  renderAttendancePane2(data.attendance);
}
