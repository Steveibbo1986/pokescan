// src/pages/Home.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { useTrades } from '../hooks/useTrades';
import { getWishlist } from '../lib/supabase';

function getAnnualRate(rarity) {
  if (!rarity) return 0.05;
  const r = rarity.toLowerCase();
  if (r.includes('illustration') || r.includes('special')) return 0.12;
  if (r.includes('secret') || r.includes('ultra')) return 0.10;
  if (r.includes('holo')) return 0.08;
  if (r.includes('rare')) return 0.06;
  return 0.04;
}

// Animated counter hook
function useCountUp(target, duration = 900, trigger = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger || target === 0) { setVal(target); return; }
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, trigger]);
  return val;
}

// XP levels
function getLevel(cards) {
  if (cards >= 1000) return { level: 10, title: 'Master collector', next: null };
  if (cards >= 500)  return { level: 9,  title: 'Elite trainer',    next: 1000 };
  if (cards >= 250)  return { level: 8,  title: 'Champion',         next: 500  };
  if (cards >= 100)  return { level: 7,  title: 'Ace trainer',      next: 250  };
  if (cards >= 50)   return { level: 6,  title: 'Collector',        next: 100  };
  if (cards >= 25)   return { level: 5,  title: 'Card hunter',      next: 50   };
  if (cards >= 10)   return { level: 4,  title: 'Getting started',  next: 25   };
  if (cards >= 5)    return { level: 3,  title: 'Rookie trainer',   next: 10   };
  if (cards >= 1)    return { level: 2,  title: 'First steps',      next: 5    };
  return              { level: 1,  title: 'New trainer',    next: 1    };
}

// SVG ring
function Ring({ pct, size = 110, stroke = 11, color = '#F5A623', bg = 'var(--surface2)', children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${animated/100*circ} ${circ}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)'}}
      />
      {children}
    </svg>
  );
}

