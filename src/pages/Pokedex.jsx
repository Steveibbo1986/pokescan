// src/pages/Pokedex.jsx
import { useState } from 'react';
import { searchPokemonCards } from '../lib/tcgapi';
import { useCollection } from '../hooks/useCollection';
import { useAuth } from '../hooks/useAuth';
import { addToWishlist } from '../lib/supabase';

const RARITY_ORDER = [
  'Common', 'Uncommon', 'Rare', 'Holo Rare', 'Reverse Holo',
  'Ultra Rare', 'Secret Rare', 'Promo',
];

export default function Pokedex() {
  const { user } = useAuth();
  const { cards: myCards } = useCollection();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const [groupBy, setGroupBy]   = useState('set'); // 'set' | 'rarity' | 'none'

  const myCardIds = new Set(myCards.map(c => c.card_id));

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const data = await searchPokemonCards(query.trim());
      setResults(data.cards);
      setTotal(data.total);
      setSearched(query.trim());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAddToWishlist = async (card) => {
    if (!user) return;
    await addToWishlist(user.id, {
      card_id:     card.id,
      card_name:   card.name,
      set_id:      card.set_id,
      set_name:    card.set_name,
      card_number: card.card_number,
      rarity:      card.rarity,
      image_url:   card.image_small,
    });
    setAddedIds(prev => new Set([...prev, card.id]));
  };

  // Group results
  const grouped = groupResults(results, groupBy);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Pokédex search</h1>
          <p>Search any Pokémon to see every card ever printed</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="pokedex-search-form">
        <input
          className="search-input search-input-lg"
          placeholder="e.g. Charizard, Pikachu, Mewtwo..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {searched && !loading && (
        <div className="pokedex-results-header">
          <div className="pokedex-count">
            {total} cards found for <strong>{searched}</strong>
            {total > 50 && <span className="muted-text"> (showing first 50)</span>}
          </div>
          <div className="pokedex-controls">
            <span className="control-label">Group by</span>
            <div className="view-toggle">
              <button className={groupBy === 'set' ? 'active' : ''} onClick={() => setGroupBy('set')}>Set</button>
              <button className={groupBy === 'rarity' ? 'active' : ''} onClick={() => setGroupBy('rarity')}>Rarity</button>
              <button className={groupBy === 'none' ? 'active' : ''} onClick={() => setGroupBy('none')}>All</button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="pokedex-loading">
          <div className="pokeball-spin">◉</div>
          <p>Searching all sets...</p>
        </div>
      )}

      {Object.entries(grouped).map(([group, cards]) => (
        <div key={group} className="pokedex-group">
          {groupBy !== 'none' && (
            <div className="pokedex-group-header">
              <h2>{group}</h2>
              <span className="set-count">{cards.length} card{cards.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="pokedex-grid">
            {cards.map(card => {
              const owned  = myCardIds.has(card.id);
              const wanted = addedIds.has(card.id);
              return (
                <div key={card.id} className={`pokedex-card ${owned ? 'pokedex-card--owned' : ''}`}>
                  <div className="pokedex-card-img">
                    {card.image_small
                      ? <img src={card.image_small} alt={card.name} loading="lazy" />
                      : <div className="card-tile-placeholder">?</div>
                    }
                    {owned && <span className="owned-overlay">Owned</span>}
                  </div>
                  <div className="pokedex-card-info">
                    <div className="pokedex-card-name">{card.name}</div>
                    <div className="pokedex-card-set">{card.set_name}</div>
                    <div className="pokedex-card-num">#{card.card_number}</div>
                    {card.rarity && <div className="pokedex-card-rarity">{card.rarity}</div>}
                    {card.prices_gbp?.market ? (
                      <div className="pokedex-price">
                        <span className="price-market">£{card.prices_gbp.market}</span>
                        {card.prices_gbp.low && card.prices_gbp.high && (
                          <span className="price-range">£{card.prices_gbp.low} – £{card.prices_gbp.high}</span>
                        )}
                      </div>
                    ) : (
                      <div className="pokedex-price price-unknown">Price unavailable</div>
                    )}
                    <div className="pokedex-card-actions">
                      {!owned && (
                        <button
                          className={`btn btn-xs ${wanted ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => handleAddToWishlist(card)}
                          disabled={wanted}
                        >
                          {wanted ? '✓ Wishlisted' : '+ Wishlist'}
                        </button>
                      )}
                      {card.tcgplayer_url && (
                        <a
                          href={card.tcgplayer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-secondary"
                        >
                          Buy ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {searched && !loading && results.length === 0 && (
        <div className="empty-state">
          No cards found for "{searched}". Try checking the spelling — use the English name (e.g. "Charizard" not "Lizardon").
        </div>
      )}
    </div>
  );
}

function groupResults(cards, groupBy) {
  if (groupBy === 'none') return { all: cards };
  if (groupBy === 'set') {
    return cards.reduce((acc, card) => {
      const key = card.set_name || 'Unknown Set';
      if (!acc[key]) acc[key] = [];
      acc[key].push(card);
      return acc;
    }, {});
  }
  if (groupBy === 'rarity') {
    const grouped = cards.reduce((acc, card) => {
      const key = card.rarity || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(card);
      return acc;
    }, {});
    // Sort by rarity order
    const sorted = {};
    RARITY_ORDER.forEach(r => { if (grouped[r]) sorted[r] = grouped[r]; });
    Object.keys(grouped).forEach(r => { if (!sorted[r]) sorted[r] = grouped[r]; });
    return sorted;
  }
  return { all: cards };
}
