/* ═══════════════════════════════════════════════════
   GYMTRACKER — app.js
   Fix: Safari iOS FileReader + mobile UX
   ═══════════════════════════════════════════════════ */

/* ── STATE ── */
let state = {
  schede: [],
  sessionLogs: {},
  activeSchedaId: null
};

const STORAGE_KEY = 'gymtracker_v3';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      schede: state.schede,
      sessionLogs: state.sessionLogs,
      activeSchedaId: state.activeSchedaId
    }));
  } catch(e) { showToast('Errore salvataggio: storage pieno?', 'error'); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch(e) {}
}

/* ── NAVIGATION ── */
function navigate(view) {
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view)?.classList.add('active');

  if (view === 'dashboard') renderDashboard();
  if (view === 'workout') renderWorkoutView();
  if (view === 'analytics') renderAnalytics();
}

document.querySelectorAll('.nav-btn, .bnav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

/* ═══════════════════════════════════════════════════
   EXCEL PARSER
   ═══════════════════════════════════════════════════ */
function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const allSchede = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    splitIntoBlocks(rows).forEach((block, idx) => {
      const scheda = parseBlock(block, idx);
      if (scheda) allSchede.push(scheda);
    });
  });

  return allSchede;
}

function splitIntoBlocks(rows) {
  const blocks = [];
  let current = [];
  for (const row of rows) {
    const cell = String(row[0] || '').trim().toUpperCase();
    // detect "SETTIMANA 1" or "SETTIMANA1"
    if (cell.replace(/\s/g,'').includes('SETTIMANA1')) {
      if (current.length > 1) blocks.push(current);
      current = [row];
    } else {
      current.push(row);
    }
  }
  if (current.length > 1) blocks.push(current);
  return blocks;
}

function parseBlock(rows, idx) {
  if (rows.length < 3) return null;

  // Row 0: week column headers
  // Row 1: field headers (esercizio, serie, rip, recupero, kg)
  // Row 2+: exercises

  const headerRow = rows[0];

  // Find week start columns
  const weekCols = [];
  headerRow.forEach((cell, i) => {
    if (String(cell).toUpperCase().replace(/\s/g,'').includes('SETTIMANA')) weekCols.push(i);
  });
  if (weekCols.length === 0) return null;

  const exercises = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const name = String(row[0] || '').trim();
    if (!name) continue;

    const weeks = weekCols.map((wOff, wIdx) => {
      if (wIdx === 0) {
        return {
          serie: str(row[1]), ripetizioni: str(row[2]),
          recupero: str(row[3]), kg: str(row[4])
        };
      }
      return {
        serie: str(row[wOff]), ripetizioni: str(row[wOff+1]),
        recupero: str(row[wOff+2]), kg: str(row[wOff+3])
      };
    });

    exercises.push({ name, weeks });
  }

  if (!exercises.length) return null;

  return {
    id: `sc_${Date.now()}_${idx}`,
    name: `Scheda ${String.fromCharCode(65 + idx)}`,
    numWeeks: exercises[0].weeks.length,
    exercises,
    importedAt: new Date().toISOString()
  };
}

function str(v) { const s = String(v ?? '').trim(); return s === 'NaN' ? '' : s; }

function parseSets(serieStr) {
  const s = str(serieStr);
  if (s.includes('+')) return s.split('+').reduce((a, n) => a + (parseInt(n) || 1), 0);
  const n = parseInt(s);
  return isNaN(n) ? 3 : Math.max(1, Math.min(n, 20));
}

function parseKg(kgStr) {
  const n = parseFloat(str(kgStr));
  return isNaN(n) ? null : n;
}

/* ═══════════════════════════════════════════════════
   IMPORT VIEW — Safari iOS fix
   Key: use FileReader.readAsArrayBuffer directly,
   avoid Blob/URL methods that fail in Safari WKWebView
   ═══════════════════════════════════════════════════ */
let parsedPreview = [];

const fileInput = document.getElementById('fileInput');
const importArea = document.getElementById('importArea');
const importPreview = document.getElementById('importPreview');
const importStatus = document.getElementById('importStatus');

fileInput.addEventListener('change', function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  handleFile(file);
  // Reset input so same file can be re-selected
  this.value = '';
});

