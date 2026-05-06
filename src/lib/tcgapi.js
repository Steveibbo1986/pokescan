// src/lib/tcgapi.js
// Supports English cards (pokemontcg.io) + International cards (TCGdex)

const BASE     = 'https://api.pokemontcg.io/v2';
const TCGDEX   = 'https://api.tcgdex.net/v2';
const USD_TO_GBP = 0.79;

// Languages routed to TCGdex (pokemontcg.io is English-only)
const INTERNATIONAL_LANGS = new Set([
  'japanese', 'chinese_traditional', 'chinese_simplified',
  'korean', 'french', 'german', 'spanish', 'italian',
  'portuguese', 'thai', 'indonesian',
]);

const LANG_TO_TCGDEX = {
  japanese:            'ja',
  chinese_traditional: 'zh-Hant',
  chinese_simplified:  'zh-Hans',
  korean:              'ko',
  french:              'fr',
  german:              'de',
  spanish:             'es',
  italian:             'it',
  portuguese:          'pt',
  thai:                'th',
  indonesian:          'id',
};

export const toGBP    = (usd) => usd ? (usd * USD_TO_GBP).toFixed(2) : null;
export const formatGBP = (usd) => { const g = toGBP(usd); return g ? `£${g}` : null; };

const headers = {};

// ─── Main router — English vs International ──────────────────
export async function findCard({ name, nameEn, setName, cardNumber, year, language }) {
  if (!name && !nameEn) return null;

  const isInternational = language && INTERNATIONAL_LANGS.has(language.toLowerCase());

  if (isInternational) {
    // Try TCGdex first for the original language
    const intlResult = await findCardTcgDex({ name, nameEn, cardNumber, setName, language });
    if (intlResult) return intlResult;
    // Fallback: if we have an English name, try pokemontcg.io
    if (nameEn) return findCardEnglish({ name: nameEn, setName, cardNumber, year });
    return null;
  }

  return findCardEnglish({ name: nameEn || name, setName, cardNumber, year });
}

// ─── TCGdex — international card lookup ──────────────────────
async function findCardTcgDex({ name, nameEn, cardNumber, setName, language }) {
  const lang = LANG_TO_TCGDEX[language?.toLowerCase()] || 'ja';

  // Strategy 1: search by number in the language endpoint
  if (cardNumber) {
    const num = cardNumber.replace(/^0+/, '').split('/')[0].trim();
    // TCGdex: GET /v2/{lang}/cards?filters[number]={num}
    const result = await tcgdexSearch(lang, `filters[number]=${num}`, name || nameEn);
    if (result) return result;
  }

  // Strategy 2: search by name in the target language
  const searchName = name || nameEn || '';
  if (searchName) {
    const result = await tcgdexSearchByName(lang, searchName);
    if (result) return result;
  }

  // Strategy 3: search the English name in the international DB
  if (nameEn && nameEn !== name) {
    const result = await tcgdexSearchByName(lang, nameEn);
    if (result) return result;
  }

  return null;
}

async function tcgdexSearch(lang, filter, nameFallback) {
  try {
    const url = `${TCGDEX}/${lang}/cards?${filter}&pagination[limit]=20`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cards = Array.isArray(data) ? data : data.data || [];
    if (!cards.length) return null;

    // If multiple results pick the one whose name best matches
    if (nameFallback && cards.length > 1) {
      const normFallback = nameFallback.toLowerCase();
      const best = cards.find(c =>
        (c.name || '').toLowerCase().includes(normFallback) ||
        normFallback.includes((c.name || '').toLowerCase())
      );
      if (best) return await tcgdexGetCard(lang, best.id);
    }
    return await tcgdexGetCard(lang, cards[0].id);
  } catch { return null; }
}

async function tcgdexSearchByName(lang, name) {
  try {
    const encoded = encodeURIComponent(name);
    const url     = `${TCGDEX}/${lang}/cards?filters[name]=${encoded}&pagination[limit]=5`;
    const res     = await fetch(url);
    if (!res.ok) return null;
    const data  = await res.json();
    const cards = Array.isArray(data) ? data : data.data || [];
    if (!cards.length) return null;
    return await tcgdexGetCard(lang, cards[0].id);
  } catch { return null; }
}

async function tcgdexGetCard(lang, id) {
  try {
    const res  = await fetch(`${TCGDEX}/${lang}/cards/${id}`);
    if (!res.ok) return null;
    const c = await res.json();
    return normaliseTcgDexCard(c, lang);
  } catch { return null; }
}

function normaliseTcgDexCard(c, lang) {
  if (!c) return null;
  return {
    id:          `tcgdex-${lang}-${c.id}`,
    name:        c.name,
    name_en:     c.name, // TCGdex returns name in the requested lang
    language:    lang,
    set_id:      c.set?.id,
    set_name:    c.set?.name,
    set_series:  c.set?.serie?.name,
    card_number: c.localId || c.id?.split('-').pop(),
    rarity:      c.rarity,
    hp:          c.hp?.toString(),
    types:       c.types,
    image_small: c.image ? `${c.image}/low.webp` : null,
    image_large: c.image ? `${c.image}/high.webp` : null,
    prices:      null,
    prices_gbp:  null,   // TCGdex is data-only, no price data — that's fine
    is_international: true,
    original_language: lang,
  };
}

