// src/pages/Trades.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCollection } from '../hooks/useCollection';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

const STATUS_LABELS = {
  pending:        { label: 'Awaiting response', color: 'var(--yellow)',  icon: '⏳' },
  accepted:       { label: 'Accepted',          color: 'var(--green)',   icon: '✓'  },
  address_shared: { label: 'Address shared',    color: 'var(--blue)',    icon: '📬' },
  posted_a:       { label: 'You posted',        color: 'var(--blue)',    icon: '📦' },
  posted_b:       { label: 'They posted',       color: 'var(--blue)',    icon: '📦' },
  completed:      { label: 'Completed',         color: 'var(--green)',   icon: '🎉' },
  disputed:       { label: 'In dispute',        color: 'var(--red)',     icon: '⚠️' },
  cancelled:      { label: 'Cancelled',         color: 'var(--muted)',   icon: '✕'  },
  expired:        { label: 'Expired',           color: 'var(--muted)',   icon: '⌛' },
};

export default function Trades() {
  const { user, profile } = useAuth();
  const { cards }         = useCollection();
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('incoming');
  const [selected, setSelected] = useState(null);   // trade detail view
  const [proposing, setProposing] = useState(false); // new trade flow

  useEffect(() => { if (user) loadTrades(); }, [user]);

  async function loadTrades() {
    setLoading(true);
    const { data } = await supabase
      .from('trades')
      .select(`
        *,
        proposer:profiles!trades_proposer_id_fkey(id, username, display_name, avatar_url, trader_rating, trade_count, trading_banned, trading_suspended_until),
        recipient:profiles!trades_recipient_id_fkey(id, username, display_name, avatar_url, trader_rating, trade_count),
        trade_cards(*)
      `)
      .or(`proposer_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    setTrades(data || []);
    setLoading(false);
  }

  // Safety check — can this user trade?
  const canTrade = useMemo(() => {
    if (!profile) return { ok: false, reason: 'Loading...' };
    if (profile.trading_banned) return { ok: false, reason: 'Your trading access has been suspended.' };
    if (profile.trading_suspended_until && new Date(profile.trading_suspended_until) > new Date())
      return { ok: false, reason: `Trading suspended until ${new Date(profile.trading_suspended_until).toLocaleDateString()}.` };
    if (profile.is_minor && !profile.parent_confirmed)
      return { ok: false, reason: 'A parent or guardian needs to confirm your account before you can trade.' };
    // 7-day account age check
    const accountAge = profile.created_at ? (Date.now() - new Date(profile.created_at)) / 86400000 : 999;
    if (accountAge < 7) return { ok: false, reason: `Trading unlocks ${Math.ceil(7 - accountAge)} days after account creation.` };
    const openTrades = trades.filter(t =>
      ['pending','accepted','address_shared','posted_a','posted_b'].includes(t.status) &&
      (t.proposer_id === user.id || t.recipient_id === user.id)
    ).length;
    if (openTrades >= 3) return { ok: false, reason: 'You have 3 open trades. Complete one before starting another.' };
    return { ok: true };
  }, [profile, trades]);

  const incoming = trades.filter(t => t.recipient_id === user?.id && t.status === 'pending');
  const outgoing = trades.filter(t => t.proposer_id === user?.id);
  const active   = trades.filter(t =>
    (t.proposer_id === user?.id || t.recipient_id === user?.id) &&
    ['accepted','address_shared','posted_a','posted_b'].includes(t.status)
  );
  const history  = trades.filter(t =>
    ['completed','cancelled','expired','disputed'].includes(t.status)
  );

  if (selected) return (
    <TradeDetail
      trade={selected} userId={user?.id}
      onBack={() => { setSelected(null); loadTrades(); }}
      onUpdate={loadTrades}
    />
  );

  if (proposing) return (
    <ProposeTrade
      userId={user?.id} myCards={cards}
      canTrade={canTrade}
      onBack={() => setProposing(false)}
      onDone={() => { setProposing(false); loadTrades(); }}
    />
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Trades</h1>
          <p>Swap cards with friends safely</p>
        </div>
        {canTrade.ok
          ? <button className="btn btn-primary" onClick={() => setProposing(true)}>⇄ Propose a trade</button>
          : <div className="trade-blocked-badge">🔒 {canTrade.reason}</div>
        }
      </div>

      {/* Safety notice for new users */}
      {profile && !profile.trader_rating && (
        <div className="trade-safety-notice">
          <span className="trade-safety-icon">🛡️</span>
          <div>
            <div className="trade-safety-title">Trading is friends-only and fully monitored</div>
            <div className="trade-safety-desc">
              Addresses are deleted after 48 hours. Disputes are reviewed by our team.
              Anyone who doesn't send their card within 14 days gets flagged automatically.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loading">Loading trades...</div>
      ) : (
        <>
          <div className="tab-bar">
            <button className={tab==='incoming'?'tab active':'tab'} onClick={()=>setTab('incoming')}>
              Incoming {incoming.length > 0 && <span className="tab-badge">{incoming.length}</span>}
            </button>
            <button className={tab==='active'?'tab active':'tab'} onClick={()=>setTab('active')}>
              Active {active.length > 0 && <span className="tab-badge">{active.length}</span>}
            </button>
            <button className={tab==='outgoing'?'tab active':'tab'} onClick={()=>setTab('outgoing')}>
              Sent
            </button>
            <button className={tab==='history'?'tab active':'tab'} onClick={()=>setTab('history')}>
              History
            </button>
          </div>

          {tab === 'incoming' && (
            <TradeList trades={incoming} userId={user.id} onSelect={setSelected}
              empty="No incoming trade offers right now." />
          )}
          {tab === 'active' && (
            <TradeList trades={active} userId={user.id} onSelect={setSelected}
              empty="No active trades. Propose one with a friend!" />
          )}
          {tab === 'outgoing' && (
            <TradeList trades={outgoing} userId={user.id} onSelect={setSelected}
              empty="You haven't sent any trade proposals yet." />
          )}
          {tab === 'history' && (
            <TradeList trades={history} userId={user.id} onSelect={setSelected}
              empty="No completed trades yet." />
          )}
        </>
      )}
    </div>
  );
}

// ── Trade list ──────────────────────────────────────────────────
function TradeList({ trades, userId, onSelect, empty }) {
  if (!trades.length) return <div className="empty-state">{empty}</div>;
  return (
    <div className="trade-list">
      {trades.map(trade => (
        <TradeCard key={trade.id} trade={trade} userId={userId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function TradeCard({ trade, userId, onSelect }) {
  const isProposer = trade.proposer_id === userId;
  const other      = isProposer ? trade.recipient : trade.proposer;
  const status     = STATUS_LABELS[trade.status] || { label: trade.status, color: 'var(--muted)', icon: '?' };
  const myCards    = (trade.trade_cards || []).filter(c => c.owner_id === userId);
  const theirCards = (trade.trade_cards || []).filter(c => c.owner_id !== userId);

  const timeLeft = trade.status === 'pending' && trade.expires_at
    ? Math.max(0, Math.round((new Date(trade.expires_at) - Date.now()) / 3600000))
    : null;

  return (
    <div className="trade-card" onClick={() => onSelect(trade)}>
      <div className="trade-card-header">
        <div className="trade-user">
          <div className="avatar-sm">{(other?.display_name||other?.username||'?')[0].toUpperCase()}</div>
          <div>
            <div className="trade-user-name">{other?.display_name || other?.username}</div>
            <div className="trade-date">{new Date(trade.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {timeLeft !== null && timeLeft < 12 && (
            <span style={{fontSize:11,color:'var(--red)',fontWeight:700}}>⚠ {timeLeft}h left</span>
          )}
          <span className="status-badge" style={{background:`${status.color}18`,color:status.color,border:`1px solid ${status.color}40`}}>
            {status.icon} {status.label}
          </span>
        </div>
      </div>

      <div className="trade-card-body">
        <div className="trade-side-preview">
          <span className="trade-label">You give</span>
          <span className="trade-count">{myCards.length} card{myCards.length!==1?'s':''}</span>
        </div>
        <div style={{fontSize:20,color:'var(--yellow)'}}>⇄</div>
        <div className="trade-side-preview" style={{textAlign:'right'}}>
          <span className="trade-label">You get</span>
          <span className="trade-count">{theirCards.length} card{theirCards.length!==1?'s':''}</span>
        </div>
      </div>

      {other?.trader_rating && (
        <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginTop:6}}>
          ⭐ {parseFloat(other.trader_rating).toFixed(1)} · {other.trade_count} trades
        </div>
      )}
    </div>
  );
}

// ── Trade detail ────────────────────────────────────────────────
function TradeDetail({ trade, userId, onBack, onUpdate }) {
  const isProposer = trade.proposer_id === userId;
  const other      = isProposer ? trade.recipient : trade.proposer;
  const myCards    = (trade.trade_cards || []).filter(c => c.owner_id === userId);
  const theirCards = (trade.trade_cards || []).filter(c => c.owner_id !== userId);
  const status     = STATUS_LABELS[trade.status] || { label: trade.status, color: 'var(--muted)', icon: '?' };
  const [busy, setBusy]           = useState(false);
  const [address, setAddress]     = useState('');
  const [showAddress, setShowAddress] = useState(false);
  const [theirAddress, setTheirAddress] = useState(null);
  const [rating, setRating]       = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [message, setMessage]     = useState('');

  useEffect(() => {
    if (['address_shared','posted_a','posted_b'].includes(trade.status)) loadAddress();
  }, [trade.status]);

  async function loadAddress() {
    const { data } = await supabase
      .from('trade_addresses')
      .select('address_enc, user_id')
      .eq('trade_id', trade.id);
    if (!data) return;
    const theirs = data.find(a => a.user_id !== userId);
    if (theirs) setTheirAddress(theirs.address_enc);
  }

  const act = async (action, extra = {}) => {
    setBusy(true);
    const updates = { status: action, ...extra };
    if (action === 'accepted')      updates.accepted_at  = new Date().toISOString();
    if (action === 'completed')     updates.completed_at = new Date().toISOString();
    if (action === 'posted_a' && isProposer)  updates.posted_a_at = new Date().toISOString();
    if (action === 'posted_b' && !isProposer) updates.posted_b_at = new Date().toISOString();

    await supabase.from('trades').update(updates).eq('id', trade.id);
    await onUpdate();
    setBusy(false);
    onBack();
  };

  const shareAddress = async () => {
    if (!address.trim()) return;
    setBusy(true);
    await supabase.from('trade_addresses').upsert({
      trade_id: trade.id, user_id: userId, address_enc: address,
      expires_at: new Date(Date.now() + 48*3600*1000).toISOString(),
    });
    await act('address_shared');
  };

  const submitRating = async (stars) => {
    setBusy(true);
    const field = isProposer ? 'rating_a' : 'rating_b';
    await supabase.from('trades').update({ [field]: stars }).eq('id', trade.id);
    // Update the other person's average rating
    const { data: profile } = await supabase.from('profiles')
      .select('trader_rating, trade_count').eq('id', other.id).single();
    if (profile) {
      const total = (parseFloat(profile.trader_rating||0) * profile.trade_count + stars) / (profile.trade_count + 1);
      await supabase.from('profiles').update({
        trader_rating: total.toFixed(2),
        trade_count: profile.trade_count + 1,
      }).eq('id', other.id);
    }
    setBusy(false);
    setRating(stars);
  };

  const submitReport = async () => {
    if (!reportReason) return;
    await supabase.from('trade_reports').insert({
      trade_id: trade.id, reporter_id: userId,
      reported_id: other.id, reason: reportReason, detail: message,
    });
    // Suspend their trading immediately pending review
    await supabase.from('profiles').update({
      trading_suspended_until: new Date(Date.now() + 7*86400*1000).toISOString()
    }).eq('id', other.id);
    setShowReport(false);
    alert('Report submitted. Trading has been temporarily suspended for this user pending review.');
  };

  return (
    <div className="page-container">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back to trades</button>

      {/* Header */}
      <div className="trade-detail-header">
        <div className="trade-detail-with">
          <div className="avatar-sm" style={{width:40,height:40,fontSize:16}}>
            {(other?.display_name||other?.username||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>{other?.display_name||other?.username}</div>
            {other?.trader_rating
              ? <div style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>⭐ {parseFloat(other.trader_rating).toFixed(1)} · {other.trade_count} trades</div>
              : <div style={{fontSize:12,color:'var(--muted)',fontWeight:600}}>New trader</div>
            }
          </div>
        </div>
        <span className="status-badge" style={{background:`${status.color}18`,color:status.color,border:`1px solid ${status.color}40`,fontSize:13,padding:'6px 14px'}}>
          {status.icon} {status.label}
        </span>
      </div>

      {/* Cards being traded */}
      <div className="trade-detail-cards">
        <div className="trade-detail-side">
          <div className="trade-label" style={{marginBottom:8}}>You give ({myCards.length})</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {myCards.map(c => (
              <div key={c.id} className="trade-mini-card-detail">
                {c.image_url && <img src={c.image_url} alt={c.card_name} />}
                <div style={{fontSize:10,fontWeight:700,marginTop:3,textAlign:'center'}}>{c.card_name}</div>
                <div style={{fontSize:10,color:'var(--muted)',textAlign:'center'}}>{c.set_name}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontSize:24,color:'var(--yellow)',alignSelf:'center'}}>⇄</div>
        <div className="trade-detail-side">
          <div className="trade-label" style={{marginBottom:8}}>You get ({theirCards.length})</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {theirCards.map(c => (
              <div key={c.id} className="trade-mini-card-detail">
                {c.image_url && <img src={c.image_url} alt={c.card_name} />}
                <div style={{fontSize:10,fontWeight:700,marginTop:3,textAlign:'center'}}>{c.card_name}</div>
                <div style={{fontSize:10,color:'var(--muted)',textAlign:'center'}}>{c.set_name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Actions per status ── */}

      {/* Incoming pending — accept or decline */}
      {trade.status === 'pending' && !isProposer && (
        <div className="trade-actions-box">
          <div className="trade-actions-title">Respond to this trade offer</div>
          <p className="trade-actions-hint">You have 48 hours to respond. Once accepted, both parties share a postal address to send cards.</p>
          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-primary" onClick={() => act('accepted')} disabled={busy}>✓ Accept trade</button>
            <button className="btn btn-secondary" onClick={() => act('cancelled')} disabled={busy}>✕ Decline</button>
          </div>
        </div>
      )}

      {/* Outgoing pending */}
      {trade.status === 'pending' && isProposer && (
        <div className="trade-actions-box">
          <div className="trade-actions-title">Waiting for {other?.display_name||other?.username} to respond</div>
          <p className="trade-actions-hint">They have 48 hours to accept or decline.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => act('cancelled')} disabled={busy}>Cancel this offer</button>
        </div>
      )}

      {/* Accepted — share address */}
      {trade.status === 'accepted' && (
        <div className="trade-actions-box">
          <div className="trade-actions-title">📬 Share your postal address</div>
          <div className="trade-address-notice">
            <span>🔒</span>
            <span>Your address is only shown to {other?.display_name||other?.username} and is permanently deleted after 48 hours.</span>
          </div>
          <textarea
            className="trade-address-input"
            placeholder={'Your full name\nStreet address\nCity\nPostcode'}
            value={address}
            onChange={e => setAddress(e.target.value)}
            rows={4}
          />
          <button className="btn btn-primary" onClick={shareAddress} disabled={busy || !address.trim()}>
            Share address securely
          </button>
        </div>
      )}

      {/* Address shared — show their address, mark posted */}
      {['address_shared','posted_a','posted_b'].includes(trade.status) && (
        <div className="trade-actions-box">
          {theirAddress && (
            <div style={{marginBottom:16}}>
              <div className="trade-actions-title">📬 Send your cards to:</div>
              <div className="trade-address-display">{theirAddress}</div>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:6}}>This address will be deleted in 48 hours.</div>
            </div>
          )}
          {/* Mark as posted */}
          {trade.status === 'address_shared' && (
            <button className="btn btn-primary"
              onClick={() => act(isProposer ? 'posted_a' : 'posted_b')}
              disabled={busy}>
              📦 I've posted my cards
            </button>
          )}
          {trade.status === 'posted_a' && !isProposer && (
            <div>
              <div style={{color:'var(--green)',fontWeight:700,marginBottom:8}}>✓ They've posted their cards — post yours!</div>
              <button className="btn btn-primary" onClick={() => act('posted_b')} disabled={busy}>📦 I've posted my cards</button>
            </div>
          )}
          {trade.status === 'posted_b' && isProposer && (
            <div>
              <div style={{color:'var(--green)',fontWeight:700,marginBottom:8}}>✓ They've posted their cards — post yours!</div>
              <button className="btn btn-primary" onClick={() => act('posted_a')} disabled={busy}>📦 I've posted my cards</button>
            </div>
          )}
          {/* Both posted */}
          {((trade.status==='posted_a' && isProposer)||(trade.status==='posted_b' && !isProposer)) && (
            <div>
              <div style={{color:'var(--green)',fontWeight:700,marginBottom:8}}>✓ You've posted your cards — waiting for theirs</div>
              <button className="btn btn-primary" onClick={() => act('completed')} disabled={busy}>
                ✓ I've received their cards — complete trade
              </button>
            </div>
          )}
        </div>
      )}

      {/* Completed — rate the trade */}
      {trade.status === 'completed' && (
        <div className="trade-actions-box">
          <div className="trade-actions-title">🎉 Trade complete!</div>
          {!rating && !(isProposer ? trade.rating_a : trade.rating_b) ? (
            <div>
              <div style={{fontSize:14,marginBottom:10}}>Rate your experience with {other?.display_name||other?.username}:</div>
              <div style={{display:'flex',gap:8}}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} className="btn btn-secondary" onClick={() => submitRating(n)} disabled={busy}
                    style={{fontSize:20,padding:'8px 12px'}}>
                    {n <= (rating||0) ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{color:'var(--green)',fontWeight:700}}>✓ Rating submitted — thanks!</div>
          )}
        </div>
      )}

      {/* Dispute */}
      {['address_shared','posted_a','posted_b'].includes(trade.status) && !showReport && (
        <button className="btn btn-ghost btn-sm" onClick={() => setShowReport(true)}
          style={{color:'var(--red)',marginTop:8}}>
          ⚠ Report a problem with this trade
        </button>
      )}

      {showReport && (
        <div className="trade-actions-box" style={{borderColor:'rgba(220,38,38,.3)'}}>
          <div className="trade-actions-title" style={{color:'var(--red)'}}>Report this trade</div>
          <p style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>
            Submitting a report will temporarily suspend {other?.display_name||other?.username} from trading while we review.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
            {['no_show','wrong_card','harassment','fake_account','other'].map(r => (
              <label key={r} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14}}>
                <input type="radio" name="reason" value={r} checked={reportReason===r} onChange={() => setReportReason(r)} />
                {{no_show:'They haven\'t posted their cards',wrong_card:'Wrong or damaged card received',harassment:'Harassment or abuse',fake_account:'Fake / suspicious account',other:'Other'}[r]}
              </label>
            ))}
          </div>
          <textarea className="trade-address-input" placeholder="Any extra details (optional)" value={message} onChange={e=>setMessage(e.target.value)} rows={3} style={{marginBottom:10}}/>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-danger btn-sm" onClick={submitReport} disabled={!reportReason||busy}>Submit report</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowReport(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Propose a trade ─────────────────────────────────────────────
function ProposeTrade({ userId, myCards, canTrade, onBack, onDone }) {
  const [step, setStep]       = useState('friend');   // friend | my-cards | their-cards | confirm
  const [friend, setFriend]   = useState(null);
  const [friendCards, setFriendCards] = useState([]);
  const [mySelected, setMySelected]   = useState([]);
  const [theirSelected, setTheirSelected] = useState([]);
  const [friends, setFriends] = useState([]);
  const [busy, setBusy]       = useState(false);

  useEffect(() => { loadFriends(); }, []);

  async function loadFriends() {
    const { data } = await supabase
      .from('friendships')
      .select(`
        requester_id, addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name, trader_rating, trade_count, trading_banned),
        addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, trader_rating, trade_count, trading_banned)
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq('status', 'accepted');
    if (!data) return;
    setFriends(data.map(f => f.requester_id === userId ? f.addressee : f.requester).filter(Boolean));
  }

  async function selectFriend(f) {
    setFriend(f);
    // Load their tradeable cards
    const { data } = await supabase
      .from('collection_cards')
      .select('*')
      .eq('user_id', f.id)
      .eq('is_tradeable', true);
    setFriendCards(data || []);
    setStep('my-cards');
  }

  const myTradeable = myCards.filter(c => c.is_tradeable);

  const toggleCard = (id, list, setList, max = 5) => {
    setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < max ? [...prev, id] : prev);
  };

  const submitTrade = async () => {
    if (!mySelected.length || !theirSelected.length) return;
    setBusy(true);
    const { data: trade } = await supabase.from('trades').insert({
      proposer_id: userId, recipient_id: friend.id, status: 'pending',
      expires_at: new Date(Date.now() + 48*3600*1000).toISOString(),
    }).select().single();
    if (!trade) { setBusy(false); return; }

    const cards = [
      ...mySelected.map(id => {
        const c = myCards.find(x => x.id === id);
        return { trade_id: trade.id, owner_id: userId, card_id: c.card_id, card_name: c.card_name, set_name: c.set_name, image_url: c.image_url };
      }),
      ...theirSelected.map(id => {
        const c = friendCards.find(x => x.id === id);
        return { trade_id: trade.id, owner_id: friend.id, card_id: c.card_id, card_name: c.card_name, set_name: c.set_name, image_url: c.image_url };
      }),
    ];
    await supabase.from('trade_cards').insert(cards);
    setBusy(false);
    onDone();
  };

  if (!canTrade.ok) return (
    <div className="page-container">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:16}}>← Back</button>
      <div className="trade-blocked-full">
        <div style={{fontSize:36,marginBottom:12}}>🔒</div>
        <h2 style={{marginBottom:8}}>Trading not available</h2>
        <p style={{color:'var(--muted)'}}>{canTrade.reason}</p>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{marginBottom:12}}>← Back</button>
      <h2 style={{marginBottom:4,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>Propose a trade</h2>

      {/* Step indicator */}
      <div className="trade-steps">
        {['Choose friend','Your cards','Their cards','Confirm'].map((s,i) => (
          <div key={i} className={`trade-step-dot ${i <= ['friend','my-cards','their-cards','confirm'].indexOf(step) ? 'active' : ''}`}>{i+1}</div>
        ))}
      </div>

      {/* Step: choose friend */}
      {step === 'friend' && (
        <div>
          <div className="trade-section-title">Who do you want to trade with?</div>
          {friends.length === 0
            ? <div className="empty-state">Add friends first to propose trades. <Link to="/community" className="link-sm">Go to Community →</Link></div>
            : (
              <div className="friends-list">
                {friends.filter(f => !f.trading_banned).map(f => (
                  <div key={f.id} className="friend-row" style={{cursor:'pointer'}} onClick={() => selectFriend(f)}>
                    <div className="avatar-sm">{(f.display_name||f.username||'?')[0].toUpperCase()}</div>
                    <div className="friend-info">
                      <span className="friend-name">{f.display_name||f.username}</span>
                      {f.trader_rating
                        ? <span className="friend-username">⭐ {parseFloat(f.trader_rating).toFixed(1)} · {f.trade_count} trades</span>
                        : <span className="friend-username">New trader</span>
                      }
                    </div>
                    <span className="link-sm">Select →</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Step: my cards */}
      {step === 'my-cards' && (
        <div>
          <div className="trade-section-title">Choose your cards to offer (max 5)</div>
          <div style={{fontSize:13,color:'var(--muted)',marginBottom:12}}>Only cards marked as tradeable are shown. <Link to="/collection" className="link-sm">Mark cards tradeable →</Link></div>
          {myTradeable.length === 0
            ? <div className="empty-state">No tradeable cards. Go to your collection and mark cards as tradeable first.</div>
            : (
              <>
                <div className="card-grid-display">
                  {myTradeable.map(c => (
                    <div key={c.id} className={`card-tile ${mySelected.includes(c.id) ? 'card-tile--selected' : ''}`}
                      onClick={() => toggleCard(c.id, mySelected, setMySelected)}>
                      <div className="card-tile-image">{c.image_url && <img src={c.image_url} alt={c.card_name}/>}</div>
                      <div className="card-tile-info">
                        <div className="card-tile-name">{c.card_name}</div>
                        <div className="card-tile-set">{c.set_name}</div>
                      </div>
                      {mySelected.includes(c.id) && <div className="card-qty">✓</div>}
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" disabled={!mySelected.length} onClick={() => setStep('their-cards')} style={{marginTop:16}}>
                  Next — choose their cards →
                </button>
              </>
            )
          }
        </div>
      )}

      {/* Step: their cards */}
      {step === 'their-cards' && (
        <div>
          <div className="trade-section-title">Choose cards you want from {friend?.display_name||friend?.username} (max 5)</div>
          {friendCards.length === 0
            ? <div className="empty-state">{friend?.display_name||friend?.username} hasn't marked any cards as tradeable yet.</div>
            : (
              <>
                <div className="card-grid-display">
                  {friendCards.map(c => (
                    <div key={c.id} className={`card-tile ${theirSelected.includes(c.id) ? 'card-tile--selected' : ''}`}
                      onClick={() => toggleCard(c.id, theirSelected, setTheirSelected)}>
                      <div className="card-tile-image">{c.image_url && <img src={c.image_url} alt={c.card_name}/>}</div>
                      <div className="card-tile-info">
                        <div className="card-tile-name">{c.card_name}</div>
                        <div className="card-tile-set">{c.set_name}</div>
                      </div>
                      {theirSelected.includes(c.id) && <div className="card-qty">✓</div>}
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" disabled={!theirSelected.length} onClick={() => setStep('confirm')} style={{marginTop:16}}>
                  Review trade →
                </button>
              </>
            )
          }
        </div>
      )}

      {/* Step: confirm */}
      {step === 'confirm' && (
        <div>
          <div className="trade-section-title">Review your trade proposal</div>
          <div className="trade-summary-box">
            <div className="trade-summary-side">
              <div className="trade-label">You send</div>
              {mySelected.map(id => {
                const c = myCards.find(x => x.id === id);
                return <div key={id} className="trade-summary-card">{c?.image_url && <img src={c.image_url} alt={c?.card_name} style={{width:40,height:56,objectFit:'cover',borderRadius:4}}/>}<div><div style={{fontSize:12,fontWeight:700}}>{c?.card_name}</div><div style={{fontSize:11,color:'var(--muted)'}}>{c?.set_name}</div></div></div>;
              })}
            </div>
            <div style={{fontSize:24,color:'var(--yellow)',alignSelf:'center'}}>⇄</div>
            <div className="trade-summary-side">
              <div className="trade-label">You receive</div>
              {theirSelected.map(id => {
                const c = friendCards.find(x => x.id === id);
                return <div key={id} className="trade-summary-card">{c?.image_url && <img src={c.image_url} alt={c?.card_name} style={{width:40,height:56,objectFit:'cover',borderRadius:4}}/>}<div><div style={{fontSize:12,fontWeight:700}}>{c?.card_name}</div><div style={{fontSize:11,color:'var(--muted)'}}>{c?.set_name}</div></div></div>;
              })}
            </div>
          </div>
          <div className="trade-confirm-notice">
            <span>🛡️</span>
            <span>By proposing this trade you agree to our trading rules. Addresses are deleted after 48 hours. Failing to send cards will result in a trading suspension.</span>
          </div>
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button className="btn btn-primary" onClick={submitTrade} disabled={busy}>
              ⚡ Send trade proposal
            </button>
            <button className="btn btn-secondary" onClick={() => setStep('their-cards')}>← Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