// Drag & drop (desktop)
const dropZone = document.getElementById('dropZone');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  showImportStatus('⏳ Lettura file in corso...', 'loading');

  // Use FileReader with readAsArrayBuffer — works on Safari iOS
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const arrayBuffer = e.target.result;
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        showImportStatus('❌ File vuoto o non leggibile.', 'error');
        return;
      }
      const schede = parseExcel(arrayBuffer);
      if (!schede.length) {
        showImportStatus('❌ Nessuna scheda trovata. Controlla che il file contenga righe con "SETTIMANA 1".', 'error');
        return;
      }
      parsedPreview = schede;
      hideImportStatus();
      showPreview(schede);
    } catch(err) {
      showImportStatus('❌ Errore: ' + err.message, 'error');
      console.error(err);
    }
  };

  reader.onerror = function() {
    showImportStatus('❌ Impossibile leggere il file. Riprova.', 'error');
  };

  // This is the critical call — readAsArrayBuffer works on Safari iOS
  reader.readAsArrayBuffer(file);
}

function showImportStatus(msg, type) {
  importStatus.textContent = msg;
  importStatus.className = 'import-status ' + type;
  importStatus.classList.remove('hidden');
}

function hideImportStatus() {
  importStatus.classList.add('hidden');
}

function showPreview(schede) {
  importArea.classList.add('hidden');
  importPreview.classList.remove('hidden');

  document.getElementById('previewTitle').textContent =
    `${schede.length} scheda${schede.length > 1 ? 'e' : ''} rilevata${schede.length > 1 ? 'e' : ''}`;

  const container = document.getElementById('previewCards');
  container.innerHTML = '';

  schede.forEach(sc => {
    const div = document.createElement('div');
    div.className = 'preview-scheda';

    const rows = sc.exercises.map(ex => `
      <tr>
        <td>${ex.name.length > 40 ? ex.name.slice(0,40)+'…' : ex.name}</td>
        <td>${ex.weeks[0]?.serie || '—'}</td>
        <td>${ex.weeks[0]?.ripetizioni || '—'}</td>
        <td>${ex.weeks[0]?.kg || '—'}</td>
      </tr>`).join('');

    div.innerHTML = `
      <div class="preview-scheda-title">${sc.name} — ${sc.numWeeks} sett. · ${sc.exercises.length} esercizi</div>
      <div style="overflow-x:auto">
        <table class="preview-table">
          <thead><tr><th>Esercizio</th><th>Serie</th><th>Rip</th><th>Kg</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    container.appendChild(div);
  });
}

document.getElementById('btnReimport').addEventListener('click', () => {
  importPreview.classList.add('hidden');
  importArea.classList.remove('hidden');
  hideImportStatus();
  parsedPreview = [];
});

document.getElementById('btnConfirm').addEventListener('click', () => {
  if (!parsedPreview.length) return;
  state.schede = parsedPreview;
  state.activeSchedaId = parsedPreview[0].id;
  state.sessionLogs = {};
  saveState();
  showToast(`✓ ${parsedPreview.length} scheda importata!`, 'success');
  navigate('dashboard');
});

/* ═══════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════ */
let chartVolInstance = null;

function renderDashboard() {
  const noData = state.schede.length === 0;
  document.getElementById('dashSub').textContent = noData
    ? 'Carica una scheda per iniziare'
    : `Scheda attiva: ${getActiveScheda()?.name || '—'}`;
  document.getElementById('pillScheda').textContent = getActiveScheda()?.name || '—';

  const totalSessions = state.schede.reduce((s, sc) => s + sc.numWeeks, 0);
  const doneSessions = Object.keys(state.sessionLogs).length;
  const pct = totalSessions > 0 ? Math.round(doneSessions / totalSessions * 100) : 0;

  document.getElementById('pCompletati').textContent = doneSessions;
  document.getElementById('pTotali').textContent = totalSessions;
  const { week } = getNextSession();
  document.getElementById('pSettimana').textContent = week ? `S${week}` : '—';
  document.getElementById('sidebarWeek').textContent = `W${week || '—'}`;

  updateRing(pct);
  renderNextWorkout();
  renderVolumeChart();
  renderStreakGrid();
}

function updateRing(pct) {
  const circ = 213.6;
  document.getElementById('ringFill').style.strokeDashoffset = circ - circ * pct / 100;
  document.getElementById('ringLabel').textContent = pct + '%';
}

function getActiveScheda() {
  return state.schede.find(s => s.id === state.activeSchedaId) || state.schede[0] || null;
}

function getNextSession() {
  if (!state.schede.length) return { scheda: null, schedaIdx: 0, week: 0 };
  for (let w = 1; w <= 10; w++) {
    for (let si = 0; si < state.schede.length; si++) {
      const sc = state.schede[si];
      if (w > sc.numWeeks) continue;
      const key = sessionKey(sc.id, w, si);
      if (!state.sessionLogs[key]) return { scheda: sc, schedaIdx: si, week: w };
    }
  }
  return { scheda: state.schede[0], schedaIdx: 0, week: 1 };
}

function sessionKey(schedaId, week, schedaIdx) {
  return `${schedaId}_w${week}_s${schedaIdx}`;
}

function renderNextWorkout() {
  const { scheda, schedaIdx, week } = getNextSession();
  const el = document.getElementById('nextWorkoutContent');
  if (!scheda) { el.innerHTML = '<div class="next-empty">Nessuna scheda caricata</div>'; return; }

  const preview = scheda.exercises.slice(0, 4);
  el.innerHTML = `
    <div class="next-workout">
      <span class="next-badge">${scheda.name} — Settimana ${week}</span>
      <div class="next-exercises">
        ${preview.map(ex => `<div class="next-ex">${ex.name.length > 45 ? ex.name.slice(0,45)+'…' : ex.name}</div>`).join('')}
        ${scheda.exercises.length > 4 ? `<div class="next-ex">+${scheda.exercises.length - 4} altri...</div>` : ''}
      </div>
      <button class="btn-start" onclick="startSession(${schedaIdx},${week})">Inizia allenamento →</button>
    </div>`;
}

function renderVolumeChart() {
  const ctx = document.getElementById('chartVolume').getContext('2d');
  const sorted = Object.entries(state.sessionLogs)
    .sort(([,a],[,b]) => (a.date||'').localeCompare(b.date||''));

  const labels = [], data = [];
  sorted.forEach(([key, log]) => {
    const parts = key.split('_');
    const si = parseInt(parts[parts.length-1].replace('s',''));
    const w = parseInt(parts[parts.length-2].replace('w',''));
    const sc = state.schede[si];
    labels.push(sc ? `${sc.name} S${w}` : `S${w}`);
    let vol = 0;
    log.exercises?.forEach(ex => ex.sets?.forEach(s => { vol += (parseFloat(s.kg)||0) * (parseFloat(s.reps)||0); }));
    data.push(Math.round(vol));
  });

  if (chartVolInstance) chartVolInstance.destroy();
  chartVolInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['—'],
      datasets: [{ data: data.length ? data : [0], backgroundColor: 'rgba(232,255,58,0.7)', borderColor: '#e8ff3a', borderWidth: 1, borderRadius: 4 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1c1c1c', borderColor: '#333', borderWidth: 1,
        titleColor: '#888', bodyColor: '#f0f0f0',
        callbacks: { label: c => ` ${c.raw} kg·rip` }
      }},
      scales: {
        x: { grid: { color: '#222' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 10 } } },
        y: { grid: { color: '#222' }, ticks: { color: '#555', font: { family: 'DM Mono', size: 10 } } }
      }
    }
  });
}

function renderStreakGrid() {
  const grid = document.getElementById('streakGrid');
  const done = Object.keys(state.sessionLogs).length;
  const total = Math.max(done + 6, 20);
  grid.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'streak-dot' + (i < done ? ' done' : '') + (i === done ? ' today' : '');
    grid.appendChild(d);
  }
}

/* ═══════════════════════════════════════════════════
   WORKOUT VIEW
   ═══════════════════════════════════════════════════ */
let ctx = { schedaIdx: 0, week: 1 };

function renderWorkoutView() {
  const sel = document.getElementById('sessionSelectors');
  if (!state.schede.length) {
    sel.innerHTML = '';
    document.getElementById('workoutContent').innerHTML =
      '<div class="empty-state"><div class="empty-icon">🏋️</div><p>Carica una scheda dall\'Import per iniziare</p></div>';
    return;
  }

  sel.innerHTML = `
    <div class="sel-group">
      <div class="sel-label">Scheda</div>
      <select class="sel" id="selScheda">
        ${state.schede.map((s,i) => `<option value="${i}" ${i===ctx.schedaIdx?'selected':''}>${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="sel-group">
      <div class="sel-label">Settimana</div>
      <select class="sel" id="selWeek">
        ${weekOptions()}
      </select>
    </div>`;

  document.getElementById('selScheda').addEventListener('change', e => {
    ctx.schedaIdx = parseInt(e.target.value);
    ctx.week = 1;
    document.getElementById('selWeek').innerHTML = weekOptions();
    document.getElementById('selWeek').addEventListener('change', e2 => { ctx.week = parseInt(e2.target.value); renderExercises(); });
    renderExercises();
  });
  document.getElementById('selWeek').addEventListener('change', e => {
    ctx.week = parseInt(e.target.value);
    renderExercises();
  });

  renderExercises();
}

function weekOptions() {
  const sc = state.schede[ctx.schedaIdx] || state.schede[0];
  return Array.from({ length: sc?.numWeeks || 4 }, (_,i) =>
    `<option value="${i+1}" ${i+1===ctx.week?'selected':''}>Settimana ${i+1}</option>`).join('');
}

function startSession(schedaIdx, week) {
  ctx = { schedaIdx, week };
  navigate('workout');
}

function renderExercises() {
  const { schedaIdx, week } = ctx;
  const sc = state.schede[schedaIdx];
  if (!sc) return;

  const key = sessionKey(sc.id, week, schedaIdx);
  const saved = state.sessionLogs[key];
  const wIdx = week - 1;

  document.getElementById('workoutSub').textContent = `${sc.name} · Settimana ${week}`;

  let html = '';
  sc.exercises.forEach((ex, exIdx) => {
    const wd = ex.weeks[wIdx] || ex.weeks[0] || {};
    const numSets = parseSets(wd.serie);
    const targetKg = parseKg(wd.kg);
    const savedEx = saved?.exercises?.[exIdx];
    const allDone = savedEx?.sets?.length > 0 && savedEx.sets.every(s => s.done);

    const setsRows = Array.from({ length: numSets }, (_, sIdx) => {
      const s = savedEx?.sets?.[sIdx];
      return `<tr class="set-row">
        <td class="set-num">${sIdx+1}</td>
        <td><input class="set-input" type="number" inputmode="decimal" placeholder="Rip" value="${s?.reps ?? str(wd.ripetizioni).replace(/[^0-9.]/g,'')||''}" data-field="reps"/></td>
        <td><input class="set-input" type="number" inputmode="decimal" step="0.5" placeholder="Kg" value="${s?.kg ?? (targetKg !== null ? targetKg : '')}" data-field="kg"/></td>
        <td><input type="checkbox" class="set-done-cb" ${s?.done?'checked':''}></td>
        <td class="set-note">${wd.recupero ? '⏱'+wd.recupero : ''}</td>
      </tr>`;
    }).join('');

    html += `
      <div class="exercise-card${allDone?' completed':''}" data-ex="${exIdx}">
        <div class="ex-header${exIdx===0?' open':''}" onclick="toggleEx(this)">
          <div class="ex-left">
            <div class="ex-check"><svg viewBox="0 0 12 10"><polyline points="1,5 4,9 11,1"/></svg></div>
            <div class="ex-info">
              <div class="ex-name">${ex.name}</div>
              <div class="ex-meta">
                ${wd.serie ? `<span class="ex-tag">${wd.serie} serie</span>` : ''}
                ${wd.ripetizioni ? `<span class="ex-tag">${wd.ripetizioni} rip</span>` : ''}
                ${targetKg !== null && targetKg > 0 ? `<span class="ex-tag">${targetKg}kg</span>` : ''}
              </div>
            </div>
          </div>
          <div class="ex-chevron"><svg viewBox="0 0 14 14"><polyline points="2,4 7,10 12,4"/></svg></div>
        </div>
        <div class="ex-body${exIdx===0?' open':''}">
          <div class="target-info">
            ${wd.serie ? `<span class="target-chip">📋 ${wd.serie} serie</span>` : ''}
            ${wd.ripetizioni ? `<span class="target-chip">🔁 ${wd.ripetizioni} rip</span>` : ''}
            ${wd.recupero ? `<span class="target-chip">⏱ ${wd.recupero}</span>` : ''}
            ${targetKg !== null && targetKg > 0 ? `<span class="target-chip">⚖️ ${targetKg} kg</span>` : ''}
          </div>
          <table class="sets-table">
            <thead><tr><th>#</th><th>Rip</th><th>Kg</th><th>✓</th><th>Rec</th></tr></thead>
            <tbody>${setsRows}</tbody>
          </table>
          <button class="btn-add-set" onclick="addSet(this,${exIdx})">+ Aggiungi serie</button>
          <textarea class="ex-notes-area" placeholder="Note (carico percepito, forma, varianti...)">${savedEx?.notes||''}</textarea>
        </div>
      </div>`;
  });

  const savedDate = saved?.date ? new Date(saved.date).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}) : null;
  html += `
    <div class="save-session-bar">
      <button class="btn btn--primary" onclick="saveSession()">💾 Salva sessione</button>
      ${saved ? `<button class="btn btn--danger" onclick="deleteSession()">🗑</button>` : ''}
      ${savedDate ? `<span style="color:var(--text3);font-size:12px;font-family:var(--font-mono)">Salvata ${savedDate}</span>` : ''}
    </div>`;

  const el = document.getElementById('workoutContent');
  el.innerHTML = html;

  el.querySelectorAll('.set-done-cb').forEach(cb => {
    cb.addEventListener('change', () => autoComplete(cb.closest('.exercise-card')));
  });
}

function toggleEx(header) {
  header.classList.toggle('open');
  header.nextElementSibling.classList.toggle('open');
}

function addSet(btn, exIdx) {
  const tbody = btn.previousElementSibling.querySelector('tbody');
  const n = tbody.querySelectorAll('tr').length + 1;
  const tr = document.createElement('tr');
  tr.className = 'set-row';
  tr.innerHTML = `
    <td class="set-num">${n}</td>
    <td><input class="set-input" type="number" inputmode="decimal" placeholder="Rip" data-field="reps"/></td>
    <td><input class="set-input" type="number" inputmode="decimal" step="0.5" placeholder="Kg" data-field="kg"/></td>
    <td><input type="checkbox" class="set-done-cb"></td><td></td>`;
  tbody.appendChild(tr);
  tr.querySelector('.set-done-cb').addEventListener('change', () => autoComplete(tr.closest('.exercise-card')));
}

function autoComplete(card) {
  const cbs = [...card.querySelectorAll('.set-done-cb')];
  card.classList.toggle('completed', cbs.length > 0 && cbs.every(cb => cb.checked));
}

function collectData() {
  const exercises = [];
  document.querySelectorAll('.exercise-card').forEach((card, i) => {
    const sets = [...card.querySelectorAll('.set-row')].map(row => ({
      reps: row.querySelector('[data-field="reps"]')?.value || '',
      kg: row.querySelector('[data-field="kg"]')?.value || '',
      done: row.querySelector('.set-done-cb')?.checked || false
    }));
    exercises.push({ name: state.schede[ctx.schedaIdx]?.exercises[i]?.name, sets, notes: card.querySelector('.ex-notes-area')?.value || '' });
  });
  return exercises;
}

function saveSession() {
  const sc = state.schede[ctx.schedaIdx];
  if (!sc) return;
  const key = sessionKey(sc.id, ctx.week, ctx.schedaIdx);
  state.sessionLogs[key] = { exercises: collectData(), date: new Date().toISOString(), schedaIdx: ctx.schedaIdx, week: ctx.week, schedaId: sc.id, schedaName: sc.name };
  saveState();
  showToast('Sessione salvata!', 'success');
  renderExercises();
}

function deleteSession() {
  const sc = state.schede[ctx.schedaIdx];
  if (!sc) return;
  const key = sessionKey(sc.id, ctx.week, ctx.schedaIdx);
  delete state.sessionLogs[key];
  saveState();
  showToast('Sessione eliminata', 'error');
  renderExercises();
}

/* ═══════════════════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════════ */
let aCharts = {};

function renderAnalytics() {
  const grid = document.getElementById('analyticsGrid');
  const filters = document.getElementById('analyticsFilters');
  Object.values(aCharts).forEach(c => c.destroy());
  aCharts = {};

  const logs = Object.entries(state.sessionLogs).sort(([,a],[,b]) => (a.date||'').localeCompare(b.date||''));

  if (!logs.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Completa almeno una sessione per vedere i grafici</p></div>';
    filters.innerHTML = '';
    return;
  }

  const allEx = new Set();
  state.schede.forEach(sc => sc.exercises.forEach(ex => allEx.add(ex.name)));

  filters.innerHTML = `
    <div class="sel-group" style="max-width:300px">
      <div class="sel-label">Filtra esercizio</div>
      <select class="sel" id="selEx">
        <option value="">Tutti gli esercizi</option>
        ${[...allEx].map(n => `<option value="${n}">${n.length>40?n.slice(0,40)+'…':n}</option>`).join('')}
      </select>
    </div>`;

  document.getElementById('selEx').addEventListener('change', renderAnalytics);
  const filterEx = document.getElementById('selEx')?.value || '';

  grid.innerHTML = `
    <div class="card card--wide">
      <div class="card-label">Carico medio per sessione (Kg)</div>
      <canvas id="chartKg" height="100"></canvas>
    </div>
    <div class="card">
      <div class="card-label">Volume per sessione (Kg × Rip)</div>
      <canvas id="chartVolA" height="150"></canvas>
    </div>
    <div class="card">
      <div class="card-label">Storico sessioni</div>
      <div id="sessionList" style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;padding-right:4px"></div>
    </div>`;

  const kgLabels=[], kgData=[], vLabels=[], vData=[];

  logs.forEach(([key, log]) => {
    const parts = key.split('_');
    const si = parseInt(parts[parts.length-1].replace('s',''));
    const w = parseInt(parts[parts.length-2].replace('w',''));
    const sc = state.schede[si];
    const label = sc ? `${sc.name} S${w}` : `S${w}`;
    let totKg=0, cntKg=0, vol=0;
    log.exercises?.forEach(ex => {
      if (filterEx && ex.name !== filterEx) return;
      ex.sets?.forEach(s => {
        const kg = parseFloat(s.kg)||0, reps = parseFloat(s.reps)||0;
        if (kg>0) { totKg+=kg; cntKg++; }
        vol += kg*reps;
      });
    });
    kgLabels.push(label); kgData.push(cntKg>0 ? Math.round(totKg/cntKg*10)/10 : 0);
    vLabels.push(label); vData.push(Math.round(vol));
  });

  const chartOpts = (label) => ({
    responsive:true,
    plugins:{ legend:{display:false}, tooltip:{
      backgroundColor:'#1c1c1c',borderColor:'#333',borderWidth:1,
      titleColor:'#888',bodyColor:'#f0f0f0',
      callbacks:{label:c=>` ${c.raw} ${label}`}
    }},
    scales:{
      x:{grid:{color:'#222'},ticks:{color:'#555',font:{family:'DM Mono',size:10}}},
      y:{grid:{color:'#222'},ticks:{color:'#555',font:{family:'DM Mono',size:10}}}
    }
  });

  aCharts.kg = new Chart(document.getElementById('chartKg'),{
    type:'line',
    data:{labels:kgLabels,datasets:[{data:kgData,borderColor:'#e8ff3a',backgroundColor:'rgba(232,255,58,0.08)',tension:0.3,fill:true,pointBackgroundColor:'#e8ff3a',pointRadius:4}]},
    options:chartOpts('kg medio')
  });

  aCharts.vol = new Chart(document.getElementById('chartVolA'),{
    type:'bar',
    data:{labels:vLabels,datasets:[{data:vData,backgroundColor:'rgba(58,255,140,0.6)',borderColor:'#3aff8c',borderWidth:1,borderRadius:4}]},
    options:chartOpts('kg·rip')
  });

  const list = document.getElementById('sessionList');
  [...logs].reverse().forEach(([key,log]) => {
    const date = log.date ? new Date(log.date).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg3);border-radius:8px;padding:10px 12px;border:1px solid var(--border)';
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:var(--font-d);font-size:16px;letter-spacing:1px">${log.schedaName||'?'} — S${log.week}</span>
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3)">${date}</span>
    </div>
    <div style="color:var(--text3);font-size:11px;margin-top:4px">${log.exercises?.length||0} esercizi</div>`;
    list.appendChild(div);
  });
}

/* ═══════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════ */
function showToast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span>${msg}`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(()=>t.remove(), 3000);
}

/* ═══════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════ */
loadState();
const next = getNextSession();
ctx = { schedaIdx: next.schedaIdx, week: next.week || 1 };
renderDashboard();
