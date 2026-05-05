// netlify/functions/parental-consent.js
// Handles:
//   POST { action:'send_email', userId, parentEmail, childName }
//   GET  ?token=xxx  → parent approval/decline page
//   POST { action:'approve'|'decline', token }

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service key for admin writes
);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': event.httpMethod === 'GET' ? 'text/html' : 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  // ── GET: render the parent consent page ──────────────────────
  if (event.httpMethod === 'GET') {
    const token = event.queryStringParameters?.token;
    if (!token) return { statusCode: 400, headers, body: errorPage('Invalid link.') };

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, parent_email, parent_consent_at, date_of_birth')
      .eq('parent_consent_token', token)
      .single();

    if (!profile) return { statusCode: 404, headers, body: errorPage('This link has expired or is invalid.') };
    if (profile.parent_consent_at) return { statusCode: 200, headers, body: alreadyDonePage(profile) };

    return { statusCode: 200, headers, body: consentPage(profile, token) };
  }

  // ── POST ─────────────────────────────────────────────────────
  const body = JSON.parse(event.body || '{}');

  // Send consent email
  if (body.action === 'send_email') {
    const { userId, parentEmail, childName } = body;
    if (!userId || !parentEmail) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing fields' }) };

    const token = crypto.randomUUID();
    await supabase.from('profiles').update({
      parent_email: parentEmail,
      parent_consent_token: token,
    }).eq('id', userId);

    const consentUrl = `${process.env.URL}/.netlify/functions/parental-consent?token=${token}`;
    await sendEmail(parentEmail, childName, consentUrl);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  // Parent approves or declines
  if (body.action === 'approve' || body.action === 'decline') {
    const { token } = body;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('parent_consent_token', token)
      .single();

    if (!profile) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid token' }) };

    if (body.action === 'approve') {
      await supabase.from('profiles').update({
        parent_consent_at: new Date().toISOString(),
        parent_trading_enabled: true,
        parent_notify_trades: true,
      }).eq('id', profile.id);
    } else {
      await supabase.from('profiles').update({
        parent_trading_enabled: false,
      }).eq('id', profile.id);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};

// ── Email sending via Resend (or any SMTP) ────────────────────
async function sendEmail(to, childName, consentUrl) {
  // Uses Resend — add RESEND_API_KEY to Netlify env vars
  // Sign up free at resend.com — 100 emails/day free tier
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.log('No RESEND_API_KEY — consent URL:', consentUrl); return; }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Scanachu <noreply@scanachu.com>',
      to,
      subject: `Action needed: ${childName} wants to trade cards on Scanachu`,
      html: emailTemplate(childName, consentUrl),
    }),
  });
}

function emailTemplate(childName, consentUrl) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1d23">
  <div style="text-align:center;margin-bottom:28px">
    <span style="font-size:32px">⚡</span>
    <h1 style="font-family:serif;font-size:24px;color:#F5A623;margin:8px 0">Scanachu</h1>
    <p style="color:#6B7280;font-size:14px">Pokémon card tracker</p>
  </div>

  <h2 style="font-size:20px;margin-bottom:12px">Hi there,</h2>
  <p style="font-size:15px;line-height:1.7;margin-bottom:16px">
    <strong>${childName}</strong> has signed up to Scanachu — a free app for tracking and trading
    Pokémon cards — and wants to enable card trading with friends.
  </p>
  <p style="font-size:15px;line-height:1.7;margin-bottom:16px">
    Because ${childName} is under 18, we need your permission before they can trade cards with other users.
  </p>

  <div style="background:#F7F8FA;border-radius:12px;padding:20px;margin-bottom:24px">
    <h3 style="font-size:16px;margin-bottom:12px">How trading works on Scanachu:</h3>
    <ul style="font-size:14px;line-height:1.8;padding-left:20px;color:#374151">
      <li>Trading is only allowed between accepted friends — no strangers</li>
      <li>Postal addresses are deleted automatically after 48 hours</li>
      <li>You'll receive an email notification for every trade ${childName} proposes or accepts</li>
      <li>You can pause trading at any time from your parent dashboard</li>
      <li>All trades are logged and monitored for safety</li>
    </ul>
  </div>

  <div style="text-align:center;margin:28px 0">
    <a href="${consentUrl}&action=approve"
      style="background:#F5A623;color:#000;font-weight:bold;padding:14px 32px;border-radius:100px;text-decoration:none;font-size:16px;display:inline-block;margin-bottom:12px">
      ✓ Yes, allow ${childName} to trade
    </a>
    <br>
    <a href="${consentUrl}&action=decline"
      style="color:#6B7280;font-size:14px;text-decoration:underline">
      No thanks, keep trading disabled
    </a>
  </div>

  <p style="font-size:13px;color:#9CA3AF;line-height:1.6">
    If you didn't expect this email or don't know who ${childName} is, please ignore it.
    No action is needed and trading will remain disabled.
    Questions? Contact us at support@scanachu.com
  </p>
