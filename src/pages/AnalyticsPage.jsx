import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessions, getSchedules } from '../utils/db';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Weight, Dumbbell, Calendar, ChevronDown } from 'lucide-react';
import { format, parseISO, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';

const ACCENT = '#ff3b30';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-elevated)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-md)',
      fontSize: '0.82rem',
    }}>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
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
      .then(([sess, sched]) => {
        setSessions(sess);
        setSchedules(sched);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filter sessions
  const filtered = selectedSchedule === 'all'
    ? sessions
    : sessions.filter((s) => s.scheduleId === selectedSchedule);

  // Weekly volume data
  const weeklyData = (() => {
    const weeks = {};
    filtered.forEach((s) => {
      const weekKey = format(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), 'dd/MM');
      if (!weeks[weekKey]) weeks[weekKey] = { week: weekKey, volume: 0, sessions: 0 };
      weeks[weekKey].sessions++;
      if (s.logs) {
        weeks[weekKey].volume += Object.values(s.logs).flatMap((ex) =>
          Object.values(ex).map((set) => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
        ).reduce((a, b) => a + b, 0);
      }
    });
    return Object.values(weeks).slice(-12).map(w => ({ ...w, volume: Math.round(w.volume) }));
  })();

  // Frequency per day of week
  const dowData = (() => {
    const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const counts = Array(7).fill(0);
    filtered.forEach((s) => {
      const d = parseISO(s.date).getDay();
      counts[(d + 6) % 7]++;
    });
    return days.map((name, i) => ({ name, allenamenti: counts[i] }));
  })();

  // Exercise progression (kg over time)
  const allExercises = (() => {
    const names = new Set();
    filtered.forEach((s) => {
      if (!s.logs) return;
      Object.values(s.logs).forEach((ex) => {
        // We need the exercise name from the schedule... approximate from index
      });
    });
    // Build from schedules
    schedules.forEach((sched) => {
      sched.days?.forEach((day) => {
        day.exercises?.forEach((ex) => names.add(ex.name));
      });
    });
    return [...names].sort();
  })();

  useEffect(() => {
    if (allExercises.length > 0 && !selectedExercise) {
      setSelectedExercise(allExercises[0]);
    }
  }, [allExercises.length]);

  // Per-exercise progression: find sessions where this exercise appears
  const exerciseProgression = (() => {
    if (!selectedExercise) return [];
    const points = [];
    filtered.forEach((s) => {
      // Find matching schedule
      const sched = schedules.find((sc) => sc.id === s.scheduleId);
      if (!sched || !s.logs) return;

      sched.days?.forEach((day, dayIdx) => {
        if (dayIdx !== s.dayIndex) return;
        day.exercises?.forEach((ex, exIdx) => {
          if (ex.name !== selectedExercise) return;
          const sets = s.logs[exIdx];
          if (!sets) return;
          const kgValues = Object.values(sets).map((st) => parseFloat(st.kg)).filter(Boolean);
          if (kgValues.length === 0) return;
          const maxKg = Math.max(...kgValues);
          points.push({ date: s.date, label: format(parseISO(s.date), 'd MMM', { locale: it }), maxKg, week: s.week });
        });
      });
    });
    return points.sort((a, b) => a.date.localeCompare(b.date));
  })();

  const kgTrend = (() => {
    if (exerciseProgression.length < 2) return 0;
    return exerciseProgression[exerciseProgression.length - 1].maxKg - exerciseProgression[0].maxKg;
  })();

  // Rest/training days last 30
  const restData = (() => {
    const trainDates = new Set(filtered.map((s) => s.date));
    return Array.from({ length: 30 }, (_, i) => {
      const d = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd');
      return {
        label: format(parseISO(d), 'dd', { locale: it }),
        value: trainDates.has(d) ? 1 : 0,
      };
    });
  })();

  const trainDaysLast30 = restData.filter((d) => d.value === 1).length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  if (sessions.length === 0) return (
    <div className="container section" style={{ textAlign: 'center' }}>
      <Dumbbell size={40} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
      <h3 style={{ marginBottom: 8 }}>Nessun dato ancora</h3>
      <p style={{ color: 'var(--text-secondary)' }}>Completa qualche allenamento per vedere le analisi.</p>
    </div>
  );

  return (
    <div className="container section fade-in" style={{ paddingBottom: 60 }}>
      <div style={{ marginBottom: 32 }}>
        <h2>Analytics</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
          Monitora la tua progressione e ottimizza gli allenamenti
        </p>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 28, display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={selectedSchedule}
          onChange={(e) => setSelectedSchedule(e.target.value)}
          className="input"
          style={{ width: 'auto', appearance: 'none', paddingRight: 32, cursor: 'pointer' }}
        >
          <option value="all">Tutte le schede</option>
          {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Key stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {[
          { label: 'Sessioni totali', value: filtered.length, sub: 'allenamenti' },
          { label: 'Giorni attivi / 30', value: `${trainDaysLast30}/30`, sub: 'ultimi 30gg' },
          {
            label: 'Volume totale',
            value: (() => {
              const v = filtered.reduce((acc, s) => acc + Object.values(s.logs || {}).flatMap((ex) =>
                Object.values(ex).map((set) => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
              ).reduce((a, b) => a + b, 0), 0);
              return v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${Math.round(v)}kg`;
            })(),
            sub: 'kg sollevati',
          },
          {
            label: 'Durata media',
            value: (() => {
              const durations = filtered.filter((s) => s.duration > 0).map((s) => s.duration);
              if (!durations.length) return '—';
              const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
              return `${Math.floor(avg/60)}m`;
            })(),
            sub: 'per sessione',
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="stat-box">
            <div className="stat-label" style={{ marginBottom: 8 }}>{label}</div>
            <div className="stat-value">{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Weekly volume chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 20 }}>Volume settimanale (kg)</h4>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={weeklyData}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT} stopOpacity={0.15} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="volume" stroke={ACCENT} strokeWidth={2} fill="url(#volGrad)" name="Volume kg" dot={{ fill: ACCENT, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Grid: frequency + rest days */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Day of week frequency */}
        <div className="card">
          <h4 style={{ marginBottom: 20 }}>Frequenza per giorno</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="allenamenti" fill={ACCENT} radius={[4,4,0,0]} name="Sessioni" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rest vs train last 30 days */}
        <div className="card">
          <h4 style={{ marginBottom: 16 }}>Allenamento vs riposo (30gg)</h4>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div className="stat-box" style={{ flex: 1, padding: '12px 14px' }}>
              <div className="stat-label">Attivi</div>
              <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>{trainDaysLast30}</div>
            </div>
            <div className="stat-box" style={{ flex: 1, padding: '12px 14px' }}>
              <div className="stat-label">Riposo</div>
              <div className="stat-value" style={{ fontSize: '1.4rem', color: 'var(--text-secondary)' }}>{30 - trainDaysLast30}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {restData.map((d, i) => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: 2,
                background: d.value ? 'var(--accent)' : 'var(--bg-tertiary)',
              }} title={d.label} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 1, background: 'var(--accent)', display: 'inline-block' }} /> Allenamento
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 1, background: 'var(--bg-tertiary)', display: 'inline-block' }} /> Riposo
            </span>
          </div>
        </div>
      </div>

      {/* Exercise progression */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4>Progressione carichi</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>Peso massimo per esercizio nel tempo</p>
          </div>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="input"
            style={{ width: 'auto', maxWidth: 300, fontSize: '0.82rem', appearance: 'none', cursor: 'pointer' }}
          >
            {allExercises.map((ex) => (
              <option key={ex} value={ex}>{ex.length > 50 ? ex.slice(0, 50) + '…' : ex}</option>
            ))}
          </select>
        </div>

        {/* Trend indicator */}
        {exerciseProgression.length >= 2 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="stat-box" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {kgTrend > 0
                ? <TrendingUp size={16} color="var(--success)" />
                : kgTrend < 0
                ? <TrendingDown size={16} color="var(--accent)" />
                : <Minus size={16} color="var(--text-secondary)" />
              }
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: kgTrend > 0 ? 'var(--success)' : kgTrend < 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {kgTrend > 0 ? '+' : ''}{kgTrend.toFixed(1)} kg
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>dall'inizio</span>
            </div>
            <div className="stat-box" style={{ padding: '10px 16px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Max: </span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {Math.max(...exerciseProgression.map((p) => p.maxKg))} kg
              </span>
            </div>
          </div>
        )}

        {exerciseProgression.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            <Weight size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ fontSize: '0.875rem' }}>Nessun dato per questo esercizio</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={exerciseProgression}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="maxKg" stroke={ACCENT} strokeWidth={2.5}
                dot={{ fill: ACCENT, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                name="Max kg" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sessions log */}
      <div style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 16 }}>Storico sessioni</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.slice(0, 20).map((s) => {
            const vol = Object.values(s.logs || {}).flatMap((ex) =>
              Object.values(ex).map((set) => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
            ).reduce((a, b) => a + b, 0);
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-muted)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)',
                }}>
                  {s.dayLabel?.split(' ')[1]}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{s.dayLabel} · Sett. {s.week}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
                    {format(parseISO(s.date), 'd MMM yyyy', { locale: it })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {s.completedSets}/{s.totalSets} serie
                  </span>
                  {vol > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>
                    {Math.round(vol)} kg
                  </span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
