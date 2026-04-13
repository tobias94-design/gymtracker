import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseWorkoutExcel } from '../utils/excelParser';
import { saveSchedule, getSchedules, deleteSchedule } from '../utils/db';
import { useNavigate } from 'react-router-dom';

export default function SchedulesPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchSchedules(); }, []);

  const fetchSchedules = async () => {
    try { const data = await getSchedules(user.uid); setSchedules(data); }
    finally { setLoading(false); }
  };

  const handleFile = async (file) => {
    if (!file?.name.match(/\.(xlsx|xls)$/i)) { setError('Carica un file Excel (.xlsx)'); return; }
    setUploading(true); setError('');
    try {
      const schedule = await parseWorkoutExcel(file);
      schedule.name = file.name.replace(/\.[^.]+$/, '');
      await saveSchedule(user.uid, schedule);
      setSuccess(`Scheda "${schedule.name}" importata con successo.`);
      await fetchSchedules();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) { setError('Errore nel parsing: ' + e.message); }
    finally { setUploading(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); };
  const handleDelete = async (id, name) => {
    if (!confirm(`Eliminare "${name}"?`)) return;
    await deleteSchedule(user.uid, id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface-container-low)',
        borderBottom: '1px solid rgba(68,72,79,0.2)',
        padding: '40px 0 28px',
      }}>
        <div className="container">
          <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 8 }}>DATA INGESTION MODULE</p>
          <h1>Importa Scheda</h1>
          <p style={{ color: 'var(--on-surface-variant)', marginTop: 8, fontSize: '0.875rem' }}>
            Carica il tuo Excel e il sistema parserà automaticamente la struttura.
          </p>
        </div>
      </div>

      <div className="container section fade-in">
        {/* Upload zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input').click()}
          style={{
            border: `2px dashed ${drag ? 'var(--primary)' : 'rgba(68,72,79,0.4)'}`,
            borderRadius: 'var(--radius-xl)',
            padding: '56px 32px',
            textAlign: 'center',
            background: drag ? 'rgba(161,255,194,0.04)' : 'var(--surface-container-low)',
            transition: 'all 0.2s',
            cursor: 'pointer',
            marginBottom: 32,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <input id="file-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: drag ? 'radial-gradient(ellipse at center, rgba(161,255,194,0.06) 0%, transparent 70%)' : 'none',
            pointerEvents: 'none',
          }} />

          <span className="material-symbols-outlined" style={{
            fontSize: 52, color: drag ? 'var(--primary)' : 'var(--secondary)',
            display: 'block', marginBottom: 16,
            filter: drag ? 'drop-shadow(0 0 12px rgba(161,255,194,0.4))' : 'none',
            transition: 'all 0.2s',
          }}>
            {uploading ? 'sync' : 'upload_file'}
          </span>

          <h3 style={{ marginBottom: 8, color: 'var(--on-surface)' }}>
            {uploading ? 'PARSING IN CORSO...' : 'DRAG & DROP SOURCE FILE'}
          </h3>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.82rem', marginBottom: 24 }}>
            Supporta .XLSX — formato scheda allenamento
          </p>

          {!uploading && (
            <button className="btn btn-secondary" onClick={e => e.stopPropagation()}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
              SELEZIONA FILE
            </button>
          )}
          {uploading && <div className="spinner" style={{ margin: '0 auto' }} />}

          {/* Format hint */}
          <div style={{
            marginTop: 28, padding: '12px 16px',
            background: 'var(--surface-container)',
            borderRadius: 'var(--radius-lg)',
            display: 'inline-block', textAlign: 'left',
          }}>
            <p className="label-xs" style={{ color: 'var(--outline)', marginBottom: 6 }}>SCHEMA ATTESO</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
              SETTIMANA 1 | SETTIMANA 2 | SETTIMANA 3 | SETTIMANA 4
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>
              ESERCIZIO | SERIE | RIPETIZIONI | RECUPERO | KG
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius-lg)',
            background: 'rgba(255,113,108,0.08)', border: '1px solid rgba(255,113,108,0.2)',
            color: 'var(--error)', marginBottom: 20, fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius-lg)',
            background: 'rgba(161,255,194,0.08)', border: '1px solid rgba(161,255,194,0.2)',
            color: 'var(--primary)', marginBottom: 20, fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            {success}
          </div>
        )}

        {/* Schedules list */}
        <div>
          <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 16 }}>SCHEDE IMPORTATE</p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : schedules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.3 }}>inbox</span>
              <p style={{ fontSize: '0.875rem' }}>Nessuna scheda importata</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {schedules.map(s => (
                <div key={s.id} className="card accent-line" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-lg)',
                    background: 'rgba(0,210,253,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--secondary)' }}>fitness_center</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name || 'Scheda'}</h4>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span className="label-xs" style={{ color: 'var(--outline)' }}>{s.weeks ?? 4} settimane</span>
                      <span className="label-xs" style={{ color: 'var(--outline)' }}>{s.days?.length ?? 0} giorni</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/workout?schedule=${s.id}`)}>
                      ALLENA
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(s.id, s.name)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
