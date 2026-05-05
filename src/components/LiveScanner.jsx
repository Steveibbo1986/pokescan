// src/components/LiveScanner.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { resolveCards, searchPokemonCards } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase } from '../lib/supabase';

// How many consecutive frames the card must fill the guide before we capture
const HOLD_FRAMES   = 18;   // ~0.6s at 30fps — steady but not too slow
const FILL_RATIO    = 0.72; // card must fill at least 72% of guide width

export default function LiveScanner({ onComplete, onBack }) {
  const { user }    = useAuth();
  const { addCard } = useCollection();

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const rafRef        = useRef(null);
  const holdCountRef  = useRef(0);   // frames card has been fully in guide
  const capturingRef  = useRef(false);

  const [phase, setPhase]               = useState('starting');
  const [cardState, setCardState]       = useState('empty'); // empty | partial | full
  const [holdPct, setHoldPct]           = useState(0);       // 0-100 fill progress
  const [capturedImg, setCapturedImg]   = useState(null);
  const [identified, setIdentified]     = useState(null);    // raw from Claude
  const [result, setResult]             = useState(null);    // resolved TCG card
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [fixing, setFixing]             = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');

  useEffect(() => {
    startCamera();
    return () => { stopAll(); };
  }, []);

  function stopAll() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  async function startCamera() {
    setPhase('starting');
    holdCountRef.current = 0;
    capturingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        setPhase('scanning');
        startLoop();
      };
    } catch {
      setErrorMsg('Camera access denied. Please allow camera access and try again.');
      setPhase('error');
    }
  }

  const startLoop = useCallback(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || capturingRef.current) return;

      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      canvas.width = vw; canvas.height = vh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, vw, vh);

      // Guide zone: a card-proportioned rectangle (2.5:3.5 aspect) centred in the frame
      // We leave generous margin so the card must actually fill the guide
      const guideW = Math.floor(vw * 0.62);
      const guideH = Math.floor(guideW * (3.5 / 2.5));
      const guideX = Math.floor((vw - guideW) / 2);
      const guideY = Math.floor((vh - guideH) / 2);

      // ── Card detection ──────────────────────────────────────────
      // Sample a thin strip near each of the 4 inner edges of the guide.
      // A card filling the guide will have high contrast / non-uniform pixels
      // at all 4 edges. Empty guide = mostly background = low variance.

      const edgeW = Math.floor(guideW * 0.08);
      const edgeH = Math.floor(guideH * 0.08);

      const topData    = ctx.getImageData(guideX + edgeW, guideY + 4,             guideW - edgeW*2, edgeH).data;
      const bottomData = ctx.getImageData(guideX + edgeW, guideY + guideH - edgeH - 4, guideW - edgeW*2, edgeH).data;
      const leftData   = ctx.getImageData(guideX + 4,             guideY + edgeH, edgeW, guideH - edgeH*2).data;
      const rightData  = ctx.getImageData(guideX + guideW - edgeW - 4, guideY + edgeH, edgeW, guideH - edgeH*2).data;

      const varTop    = pixelVariance(topData);
      const varBottom = pixelVariance(bottomData);
      const varLeft   = pixelVariance(leftData);
      const varRight  = pixelVariance(rightData);

      // All 4 edges must have content (variance > threshold)
      const EDGE_THRESH = 400;
      const edgesFilled = [varTop, varBottom, varLeft, varRight].filter(v => v > EDGE_THRESH).length;

      // Also check overall guide variance (card has rich content)
      const centreData = ctx.getImageData(
        guideX + Math.floor(guideW * 0.2),
        guideY + Math.floor(guideH * 0.2),
        Math.floor(guideW * 0.6),
        Math.floor(guideH * 0.6)
      ).data;
      const centreVar = pixelVariance(centreData);

      const cardFull    = edgesFilled >= 4 && centreVar > 600;
      const cardPartial = edgesFilled >= 2 || centreVar > 300;

      setCardState(cardFull ? 'full' : cardPartial ? 'partial' : 'empty');

      if (cardFull) {
        holdCountRef.current = Math.min(holdCountRef.current + 1, HOLD_FRAMES);
      } else {
        // Drop faster if card moves away completely
        holdCountRef.current = Math.max(0, holdCountRef.current - (cardPartial ? 1 : 3));
      }

      setHoldPct(Math.round((holdCountRef.current / HOLD_FRAMES) * 100));

      if (holdCountRef.current >= HOLD_FRAMES && !capturingRef.current) {
        capturingRef.current = true;
        // Capture the FULL frame — don't crop yet, let Claude see the whole card
        doCapture(canvas, vw, vh, guideX, guideY, guideW, guideH);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  async function doCapture(canvas, vw, vh, guideX, guideY, guideW, guideH) {
    cancelAnimationFrame(rafRef.current);
    stopAll();

    // Crop to guide zone with a small 2% padding so we don't clip edge of card
    const pad = Math.floor(Math.min(guideW, guideH) * 0.02);
    const cx = Math.max(0, guideX - pad);
    const cy = Math.max(0, guideY - pad);
    const cw = Math.min(vw - cx, guideW + pad * 2);
    const ch = Math.min(vh - cy, guideH + pad * 2);

    const crop = document.createElement('canvas');
    crop.width  = cw;
    crop.height = ch;
    crop.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);

    const dataUrl = crop.toDataURL('image/jpeg', 0.92);
    setCapturedImg(dataUrl);
    setPhase('identifying');

    try {
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
        }),
      });
      const data = await res.json();

      // Handle both response shapes
      const raw = data.result || data.results?.[0] || {};
      setIdentified(raw);

      if (raw.error === 'not_a_pokemon_card') {
        setResult({ resolved: false, notCard: true });
        setPhase('confirming');
        return;
      }

      const [resolved] = await resolveCards([raw]);
      setResult(resolved);
      setPhase('confirming');
    } catch (err) {
      console.error(err);
      setErrorMsg('Could not identify card. Check your connection and try again.');
      setPhase('error');
    }
  }

  const retake = () => {
    setCapturedImg(null);
    setIdentified(null);
    setResult(null);
    setSaved(false);
    setFixing(false);
    holdCountRef.current = 0;
    capturingRef.current = false;
    setHoldPct(0);
    setCardState('empty');
    startCamera();
  };

  const applyFix = (tcgCard) => {
    setResult(r => ({ ...r, resolved: true, tcgCard }));
    setFixing(false);
  };

  const saveCard = async () => {
    if (!result?.tcgCard) return;
    setSaving(true);
    try {
      let scanImageUrl = null;
      if (capturedImg) {
        const blob = await fetch(capturedImg).then(r => r.blob());
        const path = `${user.id}/live-${Date.now()}.jpg`;
        const { data: up } = await supabase.storage.from('card-scans').upload(path, blob, { upsert: true });
        if (up) { const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path); scanImageUrl = url?.publicUrl; }
      }
      await addCard({
        card_id: result.tcgCard.id, card_name: result.tcgCard.name,
        set_id: result.tcgCard.set_id, set_name: result.tcgCard.set_name,
        set_series: result.tcgCard.set_series, card_number: result.tcgCard.card_number,
        rarity: result.tcgCard.rarity, image_url: result.tcgCard.image_small,
        scan_image_url: scanImageUrl, market_price_gbp: result.tcgCard.prices_gbp?.market || null,
      });
      setSaved(true);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // ── Render ──────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div className="ls-error">
      <div className="ls-error-icon">⚠️</div>
      <p>{errorMsg}</p>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-primary" onClick={retake}>Try again</button>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>
    </div>
  );

  if (fixing) return (
    <div className="ls-confirm">
      <button className="btn btn-ghost btn-sm" onClick={() => setFixing(false)} style={{marginBottom:12}}>← Back</button>
      <h3 style={{marginBottom:8,color:'var(--yellow)'}}>Find the right card</h3>
      {identified?.name && <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Claude read: "<strong>{identified.name}</strong>"</p>}
      <ManualFixer initialName={identified?.name || ''} onSelect={applyFix} onCancel={() => setFixing(false)} />
    </div>
  );

  return (
    <div className="ls-wrap">

      {/* ── Camera view ── */}
      {(phase === 'scanning' || phase === 'starting') && (
        <div className="ls-camera-wrap">
          <video ref={videoRef} className="ls-video" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="ls-canvas-hidden" />

          {/* Dark vignette with transparent card-shaped guide */}
          <div className="ls-overlay">
            <div className="ls-overlay-top" />
            <div className="ls-overlay-mid">
              <div className="ls-overlay-side" />

              <div className={`ls-guide ls-guide--${cardState}`}>
                <div className="ls-corner ls-corner--tl" />
                <div className="ls-corner ls-corner--tr" />
                <div className="ls-corner ls-corner--bl" />
                <div className="ls-corner ls-corner--br" />

                {/* Hold progress arc */}
                {cardState === 'full' && holdPct > 0 && (
                  <div className="ls-hold-ring">
                    <svg viewBox="0 0 48 48" className="ls-hold-svg">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="4"/>
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#F5A623" strokeWidth="4"
                        strokeDasharray={`${holdPct * 1.257} 125.7`}
                        strokeLinecap="round"
                        transform="rotate(-90 24 24)"
                        style={{transition:'stroke-dasharray .08s linear'}}
                      />
                    </svg>
                  </div>
                )}

                {cardState === 'full' && (
                  <div className="ls-scan-line" />
                )}
              </div>

              <div className="ls-overlay-side" />
            </div>
            <div className="ls-overlay-bottom">
              <div className={`ls-status ls-status--${cardState}`}>
                {cardState === 'full'    ? holdPct < 50 ? '⚡ Hold still...' : holdPct < 90 ? '⚡ Almost there...' : '⚡ Capturing!'
                 : cardState === 'partial' ? 'Move card to fill the guide'
                 : 'Place card inside the guide'}
              </div>
            </div>
          </div>

          <div className="ls-controls">
            <button className="ls-back-btn" onClick={() => { stopAll(); onBack?.(); }}>← Back</button>
            <button className="ls-manual-btn" onClick={() => {
              if (!capturingRef.current && videoRef.current && canvasRef.current) {
                capturingRef.current = true;
                const vw = videoRef.current.videoWidth, vh = videoRef.current.videoHeight;
                const guideW = Math.floor(vw * 0.62);
                const guideH = Math.floor(guideW * (3.5 / 2.5));
                const guideX = Math.floor((vw - guideW) / 2);
                const guideY = Math.floor((vh - guideH) / 2);
                doCapture(canvasRef.current, vw, vh, guideX, guideY, guideW, guideH);
              }
            }}>Capture now</button>
          </div>
        </div>
      )}

      {/* ── Identifying ── */}
      {phase === 'identifying' && (
        <div className="ls-identifying">
          {capturedImg && <img src={capturedImg} alt="Captured card" className="ls-captured-img" />}
          <div className="ls-identifying-label">
            <span style={{display:'inline-block',animation:'spin 1s linear infinite',marginRight:6}}>⚡</span>
            Identifying card...
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {phase === 'confirming' && (
        <div className="ls-confirm">
          <button className="btn btn-ghost btn-sm" onClick={retake} style={{marginBottom:12}}>← Scan again</button>

          {result?.notCard ? (
            <div className="ls-not-found">
              <div style={{fontSize:32,marginBottom:8}}>🤔</div>
              <p>Doesn't look like a Pokémon card. Try again with better lighting.</p>
              <button className="btn btn-secondary btn-sm" onClick={retake} style={{marginTop:10}}>Retry</button>
            </div>
          ) : !result?.resolved ? (
            <div className="ls-not-found">
              <div style={{fontSize:32,marginBottom:8}}>❓</div>
              <p>{identified?.name ? `Couldn't find "${identified.name}" in the database` : "Couldn't identify this card"}</p>
              <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                <button className="btn btn-primary btn-sm" onClick={() => setFixing(true)}>🔍 Search manually</button>
                <button className="btn btn-secondary btn-sm" onClick={retake}>📷 Retake</button>
              </div>
            </div>
          ) : saved ? (
            <div className="ls-done" style={{padding:'20px 0'}}>
              <div className="ls-done-icon">✓</div>
              <h2>Added to collection!</h2>
              <div style={{fontSize:14,fontWeight:700,marginTop:4,color:'var(--muted)'}}>{result.tcgCard.name} · {result.tcgCard.set_name}</div>
              <div style={{display:'flex',gap:8,marginTop:16}}>
                <button className="btn btn-primary" onClick={retake}>📷 Scan another</button>
                <button className="btn btn-secondary btn-sm" onClick={onComplete}>Done</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="ls-confirm-title">⚡ Card identified!</h3>
              <div className="ls-result-card">
                {result.tcgCard.image_small && (
                  <img src={result.tcgCard.image_small} alt={result.tcgCard.name} className="ls-result-img" />
                )}
                <div className="ls-result-info">
                  <div className="ls-result-name">{result.tcgCard.name}</div>
                  <div className="ls-result-set">{result.tcgCard.set_name}</div>
                  <div className="ls-result-num">#{result.tcgCard.card_number}</div>
                  {result.tcgCard.rarity && <div className="ls-result-rarity">{result.tcgCard.rarity}</div>}
                  {result.tcgCard.prices_gbp?.market && (
                    <div className="ls-result-price">£{result.tcgCard.prices_gbp.market}</div>
                  )}
                </div>
              </div>
              <div className="ls-confirm-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setFixing(true)}>✏ Wrong card?</button>
                <button className="btn btn-secondary btn-sm" onClick={retake}>📷 Scan again</button>
              </div>
              <button className="btn btn-primary btn-full" onClick={saveCard} disabled={saving} style={{marginTop:12}}>
                {saving ? 'Saving...' : '+ Add to collection'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pixel variance helper ──────────────────────────────────────
function pixelVariance(data) {
  let sum = 0, sumSq = 0;
  const step = 8; // sample every 8th pixel for speed
  let n = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    const lum = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
    sum += lum; sumSq += lum * lum; n++;
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return (sumSq / n) - mean * mean;
}

// ── Manual fixer ───────────────────────────────────────────────
function ManualFixer({ initialName, onSelect, onCancel }) {
  const [q, setQ]       = useState(initialName);
  const [results, setR] = useState([]);
  const [loading, setL] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setL(true);
    try {
      const isNum = /\d+[\/\\]\d+/.test(q) || /^\d{1,3}$/.test(q.trim());
      if (isNum) {
        const num = q.split(/[\/\\]/)[0].replace(/^0+/, '');
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`number:${num}`)}&pageSize=20&orderBy=set.releaseDate`);
        const data = await res.json();
        const USD = 0.79;
        setR((data.data||[]).map(c => {
          const p = c.tcgplayer?.prices;
          const tier = p ? (p.holofoil||p.normal||p['1stEditionNormal']||p.reverseHolofoil) : null;
          const prices = tier ? { market: tier.market } : null;
          return { id:c.id, name:c.name, set_id:c.set?.id, set_name:c.set?.name, set_series:c.set?.series,
            card_number:c.number, rarity:c.rarity, image_small:c.images?.small, prices,
            prices_gbp: prices?.market ? { market: (prices.market * USD).toFixed(2) } : null };
        }));
      } else {
        const data = await searchPokemonCards(q);
        setR(data.cards || []);
      }
    } catch(e) { console.error(e); }
    setL(false);
  };

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input className="search-input" value={q} onChange={e=>setQ(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Card number (e.g. 4/102) or name" autoFocus />
        <button className="btn btn-primary btn-sm" onClick={search} disabled={loading}>Search</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
      </div>
      {loading && <div style={{textAlign:'center',padding:16,color:'var(--muted)'}}>Searching...</div>}
      <div className="card-grid-display card-grid-sm" style={{maxHeight:340,overflowY:'auto'}}>
        {results.map(card => (
          <div key={card.id} className="card-tile" onClick={() => onSelect(card)} style={{cursor:'pointer'}}>
            <div className="card-tile-image">
              {card.image_small && <img src={card.image_small} alt={card.name} loading="lazy" />}
            </div>
            <div className="card-tile-info">
              <div className="card-tile-name">{card.name}</div>
              <div className="card-tile-set">{card.set_name}</div>
              <div className="card-tile-number">#{card.card_number}</div>
              {card.prices_gbp?.market && <div style={{fontSize:11,color:'var(--green)',fontWeight:700}}>£{card.prices_gbp.market}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
