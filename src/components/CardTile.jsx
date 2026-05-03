// src/components/CardTile.jsx
import { useState } from 'react';

const RARITY_COLORS = {
  'Common':        '#888',
  'Uncommon':      '#3a7d44',
  'Rare':          '#1a6fb5',
  'Holo Rare':     '#7c3aed',
  'Ultra Rare':    '#c2410c',
  'Secret Rare':   '#b45309',
};

export default function CardTile({ card, onClick, showTradeable = false, selected = false, onSelect }) {
  const [imgError, setImgError] = useState(false);
  const rarityColor = RARITY_COLORS[card.rarity] || '#888';

  return (
    <div
      className={`card-tile ${selected ? 'card-tile--selected' : ''}`}
      onClick={onClick}
    >
      {onSelect && (
        <input
          type="checkbox"
          className="card-tile-check"
          checked={selected}
          onChange={e => { e.stopPropagation(); onSelect(card, e.target.checked); }}
          onClick={e => e.stopPropagation()}
        />
      )}

      <div className="card-tile-image">
        {card.image_url && !imgError ? (
          <img
            src={card.image_url}
            alt={card.card_name}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="card-tile-placeholder">
            <span>{card.card_name?.[0] || '?'}</span>
          </div>
        )}
        {card.quantity > 1 && (
          <span className="card-qty">×{card.quantity}</span>
        )}
      </div>

      <div className="card-tile-info">
        <div className="card-tile-name">{card.card_name}</div>
        <div className="card-tile-set">{card.set_name}</div>
        <div className="card-tile-meta">
          <span className="card-tile-number">#{card.card_number}</span>
          {card.rarity && (
            <span className="card-tile-rarity" style={{ color: rarityColor }}>
              {card.rarity}
            </span>
          )}
        </div>
        {showTradeable && card.is_tradeable && (
          <span className="trade-badge">Trade</span>
        )}
      </div>
    </div>
  );
}
