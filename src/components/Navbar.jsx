// src/components/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTrades } from '../hooks/useTrades';
import { signOut } from '../lib/supabase';

const NAV = [
  { to: '/home',        label: 'Home',       icon: '🏠' },
  { to: '/scan',       label: 'Scan',       icon: '📷' },
  { to: '/collection', label: 'Collection', icon: '📚' },
  { to: '/my-pokedex', label: 'Pokédex',    icon: '📖' },
  { to: '/find',       label: 'Find',       icon: '🔍' },
  { to: '/wishlist',   label: 'Wishlist',   icon: '⭐' },
  { to: '/trades',     label: 'Trades',     icon: '⇄'  },
  { to: '/community',  label: 'Community',  icon: '👥' },
];

export default function Navbar() {
  const { profile }    = useAuth();
  const { incoming = [] } = useTrades();
  const { pathname }   = useLocation();

  // Mobile bottom nav shows 5 most important items
  const mobileNav = [
    { to: '/home',        label: 'Home',    icon: '🏠' },
    { to: '/scan',       label: 'Scan',    icon: '📷' },
    { to: '/my-pokedex', label: 'Pokédex', icon: '📖' },
    { to: '/wishlist',   label: 'Wishlist',icon: '⭐' },
    { to: '/trades',     label: 'Trades',  icon: '⇄', badge: incoming.length },
  ];

  return (
    <>
      {/* ─── Desktop top navbar ─── */}
      <nav className="navbar">
        <Link to="/home" className="navbar-brand">
          <span className="brand-icon">⚡</span>
          Scanachu
        </Link>
        <div className="navbar-links">
          {NAV.map(({ to, label, icon }) => {
            const badge = to === '/trades' ? incoming.length : 0;
            return (
              <Link key={to} to={to} className={`nav-link ${pathname === to ? 'active' : ''}`}>
                {label}
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </Link>
            );
          })}
        </div>
        <div className="navbar-user">
          <Link to="/account" className="nav-avatar">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={profile.username} />
              : <div className="avatar-initials">{(profile?.display_name || profile?.username || '?')[0].toUpperCase()}</div>
            }
          </Link>
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </nav>

      {/* ─── Mobile bottom navbar ─── */}
      <nav className="mobile-nav">
        {mobileNav.map(({ to, label, icon, badge }) => (
          <Link key={to} to={to} className={`mobile-nav-item ${pathname === to ? 'active' : ''}`}>
            <span className="mobile-nav-icon">
              {icon}
              {badge > 0 && <span className="mobile-nav-badge">{badge}</span>}
            </span>
            <span className="mobile-nav-label">{label}</span>
          </Link>
        ))}

        {/* More menu for the rest */}
        <MobileMore pathname={pathname} incoming={incoming} />
      </nav>
    </>
  );
}

function MobileMore({ pathname, incoming }) {
  const moreItems = [
    { to: '/collection', label: 'Collection', icon: '📚' },
    { to: '/find',       label: 'Find',       icon: '🔍' },
    { to: '/community',  label: 'Community',  icon: '👥' },
    { to: '/account',    label: 'Account',    icon: '⚙️' },
  ];

  const moreActive = moreItems.some(i => i.to === pathname);

  return (
    <div className={`mobile-nav-item mobile-nav-more ${moreActive ? 'active' : ''}`}>
      <span className="mobile-nav-icon">⋯</span>
      <span className="mobile-nav-label">More</span>
      <div className="mobile-more-menu">
        {moreItems.map(({ to, label, icon }) => (
          <Link key={to} to={to} className={`mobile-more-item ${pathname === to ? 'active' : ''}`}>
            <span>{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
        <button className="mobile-more-signout" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}
