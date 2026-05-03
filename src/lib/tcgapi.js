// src/lib/tcgapi.js
// Wrapper around the free Pokémon TCG API (api.pokemontcg.io)

const BASE = 'https://api.pokemontcg.io/v2';
const USD_TO_GBP = 0.79; // approximate - update as needed

export function toGBP(usd) {
  if (!usd) return null;
  return (usd * USD_TO_GBP).toFixed(2);
}

export function formatGBP(usd) {
  const gbp = toGBP(usd);
  if (!gbp) return null;
  return `£${gbp}`;
}

const headers = {};

// ─── Card search ────────────────────────────────────────────
export async function findCard({ name, setName, cardNumber }) {
  const parts = [];
  if (name)       parts.push(`name:"${name}"`);
  if (cardNumber) parts.push(`number:${cardNumber.replace(/^0+/, '')}`);

  const query = parts.join(' ');
  const url = `${BASE}/cards?q=${encodeURIComponent(query)}&pageSize=10`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const data = await res.json();

  if (!data.data?.length) return null;

  if (setName) {
    const setNorm = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = data.data.find(c => {
      const cn = (c.set?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cn.includes(setNorm) || setNorm.includes(cn);
    });
    if (match) return normaliseCard(match);
  }

  return normaliseCard(data.data[0]);
}

// Get a single card by its ID
export async function getCardById(cardId) {
  const res = await fetch(`${BASE}/cards/${cardId}`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return normaliseCard(data.data);
}

// ─── Pokémon search - all cards for a named Pokémon ─────────
export async function searchPokemonCards(pokemonName, page = 1) {
  const query = `name:"${pokemonName}"`;
  const url = `${BASE}/cards?q=${encodeURIComponent(query)}&page=${page}&pageSize=50&orderBy=-set.releaseDate`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const data = await res.json();

  return {
    cards: data.data.map(normaliseCard),
    total: data.totalCount,
    page: data.page,
    pageSize: data.pageSize,
  };
}

// ─── Set browsing ───────────────────────────────────────────
export async function getSets() {
  const res = await fetch(`${BASE}/sets?orderBy=-releaseDate&pageSize=250`, { headers });
  if (!res.ok) throw new Error('Failed to fetch sets');
  const data = await res.json();
  return data.data.map(s => ({
    id: s.id,
    name: s.name,
    series: s.series,
    total: s.total,
    printedTotal: s.printedTotal,
    releaseDate: s.releaseDate,
    logo: s.images?.logo,
    symbol: s.images?.symbol,
  }));
}

export async function getCardsInSet(setId, page = 1, pageSize = 250) {
  const res = await fetch(
    `${BASE}/cards?q=set.id:${setId}&page=${page}&pageSize=${pageSize}&orderBy=number`,
    { headers }
  );
  if (!res.ok) throw new Error('Failed to fetch set cards');
  const data = await res.json();
  return {
    cards: data.data.map(normaliseCard),
    total: data.totalCount,
    page: data.page,
  };
}

// ─── Bulk card resolution ───────────────────────────────────
export async function resolveCards(identifiedCards) {
  const resolved = await Promise.allSettled(
    identifiedCards.map(async (card) => {
      if (card.error) return { ...card, resolved: false };
      const tcgCard = await findCard({
        name: card.name,
        setName: card.set_name,
        cardNumber: card.card_number,
      });
      if (!tcgCard) return { ...card, resolved: false, tcgCard: null };
      return { ...card, resolved: true, tcgCard };
    })
  );
  return resolved.map(r => r.status === 'fulfilled' ? r.value : { error: 'resolution_failed' });
}

// ─── Normalise card shape ───────────────────────────────────
export function normaliseCard(c) {
  if (!c) return null;
  const prices = extractPrices(c.tcgplayer?.prices);
  return {
    id: c.id,
    name: c.name,
    set_id: c.set?.id,
    set_name: c.set?.name,
    set_series: c.set?.series,
    card_number: c.number,
    rarity: c.rarity,
    hp: c.hp,
    types: c.types,
    image_small: c.images?.small,
    image_large: c.images?.large,
    tcgplayer_url: c.tcgplayer?.url,
    prices,
    prices_gbp: prices ? {
      market: toGBP(prices.market),
      low:    toGBP(prices.low),
      mid:    toGBP(prices.mid),
      high:   toGBP(prices.high),
    } : null,
  };
}

function extractPrices(prices) {
  if (!prices) return null;
  const tier = prices.holofoil || prices.normal || prices['1stEditionNormal'] || prices.reverseHolofoil;
  if (!tier) return null;
  return {
    market: tier.market,
    low:    tier.low,
    mid:    tier.mid,
    high:   tier.high,
  };
}
