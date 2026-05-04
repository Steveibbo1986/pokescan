// src/pages/Analytics.jsx
import { useMemo } from 'react';
import { useCollection } from '../hooks/useCollection';

export default function Analytics() {
  const { cards, bySet } = useCollection();

  const value = useMemo(() => cards.reduce((s, c) => s + parseFloat(c.market_price_gbp || 0), 0), [cards]);

  // Rarity breakdown
  const rarityMap = useMemo(() => {
    const m = {};
    cards.forEach(c => {
      const r = c.rarity || 'Unknown';
      m[r] = (m[r] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [cards]);

  // Top 10 most valuable
  const top10 = useMemo(() =>
    [...cards].filter(c => c.market_price_gbp > 0)
      .sort((a, b) => parseFloat(b.market_price_gbp) - parseFloat(a.market_price_gbp))
      .slice(0, 10)
  , [cards]);

  // Set breakdown
  const setValues = useMemo(() =>
    Object.entries(bySet).map(([setId, { set_name, cards: sc }]) => ({
      set_name, count: sc.length,
      value: sc.reduce((s, c) => s + parseFloat(c.market_price_gbp || 0), 0),
    })).sort((a, b) => b.value - a.value).slice(0, 8)
  , [bySet]);

  const RARITY_COLORS = {
    'Common': '#9CA3AF', 'Uncommon': '#5BAD3A', 'Rare': '#3B9DD2',
    'Holo Rare': '#9B59B6', 'Ultra Rare': '#F5A623', 'Secret Rare': '#E8563A',
    'Illustration Rare': '#F5A623', 'Special Illustration Rare': '#FFD700',
  };

  const maxCount = rarityMap[0]?.[1] || 1;
  const maxSetVal = setValues[0]?.value || 1;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Collection analytics</h1>
          <p>A detailed breakdown of what you've collected</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-number">{cards.length}</div>
          <div className="stat-label">Total cards</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{Object.keys(bySet).length}</div>
          <div className="stat-label">Sets</div>
        </div>
        {value > 0 && (
          <div className="stat-card">
            <div className="stat-number" style={{color:'var(--green)'}}>£{value.toFixed(0)}</div>
            <div className="stat-label">Total value</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-number">
            {cards.filter(c=>c.rarity?.toLowerCase().includes('holo')||c.rarity?.toLowerCase().includes('ultra')||c.rarity?.toLowerCase().includes('secret')).length}
          </div>
          <div className="stat-label">Rare+ cards</div>
        </div>
      </div>

      <div className="analytics-grid">

        {/* Rarity breakdown */}
        <div className="analytics-panel">
          <h2 className="analytics-panel-title">Rarity breakdown</h2>
          <div className="analytics-bars">
            {rarityMap.map(([rarity, count]) => {
              const col = RARITY_COLORS[rarity] || '#9CA3AF';
              return (
                <div key={rarity} className="analytics-bar-row">
                  <div className="analytics-bar-label">{rarity}</div>
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill"
                      style={{ width: `${(count / maxCount) * 100}%`, background: col }}
                    />
                  </div>
                  <div className="analytics-bar-count">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 10 valuable */}
        <div className="analytics-panel">
          <h2 className="analytics-panel-title">Top 10 by value</h2>
          {top10.length === 0 && <div className="empty-state" style={{padding:'20px 0'}}>Fetch prices to see values</div>}
          <div className="analytics-top10">
            {top10.map((card, i) => (
              <div key={card.id} className="analytics-top10-row">
                <span className="analytics-rank">#{i + 1}</span>
                {card.image_url && <img src={card.image_url} alt={card.card_name} className="analytics-thumb" />}
                <div className="analytics-top10-info">
                  <div className="analytics-top10-name">{card.card_name}</div>
                  <div className="analytics-top10-set">{card.set_name}</div>
                </div>
                <span className="analytics-top10-val">£{parseFloat(card.market_price_gbp).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Value by set */}
        {setValues.some(s => s.value > 0) && (
          <div className="analytics-panel analytics-panel--wide">
            <h2 className="analytics-panel-title">Value by set</h2>
            <div className="analytics-bars">
              {setValues.map(s => (
                <div key={s.set_name} className="analytics-bar-row">
                  <div className="analytics-bar-label analytics-bar-label--set">{s.set_name} <span style={{color:'var(--muted)',fontSize:10}}>({s.count})</span></div>
                  <div className="analytics-bar-track">
                    <div className="analytics-bar-fill" style={{ width: `${(s.value / maxSetVal) * 100}%`, background: 'var(--green)' }} />
                  </div>
                  <div className="analytics-bar-count">£{s.value.toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Condition breakdown */}
        <div className="analytics-panel">
          <h2 className="analytics-panel-title">Cards available to trade</h2>
          <div className="analytics-donut-wrap">
            <DonutChart
              tradeable={cards.filter(c => c.is_tradeable).length}
              total={cards.length}
            />
          </div>
          <p className="analytics-trade-hint">
            Mark cards as tradeable in your collection to let friends request them.
          </p>
        </div>

      </div>
    </div>
  );
}

function DonutChart({ tradeable, total }) {
  const pct   = total > 0 ? tradeable / total : 0;
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const dash  = pct * circ;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--surface2)" strokeWidth="14"/>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--yellow)"
          strokeWidth="14" strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round" transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
        <text x="55" y="52" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text)">{tradeable}</text>
        <text x="55" y="66" textAnchor="middle" fontSize="10" fill="var(--muted)">of {total}</text>
      </svg>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--yellow)' }}>{Math.round(pct * 100)}%</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Available to trade</div>
      </div>
    </div>
  );
}
