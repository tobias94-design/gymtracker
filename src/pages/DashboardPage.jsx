import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessions, getSchedules } from '../utils/db';
import { useNavigate } from 'react-router-dom';
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

  const last7 = sessions.filter(s => parseISO(s.date) >= subDays(new Date(), 7));
  const streak = (() => {
    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
    let count = 0, check = new Date();
    for (const d of dates) {
      const sd = parseISO(d);
      if (Math.floor((check - sd) / 86400000) <= 1) { count++; check = sd; } else break;
    }
    return count;
  })();
  const totalVolume = sessions.reduce((acc, s) => acc + Object.values(s.logs || {}).flatMap(ex =>
    Object.values(ex).map(set => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
  ).reduce((a, b) => a + b, 0), 0);

  const labelDate = d => {
    const p = parseISO(d);
    if (isToday(p)) return 'Oggi';
    if (isYesterday(p)) return 'Ieri';
    return format(p, 'd MMM', { locale: it });
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      <div className="spinner" />
    </div>
  );

  const firstName = (user.displayName || user.email)?.split(/[@\s]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'BUONGIORNO' : hour < 18 ? 'BUON POMERIGGIO' : 'BUONASERA';

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Hero section */}
      <div style={{
        background: 'linear-gradient(135deg, var(--surface-container-low) 0%, var(--background) 100%)',
        borderBottom: '1px solid rgba(68,72,79,0.2)',
        padding: '40px 0 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: '40%', height: '100%',
          background: 'radial-gradient(ellipse at right, rgba(0,210,253,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="container">
          <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 8 }}>{greeting}, ATLETA</p>
          <h1 style={{ color: 'var(--on-surface)', marginBottom: 8 }}>{firstName}</h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>
            {sessions.length === 0 ? 'Carica la tua prima scheda per iniziare.' : `${sessions.length} sessioni registrate nel Performance Lab.`}
          </p>
        </div>
      </div>

      <div className="container section fade-in">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 36 }}>
          {[
            { label: 'Streak', value: streak, unit: 'giorni', icon: 'local_fire_department', color: 'var(--tertiary)' },
            { label: 'Questa settimana', value: last7.length, unit: 'sessioni', icon: 'calendar_today', color: 'var(--secondary)' },
            { label: 'Totale sessioni', value: sessions.length, unit: 'completate', icon: 'fitness_center', color: 'var(--primary)' },
            {
              label: 'Volume totale',
              value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}t` : `${Math.round(totalVolume)}`,
              unit: 'kg sollevati', icon: 'monitoring', color: 'var(--primary-dim)',
            },
          ].map(({ label, value, unit, icon, color }) => (
            <div key={label} className="stat-box" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: -10, right: -10,
                width: 60, height: 60,
                background: `radial-gradient(ellipse, ${color}15 0%, transparent 70%)`,
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span className="stat-label">{label}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color }}>{icon}</span>
              </div>
              <div className="stat-value" style={{ color }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--outline)', marginTop: 4, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{unit}</div>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p className="label-xs" style={{ color: 'var(--secondary)' }}>SCHEDE ATTIVE</p>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/schedules')}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              Importa
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--surface-container-low)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--outline)', marginBottom: 12, display: 'block' }}>upload_file</span>
              <p style={{ color: 'var(--on-surface-variant)', marginBottom: 20, fontSize: '0.875rem' }}>Nessuna scheda importata</p>
              <button className="btn btn-primary" onClick={() => navigate('/schedules')}>IMPORTA EXCEL</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schedules.slice(0, 3).map(s => (
                <div key={s.id} className="card accent-line"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => navigate(`/workout?schedule=${s.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-container-high)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-container)'}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                    background: 'rgba(0,210,253,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--secondary)' }}>fitness_center</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-headline)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 2 }}>
                      <span className="label-xs" style={{ color: 'var(--outline)' }}>{s.days?.length} giorni</span>
                      <span style={{ margin: '0 6px', color: 'var(--outline-variant)' }}>·</span>
                      <span className="label-xs" style={{ color: 'var(--outline)' }}>{s.weeks} settimane</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--outline)' }}>chevron_right</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p className="label-xs" style={{ color: 'var(--secondary)' }}>SESSIONI RECENTI</p>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analytics')}>
                Vedi tutto <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.slice(0, 5).map(s => {
                const vol = Object.values(s.logs || {}).flatMap(ex =>
                  Object.values(ex).map(set => (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0))
                ).reduce((a, b) => a + b, 0);
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', background: 'var(--surface-container-low)',
                    borderRadius: 'var(--radius-xl)',
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 'var(--radius-lg)',
                      background: 'rgba(161,255,194,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
                      fontFamily: 'var(--font-headline)',
                    }}>
                      {s.dayLabel?.split(' ')[1]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.dayLabel} · Sett. {s.week}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: 1 }}>
                        {s.scheduleName} · {labelDate(s.date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {s.duration > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{Math.floor(s.duration / 60)}m</div>
                      )}
                      {vol > 0 && <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 700 }}>{Math.round(vol)}kg</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Heatmap */}
        {sessions.length > 0 && <WorkoutHeatmap sessions={sessions} />}
      </div>
    </div>
  );
}

function WorkoutHeatmap({ sessions }) {
  const days = Array.from({ length: 84 }, (_, i) => format(subDays(new Date(), 83 - i), 'yyyy-MM-dd'));
  return (
    <div>
      <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 16 }}>ATTIVITÀ — ULTIMI 3 MESI</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {days.map(d => {
          const count = sessions.filter(s => s.date === d).length;
          return (
            <div key={d} title={d} style={{
              width: 12, height: 12, borderRadius: 2,
              background: count > 0 ? 'var(--primary)' : 'var(--surface-container)',
              opacity: count > 0 ? Math.min(0.3 + count * 0.4, 1) : 1,
              boxShadow: count > 0 ? '0 0 4px rgba(161,255,194,0.3)' : 'none',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--outline)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Meno</span>
        {[0.2, 0.45, 0.7, 1].map((o, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: `rgba(161,255,194,${o})` }} />
        ))}
        <span style={{ fontSize: '0.65rem', color: 'var(--outline)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Più</span>
      </div>
    </div>
  );
}
