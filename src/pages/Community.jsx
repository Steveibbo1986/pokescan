// src/pages/Community.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getFriends, sendFriendRequest, respondToFriendRequest, searchProfiles, getCollection } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import TradeModal from '../components/TradeModal';
import CardGrid from '../components/CardGrid';

export default function Community() {
  const { user } = useAuth();
  const [tab, setTab]               = useState('friends');
  const [friends, setFriends]       = useState([]);
  const [requests, setRequests]     = useState([]);
  const [search, setSearch]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [browsing, setBrowsing]     = useState(null); // { user, cards }
  const [tradeWith, setTradeWith]   = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!user) return;
    loadFriends();
    loadRequests();
  }, [user]);

  async function loadFriends() {
    const { data } = await getFriends(user.id);
    const enriched = (data || []).map(f => ({
      ...f,
      friend: f.requester_id === user.id ? f.addressee : f.requester,
    }));
    setFriends(enriched);
    setLoading(false);
  }

  async function loadRequests() {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(id, username, display_name)')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    setRequests(data || []);
  }

  async function handleSearch(q) {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await searchProfiles(q);
    setSearchResults((data || []).filter(p => p.id !== user.id));
  }

  async function addFriend(targetId) {
    await sendFriendRequest(user.id, targetId);
    setSearchResults(r => r.filter(p => p.id !== targetId));
  }

  async function respondRequest(id, status) {
    await respondToFriendRequest(id, status);
    setRequests(r => r.filter(req => req.id !== id));
    if (status === 'accepted') loadFriends();
  }

  async function browseCollection(friend) {
    const { data } = await getCollection(friend.id);
    setBrowsing({ user: friend, cards: data || [] });
    setTab('browse');
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Community</h1>
      </div>

      <div className="tab-bar">
        <button className={tab === 'friends' ? 'tab active' : 'tab'} onClick={() => setTab('friends')}>
          Friends ({friends.length})
        </button>
        <button className={tab === 'requests' ? 'tab active' : 'tab'} onClick={() => setTab('requests')}>
          Requests {requests.length > 0 && <span className="tab-badge">{requests.length}</span>}
        </button>
        <button className={tab === 'find' ? 'tab active' : 'tab'} onClick={() => setTab('find')}>
          Find people
        </button>
        {browsing && (
          <button className={tab === 'browse' ? 'tab active' : 'tab'} onClick={() => setTab('browse')}>
            {browsing.user.display_name || browsing.user.username}'s collection
          </button>
        )}
      </div>

      {tab === 'friends' && (
        <div className="friends-list">
          {loading && <div className="page-loading">Loading...</div>}
          {!loading && !friends.length && (
            <div className="empty-state">No friends yet — find people to add!</div>
          )}
          {friends.map(f => (
            <div key={f.id} className="friend-row">
              <div className="avatar-sm">
                {f.friend?.display_name?.[0] || f.friend?.username?.[0] || '?'}
              </div>
              <div className="friend-info">
                <span className="friend-name">{f.friend?.display_name || f.friend?.username}</span>
                <span className="friend-username">@{f.friend?.username}</span>
              </div>
              <div className="friend-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => browseCollection(f.friend)}>
                  View collection
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setTradeWith({ user: f.friend, cards: [] });
                }}>
                  Propose trade
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="requests-list">
          {!requests.length && <div className="empty-state">No pending requests</div>}
          {requests.map(req => (
            <div key={req.id} className="friend-row">
              <div className="avatar-sm">
                {req.requester?.display_name?.[0] || req.requester?.username?.[0] || '?'}
              </div>
              <div className="friend-info">
                <span className="friend-name">{req.requester?.display_name || req.requester?.username}</span>
                <span className="friend-username">wants to connect</span>
              </div>
              <div className="friend-actions">
                <button className="btn btn-primary btn-sm" onClick={() => respondRequest(req.id, 'accepted')}>
                  Accept
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => respondRequest(req.id, 'declined')}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'find' && (
        <div className="find-people">
          <input
            className="search-input search-input-lg"
            placeholder="Search by username..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            autoFocus
          />
          <div className="search-results">
            {searchResults.map(p => {
              const alreadyFriend = friends.some(f => f.friend?.id === p.id);
              return (
                <div key={p.id} className="friend-row">
                  <div className="avatar-sm">
                    {p.display_name?.[0] || p.username?.[0] || '?'}
                  </div>
                  <div className="friend-info">
                    <span className="friend-name">{p.display_name || p.username}</span>
                    <span className="friend-username">@{p.username}</span>
                  </div>
                  {!alreadyFriend && (
                    <button className="btn btn-primary btn-sm" onClick={() => addFriend(p.id)}>
                      + Add friend
                    </button>
                  )}
                  {alreadyFriend && <span className="status-badge status-ok">Friends</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'browse' && browsing && (
        <div className="browse-collection">
          <div className="browse-header">
            <div>
              <h2>{browsing.user.display_name || browsing.user.username}'s collection</h2>
              <p>{browsing.cards.length} cards · {browsing.cards.filter(c => c.is_tradeable).length} available to trade</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setTradeWith({ user: browsing.user, cards: browsing.cards.filter(c => c.is_tradeable) })}
            >
              Propose trade
            </button>
          </div>
          <CardGrid
            cards={browsing.cards}
            showTradeable
            emptyMessage="This user has no cards yet"
          />
        </div>
      )}

      {tradeWith && (
        <TradeModal
          targetUser={tradeWith.user}
          targetCards={tradeWith.cards}
          onClose={() => setTradeWith(null)}
        />
      )}
    </div>
  );
}
