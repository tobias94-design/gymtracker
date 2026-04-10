import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { parseWorkoutExcel } from '../utils/excelParser';
import { saveSchedule, getSchedules, deleteSchedule } from '../utils/db';
import { Upload, Trash2, ChevronRight, Calendar, Dumbbell, CheckCircle } from 'lucide-react';
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
    try {
      const data = await getSchedules(user.uid);
      setSchedules(data);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file) => {
    if (!file?.name.endsWith('.xlsx') && !file?.name.endsWith('.xls')) {
      setError('Carica un file Excel (.xlsx)');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const schedule = await parseWorkoutExcel(file);
      schedule.name = file.name.replace(/\.[^.]+$/, '');
      await saveSchedule(user.uid, schedule);
      setSuccess(`Scheda "${schedule.name}" caricata con successo!`);
      await fetchSchedules();
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      setError('Errore nel parsing del file: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Eliminare la scheda "${name}"?`)) return;
    await deleteSchedule(user.uid, id);
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="container section fade-in">
      <div style={{ marginBottom: 32 }}>
        <h2>Le mie schede</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
          Carica la tua scheda Excel e inizia ad allenarti
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-xl)',
          padding: '48px 32px',
          textAlign: 'center',
          background: drag ? 'var(--accent-muted)' : 'var(--bg-secondary)',
          transition: 'all 0.2s',
          cursor: 'pointer',
          marginBottom: 32,
        }}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div style={{
          width: 56, height: 56,
          background: drag ? 'var(--accent)' : 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          transition: 'all 0.2s',
        }}>
          {uploading
            ? <div className="spinner" />
            : <Upload size={24} color={drag ? 'white' : 'var(--text-secondary)'} />
          }
        </div>
        <h4 style={{ marginBottom: 8 }}>
          {uploading ? 'Caricamento in corso...' : 'Trascina il tuo Excel qui'}
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          o clicca per selezionare un file .xlsx
        </p>

        {/* Format hint */}
        <div style={{
          marginTop: 24, padding: '12px 16px',
          background: 'var(--bg)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)', display: 'inline-block', textAlign: 'left',
        }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 500 }}>
            FORMATO ATTESO
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            SETTIMANA 1 | SETTIMANA 2 | SETTIMANA 3 | SETTIMANA 4
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            ESERCIZIO | SERIE | RIPETIZIONI | RECUPERO | KG
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent-muted)', border: '1px solid var(--accent-muted-border)',
          color: 'var(--accent)', marginBottom: 20, fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)',
          color: 'var(--success)', marginBottom: 20, fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Schedules list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : schedules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <Dumbbell size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>Nessuna scheda caricata</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schedules.map((s) => (
            <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'var(--accent-muted)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Dumbbell size={20} color="var(--accent)" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ marginBottom: 4 }}>{s.name || 'Scheda senza nome'}</h4>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} /> {s.weeks ?? 4} settimane
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Dumbbell size={12} /> {s.days?.length ?? 0} giorni
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/workout?schedule=${s.id}`)}
                >
                  Allena <ChevronRight size={14} />
                </button>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={() => handleDelete(s.id, s.name)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
