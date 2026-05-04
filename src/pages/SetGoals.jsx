// src/pages/SetGoals.jsx  — set completion tracker with goals
import { useState, useEffect } from 'react';
import { useCollection } from '../hooks/useCollection';
import { useAuth } from '../hooks/useAuth';
import { getSets, getCardsInSet } from '../lib/tcgapi';
import { addToWishlist } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function SetGoals() {
  const { cards } = useCollection();
  const { user }  = useAuth();
  const [sets, setSets]           = useState([]);
  const [goals, setGoals]         = useState(() => JSON.parse(localStorage.getItem('scanachu-goals') || '[]'));
  const [loadingSets, setLoading] = useState(false);
  const [adding, setAdding]       = useState(false);
  const [searchQ, setSearchQ]     = useState('');
  const [setDetails, setSetDetails] = useState({}); // setId → { total, cards }

  useEffect(() => {
    setLoading(true);
    getSets().then(data => { setSets(data); setLoading(false); });
  }, []);

  useEffect(() => {
    localStorage.setItem('scanachu-goals', JSON.stringify(goals));
  }, [goals]);

  // Load card counts for goal sets
  useEffect(() => {
    goals.forEach(async (setId) => {
      if (setDetails[setId]) return;
      const { cards: setCards } = await getCardsInSet(setId);
      setSetDetails(d => ({ ...d, [setId]: setCards }));
    });
  }, [goals]);

  const myCardIds = new Set(cards.map(c => c.card_id));

  const addGoal = (setId) => {
    if (goals.includes(setId)) return;
    setGoals(g => [...g, setId]);
    setAdding(false);
  };

  const removeGoal = (setId) => setGoals(g => g.filter(id => id !== setId));

  const addMissingToWishlist = async (setId) => {
    const setCards = setDetails[setId] || [];
    const missing  = setCards.filter(c => !myCardIds.has(c.id));
    for (const card of missing) {
      await addToWishlist(user.id, {
        card_id: card.id, card_name: card.name,
        set_id: card.set_id, set_name: card.set_name,
        card_number: card.card_number, rarity: card.rarity, image_url: card.image_small,
        market_price_gbp: card.prices_gbp?.market || null,
      });
    }
    alert(`Added ${missing.length} missing cards to your wishlist!`);
  };

  const filteredSets = sets.filter(s =>
    !goals.includes(s.id) &&
    s.name.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Set goals</h1>
          <p>Track your progress towards completing a set</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(v => !v)}>
          {adding ? '✕ Cancel' : '+ Add a set goal'}
        </button>
      </div>

      {/* Add set picker */}
      {adding && (
        <div className="setgoal-picker">
          <input
            className="search-input"
            placeholder="Search sets..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            autoFocus
            style={{ marginBottom: 12 }}
          />
          <div className="setgoal-list">
            {filteredSets.slice(0, 20).map(s => (
              <div key={s.id} className="setgoal-row" onClick={() => addGoal(s.id)}>
                {s.logo && <img src={s.logo} alt={s.name} className="setgoal-logo" />}
                <div className="setgoal-info">
                  <div className="setgoal-name">{s.name}</div>
                  <div className="setgoal-meta">{s.series} · {s.total} cards · {s.releaseDate?.slice(0, 4)}</div>
                </div>
                <span className="setgoal-add">+ Add goal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.length === 0 && !adding && (
        <div className="empty-state">
          No set goals yet. Add a set above to track your progress towards completing it!
        </div>
      )}

      <div className="setgoal-goals">
        {goals.map(setId => {
          const setInfo    = sets.find(s => s.id === setId);
          const setCards   = setDetails[setId];
          const owned      = cards.filter(c => c.set_id === setId).length;
          const total      = setCards?.length || setInfo?.total || 0;
          const pct        = total > 0 ? Math.round((owned / total) * 100) : 0;
          const missing    = setCards ? setCards.filter(c => !myCardIds.has(c.id)) : [];
          const missingVal = missing.reduce((s, c) => s + parseFloat(c.prices_gbp?.market || 0), 0);
          const complete   = total > 0 && owned >= total;

          return (
            <div key={setId} className={`setgoal-card ${complete ? 'setgoal-card--complete' : ''}`}>
              <div className="setgoal-card-header">
                <div className="setgoal-card-info">
                  {setInfo?.logo && <img src={setInfo.logo} alt={setInfo.name} className="setgoal-card-logo" />}
                  <div>
                    <div className="setgoal-card-name">{setInfo?.name || setId}</div>
                    <div className="setgoal-card-meta">{setInfo?.series} · {setInfo?.releaseDate?.slice(0, 4)}</div>
                  </div>
                </div>
                <button className="btn-ghost btn-sm text-danger" onClick={() => removeGoal(setId)} style={{fontSize:12}}>Remove</button>
              </div>

              {/* Progress */}
              <div className="setgoal-progress-row">
                <div className="setgoal-pct">{pct}%</div>
                <div style={{ flex: 1 }}>
                  <div className="progress-bar" style={{ height: 10 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: complete ? 'var(--green)' : 'var(--yellow)' }} />
                  </div>
                  <div className="setgoal-progress-label">
                    {owned} / {total} cards
                    {missing.length > 0 && ` · ${missing.length} missing`}
                    {missingVal > 0 && ` · ~£${missingVal.toFixed(0)} to complete`}
                  </div>
                </div>
              </div>

              {complete ? (
                <div className="setgoal-complete-badge">🎉 Set complete!</div>
              ) : (
                <div className="setgoal-card-actions">
                  <Link to={`/find?browse=${setId}`} className="btn btn-secondary btn-sm">
                    Browse missing cards
                  </Link>
                  {missing.length > 0 && (
                    <button className="btn btn-primary btn-sm" onClick={() => addMissingToWishlist(setId)}>
                      ⭐ Add {missing.length} to wishlist
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
