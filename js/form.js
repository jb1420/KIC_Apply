const STORAGE_KEY = 'kic2026-draft-v2';
const SERVER_URL = 'https://jb1420.pythonanywhere.com/enroll'; // 나중에 서버 URL 입력 (예: https://api.your-server.com/submissions)
let currentStep = 1;
const totalSteps = 3;
const stepNames = ['TEAM', 'CREW', 'CONFIRM'];

const membersWrap = document.getElementById('membersWrap');
const addMemberBtn = document.getElementById('addMemberBtn');
let memberCount = 0;

// ============ MEMBER CARDS ============
function updateRoomOptions(gradeSelect, roomSelect) {
  const grade = gradeSelect.value;
  const prevRoom = roomSelect.value;
  roomSelect.innerHTML = '<option value="">— 반 선택 —</option>';
  if (!grade) return;
  const count = grade === 'RAA' ? 4 : 12;
  for (let i = 1; i <= count; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i}반`;
    roomSelect.appendChild(opt);
  }
  if (prevRoom && Number(prevRoom) <= count) roomSelect.value = prevRoom;
}

function createMemberCard(idx, isLeader = false) {
  const card = document.createElement('div');
  card.className = 'member';
  card.dataset.idx = idx;
  card.innerHTML = `
    <div class="member-header">
      <span class="member-tag">MEMBER ${String(idx + 1).padStart(2, '0')}${isLeader ? ' · LEADER' : ''}</span>
      ${!isLeader ? `<button type="button" class="member-remove" aria-label="remove">×</button>` : ''}
    </div>
    <div class="member-grid">
      <div>
        <label class="field-label">이름</label>
        <input type="text" class="field-input" name="memberName_${idx}" maxlength="20" placeholder="홍길동" required>
      </div>
      <div>
        <label class="field-label">옷 사이즈</label>
        <select class="field-input" name="memberSize_${idx}" required>
          <option value="">— 사이즈 선택 —</option>
          <option value="S">S</option>
          <option value="M">M</option>
          <option value="L">L</option>
          <option value="XL">XL</option>
        </select>
      </div>
      <div>
        <label class="field-label">학년</label>
        <select class="field-input" name="memberGrade_${idx}" required>
          <option value="">— 학년 선택 —</option>
          <option value="1">1학년</option>
          <option value="2">2학년</option>
          <option value="3">3학년</option>
          <option value="RAA">RAA</option>
        </select>
      </div>
      <div>
        <label class="field-label">반</label>
        <select class="field-input" name="memberRoom_${idx}" required>
          <option value="">— 반 선택 —</option>
        </select>
      </div>
      <div class="full">
        <label class="field-label">연락처 (KakaoTalk ID 또는 전화번호)</label>
        <input type="text" class="field-input" name="memberContact_${idx}" maxlength="40" placeholder="010-0000-0000" required>
      </div>
    </div>
  `;

  const gradeSelect = card.querySelector(`[name="memberGrade_${idx}"]`);
  const roomSelect = card.querySelector(`[name="memberRoom_${idx}"]`);
  gradeSelect.addEventListener('change', () => {
    updateRoomOptions(gradeSelect, roomSelect);
    saveDraft();
  });

  if (!isLeader) {
    card.querySelector('.member-remove').addEventListener('click', () => {
      card.remove();
      memberCount--;
      reindexMembers();
      updateAddButton();
      saveDraft();
    });
  }
  card.querySelectorAll('input, select').forEach(inp => {
    inp.addEventListener('input', saveDraft);
    inp.addEventListener('change', saveDraft);
  });
  return card;
}

function reindexMembers() {
  const cards = membersWrap.querySelectorAll('.member');
  cards.forEach((c, i) => {
    c.dataset.idx = i;
    const tag = c.querySelector('.member-tag');
    tag.textContent = `MEMBER ${String(i + 1).padStart(2, '0')}${i === 0 ? ' · LEADER' : ''}`;
    c.querySelectorAll('input, select').forEach(inp => {
      const baseName = inp.name.split('_')[0];
      inp.name = `${baseName}_${i}`;
    });
  });
}

function updateAddButton() {
  if (memberCount >= 4) {
    addMemberBtn.disabled = true;
    addMemberBtn.textContent = '✓ 최대 인원 도달 (4 / 4)';
  } else {
    addMemberBtn.disabled = false;
    addMemberBtn.textContent = `+ 팀원 추가 (${memberCount} / 4)`;
  }
}

for (let i = 0; i < 3; i++) {
  membersWrap.appendChild(createMemberCard(i, i === 0));
  memberCount++;
}
updateAddButton();

addMemberBtn.addEventListener('click', () => {
  if (memberCount >= 4) return;
  membersWrap.appendChild(createMemberCard(memberCount, false));
  memberCount++;
  updateAddButton();
  saveDraft();
});

// ============ STEP NAVIGATION ============
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressSegs = document.querySelectorAll('#progressBar .seg');
const currStepEl = document.getElementById('currStep');
const stepNameEl = document.getElementById('stepName');
const modalNav = document.getElementById('modalNav');

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const el = document.querySelector(`.step[data-step="${n}"]`);
  if (el) el.classList.add('active');

  progressSegs.forEach((p, i) => {
    p.classList.remove('active', 'done');
    if (i < n - 1) p.classList.add('done');
    else if (i === n - 1) p.classList.add('active');
  });

  if (n <= totalSteps) {
    currStepEl.textContent = String(n).padStart(2, '0');
    stepNameEl.textContent = stepNames[n - 1];
  }

  prevBtn.disabled = n === 1;
  if (n === totalSteps) {
    nextBtn.textContent = '제출하기 ✓';
  } else if (n > totalSteps) {
    modalNav.style.display = 'none';
  } else {
    nextBtn.textContent = '다음 →';
    modalNav.style.display = 'flex';
  }

  document.querySelector('.modal-body').scrollTop = 0;
}

function showError(name, msg) {
  const el = document.querySelector(`.field-error[data-for="${name}"]`);
  if (el) {
    el.textContent = msg ? '⚠ ' + msg : '';
    el.classList.toggle('show', !!msg);
  }
}

function validateStep(n) {
  let valid = true;
  if (n === 1) {
    const teamName = document.querySelector('[name="teamName"]');
    if (!teamName.value.trim()) {
      showError('teamName', '팀명을 입력해주세요');
      valid = false;
    } else showError('teamName', '');
  }
  if (n === 2) {
    const cards = membersWrap.querySelectorAll('.member');
    if (cards.length < 3) {
      alert('최소 3명의 팀원이 필요합니다.');
      return false;
    }
    cards.forEach(card => {
      card.querySelectorAll('input[required], select[required]').forEach(inp => {
        if (!inp.value.trim()) {
          inp.style.borderBottomColor = '#ff6b8b';
          valid = false;
        } else {
          inp.style.borderBottomColor = '';
        }
      });
    });
    if (!valid) alert('모든 팀원 정보를 올바르게 입력해주세요.');
  }
  if (n === 3) {
    const chks = document.querySelectorAll('.check input[type="checkbox"]');
    chks.forEach(chk => {
      if (chk.hasAttribute('required') && !chk.checked) valid = false;
    });
    if (!valid) alert('모든 항목에 동의해주셔야 합니다.');
  }
  return valid;
}

nextBtn.addEventListener('click', async () => {
  if (!validateStep(currentStep)) return;
  if (currentStep === totalSteps) {
    await submitForm();
    return;
  }
  currentStep++;
  showStep(currentStep);
  saveDraft();
});

prevBtn.addEventListener('click', () => {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
});

// ============ DRAFT SAVE / LOAD ============
async function saveDraft() {
  try {
    const data = collectFormData();
    if (window.storage) {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {}
}

async function loadDraft() {
  try {
    if (!window.storage) return;
    const r = await window.storage.get(STORAGE_KEY);
    if (!r) return;
    const data = JSON.parse(r.value);

    ['teamName', 'teamSlogan'].forEach(k => {
      if (data[k]) {
        const el = document.querySelector(`[name="${k}"]`);
        if (el) el.value = data[k];
      }
    });

    if (data.members && Array.isArray(data.members)) {
      membersWrap.innerHTML = '';
      memberCount = 0;
      data.members.forEach((m, i) => {
        const card = createMemberCard(i, i === 0);
        membersWrap.appendChild(card);
        const findEl = (name) => card.querySelector(`[name="${name}_${i}"]`);
        if (findEl('memberName')) findEl('memberName').value = m.name || '';
        if (findEl('memberGrade') && m.grade) {
          findEl('memberGrade').value = m.grade;
          const roomSel = findEl('memberRoom');
          if (roomSel) {
            updateRoomOptions(findEl('memberGrade'), roomSel);
            if (m.room) roomSel.value = m.room;
          }
        }
        if (findEl('memberSize')) findEl('memberSize').value = m.size || '';
        if (findEl('memberContact')) findEl('memberContact').value = m.contact || '';
        memberCount++;
      });
      while (memberCount < 3) {
        membersWrap.appendChild(createMemberCard(memberCount, memberCount === 0));
        memberCount++;
      }
      updateAddButton();
    }
  } catch (e) {}
}

function collectFormData() {
  const members = [];
  membersWrap.querySelectorAll('.member').forEach((c, i) => {
    members.push({
      name: c.querySelector(`[name="memberName_${i}"]`)?.value || '',
      grade: c.querySelector(`[name="memberGrade_${i}"]`)?.value || '',
      room: c.querySelector(`[name="memberRoom_${i}"]`)?.value || '',
      size: c.querySelector(`[name="memberSize_${i}"]`)?.value || '',
      contact: c.querySelector(`[name="memberContact_${i}"]`)?.value || ''
    });
  });
  return {
    teamName: document.querySelector('[name="teamName"]')?.value || '',
    teamSlogan: document.querySelector('[name="teamSlogan"]')?.value || '',
    members,
    submittedAt: new Date().toISOString()
  };
}

document.querySelectorAll('.step[data-step="1"] input').forEach(el => {
  el.addEventListener('input', saveDraft);
  el.addEventListener('change', saveDraft);
});

// ============ SUBMIT ============
async function submitForm() {
  nextBtn.disabled = true;
  prevBtn.disabled = true;
  nextBtn.textContent = '전송 중...';

  try {
    const data = collectFormData();
    const appId = 'KIC26-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    data.applicationId = appId;

    // 서버로 제출
    if (SERVER_URL) {
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
      }

      // 서버 응답 처리 (필요시)
      // const result = await response.json();
    } else {
      // 서버 URL이 설정되지 않으면 로컬 스토리지에만 저장
      console.warn('SERVER_URL이 설정되지 않았습니다. 데이터는 로컬에만 저장됩니다.');
      if (window.storage) {
        await window.storage.set(`submission:${appId}`, JSON.stringify(data), true);
        await window.storage.delete(STORAGE_KEY);
      }
    }

    // 드래프트 로컬 저장소 정리
    if (window.storage) {
      await window.storage.delete(STORAGE_KEY);
    }

    await new Promise(r => setTimeout(r, 1000));
    currentStep = 4;
    showStep(4);
    // document.getElementById('appId').textContent = appId;

    const successMembers = document.getElementById('successMembers');
    if (successMembers) {
      successMembers.innerHTML = data.members.map((m, i) => {
        const gradeLabel = m.grade === 'RAA' ? 'RAA' : (m.grade ? `${m.grade}학년` : '');
        const roomLabel = m.room ? ` ${m.room}반` : '';
        const classLabel = gradeLabel ? `${gradeLabel}${roomLabel}` : '';
        const tag = i === 0 ? 'LEADER' : `MEMBER ${String(i + 1).padStart(2, '0')}`;
        return `<div class="success-member">
          <span class="sm-tag">${tag}</span>
          <span class="sm-name">${m.name || '—'}</span>
          ${classLabel ? `<span class="sm-class">${classLabel}</span>` : ''}
        </div>`;
      }).join('');
    }
  } catch (err) {
    alert('제출 중 오류가 발생했습니다: ' + err.message);
    nextBtn.disabled = false;
    prevBtn.disabled = false;
    nextBtn.textContent = '제출하기 ✓';
  }
}

// ============ CHECKBOX DIV CLICK ============
document.querySelectorAll('.check').forEach(checkDiv => {
  checkDiv.style.cursor = 'pointer';
  checkDiv.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL' || e.target.closest('label')) {
      saveDraft();
      return;
    }
    const checkbox = checkDiv.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      saveDraft();
    }
  });
});

loadDraft();
showStep(1);
