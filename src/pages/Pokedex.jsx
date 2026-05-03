// src/pages/Pokedex.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { searchPokemonCards, getSets, getCardsInSet } from '../lib/tcgapi';
import { useCollection } from '../hooks/useCollection';
import { useAuth } from '../hooks/useAuth';
import { addToWishlist, getWishlist } from '../lib/supabase';

const RARITY_ORDER = [
  'Illustration Rare','Special Illustration Rare','Hyper Rare',
  'Secret Rare','Ultra Rare','Holo Rare','Rare','Uncommon','Common','Promo',
];

// Popular Pokémon for suggestions when typing
const POPULAR = [
  'Pikachu','Charizard','Mewtwo','Gengar','Eevee','Snorlax','Mew',
  'Lucario','Gardevoir','Umbreon','Espeon','Rayquaza','Lugia','Ho-Oh',
  'Blastoise','Venusaur','Gyarados','Dragonite','Alakazam','Machamp',
  'Articuno','Zapdos','Moltres','Raichu','Clefairy','Jigglypuff',
  'Haunter','Scyther','Magikarp','Vaporeon','Flareon','Jolteon',
];

export default function Pokedex() {
  const { user } = useAuth();
  const { cards: myCards } = useCollection();

  // Search state
  const [query, setQuery]           = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState('');
  const [groupBy, setGroupBy]       = useState('set');
  const [addedIds, setAddedIds]     = useState(new Set());
  const [wishlistIds, setWishlistIds] = useState(new Set());

  // Browse state
  const [tab, setTab]               = useState('search'); // 'search' | 'browse'
  const [sets, setSets]             = useState([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [setCards, setSetCards]     = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingSet, setLoadingSet] = useState(false);

  const wrapRef = useRef(null);
  const myCardIds = new Set(myCards.map(c => c.card_id));

  // Load wishlist IDs
  useEffect(() => {
    if (user) getWishlist(user.id).then(({ data }) => {
      setWishlistIds(new Set((data || []).map(c => c.card_id)));
    });
  }, [user]);

  // Load sets for browse tab
  useEffect(() => {
    setLoadingSets(true);
    getSets().then(data => { setSets(data); setLoadingSets(false); });
  }, []);

  useEffect(() => {
    if (!selectedSet) return;
    setLoadingSet(true);
    getCardsInSet(selectedSet).then(({ cards }) => { setSetCards(cards); setLoadingSet(false); });
  }, [selectedSet]);

  // Predictive suggestions
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    const matches = POPULAR.filter(p => p.toLowerCase().startsWith(q)).slice(0, 6);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (name) => {
    const q = name || query;
    if (!q.trim()) return;
    setShowSuggestions(false);
    setLoading(true);
    setResults([]);
    try {
      const data = await searchPokemonCards(q.trim());
      setResults(data.cards);
      setTotal(data.total);
      setSearched(q.trim());
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleSuggestionClick = (name) => {
    setQuery(name);
    doSearch(name);
  };

  const handleAddToWishlist = async (card) => {
    if (!user) return;
    await addToWishlist(user.id, {
      card_id: card.id, card_name: card.name,
      set_id: card.set_id, set_name: card.set_name,
      card_number: card.card_number, rarity: card.rarity,
      image_url: card.image_small,
      market_price_gbp: card.prices_gbp?.market || null,
    });
    setAddedIds(prev => new Set([...prev, card.id]));
    setWishlistIds(prev => new Set([...prev, card.id]));
  };

  const grouped = groupResults(results, groupBy);
  const missingFromSet = setCards.filter(c => !myCardIds.has(c.id));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Pokédex</h1>
          <p>Search any Pokémon or browse sets — includes Illustration Rare & special cards</p>
        </div>
      </div>

      <div className="tab-bar pokedex-tabs">
        <button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => setTab('search')}>Search</button>
        <button className={tab === 'browse' ? 'tab active' : 'tab'} onClick={() => setTab('browse')}>Browse sets</button>
      </div>

      {/* ─── SEARCH TAB ─── */}
      {tab === 'search' && (
        <>
          <div className="pokedex-search-wrap" ref={wrapRef}>
            <div className="pokedex-search-form">
              <input
                className="search-input search-input-lg"
                placeholder="e.g. Charizard, Pikachu, Mewtwo..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                autoFocus
              />
              <button className="btn btn-primary" onClick={() => doSearch()} disabled={loading}>
                {loading ? '...' : 'Search'}
              </button>
            </div>

            {showSuggestions && (
              <div className="search-suggestions">
                {suggestions.map(name => (
                  <div key={name} className="suggestion-item" onClick={() => handleSuggestionClick(name)}>
                    <span className="suggestion-name">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              <span className="pokeball-spin">⚡</span>
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
                {cards.map(card => (
                  <PokedexCard
                    key={card.id} card={card}
                    owned={myCardIds.has(card.id)}
                    wanted={wishlistIds.has(card.id) || addedIds.has(card.id)}
                    onWishlist={() => handleAddToWishlist(card)}
                  />
                ))}
              </div>
            </div>
          ))}

          {searched && !loading && results.length === 0 && (
            <div className="empty-state">No cards found for "{searched}". Try checking the spelling.</div>
          )}

          {!searched && !loading && (
            <div className="pokedex-suggestions-grid">
              <div className="section-title" style={{marginBottom:16}}>Popular Pokémon</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {POPULAR.slice(0,16).map(name => (
                  <button key={name} className="btn btn-secondary btn-sm" onClick={() => { setQuery(name); doSearch(name); }}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── BROWSE TAB ─── */}
      {tab === 'browse' && (
        <div className="browse-sets">
          <div className="set-picker">
            <select
              className="select select-lg"
              value={selectedSet}
              onChange={e => setSelectedSet(e.target.value)}
              disabled={loadingSets}
              style={{width:'100%',maxWidth:500}}
            >
              <option value="">{loadingSets ? 'Loading sets...' : 'Choose a set...'}</option>
              {sets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.releaseDate?.slice(0, 4)}) — {s.total} cards
                </option>
              ))}
            </select>
          </div>

          {loadingSet && (
            <div className="pokedex-loading"><span className="pokeball-spin">⚡</span><p>Loading set...</p></div>
          )}

          {selectedSet && setCards.length > 0 && !loadingSet && (
            <>
              <div className="set-progress">
                <div className="set-progress-label">
                  You own {myCards.filter(c => c.set_id === selectedSet).length} / {setCards.length} cards
                  · {missingFromSet.length} missing
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(myCards.filter(c => c.set_id === selectedSet).length / setCards.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="card-grid-display" style={{marginTop:16}}>
                {setCards.map(card => {
                  const owned  = myCardIds.has(card.id);
                  const wanted = wishlistIds.has(card.id) || addedIds.has(card.id);
                  return (
                    <div key={card.id} className={`set-card-tile ${owned ? 'owned' : ''}`}>
                      <img src={card.image_small} alt={card.name} loading="lazy" />
                      <div className="set-card-name">{card.name}</div>
                      <div className="set-card-num">#{card.card_number}</div>
                      {card.rarity && <div className="set-card-num" style={{color:'var(--yellow)',fontSize:10}}>{card.rarity}</div>}
                      {card.prices_gbp?.market && (
                        <div className="set-card-price">£{card.prices_gbp.market}</div>
                      )}
                      <div style={{padding:'0 4px 4px'}}>
                        {owned ? (
                          <span className="owned-badge">Owned ✓</span>
                        ) : (
                          <button
                            className={`btn btn-xs ${wanted ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => !wanted && handleAddToWishlist(card)}
                            disabled={wanted}
                            style={{width:'100%',justifyContent:'center'}}
                          >
                            {wanted ? '✓ Wishlisted' : '+ Want'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PokedexCard({ card, owned, wanted, onWishlist }) {
  return (
    <div className={`pokedex-card ${owned ? 'pokedex-card--owned' : ''}`}>
      <div className="pokedex-card-img">
        {card.image_small
          ? <img src={card.image_small} alt={card.name} loading="lazy" />
          : <div className="card-tile-placeholder">?</div>
        }
        {owned && <span className="owned-overlay">✓ Owned</span>}
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
              onClick={onWishlist} disabled={wanted}
            >
              {wanted ? '✓' : '+ Wishlist'}
            </button>
          )}
          {card.tcgplayer_url && (
            <a href={card.tcgplayer_url} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-secondary">
              Buy ↗
            </a>
          )}
        </div>
      </div>
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
    const sorted = {};
    RARITY_ORDER.forEach(r => { if (grouped[r]) sorted[r] = grouped[r]; });
    Object.keys(grouped).forEach(r => { if (!sorted[r]) sorted[r] = grouped[r]; });
    return sorted;
  }
  return { all: cards };
}
