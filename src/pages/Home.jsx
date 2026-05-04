// src/pages/Home.jsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { useTrades } from '../hooks/useTrades';
import { getWishlist } from '../lib/supabase';

// Pokémon card appreciation rates based on historical data
// Vintage (pre-2000) ~15%/yr, Modern holos ~8%/yr, Commons ~3%/yr
function getAnnualRate(rarity, setYear) {
  const isVintage = setYear && setYear < 2000;
  if (!rarity) return 0.05;
  const r = rarity.toLowerCase();
  if (r.includes('illustration') || r.includes('special') || r.includes('hyper')) return isVintage ? 0.18 : 0.12;
  if (r.includes('secret') || r.includes('ultra')) return isVintage ? 0.16 : 0.10;
  if (r.includes('holo')) return isVintage ? 0.15 : 0.08;
  if (r.includes('rare')) return isVintage ? 0.12 : 0.06;
  if (r.includes('uncommon')) return 0.04;
  return 0.03; // common
}

function projectValue(currentValue, rate, years) {
  return currentValue * Math.pow(1 + rate, years);
}

export default function Home() {
  const { profile, user } = useAuth();
  const { cards, bySet }  = useCollection();
  const { incoming }      = useTrades();
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    if (user) getWishlist(user.id).then(({ data }) => setWishlist(data || []));
  }, [user]);


  const collectionValue = useMemo(() =>
    cards.reduce((sum, c) => sum + parseFloat(c.market_price_gbp || 0), 0)
  , [cards]);

  const wishlistTotal = useMemo(() =>
    wishlist.reduce((sum, c) => sum + parseFloat(c.market_price_gbp || 0), 0)
  , [wishlist]);

  // Top 5 most valuable cards
  const top5Cards = useMemo(() =>
    [...cards]
      .filter(c => c.market_price_gbp > 0)
      .sort((a, b) => parseFloat(b.market_price_gbp) - parseFloat(a.market_price_gbp))
      .slice(0, 5)
  , [cards]);

  // Collection value projection
  const projections = useMemo(() => {
    if (collectionValue === 0) return null;
    const totalRate = cards.reduce((sum, c) => {
      const val = parseFloat(c.market_price_gbp || 0);
      if (!val) return sum;
      const rate = getAnnualRate(c.rarity, c.set_year);
      return sum + (val * rate);
    }, 0) / (collectionValue || 1);

    return {
      rate: totalRate,
      y10: projectValue(collectionValue, totalRate, 10),
      y20: projectValue(collectionValue, totalRate, 20),
      y30: projectValue(collectionValue, totalRate, 30),
    };
  }, [cards, collectionValue]);

  // Set breakdown
  const setValues = useMemo(() =>
    Object.entries(bySet).map(([setId, { set_name, cards: sc }]) => ({
      setId, set_name,
      count: sc.length,
      value: sc.reduce((sum, c) => sum + parseFloat(c.market_price_gbp || 0), 0),
    })).sort((a, b) => b.value - a.value).slice(0, 5)
  , [bySet]);

  const tradeableCount = cards.filter(c => c.is_tradeable).length;

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
          <div className="stat-number">{Object.keys(bySet).length}</div>
          <div className="stat-label">Sets collected</div>
        </Link>
        {collectionValue > 0 && (
          <Link to="/collection" className="stat-card" style={{borderColor:'rgba(74,222,128,.3)'}}>
            <div className="stat-number" style={{color:'var(--green)'}}>£{collectionValue.toFixed(0)}</div>
            <div className="stat-label">Collection value</div>
          </Link>
        )}
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

      {/* Quick actions */}
      <div className="quick-actions">
        <Link to="/scan" className="quick-action"><span className="qa-icon">📷</span><span>Scan cards</span></Link>
        <Link to="/my-pokedex" className="quick-action"><span className="qa-icon">📖</span><span>My Pokédex</span></Link>
        <Link to="/find" className="quick-action"><span className="qa-icon">🔍</span><span>Find cards</span></Link>
        <Link to="/wishlist" className="quick-action"><span className="qa-icon">⭐</span><span>Wishlist</span></Link>
        <Link to="/trades" className="quick-action"><span className="qa-icon">⇄</span><span>Trades</span></Link>
        <Link to="/community" className="quick-action"><span className="qa-icon">👥</span><span>Community</span></Link>
      </div>

      {/* Trade alert */}
      {incoming.length > 0 && (
        <Link to="/trades" style={{display:'block',background:'rgba(255,215,0,.08)',border:'1px solid rgba(255,215,0,.3)',borderRadius:'var(--radius)',padding:'16px 20px',marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:600,color:'var(--yellow)'}}>⚡ {incoming.length} pending trade offer{incoming.length !== 1 ? 's' : ''}</div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:2}}>Tap to review and respond</div>
        </Link>
      )}

      {/* Two-col panels */}
      <div className="home-grid">

        {/* Top 5 most valuable cards */}
        <div className="home-panel">
          <div className="home-panel-header">
            <h2>💎 Top 5 valuable cards</h2>
            <Link to="/collection" className="link-sm">View all</Link>
          </div>
          <div className="home-panel-body">
            {top5Cards.length === 0 ? (
              <div className="empty-state" style={{padding:'20px 0'}}>
                Scan cards to see their values
              </div>
            ) : (
              top5Cards.map((card, i) => (
                <div key={card.id} className="wishlist-preview-row">
                  <div className="top5-rank">#{i + 1}</div>
                  {card.image_url
                    ? <img src={card.image_url} alt={card.card_name} className="wishlist-preview-img" />
                    : <div className="wishlist-preview-img" style={{background:'var(--surface2)',borderRadius:3}}/>
                  }
                  <div className="wishlist-preview-info">
                    <div className="wishlist-preview-name">{card.card_name}</div>
                    <div className="wishlist-preview-set">{card.set_name} · {card.rarity}</div>
                  </div>
                  <span className="wishlist-preview-price">£{parseFloat(card.market_price_gbp).toFixed(2)}</span>
                </div>
              ))
            )}
            {collectionValue > 0 && (
              <div style={{paddingTop:10,borderTop:'1px solid var(--border)',marginTop:4,display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'var(--muted)'}}>Total collection value</span>
                <strong style={{color:'var(--green)'}}>£{collectionValue.toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Wishlist */}
        <div className="home-panel">
          <div className="home-panel-header">
            <h2>⭐ Wishlist</h2>
            <Link to="/wishlist" className="link-sm">View all</Link>
          </div>
          <div className="home-panel-body">
            {!wishlist.length ? (
              <div className="empty-state" style={{padding:'20px 0'}}>
                No wishlist yet — <Link to="/find" className="link-sm">find some cards</Link>
              </div>
            ) : (
              <>
                {wishlist.slice(0, 5).map(card => (
                  <div key={card.id} className="wishlist-preview-row">
                    {card.image_url ? <img src={card.image_url} alt={card.card_name} className="wishlist-preview-img" /> : <div className="wishlist-preview-img" style={{background:'var(--surface2)',borderRadius:3}}/>}
                    <div className="wishlist-preview-info">
                      <div className="wishlist-preview-name">{card.card_name}</div>
                      <div className="wishlist-preview-set">{card.set_name}</div>
                    </div>
                    {card.market_price_gbp ? <span className="wishlist-preview-price">£{parseFloat(card.market_price_gbp).toFixed(2)}</span> : <span className="wishlist-preview-price" style={{color:'var(--muted)'}}>—</span>}
                  </div>
                ))}
                {wishlistTotal > 0 && (
                  <div style={{paddingTop:10,borderTop:'1px solid var(--border)',marginTop:4,display:'flex',justifyContent:'space-between',fontSize:13}}>
                    <span style={{color:'var(--muted)'}}>Wishlist total</span>
                    <strong style={{color:'var(--yellow)'}}>£{wishlistTotal.toFixed(2)}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* Set values */}
      {setValues.length > 0 && setValues.some(s => s.value > 0) && (
        <div className="home-panel" style={{marginBottom:20}}>
          <div className="home-panel-header">
            <h2>📦 Value by set</h2>
            <Link to="/collection" className="link-sm">View collection</Link>
          </div>
          <div className="home-panel-body">
            <div className="set-value-list">
              {setValues.map(s => (
                <div key={s.setId} className="set-value-row">
                  <div className="set-value-info">
                    <div className="set-value-name">{s.set_name}</div>
                    <div className="set-value-count">{s.count} card{s.count !== 1 ? 's' : ''}</div>
                  </div>
                  {s.value > 0 ? (
                    <div className="set-value-amount">£{s.value.toFixed(2)}</div>
                  ) : (
                    <div className="set-value-amount" style={{color:'var(--muted)'}}>No price data</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Future value prediction */}
      {projections && collectionValue > 5 && (
        <div className="home-panel" style={{marginBottom:20}}>
          <div className="home-panel-header">
            <h2>📈 Predicted future value</h2>
            <span style={{fontSize:12,color:'var(--muted)'}}>Based on historical Pokémon card appreciation</span>
          </div>
          <div className="home-panel-body">
            <div className="prediction-note">
              ⚡ Pokémon cards have historically increased in value over time — especially holos and vintage sets. These are estimates based on average annual appreciation rates. The better condition you keep them in, the more they could be worth!
            </div>
            <div className="prediction-grid">
              <div className="prediction-card">
                <div className="prediction-year">Today</div>
                <div className="prediction-value">£{collectionValue.toFixed(0)}</div>
                <div className="prediction-label">Current value</div>
              </div>
              <div className="prediction-arrow">→</div>
              <div className="prediction-card prediction-card--future">
                <div className="prediction-year">10 years</div>
                <div className="prediction-value">£{projections.y10.toFixed(0)}</div>
                <div className="prediction-label prediction-gain">+£{(projections.y10 - collectionValue).toFixed(0)}</div>
              </div>
              <div className="prediction-arrow">→</div>
              <div className="prediction-card prediction-card--future">
                <div className="prediction-year">20 years</div>
                <div className="prediction-value">£{projections.y20.toFixed(0)}</div>
                <div className="prediction-label prediction-gain">+£{(projections.y20 - collectionValue).toFixed(0)}</div>
              </div>
              <div className="prediction-arrow">→</div>
              <div className="prediction-card prediction-card--gold">
                <div className="prediction-year">30 years</div>
                <div className="prediction-value">£{projections.y30.toFixed(0)}</div>
                <div className="prediction-label prediction-gain">+£{(projections.y30 - collectionValue).toFixed(0)}</div>
              </div>
            </div>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:12,lineHeight:1.6}}>
              * Estimates only. Based on ~{(projections.rate * 100).toFixed(1)}% avg. annual rate for your collection mix. Past performance doesn't guarantee future returns. Keep cards in sleeves and binders for best preservation!
            </div>
          </div>
        </div>
      )}

      {/* Recently added */}
      {cards.length > 0 && (
        <div className="home-panel" style={{marginBottom:20}}>
          <div className="home-panel-header">
            <h2>🃏 Recently added</h2>
            <Link to="/collection" className="link-sm">View all</Link>
          </div>
          <div className="home-panel-body">
            <div className="recent-cards">
              {cards.slice(0, 10).map(card => (
                <div key={card.id} className="recent-card-tile">
                  {card.image_url ? <img src={card.image_url} alt={card.card_name} /> : <div style={{width:80,height:112,background:'var(--surface2)',borderRadius:'var(--radius-sm)',border:'1px solid var(--border)'}}/>}
                  <span>{card.card_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pokédex teaser */}
      <Link to="/my-pokedex" style={{display:'block',textDecoration:'none',marginBottom:20}}>
        <div className="home-panel" style={{cursor:'pointer'}}>
          <div className="home-panel-header">
            <h2>📖 My Pokédex</h2>
            <span className="link-sm">View all →</span>
          </div>
          <div className="home-panel-body">
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:8}}>All 1025 Pokémon — see which ones you have cards for and which are still missing.</div>
            <div className="dex-completion-bar"><div className="dex-completion-fill" style={{width:'2%'}}/></div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Keep scanning to fill it up! ⚡</div>
          </div>
        </div>
      </Link>

    </div>
  );
}
