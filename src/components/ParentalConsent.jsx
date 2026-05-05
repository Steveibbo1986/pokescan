// src/components/ParentalConsent.jsx
// Shown in Account page and as a gate before trading for under-18s
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function ParentalConsent({ onDone }) {
  const { user, profile } = useAuth();
  const [parentEmail, setParentEmail] = useState('');
  const [step, setStep]   = useState('form'); // form | sent | already
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);

  // Already confirmed
  if (profile?.parent_consent_at) {
    return (
      <div className="consent-box consent-box--ok">
        <div className="consent-icon">✓</div>
        <div>
          <div className="consent-title">Parental consent confirmed</div>
          <div className="consent-sub">
            A parent or guardian has approved trading for this account.
            {profile.parent_email && ` (${profile.parent_email})`}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'sent') {
    return (
      <div className="consent-box consent-box--pending">
        <div className="consent-icon">📧</div>
        <div>
          <div className="consent-title">Consent email sent!</div>
          <div className="consent-sub">
            We've emailed <strong>{parentEmail}</strong> with a link to approve trading.
            Trading will unlock as soon as they click confirm — usually within a few minutes.
          </div>
          <button className="btn btn-ghost btn-sm" style={{marginTop:10}}
            onClick={() => setStep('form')}>
            Wrong email? Send again
          </button>
        </div>
      </div>
    );
  }

  const send = async () => {
    if (!parentEmail.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (parentEmail.toLowerCase() === (user?.email || '').toLowerCase()) {
      setError("The parent email must be different from your own account email.");
      return;
    }
    setError(''); setBusy(true);
    try {
      const res = await fetch('/.netlify/functions/parental-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_email',
          userId: user.id,
          parentEmail,
          childName: profile?.display_name || profile?.username || 'your child',
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setStep('sent');
      onDone?.();
    } catch {
      setError('Could not send email. Please try again in a moment.');
    }
    setBusy(false);
  };

  return (
    <div className="consent-box">
      <div className="consent-icon">🛡️</div>
      <div style={{flex:1}}>
        <div className="consent-title">Parental consent required</div>
        <div className="consent-sub" style={{marginBottom:14}}>
          Because you're under 18, a parent or guardian needs to approve trading before you can swap cards with friends.
          This keeps everyone safe — your address is only shared with your trading partner and deleted after 48 hours.
        </div>
        <div className="consent-form">
          <input
            className="search-input"
            type="email"
            placeholder="Parent or guardian's email address"
            value={parentEmail}
            onChange={e => { setParentEmail(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && send()}
            autoComplete="off"
          />
          <button className="btn btn-primary" onClick={send} disabled={busy || !parentEmail}>
            {busy ? 'Sending...' : 'Send consent request'}
          </button>
        </div>
        {error && <div className="consent-error">{error}</div>}
        <div className="consent-note">
          Your parent will receive a plain-English email explaining what Scanachu is.
          They can approve or decline in one click — no account needed.
        </div>
      </div>
    </div>
  );
}
