// src/components/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTrades } from '../hooks/useTrades';
import { signOut } from '../lib/supabase';

export default function Navbar() {
  const { profile } = useAuth();
  const { incoming = [] } = useTrades();
  const { pathname } = useLocation();

  const nav = [
    { to: '/',           label: 'Home'       },
    { to: '/scan',       label: 'Scan'       },
    { to: '/collection', label: 'Collection' },
    { to: '/pokedex',    label: 'Pokédex'    },
    { to: '/wishlist',   label: 'Wishlist'   },
    { to: '/trades',     label: 'Trades', badge: incoming.length },
    { to: '/community',  label: 'Community'  },
  ];

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">◈</span>
        PokéScan
      </Link>

      <div className="navbar-links">
        {nav.map(({ to, label, badge }) => (
          <Link
            key={to}
            to={to}
            className={`nav-link ${pathname === to ? 'active' : ''}`}
          >
            {label}
            {badge > 0 && <span className="nav-badge">{badge}</span>}
          </Link>
        ))}
      </div>

      <div className="navbar-user">
        <Link to="/profile" className="nav-avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} />
          ) : (
            <div className="avatar-initials">
              {(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
            </div>
          )}
        </Link>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  );
}
