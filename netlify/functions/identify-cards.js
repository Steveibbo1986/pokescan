// netlify/functions/identify-cards.js
// Receives base64 card images, returns identified card data via Claude Vision

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const { images } = JSON.parse(event.body);
    if (!images || !Array.isArray(images) || images.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No images provided' }) };
    }
    if (images.length > 9) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 9 images per scan' }) };
    }

    // Build content array - one image + prompt per card
    const results = await Promise.all(images.map((img, idx) => identifyCard(img, idx)));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results }),
    };
  } catch (err) {
    console.error('identify-cards error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to identify cards', detail: err.message }),
    };
  }
};

async function identifyCard(imageData, index) {
  // imageData is either a base64 string or { base64, mediaType }
  const base64 = typeof imageData === 'string' ? imageData : imageData.base64;
  const mediaType = (typeof imageData === 'object' && imageData.mediaType) || 'image/jpeg';

  // Strip data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');

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
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: cleanBase64 },
            },
            {
              type: 'text',
              text: `You are identifying a Pokémon Trading Card Game card from this image.
Extract the following information and respond ONLY with a valid JSON object, no other text:

{
  "name": "exact card name as printed",
  "set_name": "set name as printed",
  "card_number": "number as printed e.g. 025/102 or just 25",
  "rarity": "Common|Uncommon|Rare|Holo Rare|Ultra Rare|Secret Rare|etc",
  "hp": "HP number if visible",
  "type": "card type e.g. Fire, Water, Psychic, etc",
  "is_pokemon": true or false,
  "confidence": "high|medium|low",
  "notes": "any issues reading the card clearly"
}

If this is not a Pokémon card at all, return: {"error": "not_a_pokemon_card"}
If the image is too blurry or unclear, return: {"error": "image_unclear", "notes": "description of issue"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Claude API error:', err);
    return { index, error: 'api_error', detail: err };
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  try {
    // Claude returns JSON - parse it
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return { index, ...parsed };
  } catch {
    return { index, error: 'parse_error', raw: text };
  }
}
