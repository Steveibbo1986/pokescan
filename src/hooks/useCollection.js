// src/hooks/useCollection.js
import { useEffect, useState, useCallback } from 'react';
import { getCollection, upsertCard, removeCard, setTradeable } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useCollection() {
  const { user } = useAuth();
  const [cards, setCards]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await getCollection(user.id);
    if (error) setError(error.message);
    else setCards(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const addCard = async (cardData) => {
    const { data, error } = await upsertCard(user.id, cardData);
    if (error) throw error;
    await fetch();
    return data;
  };

  const deleteCard = async (id) => {
    await removeCard(id);
    setCards(c => c.filter(x => x.id !== id));
  };

  const toggleTradeable = async (id, val) => {
    await setTradeable(id, val);
    setCards(c => c.map(x => x.id === id ? { ...x, is_tradeable: val } : x));
  };

  // Group by set for display
  const bySet = cards.reduce((acc, card) => {
    const key = card.set_id;
    if (!acc[key]) acc[key] = { set_name: card.set_name, cards: [] };
    acc[key].cards.push(card);
    return acc;
  }, {});

  return { cards, bySet, loading, error, addCard, deleteCard, toggleTradeable, refetch: fetch };
}
