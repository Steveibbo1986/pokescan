// src/components/PriceBackfill.jsx
// One-click button to fetch prices for all cards missing values
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';

export default function PriceBackfill() {
  const { user }      = useAuth();
  const { cards, refetch } = useCollection();
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState(null);

  const unpricedCount = cards.filter(c => !c.market_price_gbp).length;
  if (unpricedCount === 0) return null; // nothing to do, hide the button

  const runBackfill = async () => {
    if (!user) return;
    setRunning(true);
    setResult(null);
    try {
      const res  = await fetch('/.netlify/functions/backfill-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      setResult(data);
      await refetch(); // reload collection to show new prices
    } catch (err) {
      setResult({ error: err.message });
    }
    setRunning(false);
  };

  return (
    <div className="price-backfill-banner">
      <div className="price-backfill-info">
        <span className="price-backfill-icon">💰</span>
        <div>
          <div className="price-backfill-title">
            {unpricedCount} card{unpricedCount !== 1 ? 's' : ''} missing price data
          </div>
          <div className="price-backfill-desc">
            Fetch current market prices for your whole collection
          </div>
        </div>
      </div>

      {result ? (
        result.error ? (
          <div className="price-backfill-result price-backfill-result--error">
            Error: {result.error}
          </div>
        ) : (
          <div className="price-backfill-result price-backfill-result--ok">
            ✓ Updated {result.updated} card{result.updated !== 1 ? 's' : ''}
            {result.no_price_available > 0 && ` · ${result.no_price_available} unavailable`}
          </div>
        )
      ) : (
        <button className="btn btn-primary btn-sm" onClick={runBackfill} disabled={running}>
          {running
            ? <><span className="spin-icon">⚡</span> Fetching prices...</>
            : '⚡ Fetch all prices'
          }
        </button>
      )}
    </div>
  );
}
