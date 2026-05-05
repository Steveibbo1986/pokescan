// src/components/ScanUploader.jsx
import { useState, useRef, useCallback } from 'react';
import { resolveCards, searchPokemonCards } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase, addToWishlist } from '../lib/supabase';

export default function ScanUploader({ onComplete }) {
  const { user }          = useAuth();
  const { addCard, cards: myCards } = useCollection();
  const [mode, setMode]   = useState('choose');

  return (
    <div className="scan-uploader">
      {mode === 'choose'     && <ScanModeChooser onChoose={setMode} />}
      {mode === 'grid'       && <GridScanner       onComplete={onComplete} user={user} addCard={addCard} myCards={myCards} onBack={() => setMode('choose')} />}
      {mode === 'individual' && <IndividualScanner onComplete={onComplete} user={user} addCard={addCard} myCards={myCards} onBack={() => setMode('choose')} />}
      {mode === 'number'     && <NumberSearch      onComplete={onComplete} user={user} addCard={addCard} myCards={myCards} onBack={() => setMode('choose')} />}
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
          <span className="scan-mode-desc">Take a photo of one card at a time, or select up to 9 photos.</span>
          <span className="btn btn-secondary btn-sm" style={{marginTop:8}}>Take / select photo</span>
        </button>
        <button className="scan-mode-card" onClick={() => onChoose('number')}>
          <span className="scan-mode-icon">🔢</span>
          <span className="scan-mode-title">Search by card number</span>
          <span className="scan-mode-desc">Know the card number? e.g. 023/088. Find and add it directly.</span>
          <span className="btn btn-secondary btn-sm" style={{marginTop:8}}>Search by number</span>
        </button>
      </div>
    </div>
  );
}

