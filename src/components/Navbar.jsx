// src/components/Navbar.jsx
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTrades } from '../hooks/useTrades';
import { signOut } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { useCoins } from '../hooks/useCoins';

const NAV = [
  { to: '/home',       label: 'Home',       icon: '🏠' },
  { to: '/scan',       label: 'Scan',       icon: '📷' },
  { to: '/collection', label: 'Collection', icon: '📚' },
  { to: '/my-pokedex', label: 'My Pokédex', icon: '📖' },
  { to: '/find',       label: 'Find',       icon: '🔍' },
  { to: '/wishlist',   label: 'Wishlist',   icon: '⭐' },
  { to: '/trades',     label: 'Trades',     icon: '⇄'  },
  { to: '/community',  label: 'Community',  icon: '👥' },
];

const MOBILE_NAV = [
  { to: '/home',       label: 'Home',    icon: '🏠' },
  { to: '/scan',       label: 'Scan',    icon: '📷' },
  { to: '/my-pokedex', label: 'Pokédex', icon: '📖' },
  { to: '/wishlist',   label: 'Wishlist',icon: '⭐' },
  { to: '/trades',     label: 'Trades',  icon: '⇄'  },
];

export default function Navbar() {
  const { profile, user }       = useAuth();
  const { incoming = [] } = useTrades();
  const { pathname }      = useLocation();
  const { theme, toggle } = useTheme();
  const { coins }         = useCoins();

  return (
    <>
      {/* Desktop */}
      <nav className="navbar">
        <Link to="/home" className="navbar-brand">
          <span className="brand-icon">⚡</span>
          Scanachu
        </Link>

        <div className="navbar-links">
          {NAV.map(({ to, label }) => {
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
          {/* Coin balance */}
          <Link to="/shop" className="nav-coins" title="Scana-bucks — visit shop">
            <span className="nav-coins-icon">⚡</span>
            <span className="nav-coins-amount">{coins.toLocaleString()}</span>
          </Link>
          {/* Theme toggle */}
          <button className="theme-toggle" onClick={toggle} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <Link to="/account" className="nav-avatar">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={profile.username} />
              : <div className="avatar-initials">{(profile?.display_name || profile?.username || '?')[0].toUpperCase()}</div>
            }
          </Link>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {MOBILE_NAV.map(({ to, label, icon }) => {
          const badge = to === '/trades' ? incoming.length : 0;
          return (
            <Link key={to} to={to} className={`mobile-nav-item ${pathname === to ? 'active' : ''}`}>
              <span className="mobile-nav-icon">
                {icon}
                {badge > 0 && <span className="mobile-nav-badge">{badge}</span>}
              </span>
              <span className="mobile-nav-label">{label}</span>
            </Link>
          );
        })}
        <MobileMore pathname={pathname} toggle={toggle} theme={theme} />
      </nav>
    </>
  );
}

function MobileMore({ pathname, toggle, theme }) {
  const moreItems = [
    { to: '/collection',   label: 'Collection',   icon: '📚' },
    { to: '/find',         label: 'Find',         icon: '🔍' },
    { to: '/community',    label: 'Community',    icon: '👥' },
    { to: '/badges', label: 'Badges', icon: '🏆' },
    { to: '/analytics',    label: 'Analytics',    icon: '📊' },
    { to: '/account',      label: 'Account',      icon: '⚙️' },
  ];
  const moreActive = moreItems.some(i => i.to === pathname);
  return (
    <div className={`mobile-nav-item mobile-nav-more ${moreActive ? 'active' : ''}`}>
      <span className="mobile-nav-icon">⋯</span>
      <span className="mobile-nav-label">More</span>
      <div className="mobile-more-menu">
        {moreItems.map(({ to, label, icon }) => (
          <Link key={to} to={to} className={`mobile-more-item ${pathname === to ? 'active' : ''}`}>
            <span>{icon}</span><span>{label}</span>
          </Link>
        ))}
        <button className="mobile-more-item" style={{width:'100%',textAlign:'left',cursor:'pointer',border:'none',background:'none',fontFamily:'inherit',fontSize:'inherit'}} onClick={toggle}>
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
        <button className="mobile-more-signout" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}
