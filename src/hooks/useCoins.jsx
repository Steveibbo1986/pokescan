// src/hooks/useCoins.js
// Central coin economy — earn, spend, load balance
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// ── Earn rates ────────────────────────────────────────────────
export const EARN_RATES = {
  scan_common:        5,
  scan_uncommon:      8,
  scan_rare:          15,
  scan_holo:          20,
  scan_ultra:         50,
  scan_secret:        75,
  badge_small:        25,
  badge_medium:       50,
  badge_large:        100,
  streak_3day:        20,
  streak_7day:        50,
  streak_30day:       200,
  complete_set:       200,
  complete_trade:     30,
  first_friend:       20,
  milestone_10cards:  30,
  milestone_50cards:  75,
  milestone_100cards: 150,
  milestone_500cards: 500,
};

// Milestones — award once only (tracked by reason string)
const MILESTONES = [
  { cards: 1,   reason: 'milestone_first_scan',   coins: 5,   label: 'First scan!' },
  { cards: 10,  reason: 'milestone_10cards',      coins: 30,  label: '10 cards!' },
  { cards: 50,  reason: 'milestone_50cards',      coins: 75,  label: '50 cards!' },
  { cards: 100, reason: 'milestone_100cards',     coins: 150, label: '100 cards!' },
  { cards: 250, reason: 'milestone_250cards',     coins: 300, label: '250 cards!' },
  { cards: 500, reason: 'milestone_500cards',     coins: 500, label: '500 cards!' },
  { cards: 1000,reason: 'milestone_1000cards',    coins: 1000,label: '1000 cards!' },
];

const CoinsContext = createContext(null);

export function CoinsProvider({ children }) {
  const { user }      = useAuth();
  const [coins, setCoins]     = useState(0);
  const [toast, setToast]     = useState(null);  // { amount, label }
  const [earnedReasons, setEarnedReasons] = useState(new Set());

  useEffect(() => { if (user) loadCoins(); }, [user]);

  async function loadCoins() {
    const { data } = await supabase
      .from('profiles')
      .select('coins')
      .eq('id', user.id)
      .single();
    if (data) setCoins(data.coins || 0);

    // Load already-earned milestones so we don't double-award
    const { data: txns } = await supabase
      .from('coin_transactions')
      .select('reason')
      .eq('user_id', user.id);
    if (txns) setEarnedReasons(new Set(txns.map(t => t.reason)));
  }

  const awardCoins = useCallback(async (amount, reason, meta = {}, label = '') => {
    if (!user || amount <= 0) return;

    // Deduplicate one-time awards
    if (earnedReasons.has(reason)) return;

    const { data } = await supabase.rpc('award_coins', {
      p_user_id: user.id,
      p_amount:  amount,
      p_reason:  reason,
      p_meta:    meta,
    });

    if (data != null) {
      setCoins(data);
      setEarnedReasons(prev => new Set([...prev, reason]));
      showToast(amount, label || `+${amount} ⚡`);
    }
  }, [user, earnedReasons]);

  // For repeatable awards (e.g. each scan — different card each time)
  const awardCoinsRepeat = useCallback(async (amount, reason, meta = {}, label = '') => {
    if (!user || amount <= 0) return;
    const { data } = await supabase.rpc('award_coins', {
      p_user_id: user.id, p_amount: amount, p_reason: reason, p_meta: meta,
    });
    if (data != null) {
      setCoins(data);
      showToast(amount, label || `+${amount} ⚡`);
    }
  }, [user]);

  const spendCoins = useCallback(async (amount, itemId, itemName) => {
    if (!user || coins < amount) return { ok: false, reason: 'insufficient' };
    const { data } = await supabase.rpc('award_coins', {
      p_user_id: user.id, p_amount: -amount,
      p_reason:  'shop_purchase',
      p_meta:    { item_id: itemId, item_name: itemName },
    });
    if (data != null) {
      setCoins(data);
      // Record ownership
      await supabase.from('user_items').insert({ user_id: user.id, item_id: itemId });
      return { ok: true };
    }
    return { ok: false, reason: 'error' };
  }, [user, coins]);

  // Check card collection size and award milestone coins
  const checkMilestones = useCallback(async (cardCount) => {
    for (const m of MILESTONES) {
      if (cardCount >= m.cards && !earnedReasons.has(m.reason)) {
        await awardCoins(m.coins, m.reason, { cards: cardCount }, `${m.label} +${m.coins} ⚡`);
      }
    }
  }, [awardCoins, earnedReasons]);

  // Coin award for scanning a card
  const awardScanCoins = useCallback(async (rarity, cardName) => {
    const r = (rarity || '').toLowerCase();
    let amount = EARN_RATES.scan_common;
    let label  = 'Common card';
    if (r.includes('secret'))        { amount = EARN_RATES.scan_secret;   label = 'Secret rare!'; }
    else if (r.includes('ultra') || r.includes('illustration')) { amount = EARN_RATES.scan_ultra; label = 'Ultra rare!'; }
    else if (r.includes('holo'))     { amount = EARN_RATES.scan_holo;     label = 'Holo rare!'; }
    else if (r.includes('rare'))     { amount = EARN_RATES.scan_rare;     label = 'Rare!'; }
    else if (r.includes('uncommon')) { amount = EARN_RATES.scan_uncommon; label = 'Uncommon'; }
    await awardCoinsRepeat(amount, `scan_${Date.now()}`, { card: cardName, rarity }, `+${amount} ⚡ ${label}`);
  }, [awardCoinsRepeat]);

  // Login streak
  const checkLoginStreak = useCallback(async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('login_streak, last_login_date')
      .eq('id', user.id)
      .single();
    if (!profile) return;

    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (profile.last_login_date === today) return; // already logged in today

    let newStreak = 1;
    if (profile.last_login_date === yesterday) {
      newStreak = (profile.login_streak || 0) + 1;
    }

    await supabase.from('profiles').update({
      login_streak: newStreak,
      last_login_date: today,
    }).eq('id', user.id);

    // Award streak bonuses
    const today_reason = `streak_${today}`;
    await awardCoins(3, today_reason, { streak: newStreak }, '+3 ⚡ Daily login');

    if (newStreak === 3)  await awardCoins(EARN_RATES.streak_3day,  `streak_3_${today}`,  {}, '🔥 3-day streak!');
    if (newStreak === 7)  await awardCoins(EARN_RATES.streak_7day,  `streak_7_${today}`,  {}, '🔥 7-day streak!');
    if (newStreak === 30) await awardCoins(EARN_RATES.streak_30day, `streak_30_${today}`, {}, '🔥 30-day streak!');
  }, [user, awardCoins]);

  function showToast(amount, label) {
    setToast({ amount, label });
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <CoinsContext.Provider value={{
      coins, toast, awardCoins, awardCoinsRepeat, awardScanCoins,
      spendCoins, checkMilestones, checkLoginStreak, loadCoins,
    }}>
      {children}
    </CoinsContext.Provider>
  );
}

export const useCoins = () => {
  const ctx = useContext(CoinsContext);
  if (!ctx) throw new Error('useCoins must be used inside CoinsProvider');
  return ctx;
};
