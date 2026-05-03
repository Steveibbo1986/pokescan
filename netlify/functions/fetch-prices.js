// netlify/functions/fetch-prices.js
// Fetches and caches card prices from the Pokémon TCG API

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const { cardIds } = JSON.parse(event.body);
    if (!cardIds || !Array.isArray(cardIds)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'cardIds array required' }) };
    }

    const prices = {};
    // Fetch in chunks of 20 to avoid URL length limits
    const chunks = chunkArray(cardIds, 20);

    for (const chunk of chunks) {
      const query = chunk.map(id => `id:${id}`).join(' OR ');
      const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&select=id,name,tcgplayer`;

      const res = await fetch(url, {
        headers: process.env.TCG_API_KEY ? { 'X-Api-Key': process.env.TCG_API_KEY } : {},
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const card of data.data || []) {
        const p = card.tcgplayer?.prices;
        if (!p) continue;

        // Get best available price tier (holofoil > normal > 1stEditionNormal)
        const tier = p.holofoil || p.normal || p['1stEditionNormal'] || p.reverseHolofoil || null;
        if (tier) {
          prices[card.id] = {
            market: tier.market || null,
            low: tier.low || null,
            mid: tier.mid || null,
            high: tier.high || null,
            url: card.tcgplayer?.url || null,
          };
        }
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ prices }) };
  } catch (err) {
    console.error('fetch-prices error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
