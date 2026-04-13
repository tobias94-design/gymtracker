import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessions, getSchedules } from '../utils/db';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { format, parseISO, subDays, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-container-high)',
      border: '1px solid rgba(68,72,79,0.3)',
      borderRadius: 'var(--radius-lg)', padding: '10px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontSize: '0.78rem',
    }}>
      <p style={{ color: 'var(--on-surface-variant)', marginBottom: 4, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.65rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, fontFamily: 'var(--font-headline)' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState('');

  useEffect(() => {
    Promise.all([getSessions(user.uid), getSchedules(user.uid)])
      .then(([sess, sched]) => { setSessions(sess); setSchedules(sched); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = selectedSchedule === 'all' ? sessions : sessions.filter(s => s.scheduleId === selectedSchedule);

  const weeklyData = (() => {
    const weeks = {};
    filtered.forEach(s => {
      const k = format(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), 'dd/MM');
      if (!weeks[k]) weeks[k] = { week: k, volume: 0, sessions: 0 };
      weeks[k].sessions++;
      weeks[k].volume += Object.values(s.logs || {}).flatMap(ex =>
        Object.values(ex).map(set => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
      ).reduce((a, b) => a + b, 0);
    });
    return Object.values(weeks).slice(-12).map(w => ({ ...w, volume: Math.round(w.volume) }));
  })();

  const dowData = (() => {
    const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const counts = Array(7).fill(0);
    filtered.forEach(s => { counts[(parseISO(s.date).getDay() + 6) % 7]++; });
    return days.map((name, i) => ({ name, sessioni: counts[i] }));
  })();

  const allExercises = (() => {
    const names = new Set();
    schedules.forEach(sched => sched.days?.forEach(day => day.exercises?.forEach(ex => names.add(ex.name))));
    return [...names].sort();
  })();

  useEffect(() => { if (allExercises.length > 0 && !selectedExercise) setSelectedExercise(allExercises[0]); }, [allExercises.length]);

  const exerciseProgression = (() => {
    if (!selectedExercise) return [];
    const points = [];
    filtered.forEach(s => {
      const sched = schedules.find(sc => sc.id === s.scheduleId);
      if (!sched || !s.logs) return;
      sched.days?.forEach((day, dayIdx) => {
        if (dayIdx !== s.dayIndex) return;
        day.exercises?.forEach((ex, exIdx) => {
          if (ex.name !== selectedExercise) return;
          const sets = s.logs[exIdx];
          if (!sets) return;
          const kgValues = Object.values(sets).map(st => parseFloat(st.kg)).filter(Boolean);
          if (!kgValues.length) return;
          points.push({ date: s.date, label: format(parseISO(s.date), 'd MMM', { locale: it }), maxKg: Math.max(...kgValues) });
        });
      });
    });
    return points.sort((a, b) => a.date.localeCompare(b.date));
  })();

  const kgTrend = exerciseProgression.length >= 2
    ? exerciseProgression[exerciseProgression.length - 1].maxKg - exerciseProgression[0].maxKg : 0;

  const restData = (() => {
    const trainDates = new Set(filtered.map(s => s.date));
    return Array.from({ length: 30 }, (_, i) => {
      const d = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      return { label: format(parseISO(d), 'dd'), value: trainDates.has(d) ? 1 : 0 };
    });
  })();

  const trainDaysLast30 = restData.filter(d => d.value === 1).length;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}><div className="spinner" /></div>;

  if (sessions.length === 0) return (
    <div className="container section" style={{ textAlign: 'center', paddingTop: 80 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--outline)', display: 'block', marginBottom: 16 }}>query_stats</span>
      <h3 style={{ marginBottom: 8 }}>Nessun dato disponibile</h3>
      <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>Completa qualche allenamento per sbloccare le analytics.</p>
    </div>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid rgba(68,72,79,0.2)', padding: '40px 0 28px' }}>
        <div className="container">
          <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 8 }}>PERFORMANCE INTELLIGENCE</p>
          <h1>Analytics</h1>
          <p style={{ color: 'var(--on-surface-variant)', marginTop: 8, fontSize: '0.875rem' }}>Monitor della progressione e ottimizzazione training.</p>
        </div>
      </div>

      <div className="container section fade-in" style={{ paddingBottom: 60 }}>
        {/* Filter */}
        <div style={{ marginBottom: 28 }}>
          <select value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)}
            className="input" style={{ width: 'auto', minWidth: 200, appearance: 'none', cursor: 'pointer', fontSize: '0.82rem' }}>
            <option value="all">Tutte le schede</option>
            {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* KPI row */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          {[
            { label: 'Sessioni totali', value: filtered.length, color: 'var(--primary)' },
            { label: 'Attivi / 30gg', value: `${trainDaysLast30}/30`, color: 'var(--secondary)' },
            {
              label: 'Volume totale',
              value: (() => { const v = filtered.reduce((acc, s) => acc + Object.values(s.logs || {}).flatMap(ex => Object.values(ex).map(set => (parseFloat(set.kg)||0)*(parseInt(set.reps)||0))).reduce((a,b)=>a+b,0), 0); return v>=1000?`${(v/1000).toFixed(1)}t`:`${Math.round(v)}kg`; })(),
              color: 'var(--tertiary)',
            },
            {
              label: 'Durata media',
              value: (() => { const d=filtered.filter(s=>s.duration>0).map(s=>s.duration); return d.length?`${Math.floor(d.reduce((a,b)=>a+b,0)/d.length/60)}m`:'—'; })(),
              color: 'var(--primary-dim)',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-box">
              <div className="stat-label" style={{ marginBottom: 10 }}>{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Weekly volume */}
        <div className="card-high" style={{ marginBottom: 20 }}>
          <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 20 }}>VOLUME SETTIMANALE (KG)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d2fd" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d2fd" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(68,72,79,0.3)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="volume" stroke="#00d2fd" strokeWidth={2} fill="url(#volGrad)" name="Volume kg" dot={{ fill: '#00d2fd', r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Grid: frequency + rest */}
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card-high">
            <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 20 }}>FREQUENZA PER GIORNO</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dowData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(68,72,79,0.3)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sessioni" fill="url(#barGrad)" radius={[3,3,0,0]} name="Sessioni">
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a1ffc2" />
                      <stop offset="100%" stopColor="#00d2fd" />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-high">
            <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 16 }}>TRAINING VS RIPOSO (30GG)</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div className="stat-box" style={{ flex: 1, padding: '10px 14px' }}>
                <div className="stat-label">Attivi</div>
                <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>{trainDaysLast30}</div>
              </div>
              <div className="stat-box" style={{ flex: 1, padding: '10px 14px' }}>
                <div className="stat-label">Riposo</div>
                <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--on-surface-variant)' }}>{30 - trainDaysLast30}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {restData.map((d, i) => (
                <div key={i} style={{
                  width: 13, height: 13, borderRadius: 2,
                  background: d.value ? 'var(--primary)' : 'var(--surface-container-highest)',
                  boxShadow: d.value ? '0 0 4px rgba(161,255,194,0.3)' : 'none',
                }} title={d.label} />
              ))}
            </div>
          </div>
        </div>

        {/* Exercise progression */}
        <div className="card-high">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 6 }}>PROGRESSIONE CARICHI</p>
              <h4>Peso massimo per esercizio</h4>
            </div>
            <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}
              className="input" style={{ width: 'auto', maxWidth: 280, fontSize: '0.78rem', appearance: 'none', cursor: 'pointer' }}>
              {allExercises.map(ex => <option key={ex} value={ex}>{ex.length > 45 ? ex.slice(0, 45) + '…' : ex}</option>)}
            </select>
          </div>

          {exerciseProgression.length >= 2 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div className="stat-box" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: kgTrend >= 0 ? 'var(--primary)' : 'var(--error)' }}>
                  {kgTrend >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: kgTrend >= 0 ? 'var(--primary)' : 'var(--error)', fontFamily: 'var(--font-headline)' }}>
                  {kgTrend >= 0 ? '+' : ''}{kgTrend.toFixed(1)} kg
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>dall'inizio</span>
              </div>
              <div className="stat-box" style={{ padding: '10px 16px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>Max: </span>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}>
                  {Math.max(...exerciseProgression.map(p => p.maxKg))} kg
                </span>
              </div>
            </div>
          )}

          {exerciseProgression.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.3 }}>show_chart</span>
              <p style={{ fontSize: '0.875rem' }}>Nessun dato per questo esercizio</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={exerciseProgression}>
                <defs>
                  <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a1ffc2" />
                    <stop offset="100%" stopColor="#00d2fd" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(68,72,79,0.3)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--on-surface-variant)', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="maxKg" stroke="url(#lineGlow)" strokeWidth={2.5}
                  dot={{ fill: '#a1ffc2', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#a1ffc2', boxShadow: '0 0 10px rgba(161,255,194,0.5)' }}
                  name="Max kg" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* History */}
        <div style={{ marginTop: 20 }}>
          <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 16 }}>STORICO SESSIONI</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.slice(0, 20).map(s => {
              const vol = Object.values(s.logs || {}).flatMap(ex =>
                Object.values(ex).map(set => (parseFloat(set.kg)||0)*(parseInt(set.reps)||0))
              ).reduce((a,b)=>a+b,0);
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px', background: 'var(--surface-container-low)',
                  borderRadius: 'var(--radius-xl)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-lg)',
                    background: 'rgba(161,255,194,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-headline)',
                  }}>{s.dayLabel?.split(' ')[1]}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.dayLabel} · Sett. {s.week}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginLeft: 8 }}>
                      {format(parseISO(s.date), 'd MMM yyyy', { locale: it })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{s.completedSets}/{s.totalSets} serie</span>
                    {vol > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700, fontFamily: 'var(--font-headline)' }}>{Math.round(vol)}kg</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
