// netlify/functions/identify-cards.js
// Two modes:
// 1. GRID mode: one photo of a 3x3 binder page → Claude identifies all 9 cards
// 2. INDIVIDUAL mode: up to 9 separate card images → identify each one

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

    // GRID MODE: single photo of multiple cards
    if (body.mode === 'grid' && body.image) {
      const results = await identifyGrid(body.image);
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'grid' }) };
    }

    // INDIVIDUAL MODE: array of single card images
    if (body.images && Array.isArray(body.images)) {
      if (body.images.length > 9) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 9 images' }) };
      }
      const results = await Promise.all(body.images.map((img, idx) => identifyCard(img, idx)));
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'individual' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide either image (grid) or images (individual)' }) };

  } catch (err) {
    console.error('identify-cards error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ─── Grid mode: one image, find all cards in it ──────────────
async function identifyGrid(imageData) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a photo of Pokémon TCG cards arranged in a binder page (likely a 3x3 grid of 9 cards, but could be fewer).

Identify every Pokémon card you can see. Read each card carefully for its name, set, and number.

Respond ONLY with a valid JSON array. Each item represents one card in reading order (left to right, top to bottom):

[
  {
    "position": 1,
    "name": "exact card name",
    "set_name": "set name as printed on card",
    "card_number": "number printed e.g. 001/078",
    "rarity": "Common|Uncommon|Rare|Holo Rare|Ultra Rare|etc",
    "hp": "HP value",
    "type": "Fire|Water|Grass|etc",
    "confidence": "high|medium|low",
    "error": null
  }
]

If a slot is empty or a card is not visible/readable, include it with "error": "not_visible".
If it's not a Pokémon card, use "error": "not_a_pokemon_card".
Return ONLY the JSON array, no other text.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Claude API error:', err);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '[]';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Parse error:', e, 'Raw:', text);
    return [];
  }
}

// ─── Individual mode: one card per image ────────────────────
async function identifyCard(imageData, index) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Identify this Pokémon TCG card. Respond ONLY with valid JSON, no other text:

{
  "name": "exact card name as printed",
  "set_name": "set name as printed",
  "card_number": "number as printed e.g. 025/102",
  "rarity": "Common|Uncommon|Rare|Holo Rare|Ultra Rare|Secret Rare|Illustration Rare|Special Illustration Rare|etc",
  "hp": "HP number",
  "type": "card type e.g. Fire, Water",
  "confidence": "high|medium|low",
  "error": null
}

If not a Pokémon card: {"error": "not_a_pokemon_card"}
If too blurry: {"error": "image_unclear"}`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    return { index, error: 'api_error', detail: response.status };
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return { index, ...JSON.parse(clean) };
  } catch {
    return { index, error: 'parse_error', raw: text };
  }
}

function extractBase64(imageData) {
  const raw = typeof imageData === 'string' ? imageData : imageData.base64 || '';
  return raw.replace(/^data:image\/[a-z]+;base64,/, '');
}

function extractMediaType(imageData) {
  if (typeof imageData === 'object' && imageData.mediaType) return imageData.mediaType;
  if (typeof imageData === 'string' && imageData.startsWith('data:')) {
    const match = imageData.match(/^data:(image\/[a-z]+);base64,/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}
