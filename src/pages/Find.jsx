// src/pages/Find.jsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchPokemonCards, getSets, getCardsInSet } from '../lib/tcgapi';
import { useCollection } from '../hooks/useCollection';
import { useAuth } from '../hooks/useAuth';
import { addToWishlist, getWishlist } from '../lib/supabase';

const RARITY_ORDER = [
  'Illustration Rare','Special Illustration Rare','Hyper Rare',
  'Secret Rare','Ultra Rare','Holo Rare','Rare','Uncommon','Common','Promo',
];

const POPULAR = [
  'Pikachu','Charizard','Mewtwo','Gengar','Eevee','Snorlax','Mew',
  'Lucario','Gardevoir','Umbreon','Espeon','Rayquaza','Lugia','Ho-Oh',
  'Blastoise','Venusaur','Gyarados','Dragonite','Alakazam','Machamp',
];

export default function Find() {
  const { user }            = useAuth();
  const { cards: myCards, addCard } = useCollection();
  const [searchParams]      = useSearchParams();
  const wrapRef             = useRef(null);

  const [query, setQuery]             = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg]       = useState(false);
  const [results, setResults]         = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState('');
  const [groupBy, setGroupBy]         = useState('set');
  const [feedback, setFeedback]       = useState({}); // cardId → 'added' | 'wishlisted'
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [tab, setTab]                 = useState('search');
  const [sets, setSets]               = useState([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [setCards, setSetCards]       = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingSet, setLoadingSet]   = useState(false);

  const myCardIds = new Set(myCards.map(c => c.card_id));

  useEffect(() => {
    if (user) getWishlist(user.id).then(({ data }) =>
      setWishlistIds(new Set((data || []).map(c => c.card_id)))
    );
  }, [user]);

  useEffect(() => {
    setLoadingSets(true);
    getSets().then(data => { setSets(data); setLoadingSets(false); });
  }, []);

  useEffect(() => {
    if (!selectedSet) return;
    setLoadingSet(true);
    getCardsInSet(selectedSet).then(({ cards }) => { setSetCards(cards); setLoadingSet(false); });
  }, [selectedSet]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setQuery(q); doSearch(q); }
  }, [searchParams]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    const matches = POPULAR.filter(p => p.toLowerCase().startsWith(q)).slice(0, 6);
    setSuggestions(matches);
    setShowSugg(matches.length > 0);
  }, [query]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (name) => {
    const q = name || query;
    if (!q.trim()) return;
    setShowSugg(false);
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

  const handleAddToCollection = async (card) => {
    try {
      await addCard({
        card_id: card.id, card_name: card.name,
        set_id: card.set_id, set_name: card.set_name,
        set_series: card.set_series, card_number: card.card_number,
        rarity: card.rarity, image_url: card.image_small,
      });
      setFeedback(f => ({ ...f, [card.id]: 'added' }));
    } catch (err) { console.error(err); }
  };

  const handleAddToWishlist = async (card) => {
    try {
      await addToWishlist(user.id, {
        card_id: card.id, card_name: card.name,
        set_id: card.set_id, set_name: card.set_name,
        card_number: card.card_number, rarity: card.rarity,
        image_url: card.image_small,
        market_price_gbp: card.prices_gbp?.market || null,
      });
      setWishlistIds(prev => new Set([...prev, card.id]));
      setFeedback(f => ({ ...f, [card.id]: feedback[card.id] === 'added' ? 'both' : 'wishlisted' }));
    } catch (err) { console.error(err); }
  };

  const grouped = groupResults(results, groupBy);

  // Shared card action buttons used in both search and browse
  const CardActions = ({ card }) => {
    const owned  = myCardIds.has(card.id);
    const wanted = wishlistIds.has(card.id);
    const fb     = feedback[card.id];

    return (
      <div className="find-card-actions">
        {fb === 'added' || fb === 'both' ? (
          <span className="find-feedback find-feedback--added">✓ In collection</span>
        ) : (
          <button className="btn btn-primary btn-xs" onClick={() => handleAddToCollection(card)}>
            + Collection
          </button>
        )}
        {fb === 'wishlisted' || fb === 'both' || wanted ? (
          <span className="find-feedback find-feedback--wishlist">✓ Wishlisted</span>
        ) : (
          <button className="btn btn-secondary btn-xs" onClick={() => handleAddToWishlist(card)}>
            ♡ Wishlist
          </button>
        )}
        {owned && fb !== 'added' && fb !== 'both' && (
          <span className="find-owned-tag">Owned</span>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Find cards</h1>
          <p>Search any Pokémon or browse sets — add straight to collection or wishlist</p>
        </div>
      </div>

      <div className="tab-bar">
        <button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => setTab('search')}>Search</button>
        <button className={tab === 'type'   ? 'tab active' : 'tab'} onClick={() => setTab('type')}>By type</button>
        <button className={tab === 'browse' ? 'tab active' : 'tab'} onClick={() => setTab('browse')}>Browse sets</button>
      </div>

      {/* ─── TYPE TAB ─── */}
      {tab === 'type' && <TypeBrowser onAddToCollection={handleAddToCollection} onAddToWishlist={handleAddToWishlist} myCardIds={myCardIds} />}

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
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                autoFocus
              />
              <button className="btn btn-primary" onClick={() => doSearch()} disabled={loading}>
                {loading ? '...' : 'Search'}
              </button>
            </div>
            {showSugg && (
              <div className="search-suggestions">
                {suggestions.map(name => (
                  <div key={name} className="suggestion-item" onClick={() => { setQuery(name); doSearch(name); }}>
                    <span className="suggestion-name">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {searched && !loading && (
            <div className="pokedex-results-header">
              <div className="pokedex-count">
                {total} cards for <strong>{searched}</strong>
                {total > 50 && <span className="muted-text"> (first 50)</span>}
              </div>
              <div className="pokedex-controls">
                <span className="control-label">Group by</span>
                <div className="view-toggle">
                  <button className={groupBy === 'set'    ? 'active' : ''} onClick={() => setGroupBy('set')}>Set</button>
                  <button className={groupBy === 'rarity' ? 'active' : ''} onClick={() => setGroupBy('rarity')}>Rarity</button>
                  <button className={groupBy === 'none'   ? 'active' : ''} onClick={() => setGroupBy('none')}>All</button>
                </div>
              </div>
            </div>
          )}

          {loading && <div className="pokedex-loading"><span className="pokeball-spin">⚡</span><p>Searching...</p></div>}

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
                  <div key={card.id} className={`pokedex-card ${myCardIds.has(card.id) ? 'pokedex-card--owned' : ''}`}>
                    <div className="pokedex-card-img">
                      {card.image_small
                        ? <img src={card.image_small} alt={card.name} loading="lazy" />
                        : <div className="card-tile-placeholder">?</div>
                      }
                      {myCardIds.has(card.id) && feedback[card.id] !== 'added' && (
                        <span className="owned-overlay">✓ Owned</span>
                      )}
                    </div>
                    <div className="pokedex-card-info">
                      <div className="pokedex-card-name">{card.name}</div>
                      <div className="pokedex-card-set">{card.set_name}</div>
                      <div className="pokedex-card-num">#{card.card_number}</div>
                      {card.rarity && <div className="pokedex-card-rarity">{card.rarity}</div>}
                      {card.prices_gbp?.market
                        ? <div className="pokedex-price">
                            <span className="price-market">£{card.prices_gbp.market}</span>
                            {card.prices_gbp.low && card.prices_gbp.high && (
                              <span className="price-range">£{card.prices_gbp.low}–£{card.prices_gbp.high}</span>
                            )}
                          </div>
                        : <div className="pokedex-price price-unknown">Price unavailable</div>
                      }
                      <CardActions card={card} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {searched && !loading && results.length === 0 && (
            <div className="empty-state">No cards found for "{searched}".</div>
          )}

          {!searched && !loading && (
            <div style={{marginTop:8}}>
              <div className="section-title" style={{marginBottom:12}}>Popular Pokémon</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {POPULAR.map(name => (
                  <button key={name} className="btn btn-secondary btn-sm"
                    onClick={() => { setQuery(name); doSearch(name); }}>{name}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── BROWSE TAB ─── */}
      {tab === 'browse' && (
        <div className="browse-sets">
          <select
            className="select select-lg"
            value={selectedSet}
            onChange={e => setSelectedSet(e.target.value)}
            disabled={loadingSets}
            style={{width:'100%',maxWidth:500,marginBottom:16}}
          >
            <option value="">{loadingSets ? 'Loading sets...' : 'Choose a set...'}</option>
            {sets.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.releaseDate?.slice(0,4)}) — {s.total} cards
              </option>
            ))}
          </select>

          {loadingSet && <div className="pokedex-loading"><span className="pokeball-spin">⚡</span></div>}

          {selectedSet && setCards.length > 0 && !loadingSet && (
            <>
              <div className="set-progress" style={{marginBottom:16}}>
                <div className="set-progress-label">
                  You own {myCards.filter(c => c.set_id === selectedSet).length} / {setCards.length}
                  · {setCards.filter(c => !myCardIds.has(c.id)).length} missing
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width:`${(myCards.filter(c=>c.set_id===selectedSet).length/setCards.length)*100}%`
                  }}/>
                </div>
              </div>

              <div className="card-grid-display">
                {setCards.map(card => {
                  const owned  = myCardIds.has(card.id);
                  const wanted = wishlistIds.has(card.id);
                  const fb     = feedback[card.id];

                  return (
                    <div key={card.id} className={`set-card-tile ${owned ? 'owned' : ''}`}>
                      <img src={card.image_small} alt={card.name} loading="lazy" />
                      <div className="set-card-name">{card.name}</div>
                      <div className="set-card-num">#{card.card_number}</div>
                      {card.rarity && (
                        <div className="set-card-num" style={{color:'var(--yellow)',fontSize:10}}>{card.rarity}</div>
                      )}
                      {card.prices_gbp?.market && (
                        <div className="set-card-price">£{card.prices_gbp.market}</div>
                      )}
                      <div style={{padding:'4px 4px 6px',display:'flex',flexDirection:'column',gap:4}}>
                        {fb === 'added' || fb === 'both' ? (
                          <span className="find-feedback find-feedback--added" style={{fontSize:10,textAlign:'center'}}>✓ Added</span>
                        ) : (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleAddToCollection(card)}
                            style={{width:'100%',justifyContent:'center'}}
                          >
                            + Collection
                          </button>
                        )}
                        {fb === 'wishlisted' || fb === 'both' || (wanted && !owned) ? (
                          <span className="find-feedback find-feedback--wishlist" style={{fontSize:10,textAlign:'center'}}>✓ Wishlisted</span>
                        ) : owned && fb !== 'added' ? (
                          <span className="owned-badge">Owned ✓</span>
                        ) : (
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleAddToWishlist(card)}
                            style={{width:'100%',justifyContent:'center'}}
                          >
                            ♡ Wishlist
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

function groupResults(cards, groupBy) {
  if (groupBy === 'none') return { all: cards };
  if (groupBy === 'set') return cards.reduce((acc, card) => {
    const k = card.set_name || 'Unknown'; if (!acc[k]) acc[k] = []; acc[k].push(card); return acc;
  }, {});
  if (groupBy === 'rarity') {
    const g = cards.reduce((acc, card) => {
      const k = card.rarity || 'Unknown'; if (!acc[k]) acc[k] = []; acc[k].push(card); return acc;
    }, {});
    const s = {};
    RARITY_ORDER.forEach(r => { if (g[r]) s[r] = g[r]; });
    Object.keys(g).forEach(r => { if (!s[r]) s[r] = g[r]; });
    return s;
  }
  return { all: cards };
}

// ─── Type Browser ───────────────────────────────────────────────
const ENERGY_TYPES = [
  { name:'Fire',      emoji:'🔥', color:'#E8563A' },
  { name:'Water',     emoji:'💧', color:'#3B9DD2' },
  { name:'Grass',     emoji:'🌿', color:'#5BAD3A' },
  { name:'Lightning', emoji:'⚡', color:'#F5A623' },
  { name:'Psychic',   emoji:'✨', color:'#9B59B6' },
  { name:'Fighting',  emoji:'👊', color:'#C04E2C' },
  { name:'Darkness',  emoji:'🌙', color:'#546E7A' },
  { name:'Metal',     emoji:'⚙️', color:'#9EA0B0' },
  { name:'Dragon',    emoji:'🐉', color:'#5B5BD6' },
  { name:'Fairy',     emoji:'🎀', color:'#D4719B' },
  { name:'Colorless', emoji:'⭐', color:'#9CA3AF' },
];

function TypeBrowser({ onAddToCollection, onAddToWishlist, myCardIds }) {
  const [selectedType, setSelectedType] = useState(null);
  const [cards, setCards]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [feedback, setFeedback]         = useState({});

  const fetchType = async (type) => {
    setSelectedType(type);
    setCards([]);
    setLoading(true);
    try {
      const res  = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`types:${type.name}`)}&pageSize=30&orderBy=-set.releaseDate`
      );
      const data = await res.json();
      const USD  = 0.79;
      setCards((data.data || []).map(c => {
        const p = c.tcgplayer?.prices;
        const tier = p ? (p.holofoil||p.normal||p['1stEditionNormal']||p.reverseHolofoil) : null;
        const marketGBP = tier?.market ? (tier.market * USD).toFixed(2) : null;
        return {
          id: c.id, name: c.name, set_id: c.set?.id, set_name: c.set?.name,
          set_series: c.set?.series, card_number: c.number, rarity: c.rarity,
          image_small: c.images?.small, images: c.images,
          types: c.types, artist: c.artist, hp: c.hp,
          prices_gbp: marketGBP ? { market: marketGBP } : null,
          market_price_gbp: marketGBP,
        };
      }));
    } catch {}
    setLoading(false);
  };

  const fb = (cardId, type) => {
    setFeedback(f => ({ ...f, [cardId]: type }));
    setTimeout(() => setFeedback(f => { const n={...f}; delete n[cardId]; return n; }), 2500);
  };

  return (
    <div>
      {/* Type chips */}
      <div className="type-browser-chips">
        {ENERGY_TYPES.map(t => (
          <button key={t.name}
            className={`type-chip ${selectedType?.name===t.name?'type-chip--active':''}`}
            style={{'--tc': t.color}}
            onClick={() => fetchType(t)}>
            <span>{t.emoji}</span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>

      {!selectedType && (
        <div className="empty-state" style={{marginTop:32}}>
          Pick a type above to browse cards
        </div>
      )}

      {loading && <div className="page-loading">Loading {selectedType?.name} cards...</div>}

      {!loading && cards.length > 0 && (
        <>
          <div style={{fontSize:13,color:'var(--muted)',fontWeight:600,marginBottom:12}}>
            {selectedType.emoji} {selectedType.name} — showing latest {cards.length} cards
          </div>
          <div className="card-grid-display">
            {cards.map(card => (
              <div key={card.id} className="card-tile">
                <div className="card-tile-image">
                  {card.image_small && <img src={card.image_small} alt={card.name} loading="lazy"/>}
                </div>
                <div className="card-tile-info">
                  <div className="card-tile-name">{card.name}</div>
                  <div className="card-tile-set">{card.set_name}</div>
                  <div className="card-tile-rarity">{card.rarity}</div>
                  {card.prices_gbp?.market && (
                    <div style={{fontSize:11,color:'var(--green)',fontWeight:700}}>£{card.prices_gbp.market}</div>
                  )}
                  <div className="find-card-actions">
                    {myCardIds.has(card.id)
                      ? <span className="find-owned-tag">✓ Owned</span>
                      : feedback[card.id]==='added'
                        ? <span className="find-feedback find-feedback--added">✓ Added!</span>
                        : <button className="btn btn-primary btn-xs" onClick={()=>{onAddToCollection(card);fb(card.id,'added');}}>+ Collection</button>
                    }
                    {feedback[card.id]==='wishlist'
                      ? <span className="find-feedback find-feedback--wishlist">✓ Wishlisted</span>
                      : <button className="btn btn-secondary btn-xs" onClick={()=>{onAddToWishlist(card);fb(card.id,'wishlist');}}>♡</button>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
