// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Scan from './pages/Scan';
import Collection from './pages/Collection';
import Wishlist from './pages/Wishlist';
import Trades from './pages/Trades';
import Community from './pages/Community';
import Pokedex from './pages/Pokedex';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading fullscreen">Loading...</div>;
  if (!user)   return <Navigate to="/auth" replace />;
  return (
    <>
      <Navbar />
      <main className="main-content">{children}</main>
    </>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading fullscreen">Loading...</div>;

  return (
    <Routes>
      <Route path="/auth"       element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/"           element={<ProtectedLayout><Home /></ProtectedLayout>} />
      <Route path="/scan"       element={<ProtectedLayout><Scan /></ProtectedLayout>} />
      <Route path="/collection" element={<ProtectedLayout><Collection /></ProtectedLayout>} />
      <Route path="/pokedex"    element={<ProtectedLayout><Pokedex /></ProtectedLayout>} />
      <Route path="/wishlist"   element={<ProtectedLayout><Wishlist /></ProtectedLayout>} />
      <Route path="/trades"     element={<ProtectedLayout><Trades /></ProtectedLayout>} />
      <Route path="/community"  element={<ProtectedLayout><Community /></ProtectedLayout>} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
