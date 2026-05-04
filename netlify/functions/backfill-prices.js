// netlify/functions/backfill-prices.js
// Call this once to fetch and store prices for all cards missing price data
// POST with { userId } to backfill a specific user's collection

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY  // needs service key to write prices
  );

  try {
    const { userId } = JSON.parse(event.body || '{}');
    if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId required' }) };

    // Get all cards with no price data
    const { data: cards, error } = await supabase
      .from('collection_cards')
      .select('id, card_id, card_name')
      .eq('user_id', userId)
      .is('market_price_gbp', null);

    if (error) throw error;
    if (!cards?.length) return { statusCode: 200, headers, body: JSON.stringify({ message: 'No cards need pricing', updated: 0 }) };

    const USD_TO_GBP = 0.79;
    let updated = 0;
    let failed  = 0;

    // Process in chunks of 20 to avoid rate limits
    const chunks = chunkArray(cards, 20);

    for (const chunk of chunks) {
      // Build TCG API query
      const query = chunk.map(c => `id:${c.card_id}`).join(' OR ');
      const url   = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&select=id,tcgplayer&pageSize=20`;

      try {
        const res  = await fetch(url);
        const data = await res.json();
        const priceMap = {};

        for (const card of data.data || []) {
          const p    = card.tcgplayer?.prices;
          const tier = p ? (p.holofoil || p.normal || p['1stEditionNormal'] || p.reverseHolofoil || p['1stEditionHolofoil']) : null;
          if (tier?.market) {
            priceMap[card.id] = (tier.market * USD_TO_GBP).toFixed(2);
          }
        }

        // Update each card that got a price
        for (const card of chunk) {
          const price = priceMap[card.card_id];
          if (price) {
            const { error: updateError } = await supabase
              .from('collection_cards')
              .update({ market_price_gbp: price })
              .eq('id', card.id);
            if (!updateError) updated++;
            else { console.error('Update error:', updateError); failed++; }
          } else {
            failed++; // no price available from TCG API
          }
        }
      } catch (chunkErr) {
        console.error('Chunk error:', chunkErr);
        failed += chunk.length;
      }

      // Small delay between chunks to be kind to the API
      await sleep(300);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: `Backfill complete`,
        total: cards.length,
        updated,
        failed,
        no_price_available: failed,
      }),
    };
  } catch (err) {
    console.error('Backfill error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
