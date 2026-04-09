°°/* ─────────────────────────────────────────────────────
   GYMTRACKER — app.js
   Stack: Vanilla JS + SheetJS + Chart.js + localStorage
   ───────────────────────────────────────────────────── */

/* ── STATE ── */
let state = {
  schede: [],          // Array of parsed workout plans from Excel
  logs: {},            // { "schedaId_week_schedaIdx_exIdx_setIdx": {reps, kg, done}, ... }
  sessionLogs: {},     // Saved sessions { "schedaId_week_schedaIdx": { exercises:[...], date } }
  activeSchedaId: null,
  currentView: 'dashboard'
};

/* ── STORAGE ── */
const STORAGE_KEY = 'gymtracker_v2';

function saveState() {
  const toSave = { schede: state.schede, logs: state.logs, sessionLogs: state.sessionLogs, activeSchedaId: state.activeSchedaId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch (e) { console.warn('State load error', e); }
}

/* ── NAV ── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    state.currentView = view;
    if (view === 'dashboard') renderDashboard();
    if (view === 'workout') renderWorkoutView();
    if (view === 'analytics') renderAnalytics();
  });
});

/* ─────────────────────────────────────────────────────
   EXCEL PARSER
   Handles flexible structure: each block starts with a
   row containing "SETTIMANA 1" in first column.
   ───────────────────────────────────────────────────── */
function parseExcel(data) {
  const workbook = XLSX.read(data, { type: 'array' });
  const allSchede = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const blocks = splitIntoBlocks(rows);
    blocks.forEach((block, idx) => {
      const scheda = parseBlock(block, idx, sheetName);
      if (scheda) allSchede.push(scheda);
    });
  });

  return allSchede;
}

function splitIntoBlocks(rows) {
  const blocks = [];
  let current = [];
  for (const row of rows) {
    const firstCell = String(row[0] || '').trim().toUpperCase();
    if (firstCell.includes('SETTIMANA') && firstCell.includes('1')) {
      if (current.length > 1) blocks.push(current);
      current = [row];
    } else {
      current.push(row);
    }
  }
  if (current.length > 1) blocks.push(current);
  return blocks;
}

function parseBlock(rows, idx, sheetName) {
  if (rows.length < 3) return null;

  // Row 0: week headers (SETTIMANA 1, 2, 3, 4)
  // Row 1: column headers (ESERCIZIO, SERIE, RIPETIZIONI, RECUPERO, KG per week)
  // Row 2+: exercises

  const headerRow = rows[0];
  const colRow = rows[1];

  // Find week column offsets
  const weekOffsets = [];
  headerRow.forEach((cell, i) => {
    if (String(cell).toUpperCase().includes('SETTIMANA')) {
      weekOffsets.push(i);
    }
  });

  if (weekOffsets.length === 0) return null;

  // Detect how many columns per week block (SERIE, RIP, RECUPERO, KG = 4 cols after ESERCIZIO)
  // First week starts at offset 0: col0=esercizio, col1=serie, col2=rip, col3=recupero, col4=kg
  // Other weeks: same 4 cols but without esercizio

  const exercises = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const esercizio = String(row[0] || '').trim();
    if (!esercizio) continue;

    const weeks = [];
    weekOffsets.forEach((wOff, wIdx) => {
      if (wIdx === 0) {
        // First week: cols 1-4 relative to block start
        weeks.push({
          serie: String(row[1] || '').trim(),
          ripetizioni: String(row[2] || '').trim(),
          recupero: String(row[3] || '').trim(),
          kg: String(row[4] || '').trim()
        });
      } else {
        // Subsequent weeks: offset into the row
        const base = wOff;
        weeks.push({
          serie: String(row[base] || '').trim(),
          ripetizioni: String(row[base + 1] || '').trim(),
          recupero: String(row[base + 2] || '').trim(),
          kg: String(row[base + 3] || '').trim()
        });
      }
    });

    exercises.push({ name: esercizio, weeks });
  }

  if (exercises.length === 0) return null;

  const numWeeks = exercises[0].weeks.length;

  return {
    id: `scheda_${Date.now()}_${idx}`,
    name: `Scheda ${String.fromCharCode(65 + idx)}`,
    sheetName,
    numWeeks,
    exercises,
    importedAt: new Date().toISOString()
  };
}

