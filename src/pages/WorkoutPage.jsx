import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSchedule, getSessions, saveSession } from '../utils/db';
import {
  ChevronLeft, ChevronRight, Check, Clock, Weight,
  RotateCcw, Flame, Timer, CheckCircle, Save,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function WorkoutPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const scheduleId = params.get('schedule');

  const [schedule, setSchedule] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [logs, setLogs] = useState({}); // { exIdx: { setIdx: { reps, kg, done } } }
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!scheduleId) { navigate('/schedules'); return; }
    Promise.all([
      getSchedule(user.uid, scheduleId),
      getSessions(user.uid),
    ]).then(([sched, sess]) => {
      setSchedule(sched);
      setSessions(sess);
      // Determine suggested week from past sessions
      const done = sess.filter((s) => s.scheduleId === scheduleId);
      if (done.length > 0) {
        const maxWeek = Math.max(...done.map((s) => s.week));
        setSelectedWeek(Math.min(maxWeek, sched.weeks ?? 4));
      }
    }).finally(() => setLoading(false));
  }, [scheduleId]);

  // Timer
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  if (!schedule) return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Scheda non trovata.</p>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/schedules')}>
        Vai alle schede
      </button>
    </div>
  );

  const day = schedule.days[selectedDay];
  const weekCount = schedule.weeks ?? 4;

  // Get previous session log for this day+week for reference
  const prevSession = sessions.find(
    (s) => s.scheduleId === scheduleId && s.dayIndex === selectedDay && s.week === selectedWeek - 1
  );

  const setLog = (exIdx, setIdx, field, value) => {
    setLogs((prev) => ({
      ...prev,
      [exIdx]: {
        ...(prev[exIdx] || {}),
        [setIdx]: { ...(prev[exIdx]?.[setIdx] || {}), [field]: value },
      },
    }));
  };

  const toggleSetDone = (exIdx, setIdx) => {
    const current = logs[exIdx]?.[setIdx]?.done;
    setLog(exIdx, setIdx, 'done', !current);
    if (!timerActive && !current) setTimerActive(true);
  };

  const completedSets = Object.values(logs).flatMap((ex) =>
    Object.values(ex).filter((s) => s.done)
  ).length;

  const totalSets = day.exercises.reduce((acc, ex) => {
    const wk = ex.weekData.find((w) => w.week === selectedWeek) ?? ex.weekData[0];
    const serie = parseInt(String(wk?.serie)?.split('+')?.[0]) || 3;
    return acc + serie;
  }, 0);

  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSession(user.uid, {
        scheduleId,
        scheduleName: schedule.name,
        dayIndex: selectedDay,
        dayLabel: day.label,
        week: selectedWeek,
        date: format(new Date(), 'yyyy-MM-dd'),
        duration: elapsed,
        logs,
        completedSets,
        totalSets,
      });
      setSaved(true);
      setTimerActive(false);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container section fade-in" style={{ maxWidth: 700, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2>{schedule.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600,
          }}>
            <Timer size={14} color="var(--accent)" />
            <span style={{ color: elapsed > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {formatTime(elapsed)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar" style={{ marginBottom: 6 }}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {completedSets} / {totalSets} serie completate
        </p>
      </div>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {schedule.days.map((d, i) => (
          <button key={d.id} onClick={() => { setSelectedDay(i); setLogs({}); }}
            style={{
              padding: '8px 18px', borderRadius: 'var(--radius-md)',
              border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'var(--font)', fontSize: '0.875rem', fontWeight: 500,
              transition: 'all 0.15s',
              borderColor: selectedDay === i ? 'var(--accent)' : 'var(--border)',
              background: selectedDay === i ? 'var(--accent)' : 'var(--bg-secondary)',
              color: selectedDay === i ? 'white' : 'var(--text-primary)',
            }}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Week selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="btn btn-ghost btn-icon"
          disabled={selectedWeek <= 1}
          onClick={() => setSelectedWeek((w) => w - 1)}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, display: 'flex', gap: 6, justifyContent: 'center' }}>
          {Array.from({ length: weekCount }, (_, i) => i + 1).map((w) => {
            const hasDone = sessions.some(
              (s) => s.scheduleId === scheduleId && s.dayIndex === selectedDay && s.week === w
            );
            return (
              <button key={w} onClick={() => setSelectedWeek(w)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid ${selectedWeek === w ? 'var(--accent)' : hasDone ? 'var(--success)' : 'var(--border)'}`,
                  background: selectedWeek === w ? 'var(--accent)' : hasDone ? 'rgba(52,199,89,0.1)' : 'var(--bg-secondary)',
                  color: selectedWeek === w ? 'white' : hasDone ? 'var(--success)' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  fontFamily: 'var(--font)',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {hasDone && selectedWeek !== w ? <Check size={14} /> : w}
              </button>
            );
          })}
        </div>
        <button className="btn btn-ghost btn-icon"
          disabled={selectedWeek >= weekCount}
          onClick={() => setSelectedWeek((w) => w + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Exercises */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {day.exercises.map((ex, exIdx) => {
          const wk = ex.weekData.find((w) => w.week === selectedWeek) ?? ex.weekData[0];
          const prevWk = prevSession?.logs?.[exIdx];
          const rawSerie = String(wk?.serie ?? '3');
          // Parse serie: "2 + 2" → 4, "4" → 4
          const serieCount = rawSerie.split('+').reduce((a, b) => a + (parseInt(b.trim()) || 0), 0) || 3;

          return (
            <div key={exIdx} className="card" style={{ transition: 'box-shadow 0.2s' }}>
              {/* Exercise header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Esercizio {exIdx + 1}
                  </span>
                  <h4 style={{ marginTop: 3, lineHeight: 1.3 }}>{ex.name}</h4>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {wk?.ripetizioni && (
                    <span className="badge badge-neutral">
                      <RotateCcw size={10} /> {wk.ripetizioni} reps
                    </span>
                  )}
                  {wk?.recupero && wk.recupero !== '/' && (
                    <span className="badge badge-neutral">
                      <Clock size={10} /> {wk.recupero}
                    </span>
                  )}
                  {wk?.kg && (
                    <span className="badge badge-accent">
                      <Weight size={10} /> {wk.kg} kg
                    </span>
                  )}
                </div>
              </div>

              {/* Sets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: serieCount }, (_, setIdx) => {
                  const setLog = logs[exIdx]?.[setIdx] || {};
                  const prevSetLog = prevWk?.[setIdx];
                  const isDone = !!setLog.done;
                  const targetKg = wk?.kg ?? '';

                  return (
                    <div key={setIdx} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isDone ? 'rgba(52,199,89,0.06)' : 'var(--bg-secondary)',
                      border: `1px solid ${isDone ? 'rgba(52,199,89,0.2)' : 'var(--border-light)'}`,
                      transition: 'all 0.2s',
                    }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', width: 20, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                        {setIdx + 1}
                      </span>

                      {/* KG input */}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        {prevSetLog?.kg && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                            prec: {prevSetLog.kg}kg
                          </span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            placeholder={targetKg !== null && targetKg !== '' ? String(targetKg) : 'kg'}
                            value={setLog.kg ?? ''}
                            onChange={(e) => setLog(exIdx, setIdx, 'kg', e.target.value)}
                            style={{
                              width: 70, padding: '5px 8px',
                              background: 'var(--bg)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                              fontSize: '0.875rem', fontFamily: 'var(--font-mono)',
                              fontWeight: 500, outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>kg</span>

                          <input
                            type="number"
                            placeholder={wk?.ripetizioni ? String(wk.ripetizioni).split('-->')[0].trim() : 'reps'}
                            value={setLog.reps ?? ''}
                            onChange={(e) => setLog(exIdx, setIdx, 'reps', e.target.value)}
                            style={{
                              width: 60, padding: '5px 8px',
                              background: 'var(--bg)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                              fontSize: '0.875rem', fontFamily: 'var(--font-mono)',
                              fontWeight: 500, outline: 'none', marginLeft: 4,
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>reps</span>
                        </div>
                      </div>

                      {/* Done button */}
                      <button onClick={() => toggleSetDone(exIdx, setIdx)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          border: `2px solid ${isDone ? 'var(--success)' : 'var(--border)'}`,
                          background: isDone ? 'var(--success)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
                        }}>
                        <Check size={16} color={isDone ? 'white' : 'var(--text-tertiary)'} strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 24px',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border-light)',
        display: 'flex', gap: 12, justifyContent: 'flex-end',
        maxWidth: 700, margin: '0 auto',
      }}>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success)', fontSize: '0.875rem' }}>
            <CheckCircle size={16} /> Salvato!
          </div>
        )}
        <button
          className="btn btn-secondary"
          onClick={() => { setLogs({}); setElapsed(0); setTimerActive(false); }}
        >
          <RotateCcw size={15} /> Reset
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || completedSets === 0}
        >
          {saving ? <div className="spinner" style={{ borderTopColor: 'white' }} /> : <Save size={15} />}
          {saving ? 'Salvataggio...' : `Salva allenamento`}
        </button>
      </div>
    </div>
  );
}
