// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Auth helpers ───────────────────────────────────────────
export const signUp = (email, password, username) =>
  supabase.auth.signUp({ email, password, options: { data: { username } } });

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getUser = () => supabase.auth.getUser();

// ─── Profile helpers ────────────────────────────────────────
export const getProfile = (userId) =>
  supabase.from('profiles').select('*').eq('id', userId).single();

export const updateProfile = (userId, updates) =>
  supabase.from('profiles').update(updates).eq('id', userId);

export const searchProfiles = (query) =>
  supabase.from('profiles').select('id, username, display_name, avatar_url')
    .ilike('username', `%${query}%`).limit(20);

// ─── Collection helpers ─────────────────────────────────────
export const getCollection = (userId) =>
  supabase.from('collection_cards').select('*').eq('user_id', userId).order('added_at', { ascending: false });

export const upsertCard = async (userId, cardData) => {
  const existing = await supabase.from('collection_cards')
    .select('id, quantity').eq('user_id', userId).eq('card_id', cardData.card_id).single();

  if (existing.data) {
    return supabase.from('collection_cards')
      .update({ quantity: existing.data.quantity + 1 })
      .eq('id', existing.data.id).select().single();
  }
  return supabase.from('collection_cards')
    .insert({ user_id: userId, ...cardData }).select().single();
};

export const removeCard = (collectionCardId) =>
  supabase.from('collection_cards').delete().eq('id', collectionCardId);

export const setTradeable = (collectionCardId, tradeable) =>
  supabase.from('collection_cards').update({ is_tradeable: tradeable }).eq('id', collectionCardId);

// ─── Wishlist helpers ───────────────────────────────────────
export const getWishlist = (userId) =>
  supabase.from('wishlist_cards').select('*').eq('user_id', userId).order('priority');

export const addToWishlist = (userId, cardData) =>
  supabase.from('wishlist_cards').upsert({ user_id: userId, ...cardData });

export const removeFromWishlist = (wishlistCardId) =>
  supabase.from('wishlist_cards').delete().eq('id', wishlistCardId);

// ─── Trade helpers ──────────────────────────────────────────
export const getTrades = (userId) =>
  supabase.from('trade_offers').select(`
    *,
    from_profile:profiles!trade_offers_from_user_id_fkey(id, username, display_name, avatar_url),
    to_profile:profiles!trade_offers_to_user_id_fkey(id, username, display_name, avatar_url)
  `).or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

export const createTrade = (tradeData) =>
  supabase.from('trade_offers').insert(tradeData).select().single();

export const updateTradeStatus = (tradeId, status) =>
  supabase.from('trade_offers').update({ status }).eq('id', tradeId);

// ─── Friendship helpers ─────────────────────────────────────
export const getFriends = (userId) =>
  supabase.from('friendships').select(`
    *,
    requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
    addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
  `).or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');

export const sendFriendRequest = (requesterId, addresseeId) =>
  supabase.from('friendships').insert({ requester_id: requesterId, addressee_id: addresseeId });

export const respondToFriendRequest = (friendshipId, status) =>
  supabase.from('friendships').update({ status }).eq('id', friendshipId);

// ─── Realtime subscription (fixed) ─────────────────────────
export const subscribeTrades = (userId, callback) => {
  const channel = supabase.channel(`trades-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trade_offers',
        filter: `to_user_id=eq.${userId}`,
      },
      callback
    );

  channel.subscribe();
  return channel;
};
