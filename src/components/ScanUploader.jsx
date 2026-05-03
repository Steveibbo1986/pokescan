// src/components/ScanUploader.jsx
import { useState, useRef, useCallback } from 'react';
import { resolveCards } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase } from '../lib/supabase';

export default function ScanUploader({ onComplete }) {
  const { user } = useAuth();
  const { addCard } = useCollection();

  const [mode, setMode] = useState('choose'); // 'choose' | 'grid' | 'individual'

  return (
    <div className="scan-uploader">
      {mode === 'choose' && <ScanModeChooser onChoose={setMode} />}
      {mode === 'grid'   && <GridScanner   onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
      {mode === 'individual' && <IndividualScanner onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
    </div>
  );
}

// ─── Mode chooser ────────────────────────────────────────────
function ScanModeChooser({ onChoose }) {
  return (
    <div className="scan-mode-chooser">
      <p className="scan-mode-intro">How do you want to scan?</p>
      <div className="scan-mode-options">
        <button className="scan-mode-card" onClick={() => onChoose('grid')}>
          <span className="scan-mode-icon">📷</span>
          <span className="scan-mode-title">Photo of binder page</span>
          <span className="scan-mode-desc">Take one photo of up to 9 cards laid out in a grid. We'll identify all of them at once.</span>
          <span className="btn btn-primary btn-sm" style={{marginTop:8}}>Use camera / upload photo</span>
        </button>
        <button className="scan-mode-card" onClick={() => onChoose('individual')}>
          <span className="scan-mode-icon">🃏</span>
          <span className="scan-mode-title">Individual card photos</span>
          <span className="scan-mode-desc">Select up to 9 separate photos — one per card. Best for single cards or when cards aren't in a binder.</span>
          <span className="btn btn-secondary btn-sm" style={{marginTop:8}}>Select card photos</span>
        </button>
      </div>
    </div>
  );
}

// ─── Grid scanner: one photo of a binder page ────────────────
function GridScanner({ onComplete, user, addCard, onBack }) {
  const fileRef    = useRef(null);
  const cameraRef  = useRef(null);

  const [photo, setPhoto]       = useState(null); // { file, preview }
  const [scanning, setScanning] = useState(false);
  const [results, setResults]   = useState(null);  // array of identified cards
  const [saving, setSaving]     = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const handlePhoto = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const preview = URL.createObjectURL(file);
    setPhoto({ file, preview });
    setResults(null);
  };

  const scanGrid = async () => {
    if (!photo) return;
    setScanning(true);

    const base64 = await fileToBase64(photo.file);

    let identified = [];
    try {
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'grid', image: base64 }),
      });
      const data = await res.json();
      identified = data.results || [];
    } catch (err) {
      console.error('Scan failed:', err);
      setScanning(false);
      return;
    }

    // Resolve valid cards against TCG API
    const validCards = identified.filter(c => !c.error);
    const resolved   = await resolveCards(validCards);

    // Merge back with position info
    const withPositions = resolved.map((r, i) => ({
      ...r,
      position: validCards[i]?.position || i + 1,
      include: !r.error && r.resolved,
    }));

    setResults(withPositions);
    setScanning(false);
  };

  const saveAll = async () => {
    setSaving(true);
    let count = 0;
    const toSave = results.filter(r => r.include && r.resolved && r.tcgCard);

    for (const r of toSave) {
      try {
        let scanImageUrl = null;
        if (photo?.file) {
          const path = `${user.id}/grid-${Date.now()}.jpg`;
          const { data: up } = await supabase.storage.from('card-scans').upload(path, photo.file, { upsert: true });
          if (up) {
            const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path);
            scanImageUrl = url?.publicUrl;
          }
        }
        await addCard({
          card_id: r.tcgCard.id, card_name: r.tcgCard.name,
          set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name,
          set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number,
          rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small,
          scan_image_url: scanImageUrl,
        });
        count++;
      } catch (err) { console.error('Save error:', err); }
    }

    setSavedCount(count);
    setSaving(false);
    setTimeout(() => { onComplete?.(); }, 2000);
  };

  if (savedCount > 0) {
    return (
      <div className="scan-success">
        <div className="success-icon">✓</div>
        <h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added to your collection!</h2>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>

      <div className="grid-scan-area">
        {!photo ? (
          <div className="grid-drop-zone" onClick={() => fileRef.current?.click()}>
            <span style={{fontSize:40}}>📷</span>
            <p className="grid-drop-title">Take or upload a photo of your binder page</p>
            <p className="grid-drop-hint">Best results: lay cards flat, good lighting, all 9 cards visible</p>
            <div className="grid-drop-buttons">
              <button className="btn btn-primary" onClick={e => { e.stopPropagation(); cameraRef.current?.click(); }}>
                📷 Open camera
              </button>
              <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                🖼 Upload photo
              </button>
            </div>
          </div>
        ) : (
          <div className="grid-preview-wrap">
            <img src={photo.preview} alt="Binder page" className="grid-preview-img" />
            <button className="btn btn-ghost btn-sm" onClick={() => { setPhoto(null); setResults(null); }}>
              ✕ Remove photo
            </button>
          </div>
        )}

        {/* Hidden inputs */}
        <input ref={fileRef}   type="file" accept="image/*"           style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />
      </div>

      {photo && !results && (
        <div style={{marginTop:16}}>
          <button className="btn btn-primary" onClick={scanGrid} disabled={scanning} style={{width:'100%',maxWidth:400,justifyContent:'center'}}>
            {scanning ? (
              <><span className="pokeball-spin" style={{fontSize:16,animation:'spin 1s linear infinite',display:'inline-block',marginRight:6}}>⚡</span>Identifying cards...</>
            ) : (
              '⚡ Identify all cards in photo'
            )}
          </button>
        </div>
      )}

      {results && results.length > 0 && (
        <GridConfirmPanel
          results={results}
          onToggle={(idx, val) => setResults(r => r.map((x, i) => i === idx ? { ...x, include: val } : x))}
          onSave={saveAll}
          saving={saving}
        />
      )}
    </div>
  );
}

