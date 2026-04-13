import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSchedule, getSessions, saveSession } from '../utils/db';
import { format } from 'date-fns';

export default function WorkoutPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const scheduleId = params.get('schedule');

  const [schedule, setSchedule] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [logs, setLogs] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!scheduleId) { navigate('/schedules'); return; }
    Promise.all([getSchedule(user.uid, scheduleId), getSessions(user.uid)])
      .then(([sched, sess]) => {
        setSchedule(sched);
        setSessions(sess);
        const done = sess.filter(s => s.scheduleId === scheduleId);
        if (done.length > 0) setSelectedWeek(Math.min(Math.max(...done.map(s => s.week)), sched.weeks ?? 4));
      }).finally(() => setLoading(false));
  }, [scheduleId]);

  useEffect(() => {
    if (timerActive) timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  const formatTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}><div className="spinner" /></div>;
  if (!schedule) return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--on-surface-variant)', marginBottom: 20 }}>Scheda non trovata.</p>
      <button className="btn btn-primary" onClick={() => navigate('/schedules')}>IMPORTA SCHEDA</button>
    </div>
  );

  const day = schedule.days[selectedDay];
  const weekCount = schedule.weeks ?? 4;
  const prevSession = sessions.find(s => s.scheduleId === scheduleId && s.dayIndex === selectedDay && s.week === selectedWeek - 1);

  const setLog = (exIdx, setIdx, field, value) => {
    setLogs(prev => ({ ...prev, [exIdx]: { ...(prev[exIdx] || {}), [setIdx]: { ...(prev[exIdx]?.[setIdx] || {}), [field]: value } } }));
  };
  const toggleDone = (exIdx, setIdx) => {
    const cur = logs[exIdx]?.[setIdx]?.done;
    setLog(exIdx, setIdx, 'done', !cur);
    if (!timerActive && !cur) setTimerActive(true);
  };

  const completedSets = Object.values(logs).flatMap(ex => Object.values(ex).filter(s => s.done)).length;
  const totalSets = day.exercises.reduce((acc, ex) => {
    const wk = ex.weekData.find(w => w.week === selectedWeek) ?? ex.weekData[0];
    return acc + (String(wk?.serie ?? '3').split('+').reduce((a, b) => a + (parseInt(b.trim()) || 0), 0) || 3);
  }, 0);
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSession(user.uid, {
        scheduleId, scheduleName: schedule.name,
        dayIndex: selectedDay, dayLabel: day.label,
        week: selectedWeek, date: format(new Date(), 'yyyy-MM-dd'),
        duration: elapsed, logs, completedSets, totalSets,
      });
      setSaved(true); setTimerActive(false);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface-container-low)',
        borderBottom: '1px solid rgba(68,72,79,0.2)',
        padding: '28px 0 20px', position: 'sticky', top: 60, zIndex: 50,
      }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 4 }}>SESSION ACTIVE</p>
              <h3 style={{ color: 'var(--on-surface)' }}>{schedule.name}</h3>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px',
              background: timerActive ? 'rgba(161,255,194,0.1)' : 'var(--surface-container)',
              borderRadius: 'var(--radius-lg)',
              border: timerActive ? '1px solid rgba(161,255,194,0.2)' : '1px solid transparent',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: timerActive ? 'var(--primary)' : 'var(--outline)' }}>timer</span>
              <span style={{
                fontFamily: 'var(--font-headline)', fontSize: '1rem', fontWeight: 700,
                color: timerActive ? 'var(--primary)' : 'var(--on-surface-variant)',
                letterSpacing: '0.05em',
              }}>{formatTime(elapsed)}</span>
            </div>
          </div>
          {/* Progress */}
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span className="label-xs" style={{ color: 'var(--outline)' }}>{completedSets} / {totalSets} serie</span>
            <span className="label-xs" style={{ color: progress === 100 ? 'var(--primary)' : 'var(--outline)' }}>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      <div className="container fade-in" style={{ paddingTop: 24, maxWidth: 720 }}>
        {/* Day selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {schedule.days.map((d, i) => (
            <button key={d.id} onClick={() => { setSelectedDay(i); setLogs({}); }}
              style={{
                padding: '7px 18px', borderRadius: 'var(--radius-lg)',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                transition: 'all 0.15s',
                background: selectedDay === i ? 'var(--primary)' : 'var(--surface-container-high)',
                color: selectedDay === i ? 'var(--on-primary-fixed)' : 'var(--on-surface-variant)',
                boxShadow: selectedDay === i ? '0 0 16px rgba(161,255,194,0.25)' : 'none',
              }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Week selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button className="btn btn-ghost btn-icon" disabled={selectedWeek <= 1} onClick={() => setSelectedWeek(w => w - 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
          </button>
          <div style={{ flex: 1, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {Array.from({ length: weekCount }, (_, i) => i + 1).map(w => {
              const hasDone = sessions.some(s => s.scheduleId === scheduleId && s.dayIndex === selectedDay && s.week === w);
              const isActive = selectedWeek === w;
              return (
                <button key={w} onClick={() => setSelectedWeek(w)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `2px solid ${isActive ? 'var(--primary)' : hasDone ? 'rgba(161,255,194,0.3)' : 'var(--outline-variant)'}`,
                    background: isActive ? 'var(--primary)' : hasDone ? 'rgba(161,255,194,0.08)' : 'transparent',
                    color: isActive ? 'var(--on-primary-fixed)' : hasDone ? 'var(--primary)' : 'var(--on-surface-variant)',
                    fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                    fontFamily: 'var(--font-headline)', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isActive ? '0 0 12px rgba(161,255,194,0.3)' : 'none',
                  }}>
                  {hasDone && !isActive
                    ? <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                    : w}
                </button>
              );
            })}
          </div>
          <button className="btn btn-ghost btn-icon" disabled={selectedWeek >= weekCount} onClick={() => setSelectedWeek(w => w + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
          </button>
        </div>

        {/* Exercises */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {day.exercises.map((ex, exIdx) => {
            const wk = ex.weekData.find(w => w.week === selectedWeek) ?? ex.weekData[0];
            const serieCount = String(wk?.serie ?? '3').split('+').reduce((a, b) => a + (parseInt(b.trim()) || 0), 0) || 3;
            const prevWk = prevSession?.logs?.[exIdx];
            const allDone = Array.from({ length: serieCount }, (_, i) => i).every(i => logs[exIdx]?.[i]?.done);

            return (
              <div key={exIdx} className="card-high accent-line" style={{
                borderLeft: allDone ? '2px solid var(--primary)' : undefined,
                transition: 'all 0.2s',
              }}>
                {/* Exercise header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 5 }}>ESERCIZIO {exIdx + 1}</p>
                    <h4 style={{ lineHeight: 1.3, color: allDone ? 'var(--primary)' : 'var(--on-surface)' }}>{ex.name}</h4>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                    {wk?.ripetizioni && (
                      <span className="chip chip-secondary">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>repeat</span>
                        {wk.ripetizioni}
                      </span>
                    )}
                    {wk?.recupero && wk.recupero !== '/' && (
                      <span className="chip" style={{ background: 'var(--surface-container-highest)', color: 'var(--on-surface-variant)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>timer</span>
                        {wk.recupero}
                      </span>
                    )}
                    {wk?.kg && (
                      <span className="chip chip-primary">
                        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>scale</span>
                        {wk.kg}kg
                      </span>
                    )}
                  </div>
                </div>

                {/* Sets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: serieCount }, (_, setIdx) => {
                    const setLog = logs[exIdx]?.[setIdx] || {};
                    const isDone = !!setLog.done;
                    return (
                      <div key={setIdx} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        background: isDone ? 'rgba(161,255,194,0.05)' : 'var(--surface-container)',
                        border: `1px solid ${isDone ? 'rgba(161,255,194,0.15)' : 'transparent'}`,
                        transition: 'all 0.2s',
                      }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, color: 'var(--outline)',
                          width: 18, flexShrink: 0, fontFamily: 'var(--font-headline)',
                        }}>{setIdx + 1}</span>

                        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {prevWk?.[setIdx]?.kg && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--outline)', width: '100%', marginBottom: -4 }}>
                              prec: {prevWk[setIdx].kg}kg × {prevWk[setIdx].reps}
                            </span>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              placeholder={wk?.kg !== null && wk?.kg !== undefined ? String(wk.kg) : 'kg'}
                              value={setLog.kg ?? ''}
                              onChange={e => setLog(exIdx, setIdx, 'kg', e.target.value)}
                              style={{
                                width: 64, padding: '5px 8px',
                                background: 'var(--surface-container-highest)',
                                border: '1px solid transparent',
                                borderRadius: 'var(--radius-lg)',
                                color: 'var(--on-surface)', fontSize: '0.875rem',
                                fontFamily: 'var(--font-headline)', fontWeight: 600,
                                outline: 'none', textAlign: 'center',
                              }}
                              onFocus={e => e.target.style.borderColor = 'rgba(161,255,194,0.4)'}
                              onBlur={e => e.target.style.borderColor = 'transparent'}
                            />
                            <span style={{ fontSize: '0.65rem', color: 'var(--outline)', fontWeight: 700, letterSpacing: '0.06em' }}>KG</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              placeholder={wk?.ripetizioni ? String(wk.ripetizioni).split('-->')[0].trim() : 'reps'}
                              value={setLog.reps ?? ''}
                              onChange={e => setLog(exIdx, setIdx, 'reps', e.target.value)}
                              style={{
                                width: 56, padding: '5px 8px',
                                background: 'var(--surface-container-highest)',
                                border: '1px solid transparent',
                                borderRadius: 'var(--radius-lg)',
                                color: 'var(--on-surface)', fontSize: '0.875rem',
                                fontFamily: 'var(--font-headline)', fontWeight: 600,
                                outline: 'none', textAlign: 'center',
                              }}
                              onFocus={e => e.target.style.borderColor = 'rgba(0,210,253,0.4)'}
                              onBlur={e => e.target.style.borderColor = 'transparent'}
                            />
                            <span style={{ fontSize: '0.65rem', color: 'var(--outline)', fontWeight: 700, letterSpacing: '0.06em' }}>REPS</span>
                          </div>
                        </div>

                        <button onClick={() => toggleDone(exIdx, setIdx)}
                          style={{
                            width: 34, height: 34, borderRadius: '50%',
                            border: `2px solid ${isDone ? 'var(--primary)' : 'var(--outline-variant)'}`,
                            background: isDone ? 'var(--primary)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
                            boxShadow: isDone ? '0 0 10px rgba(161,255,194,0.3)' : 'none',
                          }}>
                          <span className="material-symbols-outlined" style={{
                            fontSize: 16, color: isDone ? 'var(--on-primary-fixed)' : 'var(--outline)',
                          }}>check</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 24px 24px',
        background: 'rgba(10,14,20,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(68,72,79,0.2)',
        display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
      }}>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 700 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            SALVATO
          </span>
        )}
        <button className="btn btn-secondary" onClick={() => { setLogs({}); setElapsed(0); setTimerActive(false); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>restart_alt</span>
          RESET
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving || completedSets === 0}>
          {saving ? <div className="spinner" style={{ borderTopColor: 'var(--on-primary-fixed)' }} /> : <span className="material-symbols-outlined" style={{ fontSize: 17 }}>save</span>}
          {saving ? 'SALVATAGGIO...' : 'SALVA SESSIONE'}
        </button>
      </div>
    </div>
  );
}