// ─── pokemontcg.io — English card lookup ─────────────────────
async function findCardEnglish({ name, setName, cardNumber, year }) {
  if (!name) return null;

  const cleanName = name.trim()
    .replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a').replace(/[ùû]/g, 'u')
    .replace(/[^\w\s'.\-♂♀]/g, '').trim();

  if (cardNumber) {
    const num = cardNumber.replace(/^0+/, '').split('/')[0].trim();
    const all = await tcgSearchAll(`name:"${cleanName}" number:${num}`, 20);
    if (all.length === 1) return normaliseCard(all[0]);
    if (all.length > 1) {
      if (year) {
        const y = all.find(c => c.set?.releaseDate?.startsWith(year));
        if (y) return normaliseCard(y);
      }
      if (setName) {
        const setNorm = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sm = all.find(c => {
          const cn = (c.set?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cn.includes(setNorm) || setNorm.includes(cn);
        });
        if (sm) return normaliseCard(sm);
      }
      const sorted = all.sort((a, b) => (a.set?.releaseDate || '').localeCompare(b.set?.releaseDate || ''));
      return normaliseCard(year ? sorted[0] : all[0]);
    }
  }

  if (setName) {
    const setNorm = setName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const all = await tcgSearchAll(`name:"${cleanName}"`, 50);
    const sm  = all.find(c => {
      const cn = (c.set?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cn.includes(setNorm) || setNorm.includes(cn) || levenshtein(cn, setNorm) < 3;
    });
    if (sm) return normaliseCard(sm);
  }

  if (year) {
    const all   = await tcgSearchAll(`name:"${cleanName}"`, 50);
    const yearM = all.find(c => c.set?.releaseDate?.startsWith(year));
    if (yearM) return normaliseCard(yearM);
  }

  const r1 = await tcgSearch(`name:"${cleanName}"`, year ? 'asc' : 'desc');
  if (r1) return r1;

  const firstWord = cleanName.split(' ')[0];
  if (firstWord.length > 3 && firstWord !== cleanName) {
    const r2 = await tcgSearch(`name:"${firstWord}"`, 'desc');
    if (r2) return r2;
  }

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

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1}, (_,i) => Array.from({length:n+1}, (_,j) => i===0?j:j===0?i:0));
  for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}

// ─── Resolve identified cards (handles language routing) ──────
export async function resolveCards(identifiedCards) {
  const resolved = await Promise.allSettled(
    identifiedCards.map(async (card) => {
      if (card.error && card.error !== 'unclear') return { ...card, resolved: false };
      try {
        const tcgCard = await findCard({
          name:       card.name,
          nameEn:     card.name_en,
          setName:    card.set_name || card.set_name_original,
          cardNumber: card.card_number,
          year:       card.year,
          language:   card.language,
        });
        if (!tcgCard) return { ...card, resolved: false, tcgCard: null };
        return { ...card, resolved: true, tcgCard };
      } catch { return { ...card, resolved: false, tcgCard: null }; }
    })
  );
  return resolved.map(r => r.status === 'fulfilled' ? r.value : { error: 'resolution_failed', resolved: false });
}

// ─── Other exports ────────────────────────────────────────────
export async function getCardById(cardId) {
  try {
    const res  = await fetch(`${BASE}/cards/${cardId}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return normaliseCard(data.data);
  } catch { return null; }
}

export async function searchPokemonCards(pokemonName, page = 1) {
  const query = `name:"${pokemonName}"`;
  const url   = `${BASE}/cards?q=${encodeURIComponent(query)}&page=${page}&pageSize=50&orderBy=-set.releaseDate`;
  const res   = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`);
  const data  = await res.json();
  return { cards: data.data.map(normaliseCard), total: data.totalCount, page: data.page, pageSize: data.pageSize };
}

export async function getSets() {
  const res  = await fetch(`${BASE}/sets?orderBy=-releaseDate&pageSize=250`, { headers });
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
  const res  = await fetch(`${BASE}/cards?q=set.id:${setId}&page=${page}&pageSize=${pageSize}&orderBy=number`, { headers });
  if (!res.ok) throw new Error('Failed to fetch set cards');
  const data = await res.json();
  return { cards: data.data.map(normaliseCard), total: data.totalCount, page: data.page };
}

export function normaliseCard(c) {
  if (!c) return null;
  const prices = extractPrices(c.tcgplayer?.prices);
  return {
    id: c.id, name: c.name,
    set_id: c.set?.id, set_name: c.set?.name, set_series: c.set?.series,
    card_number: c.number, rarity: c.rarity, hp: c.hp, types: c.types,
    image_small: c.images?.small, image_large: c.images?.large,
    tcgplayer_url: c.tcgplayer?.url, prices,
    prices_gbp: prices ? { market: toGBP(prices.market), low: toGBP(prices.low), mid: toGBP(prices.mid), high: toGBP(prices.high) } : null,
  };
}

function extractPrices(prices) {
  if (!prices) return null;
  const tier = prices.holofoil || prices.normal || prices['1stEditionNormal'] || prices.reverseHolofoil || prices['1stEditionHolofoil'];
  if (!tier) return null;
  return { market: tier.market, low: tier.low, mid: tier.mid, high: tier.high };
}
