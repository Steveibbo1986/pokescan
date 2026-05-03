// src/components/ScanUploader.jsx
import { useState, useRef, useCallback } from 'react';
import { resolveCards, searchPokemonCards, getCardById } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase, addToWishlist } from '../lib/supabase';

export default function ScanUploader({ onComplete }) {
  const { user } = useAuth();
  const { addCard } = useCollection();
  const [mode, setMode] = useState('choose');

  return (
    <div className="scan-uploader">
      {mode === 'choose'     && <ScanModeChooser onChoose={setMode} />}
      {mode === 'grid'       && <GridScanner       onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
      {mode === 'individual' && <IndividualScanner onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
      {mode === 'number'     && <NumberSearch      onComplete={onComplete} user={user} addCard={addCard} onBack={() => setMode('choose')} />}
    </div>
  );
}

// ─── Mode chooser ─────────────────────────────────────────────
function ScanModeChooser({ onChoose }) {
  return (
    <div className="scan-mode-chooser">
      <p className="scan-mode-intro">How do you want to add cards?</p>
      <div className="scan-mode-options scan-mode-options--3">

        <button className="scan-mode-card" onClick={() => onChoose('grid')}>
          <span className="scan-mode-icon">📷</span>
          <span className="scan-mode-title">Binder page photo</span>
          <span className="scan-mode-desc">One photo of up to 9 cards. We identify them all at once.</span>
          <span className="btn btn-primary btn-sm" style={{marginTop:8}}>Open camera / upload</span>
        </button>

        <button className="scan-mode-card" onClick={() => onChoose('individual')}>
          <span className="scan-mode-icon">🃏</span>
          <span className="scan-mode-title">Single card photo</span>
          <span className="scan-mode-desc">Take a photo of one card at a time, or select up to 9 individual photos.</span>
          <span className="btn btn-secondary btn-sm" style={{marginTop:8}}>Take / select photo</span>
        </button>

        <button className="scan-mode-card" onClick={() => onChoose('number')}>
          <span className="scan-mode-icon">🔢</span>
          <span className="scan-mode-title">Search by card number</span>
          <span className="scan-mode-desc">Know the card number? e.g. 023/088. Search to find it and add it directly.</span>
          <span className="btn btn-secondary btn-sm" style={{marginTop:8}}>Search by number</span>
        </button>

      </div>
    </div>
  );
}

// ─── Number / name search ──────────────────────────────────────
function NumberSearch({ onComplete, user, addCard, onBack }) {
  const { cards: myCards } = useCollection();
  const [query, setQuery]       = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [feedback, setFeedback] = useState({}); // cardId → 'added' | 'wishlisted'

  const myCardIds = new Set(myCards.map(c => c.card_id));

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    setSearched(true);

    const q = query.trim();

    try {
      // Detect if it looks like a card number (contains /)
      const isNumber = /\d+\/\d+/.test(q) || /^\d+$/.test(q);

      let cards = [];

      if (isNumber) {
        // Search by number — optionally filter by set name too
        const numPart = q.split('/')[0].replace(/^0+/, '');
        let searchQuery = `number:${numPart}`;
        if (setFilter.trim()) searchQuery += ` set.name:"${setFilter.trim()}"`;

        const res = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(searchQuery)}&pageSize=20&orderBy=-set.releaseDate`
        );
        const data = await res.json();
        cards = (data.data || []).map(normaliseCardRaw);
      } else {
        // Name search
        const data = await searchPokemonCards(q);
        cards = data.cards || [];
      }

      setResults(cards);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAddToCollection = async (card) => {
    try {
      await addCard({
        card_id: card.id, card_name: card.name,
        set_id: card.set_id, set_name: card.set_name,
        set_series: card.set_series, card_number: card.card_number,
        rarity: card.rarity, image_url: card.image_small,
      });
      setFeedback(f => ({ ...f, [card.id]: 'added' }));
    } catch (err) { console.error(err); }
  };

  const handleAddToWishlist = async (card) => {
    try {
      await addToWishlist(user.id, {
        card_id: card.id, card_name: card.name,
        set_id: card.set_id, set_name: card.set_name,
        card_number: card.card_number, rarity: card.rarity,
        image_url: card.image_small,
        market_price_gbp: card.prices_gbp?.market || null,
      });
      setFeedback(f => ({ ...f, [card.id]: 'wishlisted' }));
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>

      <div className="number-search-form">
        <div className="number-search-inputs">
          <div className="form-field" style={{flex:1}}>
            <label>Card number or Pokémon name</label>
            <input
              className="search-input"
              style={{width:'100%'}}
              placeholder="e.g. 023/088  or  Charizard  or  025"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              autoFocus
            />
          </div>
          <div className="form-field" style={{flex:1}}>
            <label>Set name <span style={{color:'var(--muted)',fontWeight:400}}>(optional — narrows results)</span></label>
            <input
              className="search-input"
              style={{width:'100%'}}
              placeholder="e.g. Base Set, Jungle, Scarlet & Violet"
              value={setFilter}
              onChange={e => setSetFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={doSearch} disabled={loading || !query.trim()}>
          {loading ? '⚡ Searching...' : '⚡ Search'}
        </button>
      </div>

      <div className="number-search-hint">
        <span>💡 Tips: </span>
        <span>Type <code>025/102</code> or just <code>025</code> for card number. Add a set name to narrow down — e.g. search <code>4</code> + set <code>Base Set</code> to find Charizard 4/102.</span>
      </div>

      {loading && <div className="pokedex-loading"><span className="pokeball-spin">⚡</span><p>Searching...</p></div>}

      {searched && !loading && results.length === 0 && (
        <div className="empty-state">No cards found. Try a different number or name.</div>
      )}

      {results.length > 0 && (
        <div className="number-search-results">
          <div className="number-search-count">{results.length} card{results.length !== 1 ? 's' : ''} found</div>
          <div className="number-results-grid">
            {results.map(card => {
              const owned    = myCardIds.has(card.id);
              const fb       = feedback[card.id];
              const ownedCards = myCards.filter(c => c.card_id === card.id);

              return (
                <div key={card.id} className={`number-result-card ${owned ? 'number-result-card--owned' : ''}`}>
                  <div className="number-result-img">
                    {card.image_small
                      ? <img src={card.image_small} alt={card.name} />
                      : <div className="card-tile-placeholder">?</div>
                    }
                    {owned && <span className="owned-overlay">✓ In collection</span>}
                  </div>

                  <div className="number-result-info">
                    <div className="number-result-name">{card.name}</div>
                    <div className="number-result-set">{card.set_name}</div>
                    <div className="number-result-num">Card #{card.card_number}</div>
                    {card.rarity && <div className="number-result-rarity">{card.rarity}</div>}

                    {/* Owned info */}
                    {owned && (
                      <div className="number-result-owned-info">
                        <span className="owned-tag">✓ You have {ownedCards[0]?.quantity || 1} of this card</span>
                      </div>
                    )}

                    {/* Price */}
                    {card.prices_gbp?.market ? (
                      <div className="number-result-price">
                        <span className="price-market">£{card.prices_gbp.market}</span>
                        {card.prices_gbp.low && card.prices_gbp.high && (
                          <span className="price-range"> (£{card.prices_gbp.low}–£{card.prices_gbp.high})</span>
                        )}
                      </div>
                    ) : (
                      <div className="number-result-price price-unknown">Price unavailable</div>
                    )}

                    {/* Actions */}
                    <div className="number-result-actions">
                      {fb === 'added' ? (
                        <span className="feedback-tag feedback-tag--added">✓ Added to collection!</span>
                      ) : fb === 'wishlisted' ? (
                        <span className="feedback-tag feedback-tag--wishlist">✓ Added to wishlist!</span>
                      ) : (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleAddToCollection(card)}>
                            + Add to collection
                          </button>
                          {!owned && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleAddToWishlist(card)}>
                              ♡ Wishlist
                            </button>
                          )}
                          {card.tcgplayer_url && (
                            <a href={card.tcgplayer_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                              Buy ↗
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Raw normalise for number search results
function normaliseCardRaw(c) {
  if (!c) return null;
  const USD_TO_GBP = 0.79;
  const prices = (() => {
    const p = c.tcgplayer?.prices;
    if (!p) return null;
    const tier = p.holofoil || p.normal || p['1stEditionNormal'] || p.reverseHolofoil;
    if (!tier) return null;
    return { market: tier.market, low: tier.low, mid: tier.mid, high: tier.high };
  })();
  return {
    id: c.id, name: c.name,
    set_id: c.set?.id, set_name: c.set?.name, set_series: c.set?.series,
    card_number: c.number, rarity: c.rarity, hp: c.hp,
    image_small: c.images?.small, image_large: c.images?.large,
    tcgplayer_url: c.tcgplayer?.url,
    prices,
    prices_gbp: prices ? {
      market: prices.market ? (prices.market * USD_TO_GBP).toFixed(2) : null,
      low:    prices.low    ? (prices.low    * USD_TO_GBP).toFixed(2) : null,
      high:   prices.high   ? (prices.high   * USD_TO_GBP).toFixed(2) : null,
    } : null,
  };
}

// ─── Grid scanner ─────────────────────────────────────────────
function GridScanner({ onComplete, user, addCard, onBack }) {
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const [photo, setPhoto]           = useState(null);
  const [scanning, setScanning]     = useState(false);
  const [results, setResults]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [fixing, setFixing]         = useState(null);

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'grid', image: base64 }),
      });
      identified = (await res.json()).results || [];
    } catch (err) { console.error(err); setScanning(false); return; }

    const validCards = identified.filter(c => c.name && c.error !== 'empty' && c.error !== 'not_a_pokemon_card');
    const resolved   = await resolveCards(validCards);
    setResults(resolved.map((r, i) => ({
      ...r, position: validCards[i]?.position || i + 1,
      originalName: validCards[i]?.name || '', include: r.resolved,
    })));
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
        if (photo?.file) {
          const path = `${user.id}/grid-${Date.now()}.jpg`;
          const { data: up } = await supabase.storage.from('card-scans').upload(path, photo.file, { upsert: true });
          if (up) { const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path); scanImageUrl = url?.publicUrl; }
        }
        await addCard({ card_id: r.tcgCard.id, card_name: r.tcgCard.name, set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name, set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number, rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small, scan_image_url: scanImageUrl });
        count++;
      } catch (err) { console.error(err); }
    }
    setSavedCount(count);
    setSaving(false);
    setTimeout(() => onComplete?.(), 2000);
  };

  if (savedCount > 0) return <div className="scan-success"><div className="success-icon">✓</div><h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added!</h2></div>;

  if (fixing !== null) {
    return (
      <div>
        <h3 style={{marginBottom:8,color:'var(--yellow)'}}>Fix card #{fixing + 1}</h3>
        <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Claude read: "<strong style={{color:'var(--text)'}}>{results[fixing]?.originalName}</strong>"</p>
        <ManualPicker initialName={results[fixing]?.originalName || ''} onSelect={c => applyFix(fixing, c)} onCancel={() => setFixing(null)} />
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>
      {!photo ? (
        <div className="grid-drop-zone">
          <span style={{fontSize:48}}>📷</span>
          <p className="grid-drop-title">Take or upload a photo of your binder page</p>
          <p className="grid-drop-hint">Lay cards flat in good lighting. Works best when all cards are clearly visible.</p>
          <div className="grid-drop-buttons">
            <button className="btn btn-primary" onClick={() => cameraRef.current?.click()}>📷 Camera</button>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>🖼 Upload</button>
          </div>
        </div>
      ) : (
        <div className="grid-preview-wrap">
          <img src={photo.preview} alt="Binder" className="grid-preview-img" />
          <button className="btn btn-ghost btn-sm" onClick={() => { setPhoto(null); setResults(null); }}>✕ Remove</button>
        </div>
      )}
      <input ref={fileRef}   type="file" accept="image/*"                       style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e => handlePhoto(e.target.files[0])} />

      {photo && !results && (
        <button className="btn btn-primary" onClick={scanGrid} disabled={scanning}
          style={{marginTop:16,width:'100%',maxWidth:400,justifyContent:'center'}}>
          {scanning ? <><span style={{display:'inline-block',animation:'spin 1s linear infinite',marginRight:6}}>⚡</span>Identifying...</> : '⚡ Identify all cards'}
        </button>
      )}

      {results && (
        <div className="confirm-panel" style={{maxWidth:'100%',marginTop:20}}>
          <h3>⚡ Found {results.length} card{results.length !== 1?'s':''} — confirm before saving</h3>
          {results.filter(r=>!r.resolved).length > 0 && (
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>
              {results.filter(r=>!r.resolved).length} not found — tap <strong style={{color:'var(--yellow)'}}>Fix</strong> to search manually.
            </p>
          )}
          <div className="grid-confirm-grid">
            {results.map((r,idx) => (
              <div key={idx} className={`grid-confirm-card ${r.resolved?'':'grid-confirm-unresolved'} ${r.include?'grid-confirm-included':''}`}>
                <div className="grid-confirm-img">
                  {r.tcgCard?.image_small ? <img src={r.tcgCard.image_small} alt={r.tcgCard.name} /> : <div className="grid-confirm-placeholder">{r.originalName?.[0]||'?'}</div>}
                  {r.resolved && <label className="grid-confirm-check"><input type="checkbox" checked={!!r.include} onChange={e=>setResults(res=>res.map((x,i)=>i===idx?{...x,include:e.target.checked}:x))} /></label>}
                </div>
                <div className="grid-confirm-info">
                  {r.resolved ? (
                    <><div className="grid-confirm-name">{r.tcgCard.name}</div><div className="grid-confirm-set">{r.tcgCard.set_name} #{r.tcgCard.card_number}</div>{r.tcgCard.prices_gbp?.market&&<div className="grid-confirm-price">£{r.tcgCard.prices_gbp.market}</div>}</>
                  ) : (
                    <><div className="grid-confirm-name" style={{color:'var(--muted)',fontSize:10}}>{r.originalName||'Not found'}</div><button className="btn btn-xs btn-primary" onClick={()=>setFixing(idx)} style={{marginTop:4}}>Fix</button></>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={saveAll} disabled={saving||results.filter(r=>r.include&&r.resolved).length===0} style={{marginTop:16}}>
            {saving?'Saving...':`Add ${results.filter(r=>r.include&&r.resolved).length} card${results.filter(r=>r.include&&r.resolved).length!==1?'s':''} to collection`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Individual scanner with camera ───────────────────────────
function IndividualScanner({ onComplete, user, addCard, onBack }) {
  const MAX = 9;
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
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
    imgs.forEach(file => { const empty = newSlots.findIndex(s => !s); if (empty === -1) return; newSlots[empty] = { file, preview: URL.createObjectURL(file) }; });
    setSlots(newSlots); setResults([]); setConfirmed(false);
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
      const res = await fetch('/.netlify/functions/identify-cards', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ images }) });
      identified = (await res.json()).results || [];
    } catch (err) { console.error(err); setScanning(false); return; }
    const resolved = await resolveCards(identified);
    setResults(resolved.map((r,i) => ({ ...r, preview: filled[i]?.preview, file: filled[i]?.file, originalName: identified[i]?.name||'', include: !r.error && r.resolved })));
    setConfirmed(true); setScanning(false);
  };

  const applyFix = (idx, tcgCard) => { setResults(r => r.map((x,i) => i===idx ? {...x,resolved:true,tcgCard,include:true} : x)); setFixing(null); };

  const saveAll = async () => {
    setSaving(true); let count = 0;
    for (const r of results.filter(r => r.include && r.resolved && r.tcgCard)) {
      try {
        let scanImageUrl = null;
        if (r.file) { const path = `${user.id}/${Date.now()}-${r.file.name}`; const { data: up } = await supabase.storage.from('card-scans').upload(path, r.file, { upsert:true }); if (up) { const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path); scanImageUrl = url?.publicUrl; } }
        await addCard({ card_id: r.tcgCard.id, card_name: r.tcgCard.name, set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name, set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number, rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small, scan_image_url: scanImageUrl });
        count++;
      } catch (err) { console.error(err); }
    }
    setSavedCount(count); setSaving(false);
    setTimeout(() => { setSlots(Array(MAX).fill(null)); setResults([]); setConfirmed(false); setSavedCount(0); onComplete?.(); }, 2000);
  };

  if (savedCount > 0) return <div className="scan-success"><div className="success-icon">✓</div><h2>{savedCount} card{savedCount!==1?'s':''} added!</h2></div>;

  if (fixing !== null) {
    return (
      <div>
        <h3 style={{marginBottom:8,color:'var(--yellow)'}}>Fix card #{fixing+1}</h3>
        <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Claude read: "<strong style={{color:'var(--text)'}}>{results[fixing]?.originalName}</strong>"</p>
        <ManualPicker initialName={results[fixing]?.originalName||''} onSelect={c=>applyFix(fixing,c)} onCancel={()=>setFixing(null)} />
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>

      {/* Camera shortcut — prominent on mobile */}
      <div className="single-card-camera-bar">
        <button className="btn btn-primary" onClick={() => cameraInputRef.current?.click()} style={{flex:1,justifyContent:'center'}}>
          📷 Take photo of a card
        </button>
        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} style={{flex:1,justifyContent:'center'}}>
          🖼 Select from gallery
        </button>
      </div>

      <input ref={fileInputRef}   type="file" accept="image/*" multiple             style={{display:'none'}} onChange={e => handleFiles(e.target.files)} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e => handleFiles(e.target.files)} />

      {/* 3×3 slot grid */}
      <div className="card-grid-upload" style={{marginTop:16}} onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files);}} onDragOver={e=>e.preventDefault()}>
        {slots.map((slot,idx) => (
          <div key={idx} className={`upload-slot ${slot?'filled':'empty'}`} onClick={()=>!slot&&fileInputRef.current?.click()}>
            {slot ? (
              <>
                <img src={slot.preview} alt={`card ${idx+1}`} className="slot-preview" />
                {!confirmed && <button className="remove-slot" onClick={e=>{e.stopPropagation();removeSlot(idx);}}>×</button>}
                {confirmed && results[idx] && <div className={`slot-badge ${results[idx].resolved?'badge-ok':'badge-err'}`}>{results[idx].resolved?'✓':'?'}</div>}
              </>
            ) : (
              <div className="slot-placeholder">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <span style={{fontSize:10}}>Add</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="scan-controls">
        <div className="scan-count">{filledSlots.length}/{MAX}</div>
        <div className="scan-buttons">
          {filledSlots.length > 0 && !confirmed && (
            <button className="btn btn-primary" onClick={scanAll} disabled={scanning}>
              {scanning ? '⚡ Scanning...' : `⚡ Identify ${filledSlots.length} card${filledSlots.length!==1?'s':''}`}
            </button>
          )}
        </div>
      </div>

      {confirmed && results.length > 0 && (
        <div className="confirm-panel">
          <h3>Confirm cards</h3>
          {results.filter(r=>!r.resolved).length > 0 && (
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>{results.filter(r=>!r.resolved).length} not found — tap <strong style={{color:'var(--yellow)'}}>Fix</strong>.</p>
          )}
          <div className="confirm-list">
            {results.map((r,idx) => (
              <div key={idx} className={`confirm-row ${!r.resolved?'unresolved':''}`}>
                <input type="checkbox" checked={!!r.include&&!!r.resolved} disabled={!r.resolved} onChange={e=>setResults(res=>res.map((x,i)=>i===idx?{...x,include:e.target.checked}:x))} />
                {r.tcgCard?.image_small ? <img src={r.tcgCard.image_small} alt={r.tcgCard.name} className="confirm-thumb" /> : <div className="confirm-thumb-placeholder"/>}
                <div className="confirm-info">
                  {r.resolved ? (
                    <><span className="confirm-name">{r.tcgCard.name}</span><span className="confirm-set">{r.tcgCard.set_name} · #{r.tcgCard.card_number}</span>{r.tcgCard.prices_gbp?.market&&<span className="confirm-price">£{r.tcgCard.prices_gbp.market}</span>}</>
                  ) : (
                    <><span className="confirm-name" style={{color:'var(--muted)'}}>{r.originalName||'Not identified'}</span><span className="confirm-set error-text">Not found</span></>
                  )}
                </div>
                {!r.resolved && <button className="btn btn-xs btn-primary" onClick={()=>setFixing(idx)}>Fix</button>}
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={saveAll} disabled={saving||results.filter(r=>r.include&&r.resolved).length===0}>
            {saving?'Saving...':`Add ${results.filter(r=>r.include&&r.resolved).length} card${results.filter(r=>r.include&&r.resolved).length!==1?'s':''} to collection`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Manual picker ────────────────────────────────────────────
function ManualPicker({ initialName, onSelect, onCancel }) {
  const [query, setQuery]       = useState(initialName);
  const [setName, setSetName]   = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  // Detect if query looks like a card number
  const isNumber = (q) => /\d+\/\d+/.test(q) || /^\d{1,3}$/.test(q.trim());

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setResults([]);

    try {
      if (isNumber(q)) {
        // Card number search — hit TCG API directly
        const numPart = q.split('/')[0].replace(/^0+/, '');
        let searchQuery = `number:${numPart}`;
        if (setName.trim()) searchQuery += ` set.name:"${setName.trim()}"`;

        const res = await fetch(
          `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(searchQuery)}&pageSize=20&orderBy=-set.releaseDate`
        );
        const data = await res.json();
        const USD_TO_GBP = 0.79;
        const cards = (data.data || []).map(c => {
          const p = c.tcgplayer?.prices;
          const tier = p ? (p.holofoil || p.normal || p['1stEditionNormal'] || p.reverseHolofoil) : null;
          const prices = tier ? { market: tier.market, low: tier.low, high: tier.high } : null;
          return {
            id: c.id, name: c.name,
            set_id: c.set?.id, set_name: c.set?.name, set_series: c.set?.series,
            card_number: c.number, rarity: c.rarity,
            image_small: c.images?.small, tcgplayer_url: c.tcgplayer?.url,
            prices,
            prices_gbp: prices ? {
              market: prices.market ? (prices.market * USD_TO_GBP).toFixed(2) : null,
              low:    prices.low    ? (prices.low    * USD_TO_GBP).toFixed(2) : null,
              high:   prices.high   ? (prices.high   * USD_TO_GBP).toFixed(2) : null,
            } : null,
          };
        });
        setResults(cards);
      } else {
        // Name search
        const data = await searchPokemonCards(q);
        setResults(data.cards || []);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div className="manual-picker">
      <div className="manual-picker-fields">
        <div className="manual-picker-main">
          <input
            className="search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Card number (e.g. 023/088) or Pokémon name"
            autoFocus
          />
        </div>
        <div className="manual-picker-set">
          <input
            className="search-input"
            value={setName}
            onChange={e => setSetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Set name (optional)"
          />
        </div>
        <button className="btn btn-primary" onClick={search} disabled={loading || !query.trim()}>
          {loading ? '...' : 'Search'}
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>

      <div className="manual-picker-hint">
        Type the number printed on the card e.g. <code>052/102</code> or just <code>52</code> — add the set name to narrow it down. Or type the Pokémon name to browse all its cards.
      </div>

      {loading && <div style={{textAlign:'center',color:'var(--muted)',padding:20}}>⚡ Searching...</div>}

      {searched && !loading && results.length === 0 && (
        <div className="empty-state" style={{padding:'16px 0'}}>No cards found — try a different number or name.</div>
      )}

      {results.length > 0 && (
        <div className="manual-picker-results">
          <div className="manual-picker-count">{results.length} card{results.length !== 1 ? 's' : ''} found — tap one to use it</div>
          <div className="manual-picker-grid">
            {results.map(card => (
              <div key={card.id} className="manual-picker-card" onClick={() => onSelect(card)}>
                <div className="manual-picker-img">
                  {card.image_small
                    ? <img src={card.image_small} alt={card.name} loading="lazy" />
                    : <div className="card-tile-placeholder">?</div>
                  }
                </div>
                <div className="manual-picker-info">
                  <div className="manual-picker-name">{card.name}</div>
                  <div className="manual-picker-set">{card.set_name}</div>
                  <div className="manual-picker-num">#{card.card_number}</div>
                  {card.rarity && <div className="manual-picker-rarity">{card.rarity}</div>}
                  {card.prices_gbp?.market && (
                    <div className="manual-picker-price">£{card.prices_gbp.market}</div>
                  )}
                  <div className="manual-picker-select-btn">Tap to select ✓</div>
                </div>
              </div>
            ))}
          </div>
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
