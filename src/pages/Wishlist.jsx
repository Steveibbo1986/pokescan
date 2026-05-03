// src/pages/Wishlist.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { getWishlist, addToWishlist, removeFromWishlist } from '../lib/supabase';
import { getSets, getCardsInSet, toGBP } from '../lib/tcgapi';

export default function Wishlist() {
  const { user } = useAuth();
  const { cards: myCards } = useCollection();
  const [wishlist, setWishlist]       = useState([]);
  const [sets, setSets]               = useState([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [setCards, setSetCards]       = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [tab, setTab]                 = useState('wishlist');
  const [view, setView]               = useState('card'); // 'card' | 'list'

  useEffect(() => {
    if (user) getWishlist(user.id).then(({ data }) => setWishlist(data || []));
  }, [user]);

  useEffect(() => {
    setLoadingSets(true);
    getSets().then(data => { setSets(data); setLoadingSets(false); });
  }, []);

  useEffect(() => {
    if (!selectedSet) return;
    getCardsInSet(selectedSet).then(({ cards }) => setSetCards(cards));
  }, [selectedSet]);

  const myCardIds    = new Set(myCards.map(c => c.card_id));
  const wishlistIds  = new Set(wishlist.map(c => c.card_id));
  const missingFromSet = setCards.filter(c => !myCardIds.has(c.id));

  // Total wishlist value in GBP
  const wishlistTotal = wishlist.reduce((sum, card) => {
    const price = parseFloat(card.market_price_gbp || 0);
    return sum + price;
  }, 0);

  const addToList = async (card) => {
    const marketGBP = card.prices_gbp?.market || null;
    await addToWishlist(user.id, {
      card_id:          card.id,
      card_name:        card.name,
      set_id:           card.set_id,
      set_name:         card.set_name,
      card_number:      card.card_number,
      rarity:           card.rarity,
      image_url:        card.image_small,
      market_price_gbp: marketGBP,
    });
    const { data } = await getWishlist(user.id);
    setWishlist(data || []);
  };

  const removeFromList = async (id) => {
    await removeFromWishlist(id);
    setWishlist(w => w.filter(c => c.id !== id));
  };

  // Recalculate total from current wishlist prices
  const totalValue = wishlist.reduce((sum, card) => {
    const p = parseFloat(card.market_price_gbp || 0);
    return sum + p;
  }, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Wishlist</h1>
          <p>{wishlist.length} card{wishlist.length !== 1 ? 's' : ''} on your list</p>
        </div>
        {wishlist.length > 0 && totalValue > 0 && (
          <div className="wishlist-total-badge">
            <span className="total-label">Estimated total</span>
            <span className="total-value">£{totalValue.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="tab-bar">
        <button className={tab === 'wishlist' ? 'tab active' : 'tab'} onClick={() => setTab('wishlist')}>
          My wishlist ({wishlist.length})
        </button>
        <button className={tab === 'browse' ? 'tab active' : 'tab'} onClick={() => setTab('browse')}>
          Browse sets
        </button>
      </div>

      {tab === 'wishlist' && (
        <>
          {wishlist.length > 0 && (
            <div className="wishlist-toolbar">
              <div className="view-toggle">
                <button className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}>
                  Card view
                </button>
                <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                  List view
                </button>
              </div>
              {totalValue > 0 && (
                <span className="wishlist-total-inline">
                  Total: <strong>£{totalValue.toFixed(2)}</strong>
                </span>
              )}
            </div>
          )}

          {!wishlist.length && (
            <div className="empty-state">
              Your wishlist is empty. Browse a set below or use the Pokédex search to add cards.
            </div>
          )}

          {view === 'card' && (
            <div className="wishlist-card-grid">
              {wishlist.map(card => (
                <WishlistCardTile key={card.id} card={card} onRemove={() => removeFromList(card.id)} />
              ))}
            </div>
          )}

          {view === 'list' && (
            <div className="wishlist-list-view">
              <div className="wishlist-list-header">
                <span>Card</span>
                <span>Set</span>
                <span>Rarity</span>
                <span>Price</span>
                <span></span>
              </div>
              {wishlist.map(card => (
                <WishlistListRow key={card.id} card={card} onRemove={() => removeFromList(card.id)} />
              ))}
              {totalValue > 0 && (
                <div className="wishlist-list-total">
                  <span>Estimated total</span>
                  <span></span>
                  <span></span>
                  <span className="total-value">£{totalValue.toFixed(2)}</span>
                  <span></span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'browse' && (
        <div className="browse-sets">
          <div className="set-picker">
            <select
              className="select select-lg"
              value={selectedSet}
              onChange={e => setSelectedSet(e.target.value)}
              disabled={loadingSets}
            >
              <option value="">{loadingSets ? 'Loading sets...' : 'Choose a set...'}</option>
              {sets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.releaseDate?.slice(0, 4)}) — {s.total} cards
                </option>
              ))}
            </select>
          </div>

          {selectedSet && setCards.length > 0 && (
            <>
              <div className="set-progress">
                <div className="set-progress-label">
                  You have {myCards.filter(c => c.set_id === selectedSet).length} / {setCards.length} cards in this set
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(myCards.filter(c => c.set_id === selectedSet).length / setCards.length) * 100}%` }}
                  />
                </div>
              </div>
              <div className="browse-count">{missingFromSet.length} missing</div>
              <div className="card-grid-display">
                {setCards.map(card => {
                  const owned  = myCardIds.has(card.id);
                  const wanted = wishlistIds.has(card.id);
                  return (
                    <div key={card.id} className={`set-card-tile ${owned ? 'owned' : 'missing'}`}>
                      <img src={card.image_small} alt={card.name} loading="lazy" />
                      <div className="set-card-name">{card.name}</div>
                      <div className="set-card-num">#{card.card_number}</div>
                      {card.prices_gbp?.market && (
                        <div className="set-card-price">£{card.prices_gbp.market}</div>
                      )}
                      {owned ? (
                        <span className="owned-badge">Owned</span>
                      ) : (
                        <button
                          className={`btn btn-xs ${wanted ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => !wanted && addToList(card)}
                          disabled={wanted}
                        >
                          {wanted ? 'On wishlist' : '+ Want'}
                        </button>
                      )}
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

// ─── Card tile view ──────────────────────────────────────────
function WishlistCardTile({ card, onRemove }) {
  const PRIORITY_COLOR = { 1: '#dc2626', 2: '#d97706', 3: '#16a34a' };
  const PRIORITY_LABEL = { 1: 'High', 2: 'Medium', 3: 'Low' };

  return (
    <div className="wishlist-tile">
      {card.image_url
        ? <img src={card.image_url} alt={card.card_name} className="wishlist-tile-img" />
        : <div className="wishlist-tile-img wishlist-tile-placeholder">{card.card_name?.[0]}</div>
      }
      <div className="wishlist-tile-info">
        <div className="wishlist-tile-name">{card.card_name}</div>
        <div className="wishlist-tile-set">{card.set_name}</div>
        <div className="wishlist-tile-num">#{card.card_number}</div>
        {card.rarity && <div className="wishlist-tile-rarity">{card.rarity}</div>}
        {card.market_price_gbp ? (
          <div className="wishlist-tile-price">£{parseFloat(card.market_price_gbp).toFixed(2)}</div>
        ) : (
          <div className="wishlist-tile-price price-unknown">Price unavailable</div>
        )}
        {card.priority && (
          <div className="wishlist-tile-priority" style={{ color: PRIORITY_COLOR[card.priority] }}>
            {PRIORITY_LABEL[card.priority]} priority
          </div>
        )}
        <div className="wishlist-tile-links">
          <a
            href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.card_name)}`}
            target="_blank" rel="noopener noreferrer" className="link-sm"
          >TCGPlayer ↗</a>
          <a
            href={`https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(card.card_name + ' pokemon card')}`}
            target="_blank" rel="noopener noreferrer" className="link-sm"
          >eBay ↗</a>
        </div>
        <button className="btn-ghost btn-sm text-danger" onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}

// ─── List row view ───────────────────────────────────────────
function WishlistListRow({ card, onRemove }) {
  return (
    <div className="wishlist-list-row">
      <div className="wishlist-list-card">
        {card.image_url && <img src={card.image_url} alt={card.card_name} className="wishlist-list-thumb" />}
        <span className="wishlist-list-name">{card.card_name}</span>
      </div>
      <span className="wishlist-list-set">{card.set_name} #{card.card_number}</span>
      <span className="wishlist-list-rarity">{card.rarity || '—'}</span>
      <span className="wishlist-list-price">
        {card.market_price_gbp
          ? <strong>£{parseFloat(card.market_price_gbp).toFixed(2)}</strong>
          : <span className="price-unknown">—</span>
        }
      </span>
      <div className="wishlist-list-actions">
        <a
          href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.card_name)}`}
          target="_blank" rel="noopener noreferrer" className="link-sm"
        >Buy ↗</a>
        <button className="btn-ghost btn-sm text-danger" onClick={onRemove}>✕</button>
      </div>
    </div>
  );
}
