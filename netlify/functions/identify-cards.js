// netlify/functions/identify-cards.js
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: 'Method not allowed' };

  try {
    const body = JSON.parse(event.body);

    // Grid: one photo, multiple cards
    if (body.mode === 'grid' && body.image) {
      const results = await identifyGrid(body.image);
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'grid' }) };
    }

    // Single card
    if (body.image) {
      const result = await identifySingle(body.image);
      return { statusCode: 200, headers, body: JSON.stringify({ result, mode: 'single' }) };
    }

    // Legacy: array of images (keep for backwards compat)
    if (body.images && Array.isArray(body.images)) {
      const results = await Promise.all(body.images.map((img, i) => identifySingle(img, i)));
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'individual' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide image or images' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function identifySingle(imageData, index = 0) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);

  const response = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `You are an expert Pokémon TCG card identifier.

Look carefully at this card image and extract the following information EXACTLY as printed on the card:

1. CARD NAME — printed at the TOP of the card (e.g. "Charizard", "Pikachu", "Dark Blastoise", "Mewtwo ex")
2. CARD NUMBER — printed at the BOTTOM of the card, usually bottom-right (e.g. "4/102", "025/165", "SV1")
3. SET NAME — the set this belongs to. Look for the set symbol (bottom-left icon) and any set text.
   Common sets: Base Set, Jungle, Fossil, Team Rocket, Gym Heroes, Gym Challenge, Neo Genesis, Neo Discovery,
   Scarlet & Violet, Paldea Evolved, Obsidian Flames, Paradox Rift, Temporal Forces, Twilight Masquerade,
   Stellar Crown, Surging Sparks, Prismatic Evolutions, 151, Crown Zenith, Silver Tempest, Lost Origin.
4. YEAR — the year printed at the bottom of the card (e.g. 1999, 2023)
5. HP — the HP number shown on the card
6. RARITY — the rarity symbol: ● Common, ◆ Uncommon, ★ Rare, ★H Holo Rare, ★★ Ultra Rare

Return ONLY a JSON object, nothing else:
{
  "name": "exact name from card",
  "card_number": "exactly as printed e.g. 4/102",
  "set_name": "set name",
  "year": "1999",
  "hp": "120",
  "rarity": "Holo Rare",
  "confidence": "high",
  "error": null
}

If not a Pokémon card: {"error": "not_a_pokemon_card"}
If image is too blurry to read: {"name": "best guess", "error": "unclear", "confidence": "low"}` }
  ], 400);

  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { index, ...parsed };
  } catch {
    return { index, error: 'parse_error', raw: response.slice(0, 100) };
  }
}

async function identifyGrid(imageData) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);

  const response = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `You are an expert Pokémon TCG card identifier.

This photo shows a binder page or spread of Pokémon cards. Find ALL cards left-to-right, top-to-bottom.

For each card read:
- name: exactly as printed at the top
- card_number: exactly as printed bottom-right (e.g. "4/102", "025/165")
- set_name: the set name
- year: year printed at bottom
- rarity: Common/Uncommon/Rare/Holo Rare/Ultra Rare

Return ONLY a JSON array, nothing else:
[
  {"position":1,"name":"Charizard","card_number":"4/102","set_name":"Base Set","year":"1999","rarity":"Holo Rare","confidence":"high","error":null},
  {"position":2,"error":"empty"}
]

Empty slots: {"position":N,"error":"empty"}
Unclear cards: {"position":N,"name":"best guess","confidence":"low","error":"unclear"}
ONLY the JSON array.` }
  ], 2000);

  return parseArrayResponse(response);
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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Claude API ${res.status}: ${err}`); }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseArrayResponse(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) { const parsed = JSON.parse(match[0]); return Array.isArray(parsed) ? parsed : []; }
    return [];
  } catch (e) { console.error('Parse error:', e); return []; }
}

function extractBase64(imageData) {
  const raw = typeof imageData === 'string' ? imageData : (imageData?.base64 || '');
  return raw.replace(/^data:image\/[a-z]+;base64,/, '');
}

function extractMediaType(imageData) {
  if (typeof imageData === 'object' && imageData?.mediaType) return imageData.mediaType;
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    const m = imageData.match(/^data:(image\/[a-z]+);base64,/);
    if (m) return m[1];
  }
  return 'image/jpeg';
}
