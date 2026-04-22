const SERVER_URL = 'https://jb1420.pythonanywhere.com';
const TOKEN_KEY = 'kic2026-admin-token';

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

let allSubmissions = [];

// ============ AUTH ============
function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(t) {
  sessionStorage.setItem(TOKEN_KEY, t);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
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
  await loadSubmissions();
}

async function loadSubmissions() {
  const token = getToken();
  if (!token) return;

  submissionsEl.innerHTML = '<div class="empty">불러오는 중...</div>';
  emptyState.style.display = 'none';

  try {
    const res = await fetch(`${SERVER_URL}/admin/submissions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      clearToken();
      dashboard.style.display = 'none';
      loginPanel.style.display = '';
      loginError.textContent = '세션이 만료되었습니다. 다시 로그인해주세요.';
      return;
    }

    if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

    const data = await res.json();
    allSubmissions = data.submissions || [];
    renderStats();
    renderSubmissions(allSubmissions);
  } catch (err) {
    submissionsEl.innerHTML = `<div class="empty">불러오기 실패: ${err.message}</div>`;
  }
}

function renderStats() {
  statTeams.textContent = allSubmissions.length;
  const totalMembers = allSubmissions.reduce((sum, s) => sum + (s.members?.length || 0), 0);
  statMembers.textContent = totalMembers;

  if (allSubmissions.length > 0) {
    const latest = [...allSubmissions].sort((a, b) =>
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
            ${m.size ? `<span>SIZE <strong>${escapeHtml(m.size)}</strong></span>` : ''}
            ${m.contact ? `<span>${escapeHtml(m.contact)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="sub-card">
        <div class="sub-header">
          <div class="sub-head-left">
            <div class="sub-id">${escapeHtml(sub.applicationId || '—')}</div>
            <div class="sub-team">${escapeHtml(sub.teamName) || '(팀명 없음)'}</div>
            ${sub.teamSlogan ? `<div class="sub-slogan">"${escapeHtml(sub.teamSlogan)}"</div>` : ''}
          </div>
          <div class="sub-time">${formatTime(sub.submittedAt)}</div>
        </div>
        <div class="sub-divider"></div>
        <div class="members-grid">${members}</div>
      </div>
    `;
  }).join('');
}

// ============ SEARCH ============
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    renderSubmissions(allSubmissions);
    return;
  }
  const filtered = allSubmissions.filter(sub => {
    if ((sub.teamName || '').toLowerCase().includes(q)) return true;
    if ((sub.applicationId || '').toLowerCase().includes(q)) return true;
    if ((sub.members || []).some(m => (m.name || '').toLowerCase().includes(q))) return true;
    return false;
  });
  renderSubmissions(filtered);
});

// ============ REFRESH ============
refreshBtn.addEventListener('click', loadSubmissions);

// ============ CSV EXPORT ============
csvBtn.addEventListener('click', () => {
  if (!allSubmissions.length) return;
  const rows = [
    ['applicationId', 'teamName', 'teamSlogan', 'submittedAt', 'memberRole', 'name', 'grade', 'room', 'size', 'contact']
  ];
  allSubmissions.forEach(sub => {
    (sub.members || []).forEach((m, i) => {
      rows.push([
        sub.applicationId || '',
        sub.teamName || '',
        sub.teamSlogan || '',
        sub.submittedAt || '',
        i === 0 ? 'LEADER' : `MEMBER${i + 1}`,
        m.name || '', m.grade || '', m.room || '', m.size || '', m.contact || ''
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
if (getToken()) {
  enterDashboard();
}