</body>
</html>`;
}

function consentPage(profile, token) {
  const name = profile.display_name || profile.username;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Parental consent — Scanachu</title>
<style>
  body{font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:24px;color:#1a1d23;background:#F7F8FA}
  .card{background:#fff;border-radius:20px;padding:32px;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  h1{color:#F5A623;font-size:28px;margin-bottom:4px}
  .btn-yes{background:#F5A623;color:#000;border:none;padding:14px 28px;border-radius:100px;font-size:16px;font-weight:bold;cursor:pointer;width:100%;margin-bottom:12px}
  .btn-no{background:none;border:1px solid #e0e0e0;color:#6B7280;padding:12px;border-radius:100px;font-size:14px;cursor:pointer;width:100%}
  ul{padding-left:20px;line-height:1.9;font-size:14px;color:#374151}
</style>
</head>
<body>
  <div class="card">
    <div style="text-align:center;margin-bottom:20px"><span style="font-size:40px">⚡</span></div>
    <h1 style="text-align:center">Scanachu</h1>
    <p style="text-align:center;color:#6B7280;margin-bottom:24px">Pokémon card tracker</p>
    <h2 style="font-size:18px;margin-bottom:8px">${name} wants to trade cards</h2>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px">
      Your child has asked permission to trade physical Pokémon cards with friends on Scanachu.
      Here's what that means:
    </p>
    <ul>
      <li>Trading is friends-only — no contact with strangers</li>
      <li>You'll get an email every time a trade is proposed or accepted</li>
      <li>Addresses are shown only to the trading partner and deleted after 48 hours</li>
      <li>You can pause or revoke access at any time</li>
    </ul>
    <div style="margin-top:24px">
      <button class="btn-yes" onclick="respond('approve')">✓ Allow ${name} to trade</button>
      <button class="btn-no" onclick="respond('decline')">Keep trading disabled for now</button>
    </div>
    <div id="msg" style="display:none;margin-top:16px;text-align:center;font-weight:bold"></div>
  </div>
  <script>
    async function respond(action) {
      const r = await fetch('/.netlify/functions/parental-consent', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action, token: '${token}' })
      });
      const d = await r.json();
      document.getElementById('msg').style.display='block';
      document.getElementById('msg').textContent = action === 'approve'
        ? '✓ Trading enabled! ${name} can now trade cards with friends.'
        : 'Trading remains disabled. You can always change this later.';
      document.getElementById('msg').style.color = action==='approve' ? '#16A34A' : '#6B7280';
    }
  </script>
</body>
</html>`;
}

function alreadyDonePage(profile) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px 24px">
    <span style="font-size:48px">✓</span>
    <h2 style="color:#16A34A">Already confirmed</h2>
    <p style="color:#6B7280">You've already given consent for ${profile.display_name||profile.username} to trade cards on Scanachu.</p>
  </body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;text-align:center;padding:60px 24px">
    <span style="font-size:48px">⚠️</span>
    <h2>${msg}</h2>
    <p style="color:#6B7280">Please ask your child to send a new consent request from the app.</p>
  </body></html>`;
}
