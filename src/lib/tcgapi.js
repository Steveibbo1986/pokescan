// src/lib/tcgapi.js
const BASE = 'https://api.pokemontcg.io/v2';
const USD_TO_GBP = 0.79;

export function toGBP(usd) {
  if (!usd) return null;
  return (usd * USD_TO_GBP).toFixed(2);
}

export function formatGBP(usd) {
  const gbp = toGBP(usd);
  return gbp ? `£${gbp}` : null;
}

const headers = {};

// ─── Improved card finder — matches by number+name+set, not just latest ──
export async function findCard({ name, setName, cardNumber, year }) {
  if (!name) return null;

  const cleanName = name.trim()
    .replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a').replace(/[ùû]/g, 'u')
    .replace(/[^\w\s'.\-♂♀é]/g, '').trim();

  // Strategy 1: card number + name (most precise — number is printed on the card)
  if (cardNumber) {
    const num = cardNumber.replace(/^0+/, '').split('/')[0].trim();
    const all = await tcgSearchAll(`name:"${cleanName}" number:${num}`, 20);
    if (all.length === 1) return normaliseCard(all[0]);
    if (all.length > 1) {
      // Multiple hits — use year to pick the right set
      if (year) {
        const yearMatch = all.find(c => c.set?.releaseDate?.startsWith(year));
        if (yearMatch) return normaliseCard(yearMatch);
      }
      // Use set name to narrow down
      if (setName) {
        const setNorm = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const setMatch = all.find(c => {
          const cn = (c.set?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cn.includes(setNorm) || setNorm.includes(cn);
        });
        if (setMatch) return normaliseCard(setMatch);
      }
      // Return oldest matching card (vintage collectors are scanning older cards)
      const sorted = all.sort((a, b) => (a.set?.releaseDate || '').localeCompare(b.set?.releaseDate || ''));
      return normaliseCard(year ? sorted[0] : all[0]);
    }
  }

  // Strategy 2: name + set name
  if (setName) {
    const setNorm = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const all = await tcgSearchAll(`name:"${cleanName}"`, 50);
    const setMatch = all.find(c => {
      const cn = (c.set?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cn.includes(setNorm) || setNorm.includes(cn) || levenshtein(cn, setNorm) < 3;
    });
    if (setMatch) return normaliseCard(setMatch);
  }

  // Strategy 3: name + year
  if (year) {
    const all = await tcgSearchAll(`name:"${cleanName}"`, 50);
    const yearMatch = all.find(c => c.set?.releaseDate?.startsWith(year));
    if (yearMatch) return normaliseCard(yearMatch);
  }

  // Strategy 4: exact name, ordered by release date ascending (get older cards first for vintage)
  const result = await tcgSearch(`name:"${cleanName}"`, year ? 'asc' : 'desc');
  if (result) return result;

  // Strategy 5: first word of name (handles "Charizard ex" → search "Charizard")
  const firstWord = cleanName.split(' ')[0];
  if (firstWord.length > 3 && firstWord !== cleanName) {
    const r = await tcgSearch(`name:"${firstWord}"`, 'desc');
    if (r) return r;
  }

  // Strategy 6: unquoted fuzzy
  return await tcgSearch(`name:${cleanName}`, 'desc');
}

async function tcgSearch(query, order = 'desc') {
  try {
    const url = `${BASE}/cards?q=${encodeURIComponent(query)}&pageSize=1&orderBy=${order === 'asc' ? 'set.releaseDate' : '-set.releaseDate'}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.length ? normaliseCard(data.data[0]) : null;
  } catch { return null; }
}

async function tcgSearchAll(query, pageSize = 10) {
  try {
    const url = `${BASE}/cards?q=${encodeURIComponent(query)}&pageSize=${pageSize}&orderBy=-set.releaseDate`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch { return []; }
}

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) => Array.from({length: n+1}, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// ─── Get card by ID ──────────────────────────────────────────
export async function getCardById(cardId) {
  try {
    const res = await fetch(`${BASE}/cards/${cardId}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return normaliseCard(data.data);
  } catch { return null; }
}

// ─── Search all cards for a Pokémon name ────────────────────
export async function searchPokemonCards(pokemonName, page = 1) {
  // Include illustrator/special cards by also searching subtypes
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

// ─── Sets ────────────────────────────────────────────────────
export async function getSets() {
  const res = await fetch(`${BASE}/sets?orderBy=-releaseDate&pageSize=250`, { headers });
  if (!res.ok) throw new Error('Failed to fetch sets');
  const data = await res.json();
  return data.data.map(s => ({
    id: s.id, name: s.name, series: s.series,
    total: s.total, printedTotal: s.printedTotal,
    releaseDate: s.releaseDate,
    logo: s.images?.logo, symbol: s.images?.symbol,
  }));
}

export async function getCardsInSet(setId, page = 1, pageSize = 250) {
  const res = await fetch(`${BASE}/cards?q=set.id:${setId}&page=${page}&pageSize=${pageSize}&orderBy=number`, { headers });
  if (!res.ok) throw new Error('Failed to fetch set cards');
  const data = await res.json();
  return { cards: data.data.map(normaliseCard), total: data.totalCount, page: data.page };
}

// ─── Bulk resolve with better error handling ─────────────────
export async function resolveCards(identifiedCards) {
  const resolved = await Promise.allSettled(
    identifiedCards.map(async (card) => {
      if (card.error && card.error !== 'unclear') return { ...card, resolved: false };
      try {
        const tcgCard = await findCard({
          name:       card.name,
          setName:    card.set_name,
          cardNumber: card.card_number,
          year:       card.year,
        });
        if (!tcgCard) return { ...card, resolved: false, tcgCard: null };
        return { ...card, resolved: true, tcgCard };
      } catch (err) {
        return { ...card, resolved: false, tcgCard: null };
      }
    })
  );
  return resolved.map(r => r.status === 'fulfilled' ? r.value : { error: 'resolution_failed', resolved: false });
}

// ─── Normalise ───────────────────────────────────────────────
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
  const tier = prices.holofoil || prices.normal || prices['1stEditionNormal']
             || prices.reverseHolofoil || prices['1stEditionHolofoil'];
  if (!tier) return null;
  return { market: tier.market, low: tier.low, mid: tier.mid, high: tier.high };
}
