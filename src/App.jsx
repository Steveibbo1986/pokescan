// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Scan from './pages/Scan';
import Collection from './pages/Collection';
import MyPokedex from './pages/MyPokedex';
import Find from './pages/Find';
import Wishlist from './pages/Wishlist';
import Trades from './pages/Trades';
import Community from './pages/Community';
import Account from './pages/Account';

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading fullscreen">Loading...</div>;
  if (!user)   return <Navigate to="/" replace />;
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
      {/* Public routes */}
      <Route path="/"     element={user ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />

      {/* Protected routes */}
      <Route path="/home"       element={<ProtectedLayout><Home /></ProtectedLayout>} />
      <Route path="/scan"       element={<ProtectedLayout><Scan /></ProtectedLayout>} />
      <Route path="/collection" element={<ProtectedLayout><Collection /></ProtectedLayout>} />
      <Route path="/my-pokedex" element={<ProtectedLayout><MyPokedex /></ProtectedLayout>} />
      <Route path="/find"       element={<ProtectedLayout><Find /></ProtectedLayout>} />
      <Route path="/wishlist"   element={<ProtectedLayout><Wishlist /></ProtectedLayout>} />
      <Route path="/trades"     element={<ProtectedLayout><Trades /></ProtectedLayout>} />
      <Route path="/community"  element={<ProtectedLayout><Community /></ProtectedLayout>} />
      <Route path="/account"    element={<ProtectedLayout><Account /></ProtectedLayout>} />
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