/* Compute number of sets from serie string like "4", "2 + 2", "3" */
function parseSets(serieStr) {
  if (!serieStr) return 3;
  const s = String(serieStr).trim();
  if (s.includes('+')) {
    return s.split('+').reduce((acc, n) => acc + (parseInt(n.trim()) || 1), 0);
  }
  const n = parseInt(s);
  return isNaN(n) ? 3 : n;
}

/* Parse kg target — may be relative like "-2" or absolute */
function parseKg(kgStr) {
  const s = String(kgStr || '').trim();
  if (!s || s === 'NaN' || s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/* ─────────────────────────────────────────────────────
   IMPORT VIEW
   ───────────────────────────────────────────────────── */
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const importPreview = document.getElementById('importPreview');
const importArea = document.getElementById('importArea');

let parsedPreview = [];

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
document.getElementById('btnReimport').addEventListener('click', () => {
  importPreview.classList.add('hidden');
  importArea.classList.remove('hidden');
  parsedPreview = [];
});
document.getElementById('btnConfirm').addEventListener('click', confirmImport);

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      parsedPreview = parseExcel(data);
      if (parsedPreview.length === 0) {
        showToast('Nessuna scheda rilevata nel file. Controlla la struttura.', 'error');
        return;
      }
      showPreview(parsedPreview);
    } catch (err) {
      showToast('Errore nel leggere il file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function showPreview(schede) {
  importArea.classList.add('hidden');
  importPreview.classList.remove('hidden');
  document.getElementById('previewTitle').textContent = `${schede.length} scheda${schede.length > 1 ? 'e' : ''} rilevata${schede.length > 1 ? 'e' : ''}`;

  const container = document.getElementById('previewCards');
  container.innerHTML = '';

  schede.forEach(scheda => {
    const div = document.createElement('div');
    div.className = 'preview-scheda';
    div.innerHTML = `
      <div class="preview-scheda-title">${scheda.name} — ${scheda.numWeeks} settimane · ${scheda.exercises.length} esercizi</div>
      <table class="preview-table">
        <thead><tr><th>Esercizio</th><th>Serie S1</th><th>Rip S1</th><th>Rec S1</th><th>Kg S1</th></tr></thead>
        <tbody>${scheda.exercises.map(ex => `
          <tr>
            <td>${ex.name}</td>
            <td>${ex.weeks[0]?.serie || '—'}</td>
            <td>${ex.weeks[0]?.ripetizioni || '—'}</td>
            <td>${ex.weeks[0]?.recupero || '—'}</td>
            <td>${ex.weeks[0]?.kg || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    container.appendChild(div);
  });
}

function confirmImport() {
  if (parsedPreview.length === 0) return;
  state.schede = parsedPreview;
  state.activeSchedaId = parsedPreview[0].id;
  state.logs = {};
  state.sessionLogs = {};
  saveState();
  showToast(`${parsedPreview.length} scheda importata con successo!`, 'success');
  document.querySelector('[data-view="dashboard"]').click();
}

/* ─────────────────────────────────────────────────────
   DASHBOARD
   ───────────────────────────────────────────────────── */
let chartVolume = null;

function renderDashboard() {
  if (state.schede.length === 0) {
    document.getElementById('dashSub').textContent = 'Carica una scheda per iniziare';
    document.getElementById('pillScheda').textContent = '—';
    document.getElementById('nextWorkoutContent').innerHTML = '<div class="next-empty">Nessuna scheda caricata</div>';
    updateRing(0);
    return;
  }

  const scheda = getActiveScheda();
  const totalSessions = state.schede.reduce((s, sc) => s + sc.numWeeks, 0) * state.schede.length;
  const completedSessions = Object.keys(state.sessionLogs).length;
  const pct = totalSessions > 0 ? Math.round(completedSessions / totalSessions * 100) : 0;

  document.getElementById('dashSub').textContent = `Scheda attiva: ${scheda?.name || '—'}`;
  document.getElementById('pillScheda').textContent = scheda?.name || '—';
  document.getElementById('pCompletati').textContent = completedSessions;
  document.getElementById('pTotali').textContent = totalSessions;
  document.getElementById('sidebarWeek').textContent = `W${getCurrentWeek()}`;

  // Week badge
  const { week } = getNextSession();
  document.getElementById('pSettimana').textContent = `S${week}`;

  updateRing(pct);
  renderNextWorkout();
  renderVolumeChart();
  renderStreakGrid();
}

function updateRing(pct) {
  const circ = 213.6;
  const offset = circ - (circ * pct / 100);
  document.getElementById('ringFill').style.strokeDashoffset = offset;
  document.getElementById('ringLabel').textContent = pct + '%';
}

function getActiveScheda() {
  return state.schede.find(s => s.id === state.activeSchedaId) || state.schede[0];
}

function getNextSession() {
  if (state.schede.length === 0) return { scheda: null, schedaIdx: 0, week: 1 };
  // Find first incomplete session
  for (let w = 1; w <= 4; w++) {
    for (let si = 0; si < state.schede.length; si++) {
      const sc = state.schede[si];
      if (w > sc.numWeeks) continue;
      const key = `${sc.id}_w${w}_s${si}`;
      if (!state.sessionLogs[key]) return { scheda: sc, schedaIdx: si, week: w };
    }
  }
  return { scheda: state.schede[0], schedaIdx: 0, week: 1 };
}

function getCurrentWeek() {
  const { week } = getNextSession();
  return week;
}

function renderNextWorkout() {
  const { scheda, schedaIdx, week } = getNextSession();
  const el = document.getElementById('nextWorkoutContent');
  if (!scheda) { el.innerHTML = '<div class="next-empty">Nessuna scheda caricata</div>'; return; }

  const previewExs = scheda.exercises.slice(0, 4);
  el.innerHTML = `
    <div class="next-workout">
      <div><span class="next-badge">${scheda.name} — Settimana ${week}</span></div>
      <div class="next-exercises">
        ${previewExs.map(ex => `<div class="next-ex">${ex.name}</div>`).join('')}
        ${scheda.exercises.length > 4 ? `<div class="next-ex">+${scheda.exercises.length - 4} altri...</div>` : ''}
      </div>
      <button class="btn-start" onclick="startSession(${schedaIdx}, ${week})">Inizia allenamento →</button>
    </div>`;
}

function renderVolumeChart() {
  const canvas = document.getElementById('chartVolume');
  const ctx = canvas.getContext('2d');

  // Build volume data from session logs
  const labels = [];
  const volumes = [];

  const sortedKeys = Object.keys(state.sessionLogs).sort((a, b) => {
    const da = state.sessionLogs[a].date || '';
    const db = state.sessionLogs[b].date || '';
    return da.localeCompare(db);
  });

  sortedKeys.forEach(key => {
    const log = state.sessionLogs[key];
    const parts = key.split('_');
    const sIdx = parseInt(parts[parts.length - 1].replace('s', ''));
    const wIdx = parseInt(parts[parts.length - 2].replace('w', ''));
    const sc = state.schede[sIdx];
    if (!sc) return;
    labels.push(`${sc.name} W${wIdx}`);
    let vol = 0;
    if (log.exercises) {
      log.exercises.forEach(ex => {
        ex.sets?.forEach(set => {
          const kg = parseFloat(set.kg) || 0;
          const reps = parseFloat(set.reps) || 0;
          vol += kg * reps;
        });
      });
    }
    volumes.push(Math.round(vol));
  });

  if (chartVolume) chartVolume.destroy();

  chartVolume = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['—'],
      datasets: [{
        data: volumes.length ? volumes : [0],
        backgroundColor: 'rgba(232,255,58,0.7)',
        borderColor: '#e8ff3a',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1c1c1c',
        borderColor: '#333',
        borderWidth: 1,
        titleColor: '#888',
        bodyColor: '#f0f0f0',
        callbacks: { label: ctx => ` ${ctx.raw} kg·rip` }
      }},
      scales: {
        x: { grid: { color: '#2a2a2a' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 10 } } },
        y: { grid: { color: '#2a2a2a' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 10 } } }
      }
    }
  });
}

