-- PokéScan Row Level Security
-- Run this AFTER schema.sql in Supabase SQL Editor

-- ─── Enable RLS on all tables ─────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.friendships      enable row level security;
alter table public.collection_cards enable row level security;
alter table public.wishlist_cards   enable row level security;
alter table public.trade_offers     enable row level security;
alter table public.price_cache      enable row level security;
alter table public.scan_sessions    enable row level security;

-- ─── Profiles ─────────────────────────────────────────────────
-- Anyone can read profiles (needed for community/trades)
create policy "profiles_read_all"    on public.profiles for select using (true);
-- Only owner can update their own profile
create policy "profiles_update_own"  on public.profiles for update using (auth.uid() = id);

-- ─── Friendships ──────────────────────────────────────────────
-- See friendships you're part of
create policy "friendships_read"     on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
-- Send a friend request
create policy "friendships_insert"   on public.friendships for insert
  with check (auth.uid() = requester_id);
-- Accept/decline (addressee) or cancel (requester)
create policy "friendships_update"   on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_delete"   on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ─── Collection Cards ─────────────────────────────────────────
-- Anyone can view collections (needed for trading/community)
create policy "collection_read_all"  on public.collection_cards for select using (true);
-- Only owner can modify their collection
create policy "collection_insert"    on public.collection_cards for insert
  with check (auth.uid() = user_id);
create policy "collection_update"    on public.collection_cards for update
  using (auth.uid() = user_id);
create policy "collection_delete"    on public.collection_cards for delete
  using (auth.uid() = user_id);

-- ─── Wishlist Cards ───────────────────────────────────────────
-- Anyone can see wishlists (helpful for trading - "I need this card")
create policy "wishlist_read_all"    on public.wishlist_cards for select using (true);
create policy "wishlist_insert"      on public.wishlist_cards for insert
  with check (auth.uid() = user_id);
create policy "wishlist_update"      on public.wishlist_cards for update
  using (auth.uid() = user_id);
create policy "wishlist_delete"      on public.wishlist_cards for delete
  using (auth.uid() = user_id);

-- ─── Trade Offers ─────────────────────────────────────────────
-- Only see trades you're involved in
create policy "trades_read"          on public.trade_offers for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
-- Only sender can create
create policy "trades_insert"        on public.trade_offers for insert
  with check (auth.uid() = from_user_id);
-- Either party can update (accept/decline/cancel)
create policy "trades_update"        on public.trade_offers for update
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- ─── Price Cache ──────────────────────────────────────────────
-- Everyone can read prices
create policy "prices_read_all"      on public.price_cache for select using (true);
-- Only service role (Netlify functions) can write prices
-- (insert/update via service key only - no user-facing policy needed)

-- ─── Scan Sessions ────────────────────────────────────────────
create policy "scans_own"            on public.scan_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
