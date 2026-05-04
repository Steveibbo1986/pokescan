// src/pages/Badges.jsx
import { useMemo, useState } from 'react';
import { useCollection } from '../hooks/useCollection';
import { useTrades } from '../hooks/useTrades';
import { useAuth } from '../hooks/useAuth';
import { BADGES, buildStats, getEarnedBadges } from '../lib/badges';
import { getWishlist, supabase } from '../lib/supabase';
import { useEffect } from 'react';

// Name-to-dex-number map (reused from MyPokedex)
import { COMMON_NAME_MAP } from './MyPokedex';

export default function Badges() {
  const { cards }         = useCollection();
  const { trades }        = useTrades();
  const { user }          = useAuth();
  const [wishlist, setWishlist]   = useState([]);
  const [friends, setFriends]     = useState([]);
  const [filter, setFilter]       = useState('all'); // all | earned | locked

  useEffect(() => {
    if (!user) return;
    getWishlist(user.id).then(({ data }) => setWishlist(data || []));
    supabase
      .from('friendships')
      .select('id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .then(({ data }) => setFriends(data || []));
  }, [user]);

  // Build dex map
  const dexMap = useMemo(() => {
    const map = {};
    for (const card of cards) {
      const nameLower = card.card_name?.toLowerCase().replace(/[^a-z0-9 .\-♂♀]/g, '').trim();
      let dexNum = COMMON_NAME_MAP[nameLower];
      if (!dexNum) dexNum = COMMON_NAME_MAP[nameLower?.split(' ')[0]];
      if (dexNum) { if (!map[dexNum]) map[dexNum] = []; map[dexNum].push(card); }
    }
    return map;
  }, [cards]);

  const stats       = useMemo(() => buildStats({ cards, trades, friends, wishlist, dexMap }), [cards, trades, friends, wishlist, dexMap]);
  const earnedIds   = useMemo(() => new Set(getEarnedBadges(stats)), [stats]);
  const earnedCount = earnedIds.size;

  const visible = BADGES.filter(b => {
    if (filter === 'earned') return earnedIds.has(b.id);
    if (filter === 'locked') return !earnedIds.has(b.id);
    return true;
  });

  // Group by category
  const groups = [
    { label: '📷 Scanning', ids: ['first_scan','ten_cards','fifty_cards','hundred_cards','five_hundred','thousand'] },
    { label: '📖 Pokédex', ids: ['dex_10','dex_50','dex_151','dex_251','dex_500','dex_full'] },
    { label: '💰 Collection value', ids: ['value_10','value_50','value_100','value_500','value_1000'] },
    { label: '⇄ Trading', ids: ['first_trade','five_trades','ten_trades'] },
    { label: '👥 Social', ids: ['first_friend','five_friends'] },
    { label: '📦 Sets', ids: ['first_set','three_sets'] },
    { label: '✨ Rarity', ids: ['first_holo','first_ultra','ten_holos'] },
    { label: '🌟 Special', ids: ['wishlist_clear','early_adopter'] },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Badges</h1>
          <p>{earnedCount} of {BADGES.length} badges earned</p>
        </div>
        <div className="badges-progress-wrap">
          <div className="badges-progress-bar">
            <div className="badges-progress-fill" style={{ width: `${(earnedCount / BADGES.length) * 100}%` }} />
          </div>
          <div className="badges-progress-label">{Math.round((earnedCount / BADGES.length) * 100)}% complete</div>
        </div>
      </div>

      {/* Filter */}
      <div className="view-toggle" style={{ marginBottom: 20, display: 'inline-flex' }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'earned' ? 'active' : ''} onClick={() => setFilter('earned')}>Earned ({earnedCount})</button>
        <button className={filter === 'locked' ? 'active' : ''} onClick={() => setFilter('locked')}>Locked ({BADGES.length - earnedCount})</button>
      </div>

      {/* Badge groups */}
      {groups.map(group => {
        const groupBadges = visible.filter(b => group.ids.includes(b.id));
        if (!groupBadges.length) return null;
        return (
          <div key={group.label} className="badge-group">
            <div className="badge-group-title">{group.label}</div>
            <div className="badge-grid">
              {groupBadges.map(badge => {
                const earned = earnedIds.has(badge.id);
                return (
                  <BadgeTile key={badge.id} badge={badge} earned={earned} stats={stats} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BadgeTile({ badge, earned, stats }) {
  const [showDetail, setShowDetail] = useState(false);

  // Next milestone hint for numeric badges
  function getProgress() {
    const s = stats;
    const thresholds = {
      ten_cards:    [s.totalCards, 10],
      fifty_cards:  [s.totalCards, 50],
      hundred_cards:[s.totalCards, 100],
      five_hundred: [s.totalCards, 500],
      thousand:     [s.totalCards, 1000],
      dex_10:       [s.dexCount, 10],
      dex_50:       [s.dexCount, 50],
      dex_500:      [s.dexCount, 500],
      value_10:     [s.collectionValue, 10],
      value_50:     [s.collectionValue, 50],
      value_100:    [s.collectionValue, 100],
      value_500:    [s.collectionValue, 500],
      value_1000:   [s.collectionValue, 1000],
      first_trade:  [s.completedTrades, 1],
      five_trades:  [s.completedTrades, 5],
      ten_trades:   [s.completedTrades, 10],
      first_friend: [s.friendCount, 1],
      five_friends: [s.friendCount, 5],
      first_holo:   [s.holoCount, 1],
      ten_holos:    [s.holoCount, 10],
    };
    return thresholds[badge.id] || null;
  }

  const progress = !earned ? getProgress() : null;
  const pct = progress ? Math.min(100, Math.round((progress[0] / progress[1]) * 100)) : null;

  return (
    <div
      className={`badge-tile ${earned ? 'badge-tile--earned' : 'badge-tile--locked'}`}
      style={earned ? { '--col': badge.color } : {}}
      onClick={() => setShowDetail(v => !v)}
    >
      {/* Shine effect on earned */}
      {earned && <div className="badge-tile-shine" />}

      <div className="badge-tile-icon" style={earned ? { filter: 'none' } : {}}>
        {badge.icon}
      </div>

      {earned && <div className="badge-tile-earned-ring" style={{ borderColor: badge.color }} />}

      <div className="badge-tile-name">{badge.name}</div>
      <div className="badge-tile-desc">{badge.desc}</div>

      {/* Progress bar for locked numeric badges */}
      {!earned && progress && (
        <div className="badge-tile-progress">
          <div className="badge-tile-prog-bar">
            <div className="badge-tile-prog-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="badge-tile-prog-label">
            {typeof progress[0] === 'number' && progress[0] < 1000
              ? `${Math.round(progress[0])} / ${progress[1]}`
              : `£${Math.round(progress[0])} / £${progress[1]}`
            }
          </div>
        </div>
      )}

      {earned && (
        <div className="badge-tile-check" style={{ background: badge.color }}>✓</div>
      )}
    </div>
  );
}
