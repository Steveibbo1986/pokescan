// netlify/functions/identify-cards.js

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

  const response = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `You are an expert Pokémon TCG card identifier. Look at this photo of Pokémon cards.

Identify EVERY card visible, reading left to right, top to bottom.

For each card, read:
- The Pokémon name printed at the TOP of the card
- The set name or symbol (bottom of card — look for set symbol icons)
- The card number (bottom right, like "52/102" or "4/102")
- HP value (top right area)
- The card rarity (tiny symbol bottom right: circle=Common, diamond=Uncommon, star=Rare)

IMPORTANT for old Base Set cards:
- Base Set cards have numbers like 1/102, 4/102, 52/102 etc
- Jungle set: 1/64
- Fossil set: 1/62
- Team Rocket: 1/82
- Look carefully at the card number at bottom right

Respond ONLY with a JSON array, no other text:
[
  {
    "position": 1,
    "name": "Pokémon name exactly as printed",
    "set_name": "Base Set|Jungle|Fossil|Team Rocket|Base Set 2|etc",
    "card_number": "52/102",
    "rarity": "Common|Uncommon|Rare|Holo Rare",
    "hp": "60",
    "confidence": "high|medium|low",
    "error": null
  }
]

If a card slot is empty: {"position": N, "error": "empty"}
If unreadable: {"position": N, "name": "best guess name", "error": "unclear", "confidence": "low"}
Return ONLY the JSON array.` }
  ], 2000);

  return parseArrayResponse(response);
}

async function identifyCard(imageData, index) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);

  const response = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `Identify this Pokémon TCG card. Read:
- Name at the top
- Set name/symbol at the bottom  
- Card number (bottom right, e.g. "52/102")
- Rarity symbol (circle=Common, diamond=Uncommon, star=Rare, star with H=Holo)
- HP number

Respond ONLY with JSON:
{
  "name": "exact name",
  "set_name": "set name",
  "card_number": "52/102",
  "rarity": "Common|Uncommon|Rare|Holo Rare|Ultra Rare|Illustration Rare|etc",
  "hp": "60",
  "confidence": "high|medium|low",
  "error": null
}

If not a Pokémon card: {"error": "not_a_pokemon_card"}
If too blurry to read: {"name": "best guess", "error": "unclear", "confidence": "low"}` }
  ], 500);

  try {
    const clean = response.replace(/```json|```/g, '').trim();
    return { index, ...JSON.parse(clean) };
  } catch {
    return { index, error: 'parse_error' };
  }
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
      model: 'claude-opus-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Claude API error:', res.status, err);
    throw new Error(`Claude API ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseArrayResponse(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    // Extract JSON array even if there's surrounding text
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch (e) {
    console.error('Parse error:', e, 'Text:', text.slice(0, 200));
    return [];
  }
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
