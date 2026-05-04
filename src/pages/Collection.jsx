// src/pages/Collection.jsx
import { useState } from 'react';
import { useCollection } from '../hooks/useCollection';
import CardGrid from '../components/CardGrid';
import CardTile from '../components/CardTile';
import PriceBackfill from '../components/PriceBackfill';

export default function Collection() {
  const { cards, bySet, loading } = useCollection();
  const [view, setView]     = useState('all');   // 'all' | 'by-set'
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('added'); // 'added' | 'name' | 'set'
  const [selectedCard, setSelectedCard] = useState(null);

  const filtered = cards.filter(c =>
    !filter ||
    c.card_name?.toLowerCase().includes(filter.toLowerCase()) ||
    c.set_name?.toLowerCase().includes(filter.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.card_name.localeCompare(b.card_name);
    if (sortBy === 'set')  return a.set_name.localeCompare(b.set_name);
    return 0; // 'added' = default DB order
  });

  const collectionValue = cards.reduce((sum, c) => sum + parseFloat(c.market_price_gbp || 0), 0);

  if (loading) return <div className="page-loading">Loading collection...</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>My collection</h1>
          <p>{cards.length} card{cards.length !== 1 ? 's' : ''} across {Object.keys(bySet).length} set{Object.keys(bySet).length !== 1 ? 's' : ''}</p>
          {collectionValue > 0 && (
            <p style={{color:'var(--green)',fontWeight:700,fontSize:15,marginTop:4}}>
              Collection value: £{collectionValue.toFixed(2)}
            </p>
          )}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCSV(cards)}>⬇ Export CSV</button>
          <a href="/scan" className="btn btn-primary">+ Scan more</a>
        </div>
      </div>

      <PriceBackfill />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search cards or sets..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="added">Recently added</option>
          <option value="name">Name A–Z</option>
          <option value="set">Set</option>
        </select>
        <div className="view-toggle">
          <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All</button>
          <button className={view === 'by-set' ? 'active' : ''} onClick={() => setView('by-set')}>By set</button>
        </div>
      </div>

      {view === 'all' ? (
        <CardGrid
          cards={sorted}
          onCardClick={setSelectedCard}
          showTradeable
          emptyMessage="No cards yet. Go scan some!"
        />
      ) : (
        Object.entries(bySet).map(([setId, { set_name, cards: setCards }]) => (
          <div key={setId} className="set-section">
            <div className="set-header">
              <h2>{set_name}</h2>
              <span className="set-count">{setCards.length} card{setCards.length !== 1 ? 's' : ''}</span>
            </div>
            <CardGrid cards={setCards} onCardClick={setSelectedCard} showTradeable />
          </div>
        ))
      )}

      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}

function CardDetailModal({ card, onClose }) {
  const { toggleTradeable, deleteCard } = useCollection();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <div className="card-detail">
          <div className="card-detail-image">
            {card.image_url && <img src={card.image_url} alt={card.card_name} />}
          </div>
          <div className="card-detail-info">
            <h2>{card.card_name}</h2>
            <p className="detail-set">{card.set_name} · #{card.card_number}</p>
            {card.rarity && <p className="detail-rarity">{card.rarity}</p>}
            <p className="detail-qty">You own: {card.quantity}</p>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={card.is_tradeable}
                onChange={e => toggleTradeable(card.id, e.target.checked)}
              />
              Available to trade
            </label>

            <div className="detail-actions">
              <a
                href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.card_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                View on TCGPlayer ↗
              </a>
              <button
                className="btn btn-danger"
                onClick={() => { deleteCard(card.id); onClose(); }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportCSV(cards) {
  const header = ['Card Name','Set Name','Card Number','Rarity','Market Price (GBP)','Date Added'];
  const rows = cards.map(c => [
    `"${(c.card_name||'').replace(/"/g,'""')}"`,
    `"${(c.set_name||'').replace(/"/g,'""')}"`,
    c.card_number || '',
    `"${(c.rarity||'').replace(/"/g,'""')}"`,
    c.market_price_gbp ? parseFloat(c.market_price_gbp).toFixed(2) : '',
    c.added_at ? new Date(c.added_at).toLocaleDateString('en-GB') : '',
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `scanachu-collection-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