function renderStreakGrid() {
  const grid = document.getElementById('streakGrid');
  const total = 30;
  const completed = Object.keys(state.sessionLogs).length;
  grid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'streak-dot' + (i < completed ? ' done' : '') + (i === completed ? ' today' : '');
    grid.appendChild(dot);
  }
}

/* ─────────────────────────────────────────────────────
   WORKOUT VIEW
   ───────────────────────────────────────────────────── */
let currentWorkoutContext = { schedaIdx: 0, week: 1 };

function renderWorkoutView() {
  const sel = document.getElementById('sessionSelectors');
  if (state.schede.length === 0) {
    sel.innerHTML = '';
    document.getElementById('workoutContent').innerHTML = `<div class="empty-state"><div class="empty-icon">🏋️</div><p>Carica una scheda dall'Import per iniziare</p></div>`;
    return;
  }

  sel.innerHTML = `
    <div class="sel-group">
      <div class="sel-label">Scheda</div>
      <select class="sel" id="selScheda">${state.schede.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}</select>
    </div>
    <div class="sel-group">
      <div class="sel-label">Settimana</div>
      <select class="sel" id="selWeek">${buildWeekOptions()}</select>
    </div>`;

  document.getElementById('selScheda').value = currentWorkoutContext.schedaIdx;
  document.getElementById('selWeek').value = currentWorkoutContext.week;

  document.getElementById('selScheda').addEventListener('change', e => {
    currentWorkoutContext.schedaIdx = parseInt(e.target.value);
    currentWorkoutContext.week = 1;
    rebuildWeekOptions();
    renderExerciseCards();
  });
  document.getElementById('selWeek').addEventListener('change', e => {
    currentWorkoutContext.week = parseInt(e.target.value);
    renderExerciseCards();
  });

  renderExerciseCards();
}

