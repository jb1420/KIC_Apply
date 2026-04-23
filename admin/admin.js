const SERVER_URL = 'https://jb1420.pythonanywhere.com';
const TOKEN_KEY = 'kic2026-admin-token';
const SEEN_IDS_KEY = 'kic2026-admin-seen-ids';
const POLL_INTERVAL_MS = 30 * 1000;

const loginPanel = document.getElementById('loginPanel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const adminMeta = document.getElementById('adminMeta');

const statTeams = document.getElementById('statTeams');
const statMembers = document.getElementById('statMembers');
const statLatest = document.getElementById('statLatest');
const submissionsEl = document.getElementById('submissions');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const csvBtn = document.getElementById('csvBtn');
const filterBtn = document.getElementById('filterBtn');

let allSubmissions = [];
let showHidden = false;
let pollTimer = null;

// ============ AUTH ============
// localStorage 사용 → 브라우저를 닫아도 토큰이 유지됨 (서버 토큰 만료는 7일)
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function isTokenExpired(t) {
  if (!t) return true;
  const parts = t.split('.');
  if (parts.length !== 3) return true;
  const expiry = parseInt(parts[1], 10);
  if (!Number.isFinite(expiry)) return true;
  return Date.now() / 1000 >= expiry;
}

// ============ SEEN IDS (푸시 알림용) ============
function getSeenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_IDS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function setSeenIds(set) {
  localStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...set]));
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = '인증 중...';

  try {
    const res = await fetch(`${SERVER_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });

    if (!res.ok) {
      if (res.status === 401) {
        loginError.textContent = '비밀번호가 일치하지 않습니다.';
      } else {
        loginError.textContent = `오류: ${res.status}`;
      }
      return;
    }

    const data = await res.json();
    setToken(data.token);
    passwordInput.value = '';
    await enterDashboard();
  } catch (err) {
    loginError.textContent = '서버 연결 실패: ' + err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '입장하기 →';
  }
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  stopPolling();
  dashboard.style.display = 'none';
  loginPanel.style.display = '';
  adminMeta.textContent = '';
  allSubmissions = [];
});

// ============ DASHBOARD ============
async function enterDashboard() {
  loginPanel.style.display = 'none';
  dashboard.style.display = '';
  adminMeta.textContent = `AUTHENTICATED · ${new Date().toLocaleString('ko-KR')}`;
  await requestNotificationPermission();
  await loadSubmissions({ initial: true });
  startPolling();
}

async function loadSubmissions({ initial = false, silent = false } = {}) {
  const token = getToken();
  if (!token) return;

  if (!silent) {
    submissionsEl.innerHTML = '<div class="empty">불러오는 중...</div>';
    emptyState.style.display = 'none';
  }

  try {
    const res = await fetch(`${SERVER_URL}/admin/submissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      clearToken();
      stopPolling();
      dashboard.style.display = 'none';
      loginPanel.style.display = '';
      loginError.textContent = '세션이 만료되었습니다. 다시 로그인해주세요.';
      return;
    }

    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

    const data = await res.json();
    const newList = data.submissions || [];

    detectAndNotifyNew(newList, { initial });

    allSubmissions = newList;
    renderStats();
    applyFilters();
  } catch (err) {
    if (!silent) {
      submissionsEl.innerHTML = `<div class="empty">불러오기 실패: ${err.message}</div>`;
    }
  }
}

// ============ POLLING ============
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    loadSubmissions({ silent: true });
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ============ NOTIFICATIONS ============
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
}

function detectAndNotifyNew(newList, { initial }) {
  const seen = getSeenIds();
  const currentIds = newList.map(s => s.applicationId).filter(Boolean);

  if (initial) {
    // 최초 로드 시에는 알림 없이 기준선만 저장
    setSeenIds(new Set(currentIds));
    return;
  }

  const added = newList.filter(s => s.applicationId && !seen.has(s.applicationId));
  if (added.length > 0) {
    showNewSubmissionNotification(added);
  }

  setSeenIds(new Set(currentIds));
}

