// src/components/ScanUploader.jsx
import { useState, useRef, useCallback } from 'react';
import { resolveCards } from '../lib/tcgapi';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase } from '../lib/supabase';

const MAX_CARDS = 9;

export default function ScanUploader({ onComplete }) {
  const { user } = useAuth();
  const { addCard } = useCollection();
  const fileInputRef = useRef(null);

  const [slots, setSlots]         = useState(Array(MAX_CARDS).fill(null)); // { file, preview, status, result }
  const [scanning, setScanning]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults]     = useState([]);
  const [saving, setSaving]       = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const filledSlots = slots.filter(Boolean);

  // ─── File handling ─────────────────────────────────────────
  const handleFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, MAX_CARDS);
    const newSlots = [...slots];

    imageFiles.forEach((file) => {
      const emptyIdx = newSlots.findIndex(s => !s);
      if (emptyIdx === -1) return;
      const preview = URL.createObjectURL(file);
      newSlots[emptyIdx] = { file, preview, status: 'ready', result: null };
    });

    setSlots(newSlots);
    setResults([]);
    setConfirmed(false);
  }, [slots]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeSlot = (idx) => {
    const newSlots = [...slots];
    if (newSlots[idx]?.preview) URL.revokeObjectURL(newSlots[idx].preview);
    newSlots[idx] = null;
    // Compact - shift filled slots to the front
    const filled = newSlots.filter(Boolean);
    const compacted = [...filled, ...Array(MAX_CARDS - filled.length).fill(null)];
    setSlots(compacted);
  };

  // ─── Scan ───────────────────────────────────────────────────
  const scanAll = async () => {
    setScanning(true);
    setConfirmed(false);

    const filled = slots.filter(Boolean);
    if (!filled.length) return;

    // Convert files to base64
    const images = await Promise.all(filled.map(slot => fileToBase64(slot.file)));

    // Call Netlify function
    let identifiedCards = [];
    try {
      const res = await fetch('/.netlify/functions/identify-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      identifiedCards = data.results || [];
    } catch (err) {
      console.error('Scan failed:', err);
      setScanning(false);
      return;
    }

    // Resolve against TCG API
    const resolved = await resolveCards(identifiedCards);

    // Merge with slot data
    const withPreviews = resolved.map((r, i) => ({
      ...r,
      preview: filled[i]?.preview,
      file: filled[i]?.file,
      include: !r.error,   // default include unless error
    }));

    setResults(withPreviews);
    setConfirmed(true);
    setScanning(false);
  };

  // ─── Save confirmed cards ───────────────────────────────────
  const saveAll = async () => {
    setSaving(true);
    let count = 0;

    const toSave = results.filter(r => r.include && r.resolved && r.tcgCard);

    for (const r of toSave) {
      try {
        // Upload scan image to Supabase Storage
        let scanImageUrl = null;
        if (r.file) {
          const path = `${user.id}/${Date.now()}-${r.file.name}`;
          const { data: uploadData } = await supabase.storage
            .from('card-scans').upload(path, r.file, { upsert: true });
          if (uploadData) {
            const { data: urlData } = supabase.storage.from('card-scans').getPublicUrl(path);
            scanImageUrl = urlData?.publicUrl;
          }
        }

        await addCard({
          card_id:       r.tcgCard.id,
          card_name:     r.tcgCard.name,
          set_id:        r.tcgCard.set_id,
          set_name:      r.tcgCard.set_name,
          set_series:    r.tcgCard.set_series,
          card_number:   r.tcgCard.card_number,
          rarity:        r.tcgCard.rarity,
          image_url:     r.tcgCard.image_small,
          scan_image_url: scanImageUrl,
        });
        count++;
      } catch (err) {
        console.error('Failed to save card:', err);
      }
    }

    setSavedCount(count);
    setSaving(false);

    // Reset after save
    setTimeout(() => {
      setSlots(Array(MAX_CARDS).fill(null));
      setResults([]);
      setConfirmed(false);
      setSavedCount(0);
      onComplete?.();
    }, 2000);
  };

  // ─── Render ─────────────────────────────────────────────────
  if (savedCount > 0) {
    return (
      <div className="scan-success">
        <div className="success-icon">✓</div>
        <h2>{savedCount} card{savedCount !== 1 ? 's' : ''} added to your collection!</h2>
      </div>
    );
  }

  return (
    <div className="scan-uploader">
      {/* 3×3 grid */}
      <div
        className="card-grid-upload"
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {slots.map((slot, idx) => (
          <div
            key={idx}
            className={`upload-slot ${slot ? 'filled' : 'empty'}`}
            onClick={() => !slot && fileInputRef.current?.click()}
          >
            {slot ? (
              <>
                <img src={slot.preview} alt={`card ${idx + 1}`} className="slot-preview" />
                {!confirmed && (
                  <button className="remove-slot" onClick={(e) => { e.stopPropagation(); removeSlot(idx); }}>×</button>
                )}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Controls */}
      <div className="scan-controls">
        <div className="scan-count">
          {filledSlots.length} / {MAX_CARDS} cards loaded
        </div>
        <div className="scan-buttons">
          {filledSlots.length > 0 && !confirmed && (
            <button
              className="btn btn-primary"
              onClick={scanAll}
              disabled={scanning}
            >
              {scanning ? 'Identifying...' : `Identify ${filledSlots.length} card${filledSlots.length !== 1 ? 's' : ''}`}
            </button>
          )}
          {filledSlots.length < MAX_CARDS && !scanning && (
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Add more
            </button>
          )}
        </div>
      </div>

      {/* Confirmation panel */}
      {confirmed && results.length > 0 && (
        <ConfirmPanel
          results={results}
          onToggle={(idx, val) => setResults(r => r.map((x, i) => i === idx ? { ...x, include: val } : x))}
          onSave={saveAll}
          saving={saving}
        />
      )}
    </div>
  );
}

function ConfirmPanel({ results, onToggle, onSave, saving }) {
  const includedCount = results.filter(r => r.include && r.resolved).length;

  return (
    <div className="confirm-panel">
      <h3>Confirm identified cards</h3>
      <div className="confirm-list">
        {results.map((r, idx) => (
          <div key={idx} className={`confirm-row ${!r.resolved ? 'unresolved' : ''}`}>
            <input
              type="checkbox"
              checked={r.include && r.resolved}
              disabled={!r.resolved}
              onChange={e => onToggle(idx, e.target.checked)}
            />
            {r.tcgCard?.image_small ? (
              <img src={r.tcgCard.image_small} alt={r.tcgCard.name} className="confirm-thumb" />
            ) : (
              <div className="confirm-thumb-placeholder" />
            )}
            <div className="confirm-info">
              {r.resolved ? (
                <>
                  <span className="confirm-name">{r.tcgCard.name}</span>
                  <span className="confirm-set">{r.tcgCard.set_name} · #{r.tcgCard.card_number}</span>
                  {r.tcgCard.prices?.market && (
                    <span className="confirm-price">~${r.tcgCard.prices.market.toFixed(2)}</span>
                  )}
                </>
              ) : (
                <>
                  <span className="confirm-name unresolved-label">
                    {r.name || 'Could not identify'}
                  </span>
                  <span className="confirm-set error-text">
                    {r.error === 'not_a_pokemon_card' ? 'Not a Pokémon card' :
                     r.error === 'image_unclear' ? 'Image too blurry' :
                     'Could not find in database'}
                  </span>
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
      >
        {saving ? 'Saving...' : `Add ${includedCount} card${includedCount !== 1 ? 's' : ''} to collection`}
      </button>
    </div>
  );
}

// Helper
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      base64: reader.result.split(',')[1],
      mediaType: file.type,
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
