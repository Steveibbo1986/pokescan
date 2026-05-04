// src/lib/badges.js
// All badge definitions and unlock logic

export const BADGES = [
  // ── Scanning milestones ──
  { id: 'first_scan',    icon: '📷', name: 'First catch!',      desc: 'Scanned your very first card',        color: '#F5A623', check: (s) => s.totalCards >= 1 },
  { id: 'ten_cards',     icon: '🃏', name: 'Getting started',   desc: '10 cards in your collection',         color: '#4ECDC4', check: (s) => s.totalCards >= 10 },
  { id: 'fifty_cards',   icon: '📚', name: 'Collector',         desc: '50 cards scanned',                    color: '#9B59B6', check: (s) => s.totalCards >= 50 },
  { id: 'hundred_cards', icon: '💯', name: 'Century!',          desc: '100 cards in your collection',        color: '#E8563A', check: (s) => s.totalCards >= 100 },
  { id: 'five_hundred',  icon: '🏆', name: 'Elite trainer',     desc: '500 cards collected',                 color: '#FFD700', check: (s) => s.totalCards >= 500 },
  { id: 'thousand',      icon: '👑', name: 'Master collector',  desc: '1,000 cards — legendary!',            color: '#FFD700', check: (s) => s.totalCards >= 1000 },

  // ── Pokédex milestones ──
  { id: 'dex_10',        icon: '🔴', name: 'Starting out',      desc: 'Cards for 10 different Pokémon',      color: '#E8563A', check: (s) => s.dexCount >= 10 },
  { id: 'dex_50',        icon: '🟡', name: 'Pokémon trainer',   desc: 'Cards for 50 different Pokémon',      color: '#F5A623', check: (s) => s.dexCount >= 50 },
  { id: 'dex_151',       icon: '🏅', name: 'Original 151',      desc: 'Cards for all Gen 1 Pokémon',         color: '#E53935', check: (s) => s.gen1Complete },
  { id: 'dex_251',       icon: '🥇', name: 'Johto champion',    desc: 'Cards for all Gen 1 & 2 Pokémon',    color: '#FFD700', check: (s) => s.gen2Complete },
  { id: 'dex_500',       icon: '⭐', name: 'Half the Pokédex',  desc: 'Cards for 500 different Pokémon',     color: '#9B59B6', check: (s) => s.dexCount >= 500 },
  { id: 'dex_full',      icon: '🌟', name: 'Pokédex complete!', desc: 'Cards for all 1,025 Pokémon',         color: '#FFD700', check: (s) => s.dexCount >= 1025 },

  // ── Value milestones ──
  { id: 'value_10',      icon: '💰', name: 'Ten pounds',        desc: 'Collection worth over £10',           color: '#5BAD3A', check: (s) => s.collectionValue >= 10 },
  { id: 'value_50',      icon: '💵', name: 'Fifty pounds',      desc: 'Collection worth over £50',           color: '#5BAD3A', check: (s) => s.collectionValue >= 50 },
  { id: 'value_100',     icon: '💴', name: 'Three figures',     desc: 'Collection worth over £100',          color: '#5BAD3A', check: (s) => s.collectionValue >= 100 },
  { id: 'value_500',     icon: '💎', name: 'High roller',       desc: 'Collection worth over £500',          color: '#9B59B6', check: (s) => s.collectionValue >= 500 },
  { id: 'value_1000',    icon: '👑', name: 'Four figures',      desc: 'Collection worth over £1,000',        color: '#FFD700', check: (s) => s.collectionValue >= 1000 },

  // ── Trading milestones ──
  { id: 'first_trade',   icon: '🤝', name: 'First trade!',      desc: 'Completed your first trade',          color: '#4ECDC4', check: (s) => s.completedTrades >= 1 },
  { id: 'five_trades',   icon: '🔄', name: 'Trader',            desc: '5 trades completed',                  color: '#4ECDC4', check: (s) => s.completedTrades >= 5 },
  { id: 'ten_trades',    icon: '♻️', name: 'Trade master',      desc: '10 trades completed',                 color: '#9B59B6', check: (s) => s.completedTrades >= 10 },

  // ── Social milestones ──
  { id: 'first_friend',  icon: '👫', name: 'Better together',   desc: 'Added your first friend',             color: '#4ECDC4', check: (s) => s.friendCount >= 1 },
  { id: 'five_friends',  icon: '👥', name: 'Social collector',  desc: '5 friends on Scanachu',               color: '#9B59B6', check: (s) => s.friendCount >= 5 },

  // ── Set milestones ──
  { id: 'first_set',     icon: '📦', name: 'Set complete!',     desc: 'Completed your first full set',       color: '#E8563A', check: (s) => s.completedSets >= 1 },
  { id: 'three_sets',    icon: '🗂',  name: 'Set collector',     desc: '3 complete sets',                     color: '#9B59B6', check: (s) => s.completedSets >= 3 },

  // ── Rarity milestones ──
  { id: 'first_holo',    icon: '✨', name: 'Shiny!',             desc: 'Got your first Holo Rare',            color: '#9B59B6', check: (s) => s.holoCount >= 1 },
  { id: 'first_ultra',   icon: '💫', name: 'Ultra rare!',        desc: 'Got your first Ultra Rare',           color: '#FFD700', check: (s) => s.ultraRareCount >= 1 },
  { id: 'ten_holos',     icon: '🌈', name: 'Rainbow collector',  desc: '10 Holo Rares in your collection',    color: '#9B59B6', check: (s) => s.holoCount >= 10 },

  // ── Special ──
  { id: 'wishlist_clear',icon: '🎯', name: 'Got em all!',        desc: 'Added every wishlist card to collection',color: '#5BAD3A', check: (s) => s.wishlistCleared },
  { id: 'early_adopter', icon: '⚡', name: 'Early adopter',      desc: 'One of the first Scanachu collectors', color: '#FFD700', check: (_) => true }, // everyone gets this
];

// Build stats object from collection + social data
export function buildStats({ cards, trades, friends, wishlist, dexMap }) {
  const dexCount   = Object.keys(dexMap || {}).length;
  const gen1Ids    = Array.from({ length: 151 }, (_, i) => i + 1);
  const gen2Ids    = Array.from({ length: 100 }, (_, i) => i + 152);
  const gen1Complete = gen1Ids.every(n => dexMap?.[n]);
  const gen2Complete = gen1Complete && gen2Ids.every(n => dexMap?.[n]);

  const holoCount      = cards.filter(c => c.rarity?.toLowerCase().includes('holo')).length;
  const ultraRareCount = cards.filter(c => c.rarity?.toLowerCase().includes('ultra')).length;
  const collectionValue = cards.reduce((s, c) => s + parseFloat(c.market_price_gbp || 0), 0);

  // Simple set completion: a set is complete if you have all cards in it
  // We use set_id groups — only mark complete if you have >= the printed total (simplified)
  const completedSets = 0; // Would need set totals to compare — simplified for now

  const wishlistCleared = wishlist?.length === 0 && cards.length > 0;

  return {
    totalCards: cards.length,
    dexCount,
    gen1Complete,
    gen2Complete,
    holoCount,
    ultraRareCount,
    collectionValue,
    completedTrades: trades?.filter(t => t.status === 'accepted').length || 0,
    friendCount: friends?.length || 0,
    completedSets,
    wishlistCleared,
  };
}

// Return list of earned badge IDs
export function getEarnedBadges(stats) {
  return BADGES.filter(b => b.check(stats)).map(b => b.id);
}
