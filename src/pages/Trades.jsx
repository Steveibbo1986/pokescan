// src/pages/Trades.jsx
import { useState } from 'react';
import { useTrades } from '../hooks/useTrades';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';

export default function Trades() {
  const { user } = useAuth();
  const { incoming, outgoing, history, respond } = useTrades();
  const { cards: myCards } = useCollection();
  const [tab, setTab] = useState('incoming');

  const myCardMap = Object.fromEntries(myCards.map(c => [c.id, c]));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Trades</h1>
          {incoming.length > 0 && (
            <p className="alert-text">{incoming.length} pending offer{incoming.length !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="tab-bar">
        <button className={tab === 'incoming' ? 'tab active' : 'tab'} onClick={() => setTab('incoming')}>
          Incoming {incoming.length > 0 && <span className="tab-badge">{incoming.length}</span>}
        </button>
        <button className={tab === 'outgoing' ? 'tab active' : 'tab'} onClick={() => setTab('outgoing')}>
          Outgoing ({outgoing.filter(t => t.status === 'pending').length})
        </button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          History
        </button>
      </div>

      <div className="trade-list">
        {tab === 'incoming' && (
          incoming.length === 0
            ? <div className="empty-state">No incoming trade offers</div>
            : incoming.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  myUserId={user?.id}
                  onAccept={() => respond(trade.id, 'accepted')}
                  onDecline={() => respond(trade.id, 'declined')}
                />
              ))
        )}
        {tab === 'outgoing' && (
          outgoing.length === 0
            ? <div className="empty-state">No outgoing trade offers</div>
            : outgoing.map(trade => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  myUserId={user?.id}
                  onCancel={() => respond(trade.id, 'cancelled')}
                />
              ))
        )}
        {tab === 'history' && (
          history.length === 0
            ? <div className="empty-state">No trade history yet</div>
            : history.map(trade => (
                <TradeCard key={trade.id} trade={trade} myUserId={user?.id} />
              ))
        )}
      </div>
    </div>
  );
}

function TradeCard({ trade, myUserId, onAccept, onDecline, onCancel }) {
  const isIncoming = trade.to_user_id === myUserId;
  const other = isIncoming ? trade.from_profile : trade.to_profile;

  const STATUS_LABEL = {
    pending:   { text: 'Pending',   cls: 'status-pending' },
    accepted:  { text: 'Accepted',  cls: 'status-ok'      },
    declined:  { text: 'Declined',  cls: 'status-bad'     },
    cancelled: { text: 'Cancelled', cls: 'status-muted'   },
  };

  const s = STATUS_LABEL[trade.status] || STATUS_LABEL.pending;

  return (
    <div className="trade-card">
      <div className="trade-card-header">
        <div className="trade-user">
          <div className="avatar-sm">
            {other?.display_name?.[0] || other?.username?.[0] || '?'}
          </div>
          <div>
            <span className="trade-user-name">{other?.display_name || other?.username}</span>
            <span className="trade-date">
              {new Date(trade.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <span className={`status-badge ${s.cls}`}>{s.text}</span>
      </div>

      <div className="trade-card-body">
        <div className="trade-side-preview">
          <span className="trade-label">{isIncoming ? 'They offer' : 'You offer'}</span>
          <span className="trade-count">{trade.offered_card_ids?.length} card{trade.offered_card_ids?.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="trade-arrow">⇄</div>
        <div className="trade-side-preview">
          <span className="trade-label">{isIncoming ? 'They want' : 'You want'}</span>
          <span className="trade-count">{trade.wanted_card_ids?.length} card{trade.wanted_card_ids?.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {trade.message && (
        <div className="trade-message-display">"{trade.message}"</div>
      )}

      {trade.status === 'pending' && (
        <div className="trade-actions">
          {onAccept && <button className="btn btn-primary" onClick={onAccept}>Accept</button>}
          {onDecline && <button className="btn btn-secondary" onClick={onDecline}>Decline</button>}
          {onCancel  && <button className="btn btn-ghost" onClick={onCancel}>Cancel offer</button>}
        </div>
      )}
    </div>
  );
}