function GridConfirmPanel({ results, onToggle, onSave, saving }) {
  const includedCount = results.filter(r => r.include && r.resolved).length;

  return (
    <div className="confirm-panel" style={{maxWidth:'100%', marginTop:20}}>
      <h3>⚡ Found {results.length} card{results.length !== 1 ? 's' : ''} — confirm before saving</h3>
      <div className="grid-confirm-grid">
        {results.map((r, idx) => (
          <div key={idx} className={`grid-confirm-card ${r.resolved ? '' : 'grid-confirm-unresolved'} ${r.include ? 'grid-confirm-included' : ''}`}>
            <div className="grid-confirm-img">
              {r.tcgCard?.image_small
                ? <img src={r.tcgCard.image_small} alt={r.tcgCard.name} />
                : <div className="grid-confirm-placeholder">{r.name?.[0] || '?'}</div>
              }
              {r.resolved && (
                <label className="grid-confirm-check">
                  <input type="checkbox" checked={r.include} onChange={e => onToggle(idx, e.target.checked)} />
                </label>
              )}
            </div>
            <div className="grid-confirm-info">
              {r.resolved ? (
                <>
                  <div className="grid-confirm-name">{r.tcgCard.name}</div>
                  <div className="grid-confirm-set">{r.tcgCard.set_name}</div>
                  <div className="grid-confirm-set">#{r.tcgCard.card_number}</div>
                  {r.tcgCard.prices_gbp?.market && (
                    <div className="grid-confirm-price">£{r.tcgCard.prices_gbp.market}</div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid-confirm-name" style={{color:'var(--muted)'}}>
                    {r.name || 'Not found'}
                  </div>
                  <div className="grid-confirm-set" style={{color:'var(--red)'}}>
                    {r.error === 'not_a_pokemon_card' ? 'Not a card' :
                     r.error === 'image_unclear' ? 'Too blurry' :
                     'Not in database'}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        className="btn btn-primary btn-full"
        onClick={onSave}
        disabled={saving || includedCount === 0}
        style={{marginTop:16}}
      >
        {saving ? 'Saving...' : `Add ${includedCount} card${includedCount !== 1 ? 's' : ''} to collection`}
      </button>
    </div>
  );
}

// ─── Individual scanner: one image per card ──────────────────
function IndividualScanner({ onComplete, user, addCard, onBack }) {
  const MAX = 9;
  const fileInputRef = useRef(null);

  const [slots, setSlots]         = useState(Array(MAX).fill(null));
  const [scanning, setScanning]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults]     = useState([]);
  const [saving, setSaving]       = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const filledSlots = slots.filter(Boolean);

  const handleFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, MAX);
    const newSlots = [...slots];
    imageFiles.forEach((file) => {
      const emptyIdx = newSlots.findIndex(s => !s);
      if (emptyIdx === -1) return;
      newSlots[emptyIdx] = { file, preview: URL.createObjectURL(file), status: 'ready' };
    });
    setSlots(newSlots);
    setResults([]);
    setConfirmed(false);
  }, [slots]);

  const removeSlot = (idx) => {
    const newSlots = [...slots];
    if (newSlots[idx]?.preview) URL.revokeObjectURL(newSlots[idx].preview);
    newSlots[idx] = null;
    const filled = newSlots.filter(Boolean);
    setSlots([...filled, ...Array(MAX - filled.length).fill(null)]);
  };

  const scanAll = async () => {
    setScanning(true);
    const filled = slots.filter(Boolean);
    const images = await Promise.all(filled.map(s => fileToBase64(s.file)));

    let identifiedCards = [];
    try {
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      identifiedCards = data.results || [];
    } catch (err) { console.error('Scan failed:', err); setScanning(false); return; }

    const resolved = await resolveCards(identifiedCards);
    setResults(resolved.map((r, i) => ({ ...r, preview: filled[i]?.preview, file: filled[i]?.file, include: !r.error })));
    setConfirmed(true);
    setScanning(false);
  };

  const saveAll = async () => {
    setSaving(true);
    let count = 0;
    for (const r of results.filter(r => r.include && r.resolved && r.tcgCard)) {
      try {
        let scanImageUrl = null;
        if (r.file) {
          const path = `${user.id}/${Date.now()}-${r.file.name}`;
          const { data: up } = await supabase.storage.from('card-scans').upload(path, r.file, { upsert: true });
          if (up) {
            const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path);
            scanImageUrl = url?.publicUrl;
          }
        }
        await addCard({
          card_id: r.tcgCard.id, card_name: r.tcgCard.name,
          set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name,
          set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number,
          rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small,
          scan_image_url: scanImageUrl,
        });
        count++;
      } catch (err) { console.error(err); }
    }
    setSavedCount(count);
    setSaving(false);
    setTimeout(() => { setSlots(Array(MAX).fill(null)); setResults([]); setConfirmed(false); setSavedCount(0); onComplete?.(); }, 2000);
  };

  if (savedCount > 0) {
    return (
      <div className="scan-success">
        <div className="success-icon">✓</div>
        <h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added to your collection!</h2>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>

      <div className="card-grid-upload" onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }} onDragOver={e => e.preventDefault()}>
        {slots.map((slot, idx) => (
          <div key={idx} className={`upload-slot ${slot ? 'filled' : 'empty'}`} onClick={() => !slot && fileInputRef.current?.click()}>
            {slot ? (
              <>
                <img src={slot.preview} alt={`card ${idx + 1}`} className="slot-preview" />
                {!confirmed && <button className="remove-slot" onClick={e => { e.stopPropagation(); removeSlot(idx); }}>×</button>}
                {confirmed && results[idx] && (
                  <div className={`slot-badge ${results[idx].resolved ? 'badge-ok' : 'badge-err'}`}>
                    {results[idx].resolved ? '✓' : '?'}
                  </div>
                )}
              </>
            ) : (
              <div className="slot-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <span>Add card</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e => handleFiles(e.target.files)} />

      <div className="scan-controls">
        <div className="scan-count">{filledSlots.length} / {MAX} cards loaded</div>
        <div className="scan-buttons">
          {filledSlots.length > 0 && !confirmed && (
            <button className="btn btn-primary" onClick={scanAll} disabled={scanning}>
              {scanning ? '⚡ Identifying...' : `⚡ Identify ${filledSlots.length} card${filledSlots.length !== 1 ? 's' : ''}`}
            </button>
          )}
          {filledSlots.length < MAX && !scanning && (
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Add more</button>
          )}
        </div>
      </div>

      {confirmed && results.length > 0 && (
        <div className="confirm-panel">
          <h3>Confirm identified cards</h3>
          <div className="confirm-list">
            {results.map((r, idx) => (
              <div key={idx} className={`confirm-row ${!r.resolved ? 'unresolved' : ''}`}>
                <input type="checkbox" checked={r.include && r.resolved} disabled={!r.resolved} onChange={e => setResults(res => res.map((x, i) => i === idx ? { ...x, include: e.target.checked } : x))} />
                {r.tcgCard?.image_small
                  ? <img src={r.tcgCard.image_small} alt={r.tcgCard.name} className="confirm-thumb" />
                  : <div className="confirm-thumb-placeholder" />
                }
                <div className="confirm-info">
                  {r.resolved ? (
                    <>
                      <span className="confirm-name">{r.tcgCard.name}</span>
                      <span className="confirm-set">{r.tcgCard.set_name} · #{r.tcgCard.card_number}</span>
                      {r.tcgCard.prices_gbp?.market && <span className="confirm-price">£{r.tcgCard.prices_gbp.market}</span>}
                    </>
                  ) : (
                    <>
                      <span className="confirm-name">{r.name || 'Could not identify'}</span>
                      <span className="confirm-set error-text">
                        {r.error === 'not_a_pokemon_card' ? 'Not a Pokémon card' : r.error === 'image_unclear' ? 'Image too blurry' : 'Not found in database'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={saveAll} disabled={saving || results.filter(r => r.include && r.resolved).length === 0}>
            {saving ? 'Saving...' : `Add ${results.filter(r => r.include && r.resolved).length} card${results.filter(r => r.include && r.resolved).length !== 1 ? 's' : ''} to collection`}
          </button>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: reader.result.split(',')[1], mediaType: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
