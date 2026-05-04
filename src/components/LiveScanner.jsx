// src/components/LiveScanner.jsx
// Live camera scanner with card guide overlay and auto-capture
import { useState, useRef, useEffect, useCallback } from 'react';
import { resolveCards } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase } from '../lib/supabase';

export default function LiveScanner({ onComplete, onBack }) {
  const { user }    = useAuth();
  const { addCard } = useCollection();

  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const cooldownRef  = useRef(false);

  const [phase, setPhase]         = useState('starting'); // starting|scanning|captured|confirming|saving|done|error
  const [cardDetected, setCardDetected] = useState(false);
  const [capturedImg, setCapturedImg]   = useState(null);
  const [results, setResults]           = useState([]);
  const [saving, setSaving]             = useState(false);
  const [savedCount, setSavedCount]     = useState(0);
  const [errorMsg, setErrorMsg]         = useState('');
  const [fixing, setFixing]             = useState(null);

  // Start camera
  useEffect(() => {
    startCamera();
    return () => { stopCamera(); cancelAnimationFrame(rafRef.current); };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setPhase('scanning');
          startDetectionLoop();
        };
      }
    } catch (err) {
      setErrorMsg('Camera access denied. Please allow camera access and try again.');
      setPhase('error');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  // Detection loop — analyse brightness/edge in the guide zone to detect a card
  const startDetectionLoop = useCallback(() => {
    const analyse = () => {
      if (!videoRef.current || !canvasRef.current) { rafRef.current = requestAnimationFrame(analyse); return; }
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2) { rafRef.current = requestAnimationFrame(analyse); return; }

      const vw = video.videoWidth, vh = video.videoHeight;
      canvas.width = vw; canvas.height = vh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, vw, vh);

      // Sample the guide zone (centre 60% of frame, card-shaped)
      const gx = Math.floor(vw * 0.2), gy = Math.floor(vh * 0.15);
      const gw = Math.floor(vw * 0.6), gh = Math.floor(vh * 0.7);
      const data = ctx.getImageData(gx, gy, gw, gh).data;

      // Simple card detection: measure brightness variance (a card has distinct edges vs blank background)
      let sum = 0, sumSq = 0, n = data.length / 4;
      for (let i = 0; i < data.length; i += 16) {
        const lum = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
        sum += lum; sumSq += lum * lum;
      }
      const mean = sum / (n / 4);
      const variance = (sumSq / (n / 4)) - mean * mean;

      // High variance = card with distinct art/text present (threshold tuned empirically)
      const detected = variance > 800;
      setCardDetected(detected);

      // Auto-capture after card is held steady for ~1.2s
      if (detected && !cooldownRef.current) {
        cooldownRef.current = true;
        setTimeout(() => {
          if (videoRef.current && canvasRef.current) {
            captureFrame();
          }
        }, 1200);
      }
      if (!detected) cooldownRef.current = false;

      rafRef.current = requestAnimationFrame(analyse);
    };
    rafRef.current = requestAnimationFrame(analyse);
  }, []);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    cancelAnimationFrame(rafRef.current);
    stopCamera();

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Crop to guide zone for tighter identification
    const vw = canvas.width, vh = canvas.height;
    const gx = Math.floor(vw * 0.18), gy = Math.floor(vh * 0.12);
    const gw = Math.floor(vw * 0.64), gh = Math.floor(vh * 0.72);
    const cropCanvas  = document.createElement('canvas');
    cropCanvas.width  = gw; cropCanvas.height = gh;
    cropCanvas.getContext('2d').drawImage(canvas, gx, gy, gw, gh, 0, 0, gw, gh);

    const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
    setCapturedImg(dataUrl);
    setPhase('identifying');

    // Send to Claude
    try {
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [{ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' }] }),
      });
      const data    = await res.json();
      const identified = data.results || [];
      const resolved   = await resolveCards(identified);
      const withMeta   = resolved.map(r => ({ ...r, include: r.resolved && !r.error }));
      setResults(withMeta);
      setPhase('confirming');
    } catch (err) {
      setErrorMsg('Could not identify card. Please try again.');
      setPhase('error');
    }
  }, []);

  const retake = () => {
    setCardDetected(false);
    setCapturedImg(null);
    setResults([]);
    cooldownRef.current = false;
    setPhase('starting');
    startCamera();
  };

  const applyFix = (idx, tcgCard) => {
    setResults(r => r.map((x, i) => i === idx ? { ...x, resolved: true, tcgCard, include: true } : x));
    setFixing(null);
  };

  const saveAll = async () => {
    setSaving(true);
    let count = 0;
    for (const r of results.filter(r => r.include && r.resolved && r.tcgCard)) {
      try {
        let scanImageUrl = null;
        if (capturedImg) {
          const blob = await fetch(capturedImg).then(r => r.blob());
          const path = `${user.id}/live-${Date.now()}.jpg`;
          const { data: up } = await supabase.storage.from('card-scans').upload(path, blob, { upsert: true });
          if (up) { const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path); scanImageUrl = url?.publicUrl; }
        }
        await addCard({
          card_id: r.tcgCard.id, card_name: r.tcgCard.name,
          set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name,
          set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number,
          rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small,
          scan_image_url: scanImageUrl, market_price_gbp: r.tcgCard.prices_gbp?.market || null,
        });
        count++;
      } catch (err) { console.error(err); }
    }
    setSavedCount(count);
    setSaving(false);
    setPhase('done');
    setTimeout(() => onComplete?.(), 2000);
  };

  if (phase === 'done') {
    return (
      <div className="ls-done">
        <div className="ls-done-icon">✓</div>
        <h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added!</h2>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="ls-error">
        <div className="ls-error-icon">⚠️</div>
        <p>{errorMsg}</p>
        <button className="btn btn-primary" onClick={onBack}>← Back</button>
      </div>
    );
  }

  return (
    <div className="ls-wrap">

      {/* Camera view with overlay */}
      {(phase === 'scanning' || phase === 'starting') && (
        <div className="ls-camera-wrap">
          <video ref={videoRef} className="ls-video" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="ls-canvas-hidden" />

          {/* Darkened overlay with card-shaped cutout */}
          <div className="ls-overlay">
            <div className="ls-overlay-top" />
            <div className="ls-overlay-mid">
              <div className="ls-overlay-side" />
              <div className={`ls-guide ${cardDetected ? 'ls-guide--detected' : ''}`}>
                {/* Corner marks */}
                <div className="ls-corner ls-corner--tl" />
                <div className="ls-corner ls-corner--tr" />
                <div className="ls-corner ls-corner--bl" />
                <div className="ls-corner ls-corner--br" />
                {cardDetected && (
                  <div className="ls-scan-line" />
                )}
              </div>
              <div className="ls-overlay-side" />
            </div>
            <div className="ls-overlay-bottom">
              <div className={`ls-status ${cardDetected ? 'ls-status--detected' : ''}`}>
                {cardDetected ? '⚡ Card detected — hold still...' : 'Align card within the guide'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="ls-controls">
            <button className="ls-back-btn" onClick={() => { stopCamera(); onBack?.(); }}>← Back</button>
            <button className="ls-manual-btn" onClick={captureFrame}>Capture now</button>
          </div>
        </div>
      )}

      {/* Identifying */}
      {phase === 'identifying' && (
        <div className="ls-identifying">
          {capturedImg && <img src={capturedImg} alt="Captured" className="ls-captured-img" />}
          <div className="ls-identifying-label">
            <span className="spin-icon">⚡</span> Identifying card...
          </div>
        </div>
      )}

      {/* Confirm result */}
      {phase === 'confirming' && results.length > 0 && (
        <div className="ls-confirm">
          <button className="btn btn-ghost btn-sm" onClick={retake} style={{marginBottom:12}}>← Scan again</button>

          {fixing !== null ? (
            <ManualFixer
              initialName={results[fixing]?.tcgCard?.card_number || results[fixing]?.name || ''}
              onSelect={card => applyFix(fixing, card)}
              onCancel={() => setFixing(null)}
            />
          ) : (
            <>
              <h3 className="ls-confirm-title">
                {results[0]?.resolved ? '⚡ Card identified!' : '⚠ Could not identify'}
              </h3>

              {results[0]?.resolved && results[0]?.tcgCard ? (
                <div className="ls-result-card">
                  <img src={results[0].tcgCard.image_small} alt={results[0].tcgCard.name} className="ls-result-img" />
                  <div className="ls-result-info">
                    <div className="ls-result-name">{results[0].tcgCard.name}</div>
                    <div className="ls-result-set">{results[0].tcgCard.set_name}</div>
                    <div className="ls-result-num">#{results[0].tcgCard.card_number}</div>
                    {results[0].tcgCard.rarity && <div className="ls-result-rarity">{results[0].tcgCard.rarity}</div>}
                    {results[0].tcgCard.prices_gbp?.market && (
                      <div className="ls-result-price">£{results[0].tcgCard.prices_gbp.market}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="ls-not-found">
                  <p>"{results[0]?.name || 'Card'}" wasn't found in the database.</p>
                </div>
              )}

              <div className="ls-confirm-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setFixing(0)}>
                  ✏ Wrong card? Fix it
                </button>
                <button className="btn btn-secondary btn-sm" onClick={retake}>
                  📷 Scan again
                </button>
              </div>

              {results[0]?.resolved && (
                <button className="btn btn-primary btn-full" onClick={saveAll} disabled={saving} style={{marginTop:12}}>
                  {saving ? 'Saving...' : '+ Add to collection'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ManualFixer({ initialName, onSelect, onCancel }) {
  const [q, setQ]         = useState(initialName);
  const [results, setR]   = useState([]);
  const [loading, setL]   = useState(false);
  const { searchPokemonCards } = require('../lib/tcgapi');

  const search = async () => {
    if (!q.trim()) return;
    setL(true);
    try {
      const isNum = /\d+\/\d+/.test(q) || /^\d+$/.test(q.trim());
      if (isNum) {
        const num = q.split('/')[0].replace(/^0+/, '');
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(`number:${num}`)}&pageSize=12&orderBy=-set.releaseDate`);
        const data = await res.json();
        const USD = 0.79;
        setR((data.data||[]).map(c => {
          const p = c.tcgplayer?.prices; const tier = p?(p.holofoil||p.normal||p['1stEditionNormal']||p.reverseHolofoil):null;
          const prices = tier?{market:tier.market}:null;
          return { id:c.id, name:c.name, set_id:c.set?.id, set_name:c.set?.name, set_series:c.set?.series, card_number:c.number, rarity:c.rarity, image_small:c.images?.small, prices, prices_gbp:prices?{market:prices.market?(prices.market*USD).toFixed(2):null}:null };
        }));
      } else {
        const { searchPokemonCards } = await import('../lib/tcgapi');
        const data = await searchPokemonCards(q);
        setR(data.cards || []);
      }
    } catch(e){ console.error(e); }
    setL(false);
  };

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input className="search-input" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Card number or name..." autoFocus />
        <button className="btn btn-primary btn-sm" onClick={search} disabled={loading}>Go</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
      </div>
      <div className="card-grid-display card-grid-sm" style={{maxHeight:320,overflowY:'auto'}}>
        {results.map(card=>(
          <div key={card.id} className="card-tile" onClick={()=>onSelect(card)} style={{cursor:'pointer'}}>
            <div className="card-tile-image">{card.image_small&&<img src={card.image_small} alt={card.name} loading="lazy"/>}</div>
            <div className="card-tile-info">
              <div className="card-tile-name">{card.name}</div>
              <div className="card-tile-set">{card.set_name} #{card.card_number}</div>
              {card.prices_gbp?.market&&<div style={{fontSize:11,color:'var(--green)',fontWeight:700}}>£{card.prices_gbp.market}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
