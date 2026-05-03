-- PokéScan Database Schema
-- Run this in Supabase SQL Editor first

-- ─── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────
create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  bio          text,
  created_at   timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Friendships ──────────────────────────────────────────────
create table public.friendships (
  id            uuid default uuid_generate_v4() primary key,
  requester_id  uuid references public.profiles(id) on delete cascade not null,
  addressee_id  uuid references public.profiles(id) on delete cascade not null,
  status        text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at    timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- ─── Collection Cards ─────────────────────────────────────────
create table public.collection_cards (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  card_id       text not null,           -- Pokémon TCG API card ID e.g. "base1-4"
  card_name     text not null,
  set_id        text not null,
  set_name      text not null,
  set_series    text,
  card_number   text,
  rarity        text,
  image_url     text,                    -- official TCG API image
  scan_image_url text,                   -- user's uploaded scan (Supabase Storage)
  quantity      int default 1 check (quantity > 0),
  condition     text check (condition in ('mint','near_mint','excellent','good','lightly_played','played','poor')) default 'near_mint',
  is_tradeable  boolean default false,
  added_at      timestamptz default now(),
  unique(user_id, card_id)
);

create index idx_collection_user on public.collection_cards(user_id);
create index idx_collection_card on public.collection_cards(card_id);
create index idx_collection_set  on public.collection_cards(set_id);

-- ─── Wishlist Cards ───────────────────────────────────────────
create table public.wishlist_cards (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  card_id     text not null,
  card_name   text not null,
  set_id      text not null,
  set_name    text not null,
  card_number text,
  rarity      text,
  image_url   text,
  priority    int check (priority between 1 and 3) default 2,
  notes       text,
  added_at    timestamptz default now(),
  unique(user_id, card_id)
);

create index idx_wishlist_user on public.wishlist_cards(user_id);

-- ─── Trade Offers ─────────────────────────────────────────────
create table public.trade_offers (
  id                uuid default uuid_generate_v4() primary key,
  from_user_id      uuid references public.profiles(id) on delete cascade not null,
  to_user_id        uuid references public.profiles(id) on delete cascade not null,
  offered_card_ids  text[] not null,     -- array of collection_cards.id
  wanted_card_ids   text[] not null,     -- array of collection_cards.id
  message           text,
  status            text check (status in ('pending','accepted','declined','countered','cancelled')) default 'pending',
  counter_offer_id  uuid references public.trade_offers(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index idx_trades_from on public.trade_offers(from_user_id);
create index idx_trades_to   on public.trade_offers(to_user_id);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trade_offers_updated_at
  before update on public.trade_offers
  for each row execute procedure public.update_updated_at();

-- ─── Price Cache ──────────────────────────────────────────────
create table public.price_cache (
  card_id       text primary key,
  market_price  numeric(10,2),
  low_price     numeric(10,2),
  mid_price     numeric(10,2),
  high_price    numeric(10,2),
  currency      text default 'USD',
  source        text default 'tcgplayer',
  fetched_at    timestamptz default now()
);

-- ─── Scan Sessions ────────────────────────────────────────────
create table public.scan_sessions (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  raw_image_urls  text[],
  results_json    jsonb,
  cards_saved     int default 0,
  status          text check (status in ('processing','complete','failed')) default 'processing',
  created_at      timestamptz default now()
);