function buildWeekOptions() {
  const sc = state.schede[currentWorkoutContext.schedaIdx] || state.schede[0];
  const n = sc?.numWeeks || 4;
  return Array.from({ length: n }, (_, i) => `<option value="${i+1}">Settimana ${i+1}</option>`).join('');
}

function rebuildWeekOptions() {
  const sel = document.getElementById('selWeek');
  if (sel) sel.innerHTML = buildWeekOptions();
}

function startSession(schedaIdx, week) {
  currentWorkoutContext = { schedaIdx, week };
  document.querySelector('[data-view="workout"]').click();
}

function renderExerciseCards() {
  const { schedaIdx, week } = currentWorkoutContext;
  const scheda = state.schede[schedaIdx];
  if (!scheda) return;

  const sessionKey = `${scheda.id}_w${week}_s${schedaIdx}`;
  const savedSession = state.sessionLogs[sessionKey];
  const wIdx = week - 1;

  const el = document.getElementById('workoutContent');
  document.getElementById('workoutSub').textContent = `${scheda.name} · Settimana ${week}`;

  let html = '<div class="exercises-list">';

  scheda.exercises.forEach((ex, exIdx) => {
    const weekData = ex.weeks[wIdx] || ex.weeks[0];
    const numSets = parseSets(weekData?.serie);
    const targetKg = parseKg(weekData?.kg);

    // Load saved set data
    const savedEx = savedSession?.exercises?.[exIdx];
    const allDone = savedEx?.sets?.every(s => s.done);
    const isCompleted = allDone && savedEx?.sets?.length > 0;

    const setsHtml = Array.from({ length: numSets }, (_, sIdx) => {
      const saved = savedEx?.sets?.[sIdx];
      const repsVal = saved?.reps ?? (weekData?.ripetizioni || '');
      const kgVal = saved?.kg ?? (targetKg !== null ? targetKg : '');
      const doneVal = saved?.done ? 'checked' : '';

      return `<tr class="set-row" data-set="${sIdx}">
        <td class="set-num">${sIdx + 1}</td>
        <td><input class="set-input" type="number" placeholder="Rip" value="${repsVal}" data-field="reps" /></td>
        <td><input class="set-input" type="number" step="0.5" placeholder="Kg" value="${kgVal}" data-field="kg" /></td>
        <td><input type="checkbox" class="set-done-cb" ${doneVal} /></td>
        <td class="set-note">${weekData?.recupero ? '⏱ ' + weekData.recupero : ''}</td>
      </tr>`;
    }).join('');

    html += `
      <div class="exercise-card${isCompleted ? ' completed' : ''}" data-ex="${exIdx}">
        <div class="ex-header${exIdx === 0 ? ' open' : ''}" onclick="toggleExercise(this)">
          <div class="ex-left">
            <div class="ex-check">
              <svg viewBox="0 0 12 10"><polyline points="1,5 4,9 11,1"/></svg>
            </div>
            <div>
              <div class="ex-name">${ex.name}</div>
              <div class="ex-meta">
                <span class="ex-tag">${weekData?.serie || '—'} serie</span>
                <span class="ex-tag">${weekData?.ripetizioni || '—'} rip</span>
                ${targetKg !== null ? `<span class="ex-tag">${targetKg} kg</span>` : ''}
              </div>
            </div>
          </div>
          <div class="ex-chevron"><svg viewBox="0 0 14 14"><polyline points="2,4 7,10 12,4"/></svg></div>
        </div>
        <div class="ex-body${exIdx === 0 ? ' open' : ''}">
          <div class="target-info">
            ${weekData?.serie ? `<span class="target-chip">📋 ${weekData.serie} serie</span>` : ''}
            ${weekData?.ripetizioni ? `<span class="target-chip">🔁 ${weekData.ripetizioni} rip</span>` : ''}
            ${weekData?.recupero ? `<span class="target-chip">⏱ ${weekData.recupero} rec</span>` : ''}
            ${targetKg !== null ? `<span class="target-chip">⚖️ ${targetKg > 0 ? targetKg : 'prog.'} kg</span>` : ''}
          </div>
          <table class="sets-table">
            <thead><tr><th>#</th><th>Rip</th><th>Kg</th><th>✓</th><th>Rec</th></tr></thead>
            <tbody>${setsHtml}</tbody>
          </table>
          <button class="btn-add-set" onclick="addSet(this, ${exIdx})">+ Aggiungi serie</button>
          <textarea class="ex-notes-area" placeholder="Note (es. carico percepito, forma, varianti...)" data-ex="${exIdx}">${savedEx?.notes || ''}</textarea>
        </div>
      </div>`;
  });

  html += '</div>';
  html += `<div class="save-session-bar">
    <button class="btn btn--primary" onclick="saveSession()">💾 Salva sessione</button>
    ${savedSession ? '<button class="btn btn--danger" onclick="deleteSession()">🗑 Cancella sessione</button>' : ''}
    ${savedSession ? `<span style="color:var(--text3);font-size:12px;font-family:var(--font-mono)">Salvata il ${new Date(savedSession.date).toLocaleDateString('it-IT')}</span>` : ''}
  </div>`;

  el.innerHTML = html;

  // Auto-check exercises when all sets done
  el.querySelectorAll('.set-done-cb').forEach(cb => {
    cb.addEventListener('change', () => checkAutoComplete(cb.closest('.exercise-card')));
  });
}

