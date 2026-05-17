// ===== Mockup state manager =====
// モード切替・サイドバー折りたたみのみを担う最小限のスクリプト。
// React 移行時はこのロジックを useState / useCallback に置き換える。

let currentMode = 'goal';
let goalCount = 3; // モックの初期目標数

/** 目標モード / 勤怠モードを切り替える */
function setMode(mode) {
  currentMode = mode;
  const isGoal = mode === 'goal';

  // sidebar: モード行のアクティブ状態
  const modeGoal = document.getElementById('mode-goal');
  const modeAtt  = document.getElementById('mode-attendance');
  if (modeGoal) modeGoal.classList.toggle('active', isGoal);
  if (modeAtt)  modeAtt.classList.toggle('active', !isGoal);

  // 年目標セクションは目標モード時のみ表示
  const goalsSection = document.getElementById('goals-section');
  if (goalsSection) goalsSection.style.display = isGoal ? 'block' : 'none';

  // pane2
  show('pane2-goal',       isGoal);
  show('pane2-attendance', !isGoal);

  // pane3
  show('pane3-goal',       isGoal);
  show('pane3-attendance', !isGoal);

  // pane4: 勤怠モードでは非表示
  const pane4 = document.getElementById('pane4');
  if (pane4) pane4.style.display = isGoal ? 'flex' : 'none';

}

/** 目標行のアクティブ状態を切り替える */
function selectGoal(el) {
  document.querySelectorAll('.goal-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  if (currentMode !== 'goal') setMode('goal');
}

/** サイドバーの折りたたみ（CSSクラストグル） */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}

// ── 年目標追加ダイアログ ────────────────────────────────

function openAddGoalDialog() {
  if (goalCount >= 5) return;
  const overlay = document.getElementById('add-goal-overlay');
  const input   = document.getElementById('add-goal-input');
  if (overlay) overlay.classList.add('open');
  if (input)   { input.value = ''; setTimeout(() => input.focus(), 50); }
}

function closeAddGoalDialog() {
  const overlay = document.getElementById('add-goal-overlay');
  if (overlay) overlay.classList.remove('open');
}

function submitAddGoal() {
  const input = document.getElementById('add-goal-input');
  const title = input ? input.value.trim() : '';
  if (!title) return;

  goalCount++;
  const goals = document.querySelector('.nav-goals');
  if (goals) {
    const item = document.createElement('div');
    item.className = 'goal-item';
    item.setAttribute('onclick', 'selectGoal(this)');
    item.innerHTML = `
      <span class="goal-arrow">▶</span>
      <span class="goal-item-text sidebar-expanded-only">${escapeHtml(title)}</span>
      <span class="goal-item-menu sidebar-expanded-only">…</span>
    `;
    // 折りたたみ中なら expanded-only を非表示に合わせる
    if (document.getElementById('sidebar').classList.contains('collapsed')) {
      item.querySelectorAll('.sidebar-expanded-only').forEach(el => el.style.display = 'none');
    }
    goals.appendChild(item);
  }

  // 5件達成で追加ボタンを disabled に
  const addBtn = document.getElementById('goal-add-btn');
  if (addBtn) addBtn.disabled = goalCount >= 5;

  closeAddGoalDialog();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── helpers ──────────────────────────────────────────

function show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'flex' : 'none';
}


// ── init ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => setMode('goal'));
