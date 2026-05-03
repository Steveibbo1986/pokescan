// src/hooks/useTrades.jsx
import { useEffect, useState, useCallback } from 'react';
import { getTrades, createTrade, updateTradeStatus } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useTrades() {
  const { user } = useAuth();
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await getTrades(user.id);
    setTrades(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const incoming = trades.filter(t => t.to_user_id === user?.id && t.status === 'pending');
  const outgoing = trades.filter(t => t.from_user_id === user?.id);
  const history  = trades.filter(t => ['accepted','declined','cancelled'].includes(t.status));

  const send = async ({ toUserId, offeredCardIds, wantedCardIds, message }) => {
    const { data, error } = await createTrade({
      from_user_id: user.id,
      to_user_id: toUserId,
      offered_card_ids: offeredCardIds,
      wanted_card_ids: wantedCardIds,
      message,
    });
    if (error) throw error;
    await fetch();
    return data;
  };

  const respond = async (tradeId, status) => {
    await updateTradeStatus(tradeId, status);
    setTrades(t => t.map(x => x.id === tradeId ? { ...x, status } : x));
  };

  return { trades, incoming, outgoing, history, loading, send, respond, refetch: fetch };
}