function toggleExercise(header) {
  const body = header.nextElementSibling;
  header.classList.toggle('open');
  body.classList.toggle('open');
}

function addSet(btn, exIdx) {
  const tbody = btn.previousElementSibling.querySelector('tbody');
  const setNum = tbody.querySelectorAll('tr').length + 1;
  const tr = document.createElement('tr');
  tr.className = 'set-row';
  tr.dataset.set = setNum - 1;
  tr.innerHTML = `
    <td class="set-num">${setNum}</td>
    <td><input class="set-input" type="number" placeholder="Rip" data-field="reps" /></td>
    <td><input class="set-input" type="number" step="0.5" placeholder="Kg" data-field="kg" /></td>
    <td><input type="checkbox" class="set-done-cb" /></td>
    <td></td>`;
  tbody.appendChild(tr);
  tr.querySelector('.set-done-cb').addEventListener('change', () => checkAutoComplete(tr.closest('.exercise-card')));
}

function checkAutoComplete(card) {
  const cbs = card.querySelectorAll('.set-done-cb');
  const allChecked = [...cbs].every(cb => cb.checked) && cbs.length > 0;
  card.classList.toggle('completed', allChecked);
}

function collectSessionData() {
  const { schedaIdx, week } = currentWorkoutContext;
  const scheda = state.schede[schedaIdx];
  const exercises = [];

  document.querySelectorAll('.exercise-card').forEach((card, exIdx) => {
    const sets = [];
    card.querySelectorAll('.set-row').forEach(row => {
      const reps = row.querySelector('[data-field="reps"]')?.value || '';
      const kg = row.querySelector('[data-field="kg"]')?.value || '';
      const done = row.querySelector('.set-done-cb')?.checked || false;
      sets.push({ reps, kg, done });
    });
    const notes = card.querySelector('.ex-notes-area')?.value || '';
    exercises.push({ name: scheda.exercises[exIdx]?.name, sets, notes });
  });

  return exercises;
}

