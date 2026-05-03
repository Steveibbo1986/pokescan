// src/pages/Auth.jsx
import { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode]     = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]   = useState('');
  const [password, setPass] = useState('');
  const [username, setUser] = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (username.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return; }
        const { error } = await signUp(email, password, username);
        if (error) throw error;
        setError('Check your email to confirm your account, then sign in.');
        setMode('signin');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon-lg">◈</span>
          <h1>PokéScan</h1>
          <p>Scan, collect, and trade Pokémon cards</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'signin' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('signin'); setError(''); }}>
            Sign in
          </button>
          <button className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('signup'); setError(''); }}>
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="trainer_name"
                required
                minLength={3}
                maxLength={30}
              />
            </div>
          )}
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPass(e.target.value)} required minLength={6} />
          </div>

          {error && <div className={`auth-error ${error.includes('Check your email') ? 'auth-success' : ''}`}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Loading...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
