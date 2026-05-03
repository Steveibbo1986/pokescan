// src/lib/tcgapi.js
// Wrapper around the free Pokémon TCG API (api.pokemontcg.io)

const BASE = 'https://api.pokemontcg.io/v2';

const headers = {};
// Optional: add API key for higher rate limits (10/sec free vs 1000/sec with key)
// if (import.meta.env.VITE_TCG_API_KEY) headers['X-Api-Key'] = import.meta.env.VITE_TCG_API_KEY;

// ─── Card search ────────────────────────────────────────────
// Find a card by name + set info (from Claude's identification)
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

  // If we have set name, try to match it
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
// Given Claude's output for multiple cards, resolve all via TCG API
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
function normaliseCard(c) {
  if (!c) return null;
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
    prices: extractPrices(c.tcgplayer?.prices),
  };
}

function extractPrices(prices) {
  if (!prices) return null;
  const tier = prices.holofoil || prices.normal || prices['1stEditionNormal'] || prices.reverseHolofoil;
  if (!tier) return null;
  return {
    market: tier.market,
    low: tier.low,
    mid: tier.mid,
    high: tier.high,
  };
}
