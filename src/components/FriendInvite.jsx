// src/components/FriendInvite.jsx
// Shareable invite link + QR code + friend suggestions
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function FriendInvite() {
  const { profile, user }   = useAuth();
  const [copied, setCopied] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sentTo, setSentTo]           = useState(new Set());
  const [showQR, setShowQR]           = useState(false);

  const inviteUrl = `${window.location.origin}/join/${profile?.username}`;

  // Load friend-of-friend suggestions
  useEffect(() => {
    if (user) loadSuggestions();
  }, [user]);

  async function loadSuggestions() {
    // Get my friend IDs
    const { data: myFriends } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (!myFriends?.length) return;

    const friendIds = myFriends.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);

    // Get friends-of-friends
    const { data: fofData } = await supabase
      .from('friendships')
      .select(`
        requester_id, addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(friendIds.map(id => `requester_id.eq.${id}`).join(',') + ',' + friendIds.map(id => `addressee_id.eq.${id}`).join(','))
      .eq('status', 'accepted');

    if (!fofData) return;

    // Build set of suggested people (friends of friends, not already my friends, not me)
    const seen = new Set([user.id, ...friendIds]);
    const suggestions = [];
    const suggestionMap = {};

    for (const f of fofData) {
      for (const person of [f.requester, f.addressee]) {
        if (!person || seen.has(person.id)) continue;
        seen.add(person.id);
        suggestions.push(person);
      }
    }

    setSuggestions(suggestions.slice(0, 6));
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Join me on Scanachu!',
        text: `Hey! I use Scanachu to track my card collection. Add me as a friend and we can trade cards! 🎴⚡`,
        url: inviteUrl,
      });
    } else {
      copyLink();
    }
  };

  const sendRequest = async (targetId) => {
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: targetId });
    setSentTo(prev => new Set([...prev, targetId]));
  };

  return (
    <div className="fi-wrap">

      {/* Your invite link */}
      <div className="fi-link-card">
        <div className="fi-link-header">
          <span className="fi-link-icon">🔗</span>
          <div>
            <div className="fi-link-title">Your invite link</div>
            <div className="fi-link-sub">Share this to let anyone add you as a friend instantly</div>
          </div>
        </div>

        <div className="fi-link-box">
          <span className="fi-link-url">{inviteUrl}</span>
        </div>

        <div className="fi-link-actions">
          <button className="btn btn-primary btn-sm" onClick={shareLink}>
            📤 Share link
          </button>
          <button className="btn btn-secondary btn-sm" onClick={copyLink}>
            {copied ? '✓ Copied!' : '📋 Copy link'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowQR(v => !v)}>
            QR code
          </button>
        </div>

        {/* QR code — generated with a free API */}
        {showQR && (
          <div className="fi-qr-wrap">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteUrl)}&bgcolor=ffffff&color=1a1d23&margin=2`}
              alt="QR code for invite link"
              className="fi-qr"
            />
            <p className="fi-qr-hint">Scan to open your profile on Scanachu</p>
          </div>
        )}
      </div>

      {/* Friend suggestions */}
      {suggestions.length > 0 && (
        <div className="fi-suggestions">
          <div className="fi-sugg-title">👥 People you might know</div>
          <div className="fi-sugg-subtitle">Friends of your friends on Scanachu</div>
          <div className="fi-sugg-list">
            {suggestions.map(person => (
              <div key={person.id} className="fi-sugg-row">
                <div className="fi-sugg-avatar">
                  {person.display_name?.[0] || person.username?.[0] || '?'}
                </div>
                <div className="fi-sugg-info">
                  <div className="fi-sugg-name">{person.display_name || person.username}</div>
                  <div className="fi-sugg-username">@{person.username}</div>
                </div>
                {sentTo.has(person.id) ? (
                  <span className="fi-sugg-sent">Request sent ✓</span>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => sendRequest(person.id)}>
                    + Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}