export default function Home() {
  const { profile, user } = useAuth();
  const { cards, bySet }  = useCollection();
  const { incoming }      = useTrades();
  const [wishlist, setWishlist] = useState([]);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    if (user) getWishlist(user.id).then(({ data }) => setWishlist(data || []));
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, [user]);

  const collectionValue = useMemo(() =>
    cards.reduce((s, c) => s + parseFloat(c.market_price_gbp || 0), 0), [cards]);

  const wishlistTotal = useMemo(() =>
    wishlist.reduce((s, c) => s + parseFloat(c.market_price_gbp || 0), 0), [wishlist]);

  const top5Cards = useMemo(() =>
    [...cards].filter(c => c.market_price_gbp > 0)
      .sort((a, b) => parseFloat(b.market_price_gbp) - parseFloat(a.market_price_gbp))
      .slice(0, 5), [cards]);

  const projections = useMemo(() => {
    if (!collectionValue) return null;
    const rate = cards.reduce((s, c) => {
      const v = parseFloat(c.market_price_gbp || 0);
      return s + (v ? v * getAnnualRate(c.rarity) : 0);
    }, 0) / (collectionValue || 1);
    return {
      rate, now: collectionValue,
      y10: collectionValue * Math.pow(1+rate, 10),
      y20: collectionValue * Math.pow(1+rate, 20),
      y30: collectionValue * Math.pow(1+rate, 30),
    };
  }, [cards, collectionValue]);

  const setCount  = Object.keys(bySet).length;
  const dexCount  = useMemo(() => {
    const names = new Set();
    cards.forEach(c => {
      const n = (c.card_name||'').toLowerCase().replace(/\s*(ex|gx|v|vmax|vstar|mega).*$/,'').trim();
      if (n) names.add(n);
    });
    return names.size;
  }, [cards]);
  const tradeableCount = cards.filter(c => c.is_tradeable).length;

  const lvl = getLevel(cards.length);
  const xpPct = lvl.next
    ? Math.round(((cards.length - (lvl.next > 500 ? lvl.next/2 : 0)) / lvl.next) * 100)
    : 100;
  const dexPct     = Math.min(100, Math.round((dexCount / 1025) * 100));
  const valuePct   = collectionValue > 0 ? Math.min(100, Math.round((collectionValue / 1000) * 100)) : 0;
  const tradesPct  = cards.length > 0 ? Math.min(100, Math.round((tradeableCount / cards.length) * 100)) : 0;

  const animCards  = useCountUp(cards.length, 900, mounted);
  const animValue  = useCountUp(Math.round(collectionValue), 1100, mounted);
  const animSets   = useCountUp(setCount, 700, mounted);
  const animDex    = useCountUp(dexCount, 800, mounted);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Hey' : 'Evening';

  // Milestones to show as "next goal"
  const nextMilestone = useMemo(() => {
    if (cards.length < 1)   return { label: 'Scan your first card!', icon: '📷', to: '/scan' };
    if (cards.length < 10)  return { label: `Scan ${10 - cards.length} more cards to reach Level 4`, icon: '🃏', to: '/scan' };
    if (cards.length < 50)  return { label: `${50 - cards.length} cards until Collector rank`, icon: '📚', to: '/scan' };
    if (cards.length < 100) return { label: `${100 - cards.length} cards until Century badge`, icon: '💯', to: '/scan' };
    if (!collectionValue)   return { label: 'Fetch prices to see your collection value', icon: '💰', to: '/collection' };
    if (wishlist.length < 1)return { label: 'Add cards to your wishlist', icon: '⭐', to: '/find' };
    return { label: 'Keep collecting — you\'re doing great!', icon: '⚡', to: '/badges' };
  }, [cards.length, collectionValue, wishlist.length]);

  // Rarity breakdown for mini chart
  const rarityBreakdown = useMemo(() => {
    const m = {};
    cards.forEach(c => {
      const r = c.rarity?.toLowerCase().includes('ultra') ? 'Ultra Rare'
        : c.rarity?.toLowerCase().includes('holo') ? 'Holo Rare'
        : c.rarity?.toLowerCase().includes('rare') ? 'Rare'
        : c.rarity?.toLowerCase().includes('uncommon') ? 'Uncommon'
        : 'Common';
      m[r] = (m[r]||0) + 1;
    });
    const order = ['Ultra Rare','Holo Rare','Rare','Uncommon','Common'];
    const colors = {'Ultra Rare':'#F5A623','Holo Rare':'#9B59B6','Rare':'#3B9DD2','Uncommon':'#5BAD3A','Common':'#9CA3AF'};
    return order.filter(k => m[k]).map(k => ({ label:k, count:m[k], color:colors[k], pct: Math.round(m[k]/cards.length*100) }));
  }, [cards]);

  return (
    <div className="page-container hm">

      {/* ── Hero greeting ── */}
      <div className={`hm-hero ${mounted?'hm-in':''}`}>
        <div className="hm-hero-text">
          <div className="hm-greeting">{greeting},</div>
          <h1 className="hm-name">{profile?.display_name || profile?.username}! <span className="hm-bolt">⚡</span></h1>
          <div className="hm-tagline">Your Pokémon card tracker</div>
        </div>
        <Link to="/account" className="hm-avatar">
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="avatar"/>
            : (profile?.display_name||profile?.username||'?')[0].toUpperCase()
          }
        </Link>
      </div>

      {/* ── Level / XP bar ── */}
      <Link to="/badges" className={`hm-level-bar ${mounted?'hm-in':''}`} style={{animationDelay:'.1s'}}>
        <div className="hm-level-badge">LV{lvl.level}</div>
        <div className="hm-level-info">
          <div className="hm-level-title">{lvl.title}</div>
          <div className="hm-xp-track">
            <div className="hm-xp-fill" style={{width: mounted ? `${Math.min(100,Math.round((cards.length/(lvl.next||1))*100))}%` : '0%'}}/>
          </div>
          <div className="hm-xp-label">
            {lvl.next ? `${cards.length} / ${lvl.next} cards to next level` : '🏆 Max level reached!'}
          </div>
        </div>
        <div className="hm-level-arrow">›</div>
      </Link>

      {/* ── Next milestone nudge ── */}
      <Link to={nextMilestone.to} className={`hm-nudge ${mounted?'hm-in':''}`} style={{animationDelay:'.18s'}}>
        <span className="hm-nudge-icon">{nextMilestone.icon}</span>
        <span className="hm-nudge-label">{nextMilestone.label}</span>
        <span className="hm-nudge-arrow">→</span>
      </Link>

      {/* ── Progress rings ── */}
      <div className={`hm-rings ${mounted?'hm-in':''}`} style={{animationDelay:'.22s'}}>

        <Link to="/collection" className="hm-ring-tile">
          <Ring pct={Math.min(100, Math.round(cards.length/100*100))} color="#F5A623">
            <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{animCards}</text>
            <text x="55" y="64" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">CARDS</text>
          </Ring>
          <div className="hm-ring-label">Collection</div>
        </Link>

        <Link to="/analytics" className="hm-ring-tile">
          <Ring pct={valuePct} color="#16A34A">
            <text x="55" y="48" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text)">£{animValue}</text>
            <text x="55" y="62" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">VALUE</text>
          </Ring>
          <div className="hm-ring-label">Value</div>
        </Link>

        <Link to="/my-pokedex" className="hm-ring-tile">
          <Ring pct={dexPct} color="#3B9DD2">
            <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{animDex}</text>
            <text x="55" y="64" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">POKÉMON</text>
          </Ring>
          <div className="hm-ring-label">Pokédex</div>
        </Link>

        <Link to="/collection" className="hm-ring-tile">
          <Ring pct={Math.min(100, Math.round(setCount/50*100))} color="#9B59B6">
            <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{animSets}</text>
            <text x="55" y="64" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">SETS</text>
          </Ring>
          <div className="hm-ring-label">Sets</div>
        </Link>

      </div>

      {/* ── Quick actions ── */}
      <div className={`hm-actions ${mounted?'hm-in':''}`} style={{animationDelay:'.3s'}}>
        <Link to="/scan"       className="hm-action hm-action--primary"><span>📷</span><span>Scan cards</span></Link>
        <Link to="/find"       className="hm-action"><span>🔍</span><span>Find cards</span></Link>
        <Link to="/my-pokedex" className="hm-action"><span>📖</span><span>Pokédex</span></Link>
        <Link to="/wishlist"   className="hm-action"><span>⭐</span><span>Wishlist</span></Link>
        <Link to="/badges"     className="hm-action"><span>🏆</span><span>Badges</span></Link>
        <Link to="/analytics"  className="hm-action"><span>📊</span><span>Analytics</span></Link>
      </div>

      {/* ── Trade alert ── */}
      {incoming.length > 0 && (
        <Link to="/trades" className="hm-trade-alert">
          <span className="hm-trade-ping"/>
          <span>⚡ {incoming.length} trade offer{incoming.length !== 1 ? 's' : ''} waiting</span>
          <span className="hm-nudge-arrow">→</span>
        </Link>
      )}

      {/* ── Rarity breakdown mini bar chart ── */}
      {rarityBreakdown.length > 0 && (
        <div className={`hm-panel ${mounted?'hm-in':''}`} style={{animationDelay:'.38s'}}>
          <div className="hm-panel-head">
            <span>✨ Rarity breakdown</span>
            <Link to="/analytics" className="hm-panel-link">Full analytics →</Link>
          </div>
          <div className="hm-rarity-bars">
            {rarityBreakdown.map(r => (
              <div key={r.label} className="hm-rarity-row">
                <div className="hm-rarity-label">{r.label}</div>
                <div className="hm-rarity-track">
                  <div className="hm-rarity-fill" style={{width: mounted ? `${r.pct}%` : '0%', background: r.color}}/>
                </div>
                <div className="hm-rarity-count" style={{color: r.color}}>{r.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top cards ── */}
      {top5Cards.length > 0 && (
        <div className={`hm-panel ${mounted?'hm-in':''}`} style={{animationDelay:'.44s'}}>
          <div className="hm-panel-head">
            <span>💎 Most valuable</span>
            <Link to="/analytics" className="hm-panel-link">See all →</Link>
          </div>
          <div className="hm-top-cards">
            {top5Cards.map((card, i) => (
              <div key={card.id} className="hm-top-row">
                <div className="hm-top-rank" style={{color: i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':'var(--muted)'}}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
                </div>
                {card.image_url && <img src={card.image_url} alt={card.card_name} className="hm-top-img"/>}
                <div className="hm-top-info">
                  <div className="hm-top-name">{card.card_name}</div>
                  <div className="hm-top-set">{card.set_name}</div>
                </div>
                <div className="hm-top-val">£{parseFloat(card.market_price_gbp).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Value forecast teaser ── */}
      {projections && (
        <div className={`hm-panel hm-forecast ${mounted?'hm-in':''}`} style={{animationDelay:'.5s'}}>
          <div className="hm-panel-head">
            <span>📈 Value forecast</span>
            <span className="hm-forecast-rate">~{Math.round(projections.rate*100)}%/yr avg</span>
          </div>
          <div className="hm-forecast-bars">
            {[
              {label:'Now',  val:projections.now, color:'#9CA3AF'},
              {label:'10yr', val:projections.y10, color:'#5BAD3A'},
              {label:'20yr', val:projections.y20, color:'#3B9DD2'},
              {label:'30yr', val:projections.y30, color:'#F5A623'},
            ].map((p, i) => {
              const maxVal = projections.y30;
              return (
                <div key={p.label} className="hm-forecast-col">
                  <div className="hm-forecast-val" style={{color:p.color}}>£{Math.round(p.val)}</div>
                  <div className="hm-forecast-track">
                    <div className="hm-forecast-bar" style={{
                      height: mounted ? `${Math.round((p.val/maxVal)*100)}%` : '0%',
                      background: p.color,
                      transitionDelay: `${0.5 + i*0.12}s`,
                    }}/>
                  </div>
                  <div className="hm-forecast-label">{p.label}</div>
                </div>
              );
            })}
          </div>
          <p className="hm-forecast-note">* Illustrative, based on historical card appreciation rates</p>
        </div>
      )}

      {/* ── Badges teaser ── */}
      <Link to="/badges" className={`hm-panel hm-badges-teaser ${mounted?'hm-in':''}`} style={{animationDelay:'.56s',display:'block',textDecoration:'none'}}>
        <div className="hm-panel-head">
          <span>🏆 Badges</span>
          <span className="hm-panel-link">View all →</span>
        </div>
        <div className="hm-badge-chips">
          {cards.length >= 1   && <span className="hm-badge-chip" style={{'--c':'#F5A623'}}>📷 First scan</span>}
          {cards.length >= 10  && <span className="hm-badge-chip" style={{'--c':'#4ECDC4'}}>🃏 10 cards</span>}
          {cards.length >= 50  && <span className="hm-badge-chip" style={{'--c':'#9B59B6'}}>📚 50 cards</span>}
          {cards.length >= 100 && <span className="hm-badge-chip" style={{'--c':'#E8563A'}}>💯 Century!</span>}
          {collectionValue >= 50  && <span className="hm-badge-chip" style={{'--c':'#5BAD3A'}}>💰 £50 value</span>}
          {collectionValue >= 100 && <span className="hm-badge-chip" style={{'--c':'#5BAD3A'}}>💴 £100 value</span>}
          {cards.length < 1 && <span style={{fontSize:13,color:'var(--muted)',fontWeight:600}}>Scan your first card to start earning badges!</span>}
        </div>
        <div className="hm-badge-progress">
          <div className="hm-badge-prog-fill" style={{
            width: mounted ? `${Math.min(100,Math.round(([
              cards.length>=1, cards.length>=10, cards.length>=50, cards.length>=100,
              cards.length>=500, collectionValue>=10, collectionValue>=50, collectionValue>=100,
              collectionValue>=500,
            ].filter(Boolean).length / 30)*100))}%` : '0%'
          }}/>
        </div>
        <div className="hm-badge-prog-label">Keep scanning to unlock more!</div>
      </Link>

      {/* ── Wishlist teaser ── */}
      {wishlist.length > 0 && (
        <div className={`hm-panel ${mounted?'hm-in':''}`} style={{animationDelay:'.62s'}}>
          <div className="hm-panel-head">
            <span>⭐ Wishlist</span>
            <Link to="/wishlist" className="hm-panel-link">{wishlist.length} cards · £{wishlistTotal.toFixed(0)} →</Link>
          </div>
          <div className="hm-wishlist-scroll">
            {wishlist.slice(0,8).map(card => (
              <div key={card.id} className="hm-wish-tile">
                {card.image_url
                  ? <img src={card.image_url} alt={card.card_name} className="hm-wish-img"/>
                  : <div className="hm-wish-placeholder">🎴</div>
                }
                <div className="hm-wish-name">{card.card_name}</div>
                {card.market_price_gbp && <div className="hm-wish-price">£{parseFloat(card.market_price_gbp).toFixed(2)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
