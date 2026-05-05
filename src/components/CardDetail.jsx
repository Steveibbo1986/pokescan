// src/components/CardDetail.jsx
// Rich card detail — basic info free, price history + grading gated to Pro
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const USD_TO_GBP = 0.79;

export default function CardDetail({ card, onClose, onAddToCollection, onAddToWishlist, owned }) {
  const { profile } = useAuth();
  const isPro = profile?.is_pro || false;
  const [priceData, setPriceData]   = useState(null);
  const [loadingPro, setLoadingPro] = useState(false);
  const [activeTab, setActiveTab]   = useState('info');
  const [showProWall, setShowProWall] = useState(false);

  useEffect(() => {
    if (activeTab === 'prices' && isPro && !priceData) fetchPriceHistory();
  }, [activeTab, isPro]);

  const fetchPriceHistory = async () => {
    if (!card) return;
    setLoadingPro(true);
    try {
      // PokemonPriceTracker API - free tier 100 credits/day
      const res = await fetch(
        `https://www.pokemonpricetracker.com/api/v2/cards?search=${encodeURIComponent(card.name)}&setId=${card.set_id}&includeHistory=true&days=90`,
        { headers: { Authorization: `Bearer ${import.meta.env.VITE_PRICE_TRACKER_KEY || ''}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPriceData(data.data?.[0] || null);
      }
    } catch {}
    setLoadingPro(false);
  };

  const prices = card.tcgplayer?.prices || {};
  const marketPrice = prices.holofoil?.market || prices.normal?.market || prices.reverseHolofoil?.market || null;
  const marketGBP   = marketPrice ? (marketPrice * USD_TO_GBP).toFixed(2) : null;
  const lowGBP      = (prices.holofoil?.low || prices.normal?.low || 0) * USD_TO_GBP;
  const highGBP     = (prices.holofoil?.high || prices.normal?.high || 0) * USD_TO_GBP;

  const TYPE_COLORS = {
    Fire:'#E8563A',Water:'#3B9DD2',Grass:'#5BAD3A',Electric:'#F5A623',
    Psychic:'#9B59B6',Ice:'#5BC8D4',Dragon:'#5B5BD6',Dark:'#546E7A',
    Fairy:'#D4719B',Normal:'#9CA3AF',Fighting:'#C04E2C',Flying:'#7BAFD4',
    Poison:'#9B3DA8',Ground:'#C8A44A',Rock:'#B8A038',Bug:'#8DB43A',
    Ghost:'#735797',Steel:'#9EA0B0',
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal cd-modal">

        {/* ── Image + basics ── */}
        <div className="cd-top">
          <div className="cd-img-wrap">
            {card.images?.large
              ? <img src={card.images.large} alt={card.name} className="cd-img"/>
              : <img src={card.images?.small || card.image_url} alt={card.name} className="cd-img"/>
            }
          </div>
          <div className="cd-basics">
            <button className="cd-close" onClick={onClose}>✕</button>
            <h2 className="cd-name">{card.name}</h2>
            <div className="cd-set">{card.set?.name || card.set_name}</div>
            <div className="cd-num">#{card.number || card.card_number} · {card.set?.releaseDate?.slice(0,4) || ''}</div>

            {/* Types */}
            {card.types && (
              <div className="cd-types">
                {card.types.map(t => (
                  <span key={t} className="cd-type-chip" style={{background:TYPE_COLORS[t]||'#9CA3AF'}}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Rarity */}
            {(card.rarity) && (
              <div className="cd-rarity">{card.rarity}</div>
            )}

            {/* Price — free for everyone */}
            {marketGBP && (
              <div className="cd-price-block">
                <div className="cd-price-main">£{marketGBP}</div>
                {lowGBP > 0 && (
                  <div className="cd-price-range">£{lowGBP.toFixed(2)} – £{highGBP.toFixed(2)}</div>
                )}
                <div className="cd-price-label">TCGPlayer market price</div>
              </div>
            )}

            {/* Actions */}
            <div className="cd-actions">
              {!owned
                ? <button className="btn btn-primary btn-sm" onClick={() => onAddToCollection?.(card)}>+ Collection</button>
                : <span className="owned-tag">✓ In collection</span>
              }
              <button className="btn btn-secondary btn-sm" onClick={() => onAddToWishlist?.(card)}>⭐ Wishlist</button>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tab-bar" style={{padding:'0 16px',borderBottom:'1.5px solid var(--border)'}}>
          <button className={activeTab==='info'?'tab active':'tab'} onClick={()=>setActiveTab('info')}>Card info</button>
          <button className={activeTab==='prices'?'tab active':'tab'} onClick={()=>{setActiveTab('prices');if(!isPro)setShowProWall(true);}}>
            📈 Price history {!isPro && <span className="cd-pro-lock">PRO</span>}
          </button>
          <button className={activeTab==='grading'?'tab active':'tab'} onClick={()=>{setActiveTab('grading');if(!isPro)setShowProWall(true);}}>
            🏅 Grading {!isPro && <span className="cd-pro-lock">PRO</span>}
          </button>
        </div>

        {/* ── Info tab ── */}
        {activeTab==='info' && (
          <div className="cd-tab-body">
            <div className="cd-info-grid">
              {card.hp && <InfoRow label="HP" value={card.hp} />}
              {card.supertype && <InfoRow label="Type" value={card.supertype} />}
              {card.subtypes && <InfoRow label="Stage" value={card.subtypes.join(', ')} />}
              {card.evolvesFrom && <InfoRow label="Evolves from" value={card.evolvesFrom} />}
              {card.artist && <InfoRow label="Illustrator" value={card.artist} />}
              {card.set?.series && <InfoRow label="Series" value={card.set.series} />}
              {card.set?.releaseDate && <InfoRow label="Released" value={card.set.releaseDate} />}
              {card.weaknesses && <InfoRow label="Weakness" value={card.weaknesses.map(w=>`${w.type} ${w.value}`).join(', ')} />}
              {card.resistances && <InfoRow label="Resistance" value={card.resistances.map(r=>`${r.type} ${r.value}`).join(', ')} />}
              {card.retreatCost && <InfoRow label="Retreat cost" value={card.retreatCost.length} />}
            </div>
            {card.attacks?.length > 0 && (
              <div style={{marginTop:12}}>
                <div style={{fontSize:12,fontWeight:800,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Attacks</div>
                {card.attacks.map((a,i) => (
                  <div key={i} className="cd-attack">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{fontWeight:800,fontSize:14}}>{a.name}</div>
                      <div style={{fontWeight:900,fontSize:14,color:'var(--yellow)'}}>{a.damage}</div>
                    </div>
                    {a.text && <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>{a.text}</div>}
                  </div>
                ))}
              </div>
            )}
            {card.flavorText && (
              <div className="cd-flavour">"{card.flavorText}"</div>
            )}
          </div>
        )}

        {/* ── Pro wall ── */}
        {(activeTab==='prices'||activeTab==='grading') && !isPro && (
          <div className="cd-pro-wall">
            <div className="cd-pro-wall-icon">⚡</div>
            <h3>Scanachu Pro</h3>
            <p>Unlock 90-day eBay price history, PSA graded valuations, and price trend data for every card in your collection.</p>
            <div className="cd-pro-feature-list">
              <span>📈 90-day eBay sale chart</span>
              <span>🏅 PSA 10 / PSA 9 prices</span>
              <span>📊 Price trend (↑ last 30 days)</span>
              <span>🌍 Cardmarket EUR prices</span>
              <span>📄 Insurance report PDF</span>
              <span>🔔 Price alerts</span>
            </div>
            <div className="cd-pro-price">£2.49<span>/month</span></div>
            <a href="/account#pro" className="btn btn-primary" style={{justifyContent:'center',marginTop:4}}>
              Upgrade to Pro →
            </a>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:8}}>or £19.99/year · cancel anytime</div>
          </div>
        )}

        {/* ── Price history tab (Pro) ── */}
        {activeTab==='prices' && isPro && (
          <div className="cd-tab-body">
            {loadingPro && <div className="page-loading">Loading price data...</div>}
            {!loadingPro && priceData && (
              <PriceHistoryChart data={priceData} marketGBP={marketGBP} />
            )}
            {!loadingPro && !priceData && (
              <div className="empty-state">No price history available for this card yet.</div>
            )}
          </div>
        )}

        {/* ── Grading tab (Pro) ── */}
        {activeTab==='grading' && isPro && (
          <div className="cd-tab-body">
            {loadingPro && <div className="page-loading">Loading grading data...</div>}
            {!loadingPro && priceData?.prices?.ebay && (
              <GradingTable ebay={priceData.prices.ebay} />
            )}
            {!loadingPro && !priceData && (
              <div className="empty-state">No grading data available for this card yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="cd-info-row">
      <span className="cd-info-label">{label}</span>
      <span className="cd-info-value">{value}</span>
    </div>
  );
}

function PriceHistoryChart({ data, marketGBP }) {
  const history = data.priceHistory || [];
  const ebay    = data.prices?.ebay;
  const USD     = 0.79;

  if (!history.length && !ebay) return <div className="empty-state">No price history data.</div>;

  const prices   = history.map(h => h.price * USD);
  const maxP     = Math.max(...prices, 0.01);
  const minP     = Math.min(...prices);
  const trending = ebay?.average ? (ebay.average * USD).toFixed(2) : marketGBP;
  const lowest   = ebay?.sold ? `${ebay.sold} eBay sales` : null;

  return (
    <div>
      <div className="cd-price-stats">
        {trending && <div className="cd-price-stat"><div className="cd-ps-val">£{trending}</div><div className="cd-ps-label">Trending</div></div>}
        {ebay?.low && <div className="cd-price-stat"><div className="cd-ps-val">£{(ebay.low*USD).toFixed(2)}</div><div className="cd-ps-label">Lowest</div></div>}
        {ebay?.high && <div className="cd-price-stat" style={{'--c':'#F5A623'}}><div className="cd-ps-val" style={{color:'var(--yellow)'}}>£{(ebay.high*USD).toFixed(2)}</div><div className="cd-ps-label">Highest</div></div>}
        {lowest && <div className="cd-price-stat"><div className="cd-ps-val">{lowest}</div><div className="cd-ps-label">Sample</div></div>}
      </div>

      {prices.length > 1 && (
        <div className="cd-chart-wrap">
          <svg viewBox={`0 0 300 80`} className="cd-chart-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16A34A" stopOpacity=".3"/>
                <stop offset="100%" stopColor="#16A34A" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Area fill */}
            <polyline
              fill="url(#chartGrad)"
              stroke="none"
              points={[
                ...prices.map((p,i) => `${(i/(prices.length-1))*300},${70-(((p-minP)/(maxP-minP||1))*60)}`),
                `300,70`, `0,70`
              ].join(' ')}
            />
            {/* Line */}
            <polyline
              fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinejoin="round"
              points={prices.map((p,i) => `${(i/(prices.length-1))*300},${70-(((p-minP)/(maxP-minP||1))*60)}`).join(' ')}
            />
          </svg>
          <div className="cd-chart-labels">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>
      )}
      <div className="cd-live-badge">● LIVE · Updated today via eBay sales</div>
    </div>
  );
}

function GradingTable({ ebay }) {
  const USD = 0.79;
  const grades = ebay?.graded?.psa || {};
  const rows = Object.entries(grades).sort((a,b) => parseInt(b[0])-parseInt(a[0]));
  if (!rows.length) return <div className="empty-state">No PSA grading data available.</div>;
  return (
    <div>
      <div style={{fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:10}}>PSA graded eBay sale prices (USD converted to GBP)</div>
      {rows.map(([grade, d]) => (
        <div key={grade} className="cd-grade-row">
          <div className="cd-grade-badge" style={{background: grade==='10'?'#F5A623':grade==='9'?'#9B59B6':'#9CA3AF'}}>
            PSA {grade}
          </div>
          <div style={{flex:1}}>
            {d.median_price && <div style={{fontSize:16,fontWeight:900,color:'var(--text)'}}>£{(d.median_price*USD).toFixed(0)}</div>}
            {d.sample_size   && <div style={{fontSize:11,color:'var(--muted)',fontWeight:600}}>{d.sample_size} sales</div>}
          </div>
        </div>
      ))}
      <div className="cd-live-badge" style={{marginTop:12}}>● LIVE · eBay completed sales</div>
    </div>
  );
}
