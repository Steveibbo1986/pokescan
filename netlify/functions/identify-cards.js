// netlify/functions/identify-cards.js
// Haiku model for speed. Individual cards run fully parallel.
// Grid mode identifies all 9 in one API call.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const body = JSON.parse(event.body);

    if (body.mode === 'grid' && body.image) {
      const results = await identifyGrid(body.image);
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'grid' }) };
    }

    if (body.images && Array.isArray(body.images)) {
      if (body.images.length > 9) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 9 images' }) };
      // All cards identified in parallel — no sequential waiting
      const results = await Promise.all(body.images.map((img, idx) => identifyCard(img, idx)));
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'individual' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide image (grid) or images (individual)' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function identifyGrid(imageData) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);
  const response  = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `Expert Pokémon TCG identifier. Find ALL cards in this photo left-to-right, top-to-bottom.
For each card read: name (top of card), card number (bottom-right e.g. "4/102"), set name, rarity.
Base Set=102 cards, Jungle=64, Fossil=62, Team Rocket=82.
Return ONLY a JSON array:
[{"position":1,"name":"Charizard","set_name":"Base Set","card_number":"4/102","rarity":"Holo Rare","confidence":"high","error":null}]
Empty slot: {"position":N,"error":"empty"}  Unclear: {"position":N,"name":"best guess","error":"unclear","confidence":"low"}
ONLY the JSON array, nothing else.` }
  ], 1500);
  return parseArrayResponse(response);
}

async function identifyCard(imageData, index) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);
  const response  = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `Identify this Pokémon card. Return ONLY JSON:
{"name":"exact name","set_name":"set name","card_number":"4/102","rarity":"Holo Rare","hp":"120","confidence":"high","error":null}
Not a card: {"error":"not_a_pokemon_card"}  Blurry: {"name":"best guess","error":"unclear","confidence":"low"}` }
  ], 300);
  try {
    const clean = response.replace(/```json|```/g, '').trim();
    return { index, ...JSON.parse(clean) };
  } catch { return { index, error: 'parse_error' }; }
}

async function callClaude(content, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // fastest + cheapest for vision
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) { const err = await res.text(); console.error('Claude API error:', res.status, err); throw new Error(`Claude API ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseArrayResponse(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) { const parsed = JSON.parse(match[0]); return Array.isArray(parsed) ? parsed : []; }
    return [];
  } catch (e) { console.error('Parse error:', e, 'Raw:', text.slice(0, 200)); return []; }
}

function extractBase64(imageData) {
  const raw = typeof imageData === 'string' ? imageData : (imageData?.base64 || '');
  return raw.replace(/^data:image\/[a-z]+;base64,/, '');
}

function extractMediaType(imageData) {
  if (typeof imageData === 'object' && imageData?.mediaType) return imageData.mediaType;
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    const match = imageData.match(/^data:(image\/[a-z]+);base64,/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}
