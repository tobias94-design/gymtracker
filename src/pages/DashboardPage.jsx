import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessions, getSchedules } from '../utils/db';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Flame, Calendar, TrendingUp, ChevronRight, Clock, Target } from 'lucide-react';
import { format, parseISO, subDays, isToday, isYesterday } from 'date-fns';
import { it } from 'date-fns/locale';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSessions(user.uid), getSchedules(user.uid)])
      .then(([sess, sched]) => { setSessions(sess); setSchedules(sched); })
      .finally(() => setLoading(false));
  }, []);

  // Compute stats
  const last7 = sessions.filter((s) => {
    const d = parseISO(s.date);
    return d >= subDays(new Date(), 7);
  });

  const streak = (() => {
    const dates = [...new Set(sessions.map((s) => s.date))].sort().reverse();
    let count = 0;
    let check = new Date();
    for (const d of dates) {
      const sd = parseISO(d);
      const diff = Math.floor((check - sd) / 86400000);
      if (diff <= 1) { count++; check = sd; } else break;
    }
    return count;
  })();

  const totalVolume = sessions.reduce((acc, s) => {
    if (!s.logs) return acc;
    return acc + Object.values(s.logs).flatMap((ex) =>
      Object.values(ex).map((set) => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
    ).reduce((a, b) => a + b, 0);
  }, 0);

  const labelDate = (d) => {
    const parsed = parseISO(d);
    if (isToday(parsed)) return 'Oggi';
    if (isYesterday(parsed)) return 'Ieri';
    return format(parsed, 'd MMM', { locale: it });
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  const firstName = (user.displayName || user.email)?.split(/[@\s]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <div className="container section fade-in" style={{ paddingBottom: 60 }}>

      {/* Greeting */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 4 }}>{greeting}</p>
        <h2>{firstName} 👋</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
          {sessions.length === 0
            ? 'Inizia caricando la tua prima scheda.'
            : `${sessions.length} allenamenti completati. Continua così.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {[
          { label: 'Streak', value: streak, unit: 'giorni', icon: Flame, color: '#ff9f0a' },
          { label: 'Questa settimana', value: last7.length, unit: 'sessioni', icon: Calendar, color: 'var(--accent)' },
          { label: 'Totale sessioni', value: sessions.length, unit: 'totali', icon: Dumbbell, color: 'var(--success)' },
          { label: 'Volume totale', value: totalVolume >= 1000 ? `${(totalVolume/1000).toFixed(1)}t` : `${Math.round(totalVolume)}`, unit: 'kg sollevati', icon: TrendingUp, color: '#5e5ce6' },
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <div key={label} className="stat-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span className="stat-label">{label}</span>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="stat-value" style={{ color }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{unit}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Inizia ad allenarti</h3>
        {schedules.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <Dumbbell size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Nessuna scheda caricata</p>
            <button className="btn btn-primary" onClick={() => navigate('/schedules')}>
              Carica scheda Excel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schedules.slice(0, 3).map((s) => (
              <div key={s.id} className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                onClick={() => navigate(`/workout?schedule=${s.id}`)}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-muted)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Dumbbell size={18} color="var(--accent)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {s.days?.length} giorni · {s.weeks} settimane
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Sessioni recenti</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analytics')}>
              Vedi tutto <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.slice(0, 5).map((s) => {
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
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-muted)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)',
                  }}>
                    {s.dayLabel?.split(' ')[1]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      {s.scheduleName} · {s.dayLabel}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Settimana {s.week} · {labelDate(s.date)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {s.duration > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <Clock size={11} /> {Math.floor(s.duration/60)}m
                      </div>
                    )}
                    {vol > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {Math.round(vol)} kg vol.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap cal mini */}
      {sessions.length > 0 && <WorkoutHeatmap sessions={sessions} />}
    </div>
  );
}

function WorkoutHeatmap({ sessions }) {
  const dates = new Set(sessions.map((s) => s.date));
  const days = Array.from({ length: 84 }, (_, i) => {
    const d = subDays(new Date(), 83 - i);
    return format(d, 'yyyy-MM-dd');
  });

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ marginBottom: 16 }}>Attività — ultimi 3 mesi</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {days.map((d) => {
          const count = sessions.filter((s) => s.date === d).length;
          return (
            <div key={d} title={d} style={{
              width: 12, height: 12, borderRadius: 2,
              background: count > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
              opacity: count > 0 ? Math.min(0.4 + count * 0.4, 1) : 1,
              transition: 'background 0.2s',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Meno</span>
        {[0.15, 0.4, 0.65, 1].map((o, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(255,59,48,${o})` }} />
        ))}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Più</span>
      </div>
    </div>
  );
}