function saveSession() {
  const { schedaIdx, week } = currentWorkoutContext;
  const scheda = state.schede[schedaIdx];
  const sessionKey = `${scheda.id}_w${week}_s${schedaIdx}`;
  const exercises = collectSessionData();

  state.sessionLogs[sessionKey] = {
    exercises,
    date: new Date().toISOString(),
    schedaIdx,
    week,
    schedaId: scheda.id,
    schedaName: scheda.name
  };

  saveState();
  showToast('Sessione salvata!', 'success');
  renderExerciseCards(); // refresh to show saved state
}

function deleteSession() {
  const { schedaIdx, week } = currentWorkoutContext;
  const scheda = state.schede[schedaIdx];
  const sessionKey = `${scheda.id}_w${week}_s${schedaIdx}`;
  delete state.sessionLogs[sessionKey];
  saveState();
  showToast('Sessione eliminata', 'error');
  renderExerciseCards();
}

/* ─────────────────────────────────────────────────────
   ANALYTICS VIEW
   ───────────────────────────────────────────────────── */
let analyticsCharts = {};

function renderAnalytics() {
  const grid = document.getElementById('analyticsGrid');
  const filters = document.getElementById('analyticsFilters');

  if (Object.keys(state.sessionLogs).length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Completa almeno una sessione per vedere i grafici</p></div>`;
    filters.innerHTML = '';
    return;
  }

  // Destroy old charts
  Object.values(analyticsCharts).forEach(c => c.destroy());
  analyticsCharts = {};

  // Build exercise list from all schede for filter
  const allExercises = new Set();
  state.schede.forEach(sc => sc.exercises.forEach(ex => allExercises.add(ex.name)));

  filters.innerHTML = `
    <div class="sel-group">
      <div class="sel-label">Esercizio</div>
      <select class="sel" id="selExercise">
        <option value="">Tutti</option>
        ${[...allExercises].map(n => `<option value="${n}">${n.length > 30 ? n.slice(0, 30) + '…' : n}</option>`).join('')}
      </select>
    </div>`;

  document.getElementById('selExercise').addEventListener('change', renderAnalytics);

  const filterEx = document.getElementById('selExercise')?.value || '';

  grid.innerHTML = `
    <div class="card card--wide">
      <div class="card-label">Progressione Carichi (Kg medio per sessione)</div>
      <canvas id="chartKg" height="100"></canvas>
    </div>
    <div class="card">
      <div class="card-label">Volume per sessione (Kg × Rip)</div>
      <canvas id="chartVolAnal" height="140"></canvas>
    </div>
    <div class="card">
      <div class="card-label">Riepilogo sessioni</div>
      <div id="sessionSummary" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;"></div>
    </div>`;

  // Build datasets
  const sessions = Object.entries(state.sessionLogs)
    .map(([key, log]) => ({ key, log }))
    .sort((a, b) => (a.log.date || '').localeCompare(b.log.date || ''));

  const kgLabels = [], kgData = [], volLabels = [], volData = [];

  sessions.forEach(({ key, log }) => {
    const label = `${log.schedaName || '?'} W${log.week}`;
    let totalKg = 0, countKg = 0, totalVol = 0;

    log.exercises?.forEach(ex => {
      if (filterEx && ex.name !== filterEx) return;
      ex.sets?.forEach(set => {
        const kg = parseFloat(set.kg) || 0;
        const reps = parseFloat(set.reps) || 0;
        if (kg > 0) { totalKg += kg; countKg++; }
        totalVol += kg * reps;
      });
    });

    kgLabels.push(label);
    kgData.push(countKg > 0 ? Math.round((totalKg / countKg) * 10) / 10 : 0);
    volLabels.push(label);
    volData.push(Math.round(totalVol));
  });

  const chartDefaults = {
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: '#1c1c1c', borderColor: '#333', borderWidth: 1,
      titleColor: '#888', bodyColor: '#f0f0f0'
    }},
    scales: {
      x: { grid: { color: '#2a2a2a' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 10 } } },
      y: { grid: { color: '#2a2a2a' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 10 } } }
    }
  };

  analyticsCharts.kg = new Chart(document.getElementById('chartKg'), {
    type: 'line',
    data: {
      labels: kgLabels,
      datasets: [{
        data: kgData,
        borderColor: '#e8ff3a',
        backgroundColor: 'rgba(232,255,58,0.08)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#e8ff3a',
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: { ...chartDefaults, responsive: true }
  });

  analyticsCharts.vol = new Chart(document.getElementById('chartVolAnal'), {
    type: 'bar',
    data: {
      labels: volLabels,
      datasets: [{
        data: volData,
        backgroundColor: 'rgba(58,255,140,0.6)',
        borderColor: '#3aff8c',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: { ...chartDefaults, responsive: true }
  });

  // Session summary list
  const summEl = document.getElementById('sessionSummary');
  sessions.slice().reverse().forEach(({ key, log }) => {
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg3);border-radius:6px;padding:10px 12px;border:1px solid var(--border);';
    const date = log.date ? new Date(log.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const exCount = log.exercises?.length || 0;
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:var(--font-display);letter-spacing:1px;font-size:16px;">${log.schedaName} — S${log.week}</span>
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3);">${date}</span>
      </div>
      <div style="color:var(--text3);font-size:11px;margin-top:4px;">${exCount} esercizi</div>`;
    summEl.appendChild(div);
  });
}

/* ─────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ─────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────── */
function init() {
  loadState();

  // Init workout context to next session
  const { schedaIdx, week } = getNextSession();
  currentWorkoutContext = { schedaIdx, week };

  renderDashboard();
}

init();
