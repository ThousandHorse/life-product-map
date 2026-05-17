// ===== Mockup state manager =====
// モード切替・セクション折りたたみのみを担う最小限のスクリプト。
// React 移行時はこのロジックを useState / useCallback に置き換える。

let currentMode = 'goal';

/** 目標モード / 勤怠モードを切り替える */
function setMode(mode) {
  currentMode = mode;
  const isGoal = mode === 'goal';

  // sidebar active state
  document.getElementById('nav-goal')
    .querySelector('.nav-section-header')
    .classList.toggle('active', isGoal);
  document.getElementById('nav-att-header')
    .classList.toggle('active', !isGoal);

  // pane2
  show('pane2-goal',       isGoal);
  show('pane2-attendance', !isGoal);

  // pane3
  show('pane3-goal',       isGoal);
  show('pane3-attendance', !isGoal);

  // pane4: 勤怠モードでは非表示
  const pane4 = document.getElementById('pane4');
  if (pane4) pane4.style.display = isGoal ? 'flex' : 'none';

  // switcher buttons (mockup dev tool)
  styleDevBtn('btn-goal',       isGoal);
  styleDevBtn('btn-attendance', !isGoal);
}

/** nav-section の折りたたみ / 展開 */
function toggleSection(id) {
  document.getElementById(id).classList.toggle('open');
}

/** 目標行のアクティブ状態を切り替える */
function selectGoal(el) {
  document.querySelectorAll('.goal-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  // 目標モードに切り替え（勤怠モードから戻る用途）
  if (currentMode !== 'goal') setMode('goal');
}

/** サイドバーの折りたたみ（モックアップでは幅トグルのみ） */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.style.width = sidebar.style.width === '48px' ? '240px' : '48px';
}

// ── helpers ──────────────────────────────────────────

function show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function styleDevBtn(id, active) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.background = active ? '#1e3a5f' : 'white';
  btn.style.color       = active ? 'white'   : '';
}

// ── init ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => setMode('goal'));
