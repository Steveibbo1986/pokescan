// src/pages/Wishlist.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { getWishlist, addToWishlist, removeFromWishlist } from '../lib/supabase';
import { getSets, getCardsInSet } from '../lib/tcgapi';

export default function Wishlist() {
  const { user } = useAuth();
  const { cards: myCards } = useCollection();
  const [wishlist, setWishlist]     = useState([]);
  const [sets, setSets]             = useState([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [setCards, setSetCards]     = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [tab, setTab]               = useState('wishlist'); // 'wishlist' | 'browse'

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

  const myCardIds = new Set(myCards.map(c => c.card_id));
  const wishlistIds = new Set(wishlist.map(c => c.card_id));

  const missingFromSet = setCards.filter(c => !myCardIds.has(c.id));

  const addToList = async (card) => {
    await addToWishlist(user.id, {
      card_id: card.id,
      card_name: card.name,
      set_id: card.set_id,
      set_name: card.set_name,
      card_number: card.card_number,
      rarity: card.rarity,
      image_url: card.image_small,
    });
    const { data } = await getWishlist(user.id);
    setWishlist(data || []);
  };

  const removeFromList = async (id) => {
    await removeFromWishlist(id);
    setWishlist(w => w.filter(c => c.id !== id));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Wishlist</h1>
          <p>{wishlist.length} card{wishlist.length !== 1 ? 's' : ''} on your list</p>
        </div>
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
        <div className="wishlist-grid">
          {!wishlist.length && (
            <div className="empty-state">
              Your wishlist is empty. Browse a set to add missing cards.
            </div>
          )}
          {wishlist.map(card => (
            <WishlistCard key={card.id} card={card} onRemove={() => removeFromList(card.id)} />
          ))}
        </div>
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

              <div className="browse-tabs">
                <span className="browse-count">{missingFromSet.length} missing</span>
              </div>

              <div className="card-grid-display">
                {setCards.map(card => {
                  const owned = myCardIds.has(card.id);
                  const wanted = wishlistIds.has(card.id);
                  return (
                    <div key={card.id} className={`set-card-tile ${owned ? 'owned' : 'missing'}`}>
                      <img src={card.image_small} alt={card.name} loading="lazy" />
                      <div className="set-card-name">{card.name}</div>
                      <div className="set-card-num">#{card.card_number}</div>
                      {card.prices?.market && (
                        <div className="set-card-price">${card.prices.market.toFixed(2)}</div>
                      )}
                      {owned ? (
                        <span className="owned-badge">Owned</span>
                      ) : (
                        <button
                          className={`btn btn-xs ${wanted ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => wanted ? null : addToList(card)}
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

function WishlistCard({ card, onRemove }) {
  const PRIORITY = { 1: 'High', 2: 'Medium', 3: 'Low' };
  const PRIORITY_COLOR = { 1: '#dc2626', 2: '#d97706', 3: '#16a34a' };

  return (
    <div className="wishlist-card">
      {card.image_url && <img src={card.image_url} alt={card.card_name} />}
      <div className="wishlist-card-info">
        <div className="wishlist-card-name">{card.card_name}</div>
        <div className="wishlist-card-set">{card.set_name} · #{card.card_number}</div>
        {card.rarity && <div className="wishlist-card-rarity">{card.rarity}</div>}
        <div className="wishlist-card-footer">
          <span className="priority-badge" style={{ color: PRIORITY_COLOR[card.priority] }}>
            {PRIORITY[card.priority]} priority
          </span>
          <div className="wishlist-card-links">
            <a
              href={`https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.card_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-sm"
            >
              TCGPlayer ↗
            </a>
            <a
              href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(card.card_name + ' pokemon card')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-sm"
            >
              eBay ↗
            </a>
          </div>
          <button className="btn-ghost btn-sm text-danger" onClick={onRemove}>Remove</button>
        </div>
      </div>
    </div>
  );
}
