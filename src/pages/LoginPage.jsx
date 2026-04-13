import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Email non trovata.',
        'auth/wrong-password': 'Password errata.',
        'auth/email-already-in-use': 'Email già registrata.',
        'auth/weak-password': 'Password troppo debole (min 6 caratteri).',
        'auth/invalid-email': 'Email non valida.',
        'auth/invalid-credential': 'Credenziali non valide.',
      };
      setError(msgs[err.code] || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--background)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background gradient mesh */}
      <div style={{
        position: 'fixed', top: '-30%', left: '-20%',
        width: '60%', height: '60%',
        background: 'radial-gradient(ellipse, rgba(0,210,253,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-20%', right: '-10%',
        width: '50%', height: '50%',
        background: 'radial-gradient(ellipse, rgba(161,255,194,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ marginBottom: 20 }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 48, color: 'var(--primary)',
              filter: 'drop-shadow(0 0 16px rgba(161,255,194,0.4))',
            }}>monitoring</span>
          </div>
          <h1 style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>
            KINETIC
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.72rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Performance Intelligence Lab
          </p>
        </div>

        {/* Card */}
        <div className="card-elevated">
          <div style={{ marginBottom: 24 }}>
            <p className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 8 }}>
              {mode === 'login' ? 'ACCESS PROTOCOL' : 'REGISTER ATHLETE'}
            </p>
            <h2 style={{ fontSize: '1.3rem' }}>
              {mode === 'login' ? 'Accedi al Lab' : 'Crea Account'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div>
                <label className="label-xs" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: 6 }}>Nome Atleta</label>
                <input className="input" type="text" placeholder="Tobia" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label-xs" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: 6 }}>Email</label>
              <input className="input" type="email" placeholder="tobia@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="label-xs" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--outline)',
                  display: 'flex', alignItems: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-lg)',
                background: 'rgba(255,113,108,0.1)', border: '1px solid rgba(255,113,108,0.2)',
                color: 'var(--error)', fontSize: '0.82rem',
              }}>{error}</div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? <div className="spinner" style={{ borderTopColor: 'var(--on-primary-fixed)' }} /> : null}
              {loading ? 'Caricamento...' : mode === 'login' ? 'ACCEDI' : 'REGISTRATI'}
            </button>
          </form>

          <div className="divider" style={{ margin: '20px 0' }} />

          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
            {mode === 'login' ? 'Nuovo atleta? ' : 'Hai già un account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
              {mode === 'login' ? 'Registrati' : 'Accedi'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
