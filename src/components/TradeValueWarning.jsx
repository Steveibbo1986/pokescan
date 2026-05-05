// src/components/TradeValueWarning.jsx
// Shows on trade confirmation if values are significantly unequal
export default function TradeValueWarning({ myValue, theirValue, onContinue, onBack }) {
  const higher  = Math.max(myValue, theirValue);
  const lower   = Math.min(myValue, theirValue);
  const ratio   = lower > 0 ? higher / lower : 999;
  const diff    = Math.abs(myValue - theirValue).toFixed(2);
  const losing  = myValue > theirValue;

  // No warning needed for roughly equal trades
  if (ratio < 3 || higher < 2) return null;

  const severe  = ratio >= 10;

  return (
    <div className={`value-warning ${severe ? 'value-warning--severe' : 'value-warning--mild'}`}>
      <div className="value-warning-icon">{severe ? '🚨' : '⚠️'}</div>
      <div className="value-warning-body">
        <div className="value-warning-title">
          {severe ? 'Very unequal trade' : 'Unequal trade'}
        </div>
        <div className="value-warning-desc">
          {losing
            ? `You're giving away ~£${diff} more than you're getting back.`
            : `You're getting ~£${diff} more than you're giving.`
          }
          {severe && ' This is a very large difference — please make sure you\'re happy with this trade.'}
        </div>
        <div className="value-warning-compare">
          <div className="vwc-side">
            <div className="vwc-label">You give</div>
            <div className={`vwc-value ${losing ? 'vwc-value--high' : ''}`}>£{myValue.toFixed(2)}</div>
          </div>
          <div className="vwc-arrow">⇄</div>
          <div className="vwc-side">
            <div className="vwc-label">You get</div>
            <div className={`vwc-value ${!losing ? 'vwc-value--high' : ''}`}>£{theirValue.toFixed(2)}</div>
          </div>
        </div>
        <div className="value-warning-actions">
          <button className="btn btn-primary btn-sm" onClick={onContinue}>
            {severe ? 'I understand, continue anyway' : 'Continue with this trade'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            ← Go back and change cards
          </button>
        </div>
      </div>
    </div>
  );
}