// ─── Duplicate warning ─────────────────────────────────────────
function DuplicateWarning({ card, existingQty, onAddAnyway, onSkip }) {
  return (
    <div className="duplicate-warning">
      <div className="duplicate-icon">⚠️</div>
      <div className="duplicate-body">
        <div className="duplicate-title">You already have this card!</div>
        <div className="duplicate-detail">
          You own {existingQty} × <strong>{card.name}</strong> ({card.set_name} #{card.card_number})
        </div>
        <div className="duplicate-actions">
          <button className="btn btn-primary btn-sm" onClick={onAddAnyway}>Add another copy anyway</button>
          <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip this card</button>
        </div>
      </div>
    </div>
  );
}

// ─── Grid scanner ─────────────────────────────────────────────
function GridScanner({ onComplete, user, addCard, myCards, onBack }) {
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const [photo, setPhoto]           = useState(null);
  const [scanning, setScanning]     = useState(false);
  const [results, setResults]       = useState(null);
  const [saving, setSaving]         = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [fixing, setFixing]         = useState(null);
  const [duplicateQueue, setDuplicateQueue] = useState([]);
  const [currentDuplicate, setCurrentDuplicate] = useState(null);

  const myCardMap = Object.fromEntries(myCards.map(c => [c.card_id, c]));

  const handlePhoto = (file) => {
    if (!file?.type.startsWith('image/')) return;
    setPhoto({ file, preview: URL.createObjectURL(file) });
    setResults(null);
  };

  const scanGrid = async () => {
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

    const valid   = identified.filter(c => c.name && c.error !== 'empty' && c.error !== 'not_a_pokemon_card');
    const resolved = await resolveCards(valid);

    setResults(resolved.map((r, i) => ({
      ...r,
      position:     valid[i]?.position || i + 1,
      originalName: valid[i]?.name || '',
      include:      r.resolved,
      duplicate:    r.resolved && myCardMap[r.tcgCard?.id] ? myCardMap[r.tcgCard.id] : null,
    })));
    setScanning(false);
  };

  const applyFix = (idx, tcgCard) => {
    setResults(r => r.map((x, i) => i === idx ? {
      ...x, resolved: true, tcgCard, include: true,
      duplicate: myCardMap[tcgCard.id] || null,
    } : x));
    setFixing(null);
  };

  const saveAll = async () => {
    setSaving(true);
    const toSave = results.filter(r => r.include && r.resolved && r.tcgCard);

    // Check for duplicates first
    const dupes = toSave.filter(r => r.duplicate);
    if (dupes.length > 0) {
      setDuplicateQueue(toSave);
      setCurrentDuplicate({ idx: 0, items: toSave });
      setSaving(false);
      return;
    }

    await doSave(toSave);
  };

  const doSave = async (items) => {
    setSaving(true);
    let count = 0;
    let scanImageUrl = null;

    // Upload scan image once
    if (photo?.file) {
      const path = `${user.id}/grid-${Date.now()}.jpg`;
      const { data: up } = await supabase.storage.from('card-scans').upload(path, photo.file, { upsert: true });
      if (up) {
        const { data: url } = supabase.storage.from('card-scans').getPublicUrl(path);
        scanImageUrl = url?.publicUrl;
      }
    }

    // Save all cards in parallel
    await Promise.allSettled(items.map(async r => {
      try {
        await addCard({ card_id: r.tcgCard.id, card_name: r.tcgCard.name, set_id: r.tcgCard.set_id, set_name: r.tcgCard.set_name, set_series: r.tcgCard.set_series, card_number: r.tcgCard.card_number, rarity: r.tcgCard.rarity, image_url: r.tcgCard.image_small, scan_image_url: scanImageUrl, market_price_gbp: r.tcgCard.prices_gbp?.market || null });
        count++;
      } catch (err) { console.error(err); }
    }));

    setSavedCount(count);
    setSaving(false);
    setTimeout(() => onComplete?.(), 2000);
  };

  const handleDuplicateResponse = async (addAnyway) => {
    const queue = [...duplicateQueue];
    const current = queue[currentDuplicate.idx];

    if (!addAnyway) {
      // Remove from save list
      queue.splice(currentDuplicate.idx, 1);
    }

    const nextDupeIdx = queue.findIndex((r, i) => i >= currentDuplicate.idx && r.duplicate);

    if (nextDupeIdx === -1) {
      // No more dupes — save remaining
      setCurrentDuplicate(null);
      setDuplicateQueue([]);
      await doSave(queue);
    } else {
      setDuplicateQueue(queue);
      setCurrentDuplicate({ idx: nextDupeIdx, items: queue });
    }
  };

  if (savedCount > 0) return <div className="scan-success"><div className="success-icon">✓</div><h2>{savedCount} card{savedCount!==1?'s':''} added!</h2></div>;

  // Duplicate prompt
  if (currentDuplicate) {
    const item = duplicateQueue[currentDuplicate.idx];
    return (
      <DuplicateWarning
        card={item.tcgCard}
        existingQty={item.duplicate?.quantity || 1}
        onAddAnyway={() => handleDuplicateResponse(true)}
        onSkip={() => handleDuplicateResponse(false)}
      />
    );
  }

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
      {!photo ? (
        <div className="grid-drop-zone">
          <span style={{fontSize:48}}>📷</span>
          <p className="grid-drop-title">Take or upload a photo of your binder page</p>
          <p className="grid-drop-hint">Lay cards flat in good lighting. Best when all 9 cards are clearly visible.</p>
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
      <input ref={fileRef}   type="file" accept="image/*"                       style={{display:'none'}} onChange={e=>handlePhoto(e.target.files[0])} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handlePhoto(e.target.files[0])} />

      {photo && !results && (
        <button className="btn btn-primary" onClick={scanGrid} disabled={scanning}
          style={{marginTop:16,width:'100%',maxWidth:400,justifyContent:'center'}}>
          {scanning ? <><span style={{display:'inline-block',animation:'spin 1s linear infinite',marginRight:6}}>⚡</span>Identifying...</> : '⚡ Identify all cards'}
        </button>
      )}

      {results && (
        <div style={{marginTop:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{color:'var(--yellow)'}}>⚡ Found {results.length} card{results.length!==1?'s':''}</h3>
            <span style={{fontSize:13,color:'var(--muted)'}}>{results.filter(r=>r.resolved).length} identified · {results.filter(r=>!r.resolved).length} need fixing</span>
          </div>
          {results.filter(r=>!r.resolved).length > 0 && (
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Tap <strong style={{color:'var(--yellow)'}}>Fix</strong> on any card Claude couldn't find.</p>
          )}
          <div className="confirm-grid-large">
            {results.map((r,idx) => (
              <ConfirmCardLarge
                key={idx} result={r} idx={idx}
                onToggle={val => setResults(res=>res.map((x,i)=>i===idx?{...x,include:val}:x))}
                onFix={() => setFixing(idx)}
              />
            ))}
          </div>
          <button className="btn btn-primary btn-full" onClick={saveAll}
            disabled={saving||results.filter(r=>r.include&&r.resolved).length===0} style={{marginTop:16}}>
            {saving?'Saving...':`Add ${results.filter(r=>r.include&&r.resolved).length} card${results.filter(r=>r.include&&r.resolved).length!==1?'s':''} to collection`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Large confirm card (used in both scanners) ────────────────
function ConfirmCardLarge({ result: r, idx, onToggle, onFix }) {
  return (
    <div className={`confirm-card-large ${r.resolved?'':'confirm-card-large--unresolved'} ${r.include&&r.resolved?'confirm-card-large--included':'confirm-card-large--skipped'}`}>
      <div className="confirm-card-large-img">
        {r.tcgCard?.image_small
          ? <img src={r.tcgCard.image_small} alt={r.tcgCard?.name} />
          : <div className="confirm-card-large-placeholder">{r.originalName?.[0]||'?'}</div>
        }
        {r.duplicate && r.include && (
          <div className="confirm-card-dupe-badge">Already owned</div>
        )}
        {!r.include && r.resolved && (
          <div className="confirm-card-skipped-overlay">✕ Skipped</div>
        )}
      </div>

      <div className="confirm-card-large-info">
        {r.resolved ? (
          <>
            <div className="confirm-card-large-name">{r.tcgCard.name}</div>
            <div className="confirm-card-large-set">{r.tcgCard.set_name}</div>
            <div className="confirm-card-large-num">#{r.tcgCard.card_number}</div>
            {r.tcgCard.rarity && <div className="confirm-card-large-rarity">{r.tcgCard.rarity}</div>}
            {r.tcgCard.prices_gbp?.market && <div className="confirm-card-large-price">£{r.tcgCard.prices_gbp.market}</div>}
          </>
        ) : (
          <div className="confirm-card-large-name" style={{color:'var(--muted)',fontSize:11}}>{r.originalName||'Not found'}</div>
        )}

        <div className="confirm-card-large-actions">
          {/* Wrong card — search for the right one */}
          <button className="confirm-fix-btn" onClick={onFix}>
            {r.resolved ? '✏ Wrong card?' : '🔍 Find card'}
          </button>

          {/* Skip / un-skip — clearly labelled, doesn't save */}
          {r.resolved && (
            r.include ? (
              <button className="confirm-skip-btn" onClick={() => onToggle(false)}>
                ✕ Don't add
              </button>
            ) : (
              <button className="confirm-unskip-btn" onClick={() => onToggle(true)}>
                ↩ Add it
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Individual scanner — single card only ────────────────────
function IndividualScanner({ onComplete, user, addCard, myCards, onBack }) {
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);
  const [photo, setPhoto]           = useState(null);   // { file, preview }
  const [scanning, setScanning]     = useState(false);
  const [result, setResult]         = useState(null);   // resolved card result
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [fixing, setFixing]         = useState(false);
  const [rawRead, setRawRead]       = useState('');     // what Claude read

  const myCardMap = Object.fromEntries(myCards.map(c => [c.card_id, c]));

  const handleFile = (file) => {
    if (!file?.type.startsWith('image/')) return;
    setPhoto({ file, preview: URL.createObjectURL(file) });
    setResult(null); setSaved(false); setFixing(false); setRawRead('');
  };

  const scanCard = async (file) => {
    setScanning(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { base64, mediaType } }),
      });
      const data = await res.json();
      const identified = data.result || data.results?.[0] || {};
      setRawRead(identified.name || '');

      if (identified.error === 'not_a_pokemon_card') {
        setResult({ resolved: false, error: 'not_a_pokemon_card' });
        setScanning(false); return;
      }

      const [resolved] = await resolveCards([identified]);
      setResult({ ...resolved, duplicate: resolved.tcgCard && myCardMap[resolved.tcgCard?.id] ? myCardMap[resolved.tcgCard.id] : null });
    } catch (err) {
      console.error(err);
      setResult({ resolved: false, error: 'network_error' });
    }
    setScanning(false);
  };

  // Auto-scan as soon as a photo is selected
  const handleFileWithScan = (file) => {
    if (!file?.type.startsWith('image/')) return;
    const preview = URL.createObjectURL(file);
    setPhoto({ file, preview });
    setResult(null); setSaved(false); setFixing(false);
    scanCard(file);
  };

  const applyFix = (tcgCard) => {
    setResult(r => ({ ...r, resolved: true, tcgCard, duplicate: myCardMap[tcgCard.id] || null }));
    setFixing(false);
  };

  const saveCard = async () => {
    if (!result?.tcgCard) return;
    setSaving(true);
    try {
      let scanImageUrl = null;
      if (photo?.file) {
        const path = `${user.id}/single-${Date.now()}.jpg`;
        const { data: up } = await supabase.storage.from('card-scans').upload(path, photo.file, { upsert: true });
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

  const scanAnother = () => {
    setPhoto(null); setResult(null); setSaved(false); setFixing(false); setRawRead('');
  };

  if (fixing) return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => setFixing(false)} style={{marginBottom:12}}>← Back</button>
      <h3 style={{marginBottom:8,color:'var(--yellow)'}}>Find the right card</h3>
      {rawRead && <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Claude read: "<strong style={{color:'var(--text)'}}>{rawRead}</strong>"</p>}
      <ManualPicker initialName={rawRead} onSelect={applyFix} onCancel={() => setFixing(false)} />
    </div>
  );

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>

      {/* Photo area */}
      {!photo ? (
        <div className="single-drop-zone">
          <span style={{fontSize:52}}>🃏</span>
          <p className="single-drop-title">Take a photo of one card</p>
          <p className="single-drop-hint">Place the card on a flat surface in good lighting. The scanner reads it automatically.</p>
          <div className="single-drop-btns">
            <button className="btn btn-primary" onClick={() => cameraInputRef.current?.click()}>📷 Camera</button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>🖼 Gallery</button>
          </div>
        </div>
      ) : (
        <div className="single-scan-layout">
          {/* Card photo */}
          <div className="single-photo-wrap">
            <img src={photo.preview} alt="Card" className="single-photo" />
            {scanning && (
              <div className="single-scanning-overlay">
                <div className="single-scan-beam"/>
                <div className="single-scanning-label">⚡ Reading card...</div>
              </div>
            )}
          </div>

          {/* Result */}
          {scanning && (
            <div className="single-result-loading">
              <span style={{fontSize:28,display:'block',marginBottom:8,animation:'spin 1s linear infinite'}}>⚡</span>
              Identifying card...
            </div>
          )}

          {!scanning && result && (
            <div className="single-result">
              {result.error === 'not_a_pokemon_card' ? (
                <div className="single-result-error">
                  <div style={{fontSize:32,marginBottom:8}}>🤔</div>
                  <div style={{fontWeight:700,marginBottom:4}}>Doesn't look like a Pokémon card</div>
                  <div style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Try taking a clearer photo with the card flat and well-lit.</div>
                  <button className="btn btn-secondary btn-sm" onClick={scanAnother}>Try again</button>
                </div>
              ) : !result.resolved ? (
                <div className="single-result-notfound">
                  <div style={{fontSize:28,marginBottom:8}}>❓</div>
                  <div style={{fontWeight:700,marginBottom:4}}>
                    {rawRead ? `Couldn't find "${rawRead}" in the database` : "Couldn't identify this card"}
                  </div>
                  <div style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>
                    Try searching by card number (printed bottom-right of card).
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="btn btn-primary btn-sm" onClick={() => setFixing(true)}>🔍 Search manually</button>
                    <button className="btn btn-secondary btn-sm" onClick={scanAnother}>📷 Retake photo</button>
                  </div>
                </div>
              ) : saved ? (
                <div className="single-result-saved">
                  <div className="single-saved-icon">✓</div>
                  <div style={{fontWeight:800,fontSize:16,color:'var(--green)',marginBottom:4}}>Added to collection!</div>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{result.tcgCard.name}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>{result.tcgCard.set_name} #{result.tcgCard.card_number}</div>
                  <div style={{display:'flex',gap:8,marginTop:14}}>
                    <button className="btn btn-primary" onClick={scanAnother}>📷 Scan another</button>
                    <button className="btn btn-secondary btn-sm" onClick={onComplete}>Done</button>
                  </div>
                </div>
              ) : (
                <div className="single-result-match">
                  <img src={result.tcgCard.image_small} alt={result.tcgCard.name} className="single-result-img" />
                  <div className="single-result-info">
                    <div className="single-result-name">{result.tcgCard.name}</div>
                    <div className="single-result-set">{result.tcgCard.set_name}</div>
                    <div className="single-result-num">#{result.tcgCard.card_number}</div>
                    {result.tcgCard.rarity && <div className="single-result-rarity">{result.tcgCard.rarity}</div>}
                    {result.tcgCard.prices_gbp?.market && (
                      <div className="single-result-price">£{result.tcgCard.prices_gbp.market}</div>
                    )}
                    {result.duplicate && (
                      <div className="single-result-dupe">⚠ You already own this card</div>
                    )}
                    <div className="single-result-actions">
                      <button className="btn btn-primary" onClick={saveCard} disabled={saving}>
                        {saving ? 'Saving...' : result.duplicate ? '+ Add another copy' : '+ Add to collection'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFixing(true)}>✏ Wrong card?</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Retake / new photo */}
          {!scanning && result && !saved && (
            <button className="btn btn-ghost btn-sm" onClick={scanAnother} style={{marginTop:8}}>
              📷 Scan a different card
            </button>
          )}
        </div>
      )}

      <input ref={fileInputRef}   type="file" accept="image/*"                       style={{display:'none'}} onChange={e=>handleFileWithScan(e.target.files[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={e=>handleFileWithScan(e.target.files[0])} />
    </div>
  );
}

// ─── Number search ─────────────────────────────────────────────
function NumberSearch({ onComplete, user, addCard, myCards, onBack }) {
  const [query, setQuery]     = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [feedback, setFeedback] = useState({});

  const myCardIds = new Set(myCards.map(c => c.card_id));

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]); setSearched(true);
    const q = query.trim();
    try {
      const isNumber = /\d+\/\d+/.test(q) || /^\d+$/.test(q);
      let cards = [];
      if (isNumber) {
        const numPart = q.split('/')[0].replace(/^0+/,'');
        let searchQuery = `number:${numPart}`;
        if (setFilter.trim()) searchQuery += ` set.name:"${setFilter.trim()}"`;
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(searchQuery)}&pageSize=20&orderBy=-set.releaseDate`);
        const data = await res.json();
        const USD_TO_GBP = 0.79;
        cards = (data.data||[]).map(c => {
          const p=c.tcgplayer?.prices; const tier=p?(p.holofoil||p.normal||p['1stEditionNormal']||p.reverseHolofoil):null;
          const prices=tier?{market:tier.market,low:tier.low,high:tier.high}:null;
          return { id:c.id, name:c.name, set_id:c.set?.id, set_name:c.set?.name, set_series:c.set?.series, card_number:c.number, rarity:c.rarity, image_small:c.images?.small, tcgplayer_url:c.tcgplayer?.url, prices, prices_gbp:prices?{market:prices.market?(prices.market*USD_TO_GBP).toFixed(2):null,low:prices.low?(prices.low*USD_TO_GBP).toFixed(2):null,high:prices.high?(prices.high*USD_TO_GBP).toFixed(2):null}:null };
        });
      } else {
        const data = await searchPokemonCards(q);
        cards = data.cards || [];
      }
      setResults(cards);
    } catch(err){ console.error(err); }
    setLoading(false);
  };

  const handleAddToCollection = async (card) => {
    const existing = myCards.find(c => c.card_id === card.id);
    if (existing) {
      if (!window.confirm(`You already have ${existing.quantity||1} × ${card.name}. Add another copy?`)) return;
    }
    try {
      await addCard({ card_id:card.id, card_name:card.name, set_id:card.set_id, set_name:card.set_name, set_series:card.set_series, card_number:card.card_number, rarity:card.rarity, image_url:card.image_small, market_price_gbp:card.prices_gbp?.market||null });
      setFeedback(f=>({...f,[card.id]:'added'}));
    } catch(err){ console.error(err); }
  };

  const handleAddToWishlist = async (card) => {
    try {
      await addToWishlist(user.id, { card_id:card.id, card_name:card.name, set_id:card.set_id, set_name:card.set_name, card_number:card.card_number, rarity:card.rarity, image_url:card.image_small, market_price_gbp:card.prices_gbp?.market||null });
      setFeedback(f=>({...f,[card.id]:feedback[card.id]==='added'?'both':'wishlisted'}));
    } catch(err){ console.error(err); }
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>
      <div className="number-search-form">
        <div className="number-search-inputs">
          <div className="form-field" style={{flex:1}}>
            <label>Card number or Pokémon name</label>
            <input className="search-input" style={{width:'100%'}} placeholder="e.g. 023/088  or  Charizard" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} autoFocus />
          </div>
          <div className="form-field" style={{flex:1}}>
            <label>Set name <span style={{color:'var(--muted)',fontWeight:400}}>(optional)</span></label>
            <input className="search-input" style={{width:'100%'}} placeholder="e.g. Base Set, Jungle" value={setFilter} onChange={e=>setSetFilter(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={doSearch} disabled={loading||!query.trim()}>{loading?'⚡ Searching...':'⚡ Search'}</button>
      </div>
      <div className="number-search-hint"><span>💡 </span>Type <code>025/102</code> or just <code>025</code> for card number. Add set name to narrow results.</div>
      {loading && <div className="pokedex-loading"><span className="pokeball-spin">⚡</span></div>}
      {searched && !loading && results.length === 0 && <div className="empty-state">No cards found.</div>}
      {results.length > 0 && (
        <div className="number-search-results">
          <div className="number-search-count">{results.length} card{results.length!==1?'s':''} found</div>
          <div className="number-results-grid">
            {results.map(card => {
              const owned = myCardIds.has(card.id);
              const fb = feedback[card.id];
              const ownedCard = myCards.find(c => c.card_id === card.id);
              return (
                <div key={card.id} className={`number-result-card ${owned?'number-result-card--owned':''}`}>
                  <div className="number-result-img">
                    {card.image_small?<img src={card.image_small} alt={card.name}/>:<div className="card-tile-placeholder">?</div>}
                    {owned&&fb!=='added'&&<span className="owned-overlay">✓ In collection</span>}
                  </div>
                  <div className="number-result-info">
                    <div className="number-result-name">{card.name}</div>
                    <div className="number-result-set">{card.set_name}</div>
                    <div className="number-result-num">#{card.card_number}</div>
                    {card.rarity&&<div className="number-result-rarity">{card.rarity}</div>}
                    {owned&&ownedCard&&<div className="number-result-owned-info"><span className="owned-tag">✓ You have {ownedCard.quantity||1} of this card</span></div>}
                    {card.prices_gbp?.market?<div className="number-result-price"><span className="price-market">£{card.prices_gbp.market}</span>{card.prices_gbp.low&&card.prices_gbp.high&&<span className="price-range"> (£{card.prices_gbp.low}–£{card.prices_gbp.high})</span>}</div>:<div className="number-result-price price-unknown">Price unavailable</div>}
                    <div className="number-result-actions">
                      {fb==='added'||fb==='both'?<span className="feedback-tag feedback-tag--added">✓ Added to collection!</span>:<button className="btn btn-primary btn-sm" onClick={()=>handleAddToCollection(card)}>+ Add to collection</button>}
                      {fb==='wishlisted'||fb==='both'?<span className="feedback-tag feedback-tag--wishlist">✓ Wishlisted!</span>:<button className="btn btn-secondary btn-sm" onClick={()=>handleAddToWishlist(card)}>♡ Wishlist</button>}
                      {card.tcgplayer_url&&<a href={card.tcgplayer_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Buy ↗</a>}
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

// ─── Improved Manual Picker with number search ─────────────────
function ManualPicker({ initialName, onSelect, onCancel }) {
  const [query, setQuery]       = useState(initialName);
  const [setName, setSetName]   = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const isNumber = (q) => /\d+\/\d+/.test(q) || /^\d{1,3}$/.test(q.trim());

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setSearched(true); setResults([]);
    try {
      if (isNumber(q)) {
        const numPart = q.split('/')[0].replace(/^0+/,'');
        let searchQuery = `number:${numPart}`;
        if (setName.trim()) searchQuery += ` set.name:"${setName.trim()}"`;
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(searchQuery)}&pageSize=20&orderBy=-set.releaseDate`);
        const data = await res.json();
        const USD = 0.79;
        setResults((data.data||[]).map(c=>{
          const p=c.tcgplayer?.prices; const tier=p?(p.holofoil||p.normal||p['1stEditionNormal']||p.reverseHolofoil):null;
          const prices=tier?{market:tier.market,low:tier.low,high:tier.high}:null;
          return { id:c.id, name:c.name, set_id:c.set?.id, set_name:c.set?.name, set_series:c.set?.series, card_number:c.number, rarity:c.rarity, image_small:c.images?.small, prices, prices_gbp:prices?{market:prices.market?(prices.market*USD).toFixed(2):null}:null };
        }));
      } else {
        const data = await searchPokemonCards(q);
        setResults(data.cards || []);
      }
    } catch(err){ console.error(err); }
    setLoading(false);
  };

  return (
    <div className="manual-picker">
      <div className="manual-picker-fields">
        <div className="manual-picker-main">
          <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Card number (e.g. 023/088) or Pokémon name" autoFocus />
        </div>
        <div className="manual-picker-set">
          <input className="search-input" value={setName} onChange={e=>setSetName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Set name (optional)" />
        </div>
        <button className="btn btn-primary" onClick={search} disabled={loading||!query.trim()}>{loading?'...':'Search'}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      <div className="manual-picker-hint">
        Type the number printed on the card e.g. <code>052/102</code> — add set name to narrow down. Or type the Pokémon name.
      </div>
      {loading && <div style={{textAlign:'center',color:'var(--muted)',padding:20}}>⚡ Searching...</div>}
      {searched && !loading && results.length===0 && <div className="empty-state" style={{padding:'16px 0'}}>No cards found.</div>}
      {results.length > 0 && (
        <div className="manual-picker-results">
          <div className="manual-picker-count">{results.length} card{results.length!==1?'s':''} — tap to use</div>
          <div className="manual-picker-grid">
            {results.map(card=>(
              <div key={card.id} className="manual-picker-card" onClick={()=>onSelect(card)}>
                <div className="manual-picker-img">{card.image_small?<img src={card.image_small} alt={card.name} loading="lazy"/>:<div className="card-tile-placeholder">?</div>}</div>
                <div className="manual-picker-info">
                  <div className="manual-picker-name">{card.name}</div>
                  <div className="manual-picker-set">{card.set_name}</div>
                  <div className="manual-picker-num">#{card.card_number}</div>
                  {card.rarity&&<div className="manual-picker-rarity">{card.rarity}</div>}
                  {card.prices_gbp?.market&&<div className="manual-picker-price">£{card.prices_gbp.market}</div>}
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
