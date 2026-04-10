import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkoutPage from './pages/WorkoutPage';
import SchedulesPage from './pages/SchedulesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import './index.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const [theme, setTheme] = useState(() => localStorage.getItem('gt-theme') || 'light');

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('gt-theme', next);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const withNav = (Page) => (
    <PrivateRoute>
      <>
        <Navbar theme={theme} onToggleTheme={toggleTheme} />
        <main style={{ flex: 1 }}>
          <Page />
        </main>
      </>
    </PrivateRoute>
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={withNav(DashboardPage)} />
      <Route path="/workout" element={withNav(WorkoutPage)} />
      <Route path="/schedules" element={withNav(SchedulesPage)} />
      <Route path="/analytics" element={withNav(AnalyticsPage)} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