function showNewSubmissionNotification(added) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = added.length === 1
    ? `새 지원서: ${added[0].teamName || '(팀명 없음)'}`
    : `새 지원서 ${added.length}건 도착`;

  const body = added
    .slice(0, 3)
    .map(s => `${s.teamName || '(팀명 없음)'} · ${(s.members || []).length}명`)
    .join('\n');

  try {
    const n = new Notification(title, { body, tag: 'kic-new-submission' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}

function renderStats() {
  const visibleSubmissions = allSubmissions.filter(sub => !sub.hidden);
  statTeams.textContent = visibleSubmissions.length;
  const totalMembers = visibleSubmissions.reduce((sum, s) => sum + (s.members?.length || 0), 0);
  statMembers.textContent = totalMembers;

  if (visibleSubmissions.length > 0) {
    const latest = [...visibleSubmissions].sort((a, b) =>
      new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
    )[0];
    statLatest.textContent = formatTime(latest.submittedAt);
  } else {
    statLatest.textContent = '—';
  }
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function gradeLabel(g) {
  if (!g) return '';
  return g === 'RAA' ? 'RAA' : `${g}학년`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderSubmissions(list) {
  if (!list.length) {
    submissionsEl.innerHTML = '';
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  const sorted = [...list].sort((a, b) =>
    new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)
  );

  submissionsEl.innerHTML = sorted.map(sub => {
    const isHidden = sub.hidden;
    const members = (sub.members || []).map((m, i) => {
      const isLeader = i === 0;
      const grade = gradeLabel(m.grade);
      const cls = grade && m.room ? `${grade} ${m.room}반` : grade;
      return `
        <div class="member-row">
          <span class="member-tag ${isLeader ? 'leader' : ''}">
            ${isLeader ? 'LEADER' : `MEMBER ${String(i + 1).padStart(2, '0')}`}
          </span>
          <div class="member-name">${escapeHtml(m.name) || '—'}</div>
          <div class="member-info">
            ${cls ? `<span>${escapeHtml(cls)}</span>` : ''}
            ${m.studentId ? `<span>${escapeHtml(m.studentId)}</span>` : ''}
            ${m.size ? `<span>SIZE <strong>${escapeHtml(m.size)}</strong></span>` : ''}
            ${m.contact ? `<span>${escapeHtml(m.contact)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="sub-card ${isHidden ? 'hidden' : ''}">
        <div class="sub-header">
          <div class="sub-head-left">
            <div class="sub-id">${escapeHtml(sub.applicationId || '—')}</div>
            <div class="sub-team">${escapeHtml(sub.teamName) || '(팀명 없음)'}</div>
            ${sub.teamSlogan ? `<div class="sub-slogan">"${escapeHtml(sub.teamSlogan)}"</div>` : ''}
            ${isHidden ? '<div class="hidden-badge">숨김</div>' : ''}
          </div>
          <div class="sub-actions">
            <button class="hide-btn ${isHidden ? 'hidden' : ''}" data-app-id="${escapeHtml(sub.applicationId)}">
              ${isHidden ? '표시' : '숨기기'}
            </button>
            <div class="sub-time">${formatTime(sub.submittedAt)}</div>
          </div>
        </div>
        <div class="sub-divider"></div>
        <div class="members-grid">${members}</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.hide-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleHidden(btn.dataset.appId, btn));
  });
}

async function toggleHidden(appId, btn) {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${SERVER_URL}/admin/toggle-hidden/${encodeURIComponent(appId)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`오류: ${res.status}`);

    const data = await res.json();
    await loadSubmissions();
  } catch (err) {
    alert('오류: ' + err.message);
  }
}

// ============ FILTER ============
filterBtn.addEventListener('click', () => {
  showHidden = !showHidden;
  filterBtn.classList.toggle('active', showHidden);
  applyFilters();
});

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  let filtered = allSubmissions;

  if (!showHidden) {
    filtered = filtered.filter(sub => !sub.hidden);
  }

  if (q) {
    filtered = filtered.filter(sub => {
      if ((sub.teamName || '').toLowerCase().includes(q)) return true;
      if ((sub.applicationId || '').toLowerCase().includes(q)) return true;
      if ((sub.members || []).some(m => (m.name || '').toLowerCase().includes(q))) return true;
      return false;
    });
  }

  renderSubmissions(filtered);
}

// ============ SEARCH ============
searchInput.addEventListener('input', applyFilters);

// ============ REFRESH ============
refreshBtn.addEventListener('click', loadSubmissions);

// ============ CSV EXPORT ============
csvBtn.addEventListener('click', () => {
  const exportList = allSubmissions.filter(sub => !sub.hidden);
  if (!exportList.length) return;
  const rows = [
    ['applicationId', 'teamName', 'teamSlogan', 'submittedAt', 'memberRole', 'name', 'grade', 'room', 'studentId', 'size', 'contact']
  ];
  exportList.forEach(sub => {
    (sub.members || []).forEach((m, i) => {
      rows.push([
        sub.applicationId || '',
        sub.teamName || '',
        sub.teamSlogan || '',
        sub.submittedAt || '',
        i === 0 ? 'LEADER' : `MEMBER${i + 1}`,
        m.name || '', m.grade || '', m.room || '', m.studentId || '', m.size || '', m.contact || ''
      ]);
    });
  });
  const csv = rows.map(r =>
    r.map(cell => {
      const s = String(cell).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(',')
  ).join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kic2026-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ============ AUTO-LOGIN ============
const existingToken = getToken();
if (existingToken) {
  if (isTokenExpired(existingToken)) {
    clearToken();
  } else {
    enterDashboard();
  }
}
