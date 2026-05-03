// src/pages/Home.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { useTrades } from '../hooks/useTrades';
import { getWishlist } from '../lib/supabase';

export default function Home() {
  const { profile, user } = useAuth();
  const { cards, bySet } = useCollection();
  const { incoming } = useTrades();
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    if (user) getWishlist(user.id).then(({ data }) => setWishlist(data || []));
  }, [user]);

  const tradeableCount  = cards.filter(c => c.is_tradeable).length;
  const setsCount       = Object.keys(bySet).length;
  const wishlistTotal   = wishlist.reduce((sum, c) => sum + parseFloat(c.market_price_gbp || 0), 0);
  const collectionValue = cards.reduce((sum, c) => sum + parseFloat(c.market_price_gbp || 0), 0);

  const topWishlist = [...wishlist]
    .sort((a, b) => parseFloat(b.market_price_gbp || 0) - parseFloat(a.market_price_gbp || 0))
    .slice(0, 5);

  const setProgress = Object.entries(bySet)
    .map(([setId, { set_name, cards: sc }]) => ({ setId, set_name, owned: sc.length }))
    .sort((a, b) => b.owned - a.owned)
    .slice(0, 4);

  return (
    <div className="page-container">

      {/* Hero */}
      <div className="home-hero">
        <h1>Hey, <span>{profile?.display_name || profile?.username}!</span> ⚡</h1>
        <p>Welcome to Scanachu — your Pokémon card tracker</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Link to="/collection" className="stat-card">
          <div className="stat-number">{cards.length}</div>
          <div className="stat-label">Cards owned</div>
        </Link>
        <Link to="/my-pokedex" className="stat-card">
          <div className="stat-number">{setsCount}</div>
          <div className="stat-label">Sets collected</div>
        </Link>
        <Link to="/wishlist" className="stat-card">
          <div className="stat-number">{wishlist.length}</div>
          <div className="stat-label">On wishlist</div>
        </Link>
        {wishlistTotal > 0 && (
          <Link to="/wishlist" className="stat-card">
            <div className="stat-number">£{wishlistTotal.toFixed(0)}</div>
            <div className="stat-label">Wishlist value</div>
          </Link>
        )}
        {collectionValue > 0 && (
          <Link to="/collection" className="stat-card">
            <div className="stat-number">£{collectionValue.toFixed(0)}</div>
            <div className="stat-label">Collection value</div>
          </Link>
        )}
        <Link to="/collection" className="stat-card">
          <div className="stat-number">{tradeableCount}</div>
          <div className="stat-label">For trade</div>
        </Link>
        {incoming.length > 0 && (
          <Link to="/trades" className="stat-card stat-card--alert">
            <div className="stat-number">{incoming.length}</div>
            <div className="stat-label">Trade offer{incoming.length !== 1 ? 's' : ''}</div>
          </Link>
        )}
      </div>

      {/* Quick actions — all links correct */}
      <div className="quick-actions">
        <Link to="/scan" className="quick-action">
          <span className="qa-icon">📷</span>
          <span>Scan cards</span>
        </Link>
        <Link to="/my-pokedex" className="quick-action">
          <span className="qa-icon">📖</span>
          <span>My Pokédex</span>
        </Link>
        <Link to="/find" className="quick-action">
          <span className="qa-icon">🔍</span>
          <span>Find cards</span>
        </Link>
        <Link to="/wishlist" className="quick-action">
          <span className="qa-icon">⭐</span>
          <span>Wishlist</span>
        </Link>
        <Link to="/trades" className="quick-action">
          <span className="qa-icon">⇄</span>
          <span>Trades</span>
        </Link>
        <Link to="/community" className="quick-action">
          <span className="qa-icon">👥</span>
          <span>Community</span>
        </Link>
      </div>

      {/* Trade alert */}
      {incoming.length > 0 && (
        <Link to="/trades" style={{display:'block',background:'rgba(255,215,0,.08)',border:'1px solid rgba(255,215,0,.3)',borderRadius:'var(--radius)',padding:'16px 20px',marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:600,color:'var(--yellow)'}}>
            ⚡ You have {incoming.length} pending trade offer{incoming.length !== 1 ? 's' : ''}
          </div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:2}}>Tap to review and respond</div>
        </Link>
      )}

      {/* Two-col panels */}
      <div className="home-grid">

        {/* Wishlist panel */}
        <div className="home-panel">
          <div className="home-panel-header">
            <h2>⭐ Top wishlist cards</h2>
            <Link to="/wishlist" className="link-sm">View all</Link>
          </div>
          <div className="home-panel-body">
            {!wishlist.length ? (
              <div className="empty-state" style={{padding:'20px 0'}}>
                No wishlist yet — <Link to="/find" className="link-sm">find some cards</Link>
              </div>
            ) : (
              <>
                {topWishlist.map(card => (
                  <div key={card.id} className="wishlist-preview-row">
                    {card.image_url
                      ? <img src={card.image_url} alt={card.card_name} className="wishlist-preview-img" />
                      : <div className="wishlist-preview-img" style={{background:'var(--surface2)',borderRadius:3}} />
                    }
                    <div className="wishlist-preview-info">
                      <div className="wishlist-preview-name">{card.card_name}</div>
                      <div className="wishlist-preview-set">{card.set_name}</div>
                    </div>
                    {card.market_price_gbp
                      ? <span className="wishlist-preview-price">£{parseFloat(card.market_price_gbp).toFixed(2)}</span>
                      : <span className="wishlist-preview-price" style={{color:'var(--muted)'}}>—</span>
                    }
                  </div>
                ))}
                {wishlistTotal > 0 && (
                  <div style={{paddingTop:10,borderTop:'1px solid var(--border)',marginTop:4,display:'flex',justifyContent:'space-between',fontSize:13}}>
                    <span style={{color:'var(--muted)'}}>Estimated total</span>
                    <strong style={{color:'var(--yellow)'}}>£{wishlistTotal.toFixed(2)}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Recent cards panel */}
        <div className="home-panel">
          <div className="home-panel-header">
            <h2>🃏 Recently added</h2>
            <Link to="/collection" className="link-sm">View all</Link>
          </div>
          <div className="home-panel-body">
            {!cards.length ? (
              <div className="empty-state" style={{padding:'20px 0'}}>
                No cards yet — <Link to="/scan" className="link-sm">scan some!</Link>
              </div>
            ) : (
              <div className="recent-cards">
                {cards.slice(0, 8).map(card => (
                  <div key={card.id} className="recent-card-tile">
                    {card.image_url
                      ? <img src={card.image_url} alt={card.card_name} />
                      : <div style={{width:80,height:112,background:'var(--surface2)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}/>
                    }
                    <span>{card.card_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Set progress */}
      {setProgress.length > 0 && (
        <div className="home-panel" style={{marginBottom:20}}>
          <div className="home-panel-header">
            <h2>📦 Your sets</h2>
            <Link to="/collection" className="link-sm">View collection</Link>
          </div>
          <div className="home-panel-body">
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
              {setProgress.map(s => (
                <div key={s.setId} style={{background:'var(--surface2)',borderRadius:'var(--radius-sm)',padding:'10px 12px'}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{s.set_name}</div>
                  <div style={{fontSize:12,color:'var(--muted)',marginBottom:6}}>{s.owned} card{s.owned !== 1 ? 's' : ''}</div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{width:`${Math.min(100,(s.owned/20)*100)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pokédex progress teaser */}
      <Link to="/my-pokedex" style={{display:'block',textDecoration:'none'}}>
        <div className="home-panel" style={{marginBottom:20,cursor:'pointer'}}>
          <div className="home-panel-header">
            <h2>📖 My Pokédex</h2>
            <span className="link-sm">View all →</span>
          </div>
          <div className="home-panel-body">
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:8}}>
              Tap to see your living Pokédex — all 1025 Pokémon, see which ones you have cards for and which are still missing.
            </div>
            <div className="dex-completion-bar">
              <div className="dex-completion-fill" style={{width:'2%'}}/>
            </div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
              Keep scanning to fill it up! ⚡
            </div>
          </div>
        </div>
      </Link>

    </div>
  );
}
