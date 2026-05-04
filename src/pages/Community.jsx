// src/pages/Community.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import TradeModal from '../components/TradeModal';
import CardGrid from '../components/CardGrid';
import FriendInvite from '../components/FriendInvite';

export default function Community() {
  const { user } = useAuth();
  const [tab, setTab]           = useState('friends');
  const [friends, setFriends]   = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [browsing, setBrowsing] = useState(null);
  const [tradeWith, setTradeWith] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionFeedback, setActionFeedback] = useState({});

  useEffect(() => {
    if (!user) return;
    loadFriends();
    loadRequests();
  }, [user]);

  async function loadFriends() {
    setLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, status, requester_id, addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (error) console.error('loadFriends error:', error);
    const enriched = (data || []).map(f => ({
      ...f,
      friend: f.requester_id === user.id ? f.addressee : f.requester,
    }));
    setFriends(enriched);
    setLoading(false);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name)
      `)
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    if (error) console.error('loadRequests error:', error);
    setRequests(data || []);
  }

  // Search profiles — debounced as user types
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => doSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  async function doSearch(q) {
    setSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', user.id)
      .limit(20);
    if (error) console.error('search error:', error);
    setSearchResults(data || []);
    setSearching(false);
  }

  const friendIds = new Set(friends.map(f => f.friend?.id));
  const pendingIds = new Set(requests.map(r => r.requester?.id));

  async function addFriend(targetId) {
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: targetId });
    if (error) { console.error('addFriend error:', error); return; }
    setActionFeedback(f => ({ ...f, [targetId]: 'sent' }));
  }

  async function respondRequest(id, status) {
    const { error } = await supabase
      .from('friendships')
      .update({ status })
      .eq('id', id);
    if (error) { console.error('respondRequest error:', error); return; }
    setRequests(r => r.filter(req => req.id !== id));
    if (status === 'accepted') loadFriends();
  }

  async function browseCollection(friend) {
    const { data } = await supabase
      .from('collection_cards')
      .select('*')
      .eq('user_id', friend.id)
      .order('added_at', { ascending: false });
    setBrowsing({ user: friend, cards: data || [] });
    setTab('browse');
  }

  return (
    <div className="page-container">
      <div className="page-header"><h1>Community</h1></div>

      <div className="tab-bar">
        <button className={tab === 'friends'  ? 'tab active' : 'tab'} onClick={() => setTab('friends')}>
          Friends ({friends.length})
        </button>
        <button className={tab === 'requests' ? 'tab active' : 'tab'} onClick={() => setTab('requests')}>
          Requests {requests.length > 0 && <span className="tab-badge">{requests.length}</span>}
        </button>
        <button className={tab === 'find'     ? 'tab active' : 'tab'} onClick={() => setTab('find')}>
          Find people
        </button>
        <button className={tab === 'invite'   ? 'tab active' : 'tab'} onClick={() => setTab('invite')}>
          🔗 Invite
        </button>
        {browsing && (
          <button className={tab === 'browse' ? 'tab active' : 'tab'} onClick={() => setTab('browse')}>
            {browsing.user.display_name || browsing.user.username}'s cards
          </button>
        )}
      </div>

      {/* Friends list */}
      {tab === 'friends' && (
        <div className="friends-list">
          {loading && <div className="page-loading">Loading...</div>}
          {!loading && !friends.length && (
            <div className="empty-state">No friends yet — find people to add!</div>
          )}
          {friends.map(f => (
            <div key={f.id} className="friend-row">
              <div className="avatar-sm">{f.friend?.display_name?.[0] || f.friend?.username?.[0] || '?'}</div>
              <div className="friend-info">
                <span className="friend-name">{f.friend?.display_name || f.friend?.username}</span>
                <span className="friend-username">@{f.friend?.username}</span>
              </div>
              <div className="friend-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => browseCollection(f.friend)}>View collection</button>
                <button className="btn btn-primary btn-sm" onClick={() => setTradeWith({ user: f.friend, cards: [] })}>Propose trade</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friend requests */}
      {tab === 'requests' && (
        <div className="requests-list">
          {!requests.length && <div className="empty-state">No pending requests</div>}
          {requests.map(req => (
            <div key={req.id} className="friend-row">
              <div className="avatar-sm">{req.requester?.display_name?.[0] || req.requester?.username?.[0] || '?'}</div>
              <div className="friend-info">
                <span className="friend-name">{req.requester?.display_name || req.requester?.username}</span>
                <span className="friend-username">wants to connect</span>
              </div>
              <div className="friend-actions">
                <button className="btn btn-primary btn-sm" onClick={() => respondRequest(req.id, 'accepted')}>Accept</button>
                <button className="btn btn-ghost btn-sm" onClick={() => respondRequest(req.id, 'declined')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Find people */}
      {tab === 'find' && (
        <div className="find-people">
          <div style={{marginBottom:8}}>
            <input
              className="search-input search-input-lg"
              placeholder="Search by username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search.length > 0 && search.length < 2 && (
              <div style={{fontSize:12,color:'var(--muted)',marginTop:6}}>Type at least 2 characters to search</div>
            )}
          </div>

          {searching && <div style={{color:'var(--muted)',fontSize:13,padding:'8px 0'}}>Searching...</div>}

          <div className="search-results">
            {searchResults.map(p => {
              const isFriend  = friendIds.has(p.id);
              const fb        = actionFeedback[p.id];
              return (
                <div key={p.id} className="friend-row">
                  <div className="avatar-sm">{p.display_name?.[0] || p.username?.[0] || '?'}</div>
                  <div className="friend-info">
                    <span className="friend-name">{p.display_name || p.username}</span>
                    <span className="friend-username">@{p.username}</span>
                  </div>
                  <div className="friend-actions">
                    {isFriend ? (
                      <span className="status-badge status-ok">Friends ✓</span>
                    ) : fb === 'sent' ? (
                      <span className="status-badge status-pending">Request sent</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => addFriend(p.id)}>+ Add friend</button>
                    )}
                  </div>
                </div>
              );
            })}
            {search.length >= 2 && !searching && searchResults.length === 0 && (
              <div className="empty-state" style={{padding:'20px 0'}}>No users found matching "{search}"</div>
            )}
          </div>
        </div>
      )}

      {/* Browse friend's collection */}
      {tab === 'browse' && browsing && (
        <div className="browse-collection">
          <div className="browse-header">
            <div>
              <h2>{browsing.user.display_name || browsing.user.username}'s collection</h2>
              <p>{browsing.cards.length} cards · {browsing.cards.filter(c => c.is_tradeable).length} available to trade</p>
            </div>
            <button className="btn btn-primary" onClick={() => setTradeWith({ user: browsing.user, cards: browsing.cards.filter(c => c.is_tradeable) })}>
              Propose trade
            </button>
          </div>
          <CardGrid cards={browsing.cards} showTradeable emptyMessage="This user has no cards yet" />
        </div>
      )}

      {/* Invite tab */}
      {tab === 'invite' && <FriendInvite />}

      {tradeWith && (
        <TradeModal targetUser={tradeWith.user} targetCards={tradeWith.cards} onClose={() => setTradeWith(null)} />
      )}
    </div>
  );
}
