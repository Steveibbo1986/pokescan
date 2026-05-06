// netlify/functions/identify-cards.js
// Supports English + Japanese + Chinese + Korean cards

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

    if (body.mode === 'grid' && body.image) {
      const results = await identifyGrid(body.image);
      return { statusCode: 200, headers, body: JSON.stringify({ results, mode: 'grid' }) };
    }

    if (body.image) {
      const result = await identifySingle(body.image);
      return { statusCode: 200, headers, body: JSON.stringify({ result, mode: 'single' }) };
    }

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
    { type: 'text', text: `You are an expert Pokémon TCG card identifier who reads cards in ANY language.

Examine this card carefully. It may be in English, Japanese (日本語), Chinese (中文), Korean (한국어), French, German, Spanish, Italian, or another language.

Extract EXACTLY as printed on the card:

1. LANGUAGE — which language is the card in? (english/japanese/chinese_traditional/chinese_simplified/korean/french/german/spanish/italian/other)
2. CARD NAME — in the card's original language AND romanised/English if you can tell
   - Japanese: e.g. "フシギダネ" → "Fushigidane (Bulbasaur)"
   - Chinese: e.g. "妙蛙种子"
   - Korean: e.g. "이상해씨"
3. CARD NUMBER — printed at the bottom of the card (e.g. "001/102", "025/165", "S-P")
4. SET NAME — the set this belongs to. For Japanese cards look for set symbols and kanji set names
5. YEAR — copyright year printed at the bottom
6. HP — the HP number
7. RARITY — symbol at bottom right: ● Common, ◆ Uncommon, ★ Rare, etc. Japanese cards use different symbols: C, U, R, RR, SR, HR, UR, SSR, SAR, AR

Return ONLY valid JSON, nothing else:
{
  "language": "japanese",
  "name": "フシギダネ",
  "name_en": "Bulbasaur",
  "card_number": "001/102",
  "set_name": "Base Set",
  "set_name_original": "第１弾",
  "year": "1996",
  "hp": "40",
  "rarity": "Common",
  "rarity_symbol": "●",
  "confidence": "high",
  "error": null
}

If not a Pokémon card: {"error": "not_a_pokemon_card"}
If unclear: {"name": "best guess", "language": "unknown", "error": "unclear", "confidence": "low"}` }
  ], 500);

  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { index, ...parsed };
  } catch {
    return { index, error: 'parse_error', raw: response.slice(0, 200) };
  }
}

async function identifyGrid(imageData) {
  const base64    = extractBase64(imageData);
  const mediaType = extractMediaType(imageData);

  const response = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: `You are an expert Pokémon TCG card identifier who reads cards in ANY language.

This photo shows multiple Pokémon cards. Cards may be in ANY language including Japanese, Chinese, Korean, etc.

For each card left-to-right, top-to-bottom extract:
- language: english/japanese/chinese_traditional/chinese_simplified/korean/french/german/spanish/italian/other
- name: card name in original language
- name_en: English name if you can identify it
- card_number: exactly as printed
- set_name: set name (English or romanised)
- year: copyright year
- rarity: rarity description

Return ONLY a JSON array:
[
  {"position":1,"language":"japanese","name":"ピカチュウ","name_en":"Pikachu","card_number":"025/165","set_name":"151","year":"2023","rarity":"Common","confidence":"high","error":null},
  {"position":2,"error":"empty"}
]
ONLY the JSON array, nothing else.` }
  ], 2000);

  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch (e) {
    console.error('Grid parse error:', e);
    return [];
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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Claude API ${res.status}: ${err}`); }
  const data = await res.json();
  return data.content?.[0]?.text || '';
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
