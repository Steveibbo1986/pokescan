// src/components/ScanUploader.jsx
import { useState, useRef, useCallback } from 'react';
import { resolveCards, searchPokemonCards } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase } from '../lib/supabase';

export default function ScanUploader({ onComplete }) {
  const { user } = useAuth();
  const { addCard } = useCollection();
  const [mode, setMode] = useState('choose');

  return (
    <div className="scan-uploader">
      {mode === 'choose'     && <ScanModeChooser onChoose={setMode} />}
      {mode === 'grid'       && <GridScanner       onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
      {mode === 'individual' && <IndividualScanner onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
    </div>
  );
}

// ─── Mode chooser ─────────────────────────────────────────────
function ScanModeChooser({ onChoose }) {
  return (
    <div className="scan-mode-chooser">
      <p className="scan-mode-intro">How do you want to scan?</p>
      <div className="scan-mode-options">
        <button className="scan-mode-card" onClick={() => onChoose('grid')}>
          <span className="scan-mode-icon">📷</span>
          <span className="scan-mode-title">Photo of binder page</span>
          <span className="scan-mode-desc">Take one photo of up to 9 cards in a grid. We'll find all of them at once.</span>
          <span className="btn btn-primary btn-sm" style={{marginTop:8}}>Open camera / upload</span>
        </button>
        <button className="scan-mode-card" onClick={() => onChoose('individual')}>
          <span className="scan-mode-icon">🃏</span>
          <span className="scan-mode-title">Individual card photos</span>
          <span className="scan-mode-desc">Select up to 9 separate photos — one per card.</span>
          <span className="btn btn-secondary btn-sm" style={{marginTop:8}}>Select photos</span>
        </button>
      </div>
    </div>
  );
}

// ─── Grid scanner ─────────────────────────────────────────────
function GridScanner({ onComplete, user, addCard, onBack }) {
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);

  const [photo, setPhoto]         = useState(null);
  const [scanning, setScanning]   = useState(false);
  const [results, setResults]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [fixing, setFixing]       = useState(null); // index of card being manually fixed

  const handlePhoto = (file) => {
    if (!file?.type.startsWith('image/')) return;
    setPhoto({ file, preview: URL.createObjectURL(file) });
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
      console.error('Scan error:', err);
      setScanning(false);
      return;
    }

    // Only try to resolve cards that have a name and no blocking error
    const validCards = identified.filter(c => c.name && c.error !== 'empty' && c.error !== 'not_a_pokemon_card');
    const resolved   = await resolveCards(validCards);

    const withMeta = resolved.map((r, i) => ({
      ...r,
      position: validCards[i]?.position || i + 1,
      originalName: validCards[i]?.name || '',
      include: r.resolved,
    }));

    setResults(withMeta);
    setScanning(false);
  };

  // Manually fix a card by searching
  const applyManualFix = (idx, tcgCard) => {
    setResults(r => r.map((x, i) => i === idx ? { ...x, resolved: true, tcgCard, include: true } : x));
    setFixing(null);
  };

  const saveAll = async () => {
    setSaving(true);
    let count = 0;
    for (const r of results.filter(r => r.include && r.resolved && r.tcgCard)) {
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
          rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small, scan_image_url: scanImageUrl,
        });
        count++;
      } catch (err) { console.error(err); }
    }
    setSavedCount(count);
    setSaving(false);
    setTimeout(() => onComplete?.(), 2000);
  };

  if (savedCount > 0) {
    return <div className="scan-success"><div className="success-icon">✓</div><h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added!</h2></div>;
  }

  // Manual fix screen
  if (fixing !== null) {
    return (
      <div>
        <div style={{marginBottom:12}}>
          <h3 style={{marginBottom:4,color:'var(--yellow)'}}>Fix card #{fixing + 1}</h3>
          <p style={{fontSize:13,color:'var(--muted)'}}>Claude read this as "<strong style={{color:'var(--text)'}}>{results[fixing]?.originalName || 'unknown'}</strong>" — search for the correct card:</p>
        </div>
        <ManualPicker
          initialName={results[fixing]?.originalName || ''}
          onSelect={card => applyManualFix(fixing, card)}
          onCancel={() => setFixing(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>

      {!photo ? (
        <div className="grid-drop-zone" onClick={() => fileRef.current?.click()}>
          <span style={{fontSize:48}}>📷</span>
          <p className="grid-drop-title">Take or upload a photo of your binder page</p>
          <p className="grid-drop-hint">Lay cards flat in good lighting — all 9 cards visible. Works best with original Base Set, Jungle, Fossil and newer sets.</p>
          <div className="grid-drop-buttons">
            <button className="btn btn-primary" onClick={e => { e.stopPropagation(); cameraRef.current?.click(); }}>📷 Camera</button>
            <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>🖼 Upload</button>
          </div>
        </div>
      ) : (
        <div className="grid-preview-wrap">
          <img src={photo.preview} alt="Binder" className="grid-preview-img" />
          <button className="btn btn-ghost btn-sm" onClick={() => { setPhoto(null); setResults(null); }}>✕ Remove photo</button>
        </div>
      )}

      <input ref={fileRef}   type="file" accept="image/*"                       style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />

      {photo && !results && (
        <button className="btn btn-primary" onClick={scanGrid} disabled={scanning}
          style={{marginTop:16, width:'100%', maxWidth:400, justifyContent:'center'}}>
          {scanning
            ? <><span style={{display:'inline-block',animation:'spin 1s linear infinite',marginRight:6}}>⚡</span>Identifying cards...</>
            : '⚡ Identify all cards in photo'
          }
        </button>
      )}

      {results && (
        <GridConfirmPanel
          results={results}
          onToggle={(idx, val) => setResults(r => r.map((x, i) => i === idx ? { ...x, include: val } : x))}
          onFix={idx => setFixing(idx)}
          onSave={saveAll}
          saving={saving}
        />
      )}
    </div>
  );
}

function GridConfirmPanel({ results, onToggle, onFix, onSave, saving }) {
  const includedCount = results.filter(r => r.include && r.resolved).length;
  const unresolvedCount = results.filter(r => !r.resolved).length;

  return (
    <div className="confirm-panel" style={{maxWidth:'100%', marginTop:20}}>
      <h3>⚡ Found {results.length} card{results.length !== 1 ? 's' : ''} — confirm before saving</h3>
      {unresolvedCount > 0 && (
        <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>
          {unresolvedCount} card{unresolvedCount !== 1 ? 's' : ''} couldn't be found automatically.
          Tap <strong style={{color:'var(--yellow)'}}>Fix</strong> to search manually.
        </p>
      )}
      <div className="grid-confirm-grid">
        {results.map((r, idx) => (
          <div key={idx} className={`grid-confirm-card ${r.resolved ? '' : 'grid-confirm-unresolved'} ${r.include ? 'grid-confirm-included' : ''}`}>
            <div className="grid-confirm-img">
              {r.tcgCard?.image_small
                ? <img src={r.tcgCard.image_small} alt={r.tcgCard.name} />
                : <div className="grid-confirm-placeholder">{r.originalName?.[0] || '?'}</div>
              }
              {r.resolved && (
                <label className="grid-confirm-check">
                  <input type="checkbox" checked={!!r.include} onChange={e => onToggle(idx, e.target.checked)} />
                </label>
              )}
            </div>
            <div className="grid-confirm-info">
              {r.resolved ? (
                <>
                  <div className="grid-confirm-name">{r.tcgCard.name}</div>
                  <div className="grid-confirm-set">{r.tcgCard.set_name} #{r.tcgCard.card_number}</div>
                  {r.tcgCard.prices_gbp?.market && <div className="grid-confirm-price">£{r.tcgCard.prices_gbp.market}</div>}
                </>
              ) : (
                <>
                  <div className="grid-confirm-name" style={{color:'var(--muted)',fontSize:10}}>{r.originalName || 'Not identified'}</div>
                  <div className="grid-confirm-set" style={{color:'var(--red)'}}>Not found</div>
                  <button className="btn btn-xs btn-primary" onClick={() => onFix(idx)} style={{marginTop:4}}>Fix</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-full" onClick={onSave}
        disabled={saving || includedCount === 0} style={{marginTop:16}}>
        {saving ? 'Saving...' : `Add ${includedCount} card${includedCount !== 1 ? 's' : ''} to collection`}
      </button>
    </div>
  );
}

// ─── Individual scanner ───────────────────────────────────────
function IndividualScanner({ onComplete, user, addCard, onBack }) {
  const MAX = 9;
  const fileInputRef = useRef(null);
  const [slots, setSlots]           = useState(Array(MAX).fill(null));
  const [scanning, setScanning]     = useState(false);
  const [confirmed, setConfirmed]   = useState(false);
  const [results, setResults]       = useState([]);
  const [saving, setSaving]         = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [fixing, setFixing]         = useState(null);

  const filledSlots = slots.filter(Boolean);

  const handleFiles = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, MAX);
    const newSlots = [...slots];
    imgs.forEach(file => {
      const empty = newSlots.findIndex(s => !s);
      if (empty === -1) return;
      newSlots[empty] = { file, preview: URL.createObjectURL(file) };
    });
    setSlots(newSlots);
    setResults([]); setConfirmed(false);
  }, [slots]);

  const removeSlot = (idx) => {
    const s = [...slots];
    if (s[idx]?.preview) URL.revokeObjectURL(s[idx].preview);
    s[idx] = null;
    const filled = s.filter(Boolean);
    setSlots([...filled, ...Array(MAX - filled.length).fill(null)]);
  };

  const scanAll = async () => {
    setScanning(true);
    const filled = slots.filter(Boolean);
    const images = await Promise.all(filled.map(s => fileToBase64(s.file)));
    let identified = [];
    try {
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      identified = (await res.json()).results || [];
    } catch (err) { console.error(err); setScanning(false); return; }

    const resolved = await resolveCards(identified);
    setResults(resolved.map((r, i) => ({ ...r, preview: filled[i]?.preview, file: filled[i]?.file, originalName: identified[i]?.name || '', include: !r.error && r.resolved })));
    setConfirmed(true);
    setScanning(false);
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
        if (r.file) {
          const path = `${user.id}/${Date.now()}-${r.file.name}`;
          const { data: up } = await supabase.storage.from('card-scans').upload(path, r.file, { upsert: true });
          if (up) { const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path); scanImageUrl = url?.publicUrl; }
        }
        await addCard({ card_id: r.tcgCard.id, card_name: r.tcgCard.name, set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name, set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number, rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small, scan_image_url: scanImageUrl });
        count++;
      } catch (err) { console.error(err); }
    }
    setSavedCount(count);
    setSaving(false);
    setTimeout(() => { setSlots(Array(MAX).fill(null)); setResults([]); setConfirmed(false); setSavedCount(0); onComplete?.(); }, 2000);
  };

  if (savedCount > 0) return <div className="scan-success"><div className="success-icon">✓</div><h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added!</h2></div>;

  if (fixing !== null) {
    return (
      <div>
        <h3 style={{marginBottom:8,color:'var(--yellow)'}}>Fix card #{fixing + 1}</h3>
        <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Claude read: "<strong style={{color:'var(--text)'}}>{results[fixing]?.originalName || 'unknown'}</strong>"</p>
        <ManualPicker initialName={results[fixing]?.originalName || ''} onSelect={card => applyFix(fixing, card)} onCancel={() => setFixing(null)} />
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
                <img src={slot.preview} alt={`card ${idx+1}`} className="slot-preview" />
                {!confirmed && <button className="remove-slot" onClick={e => { e.stopPropagation(); removeSlot(idx); }}>×</button>}
                {confirmed && results[idx] && (
                  <div className={`slot-badge ${results[idx].resolved ? 'badge-ok' : 'badge-err'}`}>{results[idx].resolved ? '✓' : '?'}</div>
                )}
              </>
            ) : (
              <div className="slot-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <span>Add</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e => handleFiles(e.target.files)} />
      <div className="scan-controls">
        <div className="scan-count">{filledSlots.length}/{MAX} loaded</div>
        <div className="scan-buttons">
          {filledSlots.length > 0 && !confirmed && (
            <button className="btn btn-primary" onClick={scanAll} disabled={scanning}>
              {scanning ? '⚡ Scanning...' : `⚡ Identify ${filledSlots.length} card${filledSlots.length !== 1 ? 's' : ''}`}
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
          {results.filter(r => !r.resolved).length > 0 && (
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>
              {results.filter(r => !r.resolved).length} card{results.filter(r => !r.resolved).length !== 1 ? 's' : ''} not found — tap <strong style={{color:'var(--yellow)'}}>Fix</strong> to search manually.
            </p>
          )}
          <div className="confirm-list">
            {results.map((r, idx) => (
              <div key={idx} className={`confirm-row ${!r.resolved ? 'unresolved' : ''}`}>
                <input type="checkbox" checked={!!r.include && !!r.resolved} disabled={!r.resolved} onChange={e => setResults(res => res.map((x, i) => i === idx ? { ...x, include: e.target.checked } : x))} />
                {r.tcgCard?.image_small ? <img src={r.tcgCard.image_small} alt={r.tcgCard.name} className="confirm-thumb" /> : <div className="confirm-thumb-placeholder" />}
                <div className="confirm-info">
                  {r.resolved ? (
                    <><span className="confirm-name">{r.tcgCard.name}</span><span className="confirm-set">{r.tcgCard.set_name} · #{r.tcgCard.card_number}</span>{r.tcgCard.prices_gbp?.market && <span className="confirm-price">£{r.tcgCard.prices_gbp.market}</span>}</>
                  ) : (
                    <><span className="confirm-name" style={{color:'var(--muted)'}}>{r.originalName || 'Not identified'}</span><span className="confirm-set error-text">Not found in database</span></>
                  )}
                </div>
                {!r.resolved && <button className="btn btn-xs btn-primary" onClick={() => setFixing(idx)}>Fix</button>}
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

// ─── Manual picker ────────────────────────────────────────────
function ManualPicker({ initialName, onSelect, onCancel }) {
  const [query, setQuery]   = useState(initialName);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await searchPokemonCards(query.trim());
      setResults(data.cards || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <input className="search-input" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()} placeholder="Type Pokémon name..." autoFocus />
        <button className="btn btn-primary btn-sm" onClick={search} disabled={loading}>Search</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
      {loading && <div style={{textAlign:'center',color:'var(--muted)',padding:20}}>Searching...</div>}
      <div className="card-grid-display card-grid-sm" style={{maxHeight:400,overflowY:'auto'}}>
        {results.map(card => (
          <div key={card.id} className="card-tile" onClick={() => onSelect(card)} style={{cursor:'pointer'}}>
            <div className="card-tile-image">
              {card.image_small && <img src={card.image_small} alt={card.name} loading="lazy" />}
            </div>
            <div className="card-tile-info">
              <div className="card-tile-name">{card.name}</div>
              <div className="card-tile-set">{card.set_name}</div>
              <div className="card-tile-set">#{card.card_number}</div>
              {card.prices_gbp?.market && <div style={{fontSize:11,color:'var(--green)',fontWeight:600}}>£{card.prices_gbp.market}</div>}
            </div>
          </div>
        ))}
      </div>
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
