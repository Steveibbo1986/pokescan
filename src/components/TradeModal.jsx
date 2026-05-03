// src/components/TradeModal.jsx
import { useState, useEffect } from 'react';
import { getCollection } from '../lib/supabase';
import { useTrades } from '../hooks/useTrades';
import CardTile from './CardTile';

export default function TradeModal({ targetUser, targetCards = [], onClose }) {
  const { send } = useTrades();
  const [myCards, setMyCards]         = useState([]);
  const [selectedMine, setSelectedMine]   = useState([]);
  const [selectedTheirs, setSelectedTheirs] = useState(targetCards.map(c => c.id));
  const [message, setMessage]         = useState('');
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [step, setStep]               = useState(1); // 1 = pick mine, 2 = pick theirs, 3 = confirm

  useEffect(() => {
    getCollection(targetUser?.id).then(({ data }) => {
      // Their tradeable cards
    });
    // Load my collection
    import('../lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) getCollection(user.id).then(({ data }) => setMyCards(data || []));
      });
    });
  }, [targetUser]);

  const toggleMine = (card) => {
    setSelectedMine(prev =>
      prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
    );
  };

  const toggleTheirs = (card) => {
    setSelectedTheirs(prev =>
      prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
    );
  };

  const handleSend = async () => {
    if (!selectedMine.length || !selectedTheirs.length) return;
    setSending(true);
    try {
      await send({
        toUserId: targetUser.id,
        offeredCardIds: selectedMine,
        wantedCardIds: selectedTheirs,
        message,
      });
      setSent(true);
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Propose trade with {targetUser?.display_name || targetUser?.username}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {sent ? (
          <div className="trade-sent">
            <div className="success-icon">✓</div>
            <p>Trade offer sent! They'll be notified.</p>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="trade-steps">
              <button className={`trade-step ${step === 1 ? 'active' : ''}`} onClick={() => setStep(1)}>
                1. Cards I'll offer {selectedMine.length > 0 && `(${selectedMine.length})`}
              </button>
              <button className={`trade-step ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>
                2. Cards I want {selectedTheirs.length > 0 && `(${selectedTheirs.length})`}
              </button>
              <button className={`trade-step ${step === 3 ? 'active' : ''}`} onClick={() => setStep(3)}>
                3. Send
              </button>
            </div>

            {step === 1 && (
              <div className="trade-picker">
                <p className="trade-hint">Select cards from your collection to offer:</p>
                <div className="card-grid-display card-grid-sm">
                  {myCards.map(card => (
                    <CardTile
                      key={card.id}
                      card={card}
                      selected={selectedMine.includes(card.id)}
                      onSelect={() => toggleMine(card)}
                    />
                  ))}
                </div>
                <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!selectedMine.length}>
                  Next →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="trade-picker">
                <p className="trade-hint">Select cards you want from {targetUser?.username}:</p>
                <div className="card-grid-display card-grid-sm">
                  {targetCards.map(card => (
                    <CardTile
                      key={card.id}
                      card={card}
                      selected={selectedTheirs.includes(card.id)}
                      onSelect={() => toggleTheirs(card)}
                    />
                  ))}
                </div>
                <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!selectedTheirs.length}>
                  Next →
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="trade-confirm">
                <div className="trade-summary">
                  <div className="trade-side">
                    <span className="trade-side-label">You offer ({selectedMine.length})</span>
                    <div className="trade-mini-cards">
                      {myCards.filter(c => selectedMine.includes(c.id)).map(c => (
                        <img key={c.id} src={c.image_url} alt={c.card_name} className="trade-mini-img" />
                      ))}
                    </div>
                  </div>
                  <div className="trade-arrow">⇄</div>
                  <div className="trade-side">
                    <span className="trade-side-label">You receive ({selectedTheirs.length})</span>
                    <div className="trade-mini-cards">
                      {targetCards.filter(c => selectedTheirs.includes(c.id)).map(c => (
                        <img key={c.id} src={c.image_url} alt={c.card_name} className="trade-mini-img" />
                      ))}
                    </div>
                  </div>
                </div>
                <textarea
                  className="trade-message"
                  placeholder="Add a message (optional)..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                />
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleSend}
                  disabled={sending || !selectedMine.length || !selectedTheirs.length}
                >
                  {sending ? 'Sending...' : 'Send trade offer'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
