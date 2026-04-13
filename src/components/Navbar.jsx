import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/workout', icon: 'fitness_center', label: 'Workout' },
  { to: '/schedules', icon: 'upload_file', label: 'Import' },
  { to: '/analytics', icon: 'query_stats', label: 'Analytics' },
];

export default function Navbar({ theme, onToggleTheme }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 100,
        background: 'rgba(10,14,20,0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(68,72,79,0.2)',
        padding: '0 24px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 22 }}>monitoring</span>
          <span style={{
            fontFamily: 'var(--font-headline)', fontWeight: 700,
            fontSize: '1.1rem', color: 'var(--primary)', letterSpacing: '-0.02em',
          }}>KINETIC</span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', gap: 4 }} className="desktop-nav">
          {navItems.map(({ to, icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 'var(--radius-lg)',
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontSize: '0.72rem', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
                background: active ? 'rgba(161,255,194,0.08)' : 'transparent',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon" onClick={onToggleTheme} style={{ color: 'var(--on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          {user && (
            <>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-container), var(--primary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--on-primary-fixed)', fontSize: '0.78rem', fontWeight: 700,
                fontFamily: 'var(--font-headline)',
              }}>
                {(user.displayName || user.email)?.[0]?.toUpperCase()}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={handleLogout} title="Logout">
                <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--on-surface-variant)' }}>logout</span>
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-icon mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99,
          background: 'rgba(15,20,26,0.98)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(68,72,79,0.2)',
          padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {navItems.map(({ to, icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} onClick={() => setMenuOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', borderRadius: 'var(--radius-xl)',
                textDecoration: 'none',
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
                color: active ? 'var(--primary)' : 'var(--on-surface)',
                background: active ? 'rgba(161,255,194,0.08)' : 'transparent',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? 'var(--primary)' : 'var(--secondary)' }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '10px 8px 20px',
        background: 'rgba(10,14,20,0.9)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(68,72,79,0.2)',
      }} className="mobile-bottom-nav">
        {navItems.map(({ to, icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              textDecoration: 'none', padding: '4px 12px',
              color: active ? 'var(--primary)' : 'var(--on-surface-variant)',
              filter: active ? 'drop-shadow(0 0 8px rgba(161,255,194,0.4))' : 'none',
              transform: active ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{icon}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
          .mobile-bottom-nav { display: none !important; }
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
