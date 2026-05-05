// src/pages/Account.jsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import TrainerProfile from '../components/TrainerProfile';

export default function Account() {
  const { profile, user, refetchProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername]       = useState(profile?.username || '');
  const [bio, setBio]                 = useState(profile?.bio || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg]   = useState(null);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passSaving, setPassSaving]   = useState(false);
  const [passMsg, setPassMsg]         = useState(null);

  const [emailMsg, setEmailMsg]       = useState(null);
  const [newEmail, setNewEmail]       = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  // ─── Save profile ─────────────────────────────────────────────
  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);

    // Check username isn't taken by someone else
    if (username !== profile?.username) {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', username).neq('id', user.id).single();
      if (existing) {
        setProfileMsg({ type: 'error', text: 'That username is already taken' });
        setProfileSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, username, bio })
      .eq('id', user.id);

    if (error) {
      setProfileMsg({ type: 'error', text: error.message });
    } else {
      setProfileMsg({ type: 'ok', text: 'Profile updated!' });
      await refetchProfile();
    }
    setProfileSaving(false);
  };

  // ─── Change password ──────────────────────────────────────────
  const changePassword = async (e) => {
    e.preventDefault();
    setPassMsg(null);
    if (newPass.length < 6) { setPassMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    if (newPass !== confirmPass) { setPassMsg({ type: 'error', text: 'Passwords do not match' }); return; }

    setPassSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) {
      setPassMsg({ type: 'error', text: error.message });
    } else {
      setPassMsg({ type: 'ok', text: 'Password updated!' });
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    }
    setPassSaving(false);
  };

  // ─── Change email ─────────────────────────────────────────────
  const changeEmail = async (e) => {
    e.preventDefault();
    setEmailMsg(null);
    if (!newEmail.includes('@')) { setEmailMsg({ type: 'error', text: 'Enter a valid email address' }); return; }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailMsg({ type: 'error', text: error.message });
    } else {
      setEmailMsg({ type: 'ok', text: 'Check your new email address for a confirmation link' });
      setNewEmail('');
    }
    setEmailSaving(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Account settings</h1>
          <p>Manage your profile, email and password</p>
        </div>
      </div>

      <div className="account-sections">

        {/* ─── Trainer card ─── */}
        <div className="account-section">
          <div className="account-section-header">
            <h2>🎮 Your trainer card</h2>
            <p>Pick your partner Pokémon and customise your card colour</p>
          </div>
          <div style={{padding:'16px 20px'}}>
            <TrainerProfile />
          </div>
        </div>

        {/* ─── Profile info ─── */}
        <div className="account-section">
          <div className="account-section-header">
            <h2>Profile</h2>
            <p>How others see you in the community and trades</p>
          </div>
          <form onSubmit={saveProfile} className="account-form">
            <div className="account-avatar-row">
              <div className="account-avatar">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" />
                  : <div className="account-avatar-initials">
                      {(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
                    </div>
                }
              </div>
              <div>
                <div className="account-email-display">{user?.email}</div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Signed in as</div>
              </div>
            </div>

            <div className="form-field">
              <label>Display name</label>
              <input
                type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
              />
            </div>

            <div className="form-field">
              <label>Username</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">@</span>
                <input
                  type="text" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  minLength={3} maxLength={30}
                />
              </div>
              <div className="field-hint">Only letters, numbers and underscores. Used for friend searches.</div>
            </div>

            <div className="form-field">
              <label>Bio <span style={{color:'var(--muted)',fontWeight:400}}>(optional)</span></label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell other collectors about yourself..."
                rows={3} maxLength={200}
                className="account-textarea"
              />
            </div>

            {profileMsg && (
              <div className={`account-msg ${profileMsg.type === 'ok' ? 'account-msg--ok' : 'account-msg--error'}`}>
                {profileMsg.text}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        {/* ─── Change email ─── */}
        <div className="account-section">
          <div className="account-section-header">
            <h2>Email address</h2>
            <p>Current: <strong>{user?.email}</strong></p>
          </div>
          <form onSubmit={changeEmail} className="account-form">
            <div className="form-field">
              <label>New email address</label>
              <input
                type="email" value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="new@email.com"
                required
              />
            </div>
            {emailMsg && (
              <div className={`account-msg ${emailMsg.type === 'ok' ? 'account-msg--ok' : 'account-msg--error'}`}>
                {emailMsg.text}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={emailSaving}>
              {emailSaving ? 'Sending confirmation...' : 'Update email'}
            </button>
          </form>
        </div>

        {/* ─── Change password ─── */}
        <div className="account-section">
          <div className="account-section-header">
            <h2>Password</h2>
            <p>Choose a strong password with at least 6 characters</p>
          </div>
          <form onSubmit={changePassword} className="account-form">
            <div className="form-field">
              <label>New password</label>
              <input
                type="password" value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="New password"
                minLength={6} required
              />
            </div>
            <div className="form-field">
              <label>Confirm new password</label>
              <input
                type="password" value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Confirm new password"
                minLength={6} required
              />
              {newPass && confirmPass && (
                <div className={`field-hint ${newPass === confirmPass ? 'field-hint--ok' : 'field-hint--error'}`}>
                  {newPass === confirmPass ? '✓ Passwords match' : '✕ Passwords do not match'}
                </div>
              )}
            </div>
            {passMsg && (
              <div className={`account-msg ${passMsg.type === 'ok' ? 'account-msg--ok' : 'account-msg--error'}`}>
                {passMsg.text}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={passSaving || newPass !== confirmPass}>
              {passSaving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* ─── Danger zone ─── */}
        <div className="account-section account-section--danger">
          <div className="account-section-header">
            <h2>Sign out</h2>
            <p>Sign out of Scanachu on this device</p>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}
