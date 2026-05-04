// src/pages/Join.jsx
// Landing page for invite links — /join/:username
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Join() {
  const { username }  = useParams();
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const [person, setPerson]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent]       = useState(false);
  const [alreadyFriends, setAlreadyFriends] = useState(false);

  useEffect(() => {
    loadPerson();
  }, [username]);

  async function loadPerson() {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('username', username)
      .single();
    setPerson(data);
    setLoading(false);

    // Check if already friends
    if (user && data) {
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${data.id}),and(requester_id.eq.${data.id},addressee_id.eq.${user.id})`)
        .single();
      if (existing) setAlreadyFriends(true);
    }
  }

  const sendRequest = async () => {
    if (!user) { navigate('/auth'); return; }
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: person.id });
    setSent(true);
  };

  if (loading) return (
    <div className="join-page">
      <div className="page-loading">Loading...</div>
    </div>
  );

  if (!person) return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-logo"><span>⚡</span> Scanachu</div>
        <div className="join-not-found">
          <div style={{fontSize:40,marginBottom:12}}>🤔</div>
          <h2>User not found</h2>
          <p>This invite link might be outdated. Ask your friend to share their link again.</p>
          <Link to="/" className="btn btn-primary" style={{marginTop:16,justifyContent:'center'}}>Go to Scanachu</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-logo"><span>⚡</span> Scanachu</div>

        <div className="join-avatar">
          {person.avatar_url
            ? <img src={person.avatar_url} alt={person.username} />
            : <div className="join-avatar-initials">{(person.display_name || person.username)[0].toUpperCase()}</div>
          }
        </div>

        <h1 className="join-name">{person.display_name || person.username}</h1>
        <p className="join-username">@{person.username}</p>
        {person.bio && <p className="join-bio">"{person.bio}"</p>}

        <div className="join-scanachu-pitch">
          <div className="join-pitch-icon">🎴</div>
          <p>
            <strong>{person.display_name || person.username}</strong> uses Scanachu to track their card collection.
            Add them as a friend to browse their cards and trade!
          </p>
        </div>

        {user?.id === person.id ? (
          <div className="join-self">
            <p>This is your own invite link!</p>
            <Link to="/home" className="btn btn-primary btn-full" style={{justifyContent:'center',marginTop:8}}>Go to your collection</Link>
          </div>
        ) : alreadyFriends ? (
          <div className="join-already">
            <p>✓ You're already friends with {person.display_name || person.username}!</p>
            <Link to="/community" className="btn btn-primary btn-full" style={{justifyContent:'center',marginTop:8}}>View community</Link>
          </div>
        ) : sent ? (
          <div className="join-sent">
            <div className="join-sent-icon">✓</div>
            <p>Friend request sent to {person.display_name || person.username}!</p>
            <Link to={user ? '/home' : '/'} className="btn btn-secondary btn-sm" style={{marginTop:12}}>
              {user ? 'Back to Scanachu' : 'Learn more'}
            </Link>
          </div>
        ) : (
          <div className="join-actions">
            {user ? (
              <button className="btn btn-primary btn-full" onClick={sendRequest} style={{justifyContent:'center'}}>
                + Add {person.display_name || person.username} as friend
              </button>
            ) : (
              <>
                <Link to="/auth" className="btn btn-primary btn-full" style={{justifyContent:'center'}}>
                  Sign up to add as friend — it's free
                </Link>
                <Link to="/auth" className="btn btn-secondary btn-full" style={{justifyContent:'center',marginTop:8}}>
                  Already have an account? Sign in
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
