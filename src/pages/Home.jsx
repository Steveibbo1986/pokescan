// src/pages/Home.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { useTrades } from '../hooks/useTrades';

export default function Home() {
  const { profile } = useAuth();
  const { cards, bySet } = useCollection();
  const { incoming } = useTrades();

  return (
    <div className="page-container">
      <div className="home-hero">
        <h1>Hey, {profile?.display_name || profile?.username}!</h1>
        <p>Your Pokémon collection at a glance</p>
      </div>

      <div className="stats-grid">
        <Link to="/collection" className="stat-card">
          <div className="stat-number">{cards.length}</div>
          <div className="stat-label">Cards collected</div>
        </Link>
        <Link to="/collection" className="stat-card">
          <div className="stat-number">{Object.keys(bySet).length}</div>
          <div className="stat-label">Sets represented</div>
        </Link>
        <Link to="/collection" className="stat-card">
          <div className="stat-number">{cards.filter(c => c.is_tradeable).length}</div>
          <div className="stat-label">Available to trade</div>
        </Link>
        {incoming.length > 0 && (
          <Link to="/trades" className="stat-card stat-card--alert">
            <div className="stat-number">{incoming.length}</div>
            <div className="stat-label">Trade offer{incoming.length !== 1 ? 's' : ''} waiting</div>
          </Link>
        )}
      </div>

      <div className="quick-actions">
        <Link to="/scan" className="quick-action">
          <div className="qa-icon">⬡</div>
          <span>Scan cards</span>
        </Link>
        <Link to="/wishlist" className="quick-action">
          <div className="qa-icon">◇</div>
          <span>Wishlist</span>
        </Link>
        <Link to="/trades" className="quick-action">
          <div className="qa-icon">⇄</div>
          <span>Trades</span>
        </Link>
        <Link to="/community" className="quick-action">
          <div className="qa-icon">◉</div>
          <span>Community</span>
        </Link>
      </div>

      {cards.length > 0 && (
        <div className="recent-section">
          <div className="section-header">
            <h2>Recently added</h2>
            <Link to="/collection" className="link-sm">View all</Link>
          </div>
          <div className="recent-cards">
            {cards.slice(0, 6).map(card => (
              <div key={card.id} className="recent-card-tile">
                {card.image_url && <img src={card.image_url} alt={card.card_name} />}
                <span>{card.card_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
