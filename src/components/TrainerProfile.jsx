// src/components/TrainerProfile.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { useAuth } from '../hooks/useAuth';
import { useCoins } from '../hooks/useCoins';
import { BADGES, buildStats, getEarnedBadges } from '../lib/badges';
import { supabase } from '../lib/supabase';

const TRAINER_TITLES = [
  { min:0,    label:'New Trainer' },
  { min:1,    label:'Rookie' },
  { min:10,   label:'Card Hunter' },
  { min:25,   label:'Collector' },
  { min:50,   label:'Ace Trainer' },
  { min:100,  label:'Expert Trainer' },
  { min:250,  label:'Champion' },
  { min:500,  label:'Elite Trainer' },
  { min:1000, label:'Master Collector' },
];

const STARTER_CHOICES = [
  {id:1,name:'Bulbasaur'},{id:4,name:'Charmander'},{id:7,name:'Squirtle'},
  {id:25,name:'Pikachu'},{id:133,name:'Eevee'},{id:39,name:'Jigglypuff'},
  {id:52,name:'Meowth'},{id:54,name:'Psyduck'},{id:129,name:'Magikarp'},
  {id:143,name:'Snorlax'},{id:152,name:'Chikorita'},{id:155,name:'Cyndaquil'},
  {id:158,name:'Totodile'},{id:252,name:'Treecko'},{id:255,name:'Torchic'},
  {id:258,name:'Mudkip'},{id:393,name:'Piplup'},{id:495,name:'Snivy'},
  {id:501,name:'Oshawott'},{id:650,name:'Chespin'},{id:653,name:'Fennekin'},
  {id:656,name:'Froakie'},{id:722,name:'Rowlet'},{id:725,name:'Litten'},
  {id:728,name:'Popplio'},{id:810,name:'Grookey'},{id:813,name:'Scorbunny'},
  {id:816,name:'Sobble'},{id:906,name:'Sprigatito'},{id:909,name:'Fuecoco'},
  {id:912,name:'Quaxly'},{id:150,name:'Mewtwo'},{id:249,name:'Lugia'},
  {id:384,name:'Rayquaza'},{id:483,name:'Dialga'},{id:484,name:'Palkia'},
];

const HAT_EMOJI = {
  hat_red_cap:'🧢', hat_top_hat:'🎩', hat_crown:'👑',
  hat_shades:'🕶', hat_party:'🎉', hat_beanie:'🧶',
};

const BORDER_COLORS = {
  border_default:'#F5A623', border_gold:'#FFD700',
  border_fire:'#E8563A',    border_water:'#3B9DD2',
};

const BG_STYLES = {
  bg_default: null,
  bg_stars:   'radial-gradient(ellipse at 50% 0%, #1a237e22 0%, transparent 70%)',
  bg_forest:  'radial-gradient(ellipse at 50% 100%, #2e7d3222 0%, transparent 70%)',
  bg_sunset:  'radial-gradient(ellipse at 50% 0%, #f57c0022 0%, transparent 70%)',
  bg_holo:    'linear-gradient(135deg, rgba(155,89,182,.1) 0%, rgba(245,166,35,.1) 50%, rgba(59,157,210,.1) 100%)',
};

function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function getTitle(count) {
  return [...TRAINER_TITLES].reverse().find(t => count >= t.min)?.label || 'New Trainer';
}

export default function TrainerProfile({ compact = false }) {
  const { profile, user }  = useAuth();
  const { cards }          = useCollection();
  const { coins }          = useCoins();
  const [favPokemon, setFavPokemon] = useState(
    () => { try { return JSON.parse(localStorage.getItem('scanachu-fav-pokemon') || 'null'); } catch { return null; } }
    || STARTER_CHOICES[1]
  );
  const [picking, setPicking]   = useState(false);
  const [search, setSearch]     = useState('');
  const [searchRes, setSearchRes] = useState([]);

  const equipped = profile?.equipped_items || {};
  const hat      = HAT_EMOJI[equipped.hat] || null;
  const borderColor = BORDER_COLORS[equipped.border] || '#F5A623';
  const bgStyle     = BG_STYLES[equipped.background] || null;
  const isRainbow   = equipped.border === 'border_rainbow';

  const cardCount    = cards.length;
  const title        = getTitle(cardCount);
  const collValue    = cards.reduce((s,c) => s + parseFloat(c.market_price_gbp||0), 0);
  const earnedBadges = getEarnedBadges(buildStats({ cards, trades:[], friends:[], wishlist:[], dexMap:{} }));
  const name         = profile?.display_name || profile?.username || 'Trainer';

  const saveChoice = (p) => {
    setFavPokemon(p);
    localStorage.setItem('scanachu-fav-pokemon', JSON.stringify(p));
    setPicking(false); setSearch(''); setSearchRes([]);
  };

  const searchPokemon = async (q) => {
    if (!q.trim()) { setSearchRes([]); return; }
    try {
      const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${q.toLowerCase().replace(/\s+/g,'-')}`);
      if (res.ok) {
        const d = await res.json();
        setSearchRes([{ id:d.id, name:d.name.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) }]);
      }
    } catch {}
  };

  return (
    <div className="trainer-profile-wrap">

      {/* ── Trainer card ── */}
      <div
        className={`trainer-card ${isRainbow ? 'trainer-card--rainbow' : ''}`}
        style={{
          '--tc': borderColor,
          background: bgStyle ? `${bgStyle}, var(--surface)` : 'var(--surface)',
        }}
      >
        <div className="tc-header">
          <div className="tc-header-bg" style={{background: borderColor}}/>
          <div className="tc-header-content">
            <div className="tc-title-row">
              <span className="tc-label">Trainer Card</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span className="tc-coins">⚡ {coins.toLocaleString()}</span>
              </div>
            </div>
            <div className="tc-name">
              {hat && <span style={{marginRight:6,fontSize:'0.75em'}}>{hat}</span>}
              {name}
            </div>
            <div className="tc-trainer-title">{title}</div>
          </div>
        </div>

        <div className="tc-body">
          <div className="tc-left">
            <div className="tc-avatar">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={name} className="tc-avatar-img"/>
                : <div className="tc-avatar-initials" style={{background:borderColor+'22',color:borderColor}}>
                    {name[0].toUpperCase()}
                  </div>
              }
            </div>
            <div className="tc-stats">
              <div className="tc-stat"><span className="tc-stat-n">{cardCount.toLocaleString()}</span><span className="tc-stat-l">Cards</span></div>
              {collValue > 0 && <div className="tc-stat"><span className="tc-stat-n" style={{color:'#16A34A'}}>£{Math.round(collValue)}</span><span className="tc-stat-l">Value</span></div>}
              <div className="tc-stat"><span className="tc-stat-n" style={{color:borderColor}}>{earnedBadges.length}</span><span className="tc-stat-l">Badges</span></div>
            </div>
          </div>

          <div className="tc-right">
            <div className="tc-pokemon-wrap">
              <img src={spriteUrl(favPokemon.id)} alt={favPokemon.name}
                className="tc-pokemon-sprite" style={{'--shadow':borderColor+'44'}}/>
              <div className="tc-pokemon-name">{favPokemon.name}</div>
            </div>
          </div>
        </div>

        <div className="tc-footer">
          <div className="tc-badges-row">
            {earnedBadges.slice(0,8).map(id => {
              const b = BADGES.find(x => x.id === id);
              return b ? <span key={id} className="tc-badge-chip" title={b.name} style={{'--c':b.color}}>{b.icon}</span> : null;
            })}
            {earnedBadges.length === 0 && <span className="tc-no-badges">Scan cards to earn badges!</span>}
          </div>
          {profile?.bio && <div className="tc-bio">"{profile.bio}"</div>}
        </div>
      </div>

      {/* ── Controls ── */}
      {!compact && (
        <div className="tc-controls">
          <div className="tc-controls-row">
            <button className="btn btn-secondary btn-sm" onClick={() => setPicking(v=>!v)}>
              {picking ? '✕ Cancel' : '🎮 Change Pokémon'}
            </button>
            <Link to="/shop" className="btn btn-primary btn-sm">
              🛍 Customise →
            </Link>
          </div>
        </div>
      )}

      {/* ── Pokémon picker ── */}
      {picking && !compact && (
        <div className="tc-picker">
          <h3 style={{marginBottom:12,fontSize:15,fontWeight:800}}>Choose your partner Pokémon</h3>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            <input className="search-input" placeholder="Search by name..."
              value={search} onChange={e=>{ setSearch(e.target.value); searchPokemon(e.target.value); }} autoFocus/>
          </div>
          {searchRes.length > 0 && (
            <div className="tc-picker-grid" style={{marginBottom:12}}>
              {searchRes.map(p => (
                <button key={p.id} className="tc-pick-btn" onClick={() => saveChoice(p)}>
                  <img src={spriteUrl(p.id)} alt={p.name} className="tc-pick-sprite"/>
                  <span className="tc-pick-name">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {!search && (
            <>
              <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Popular choices</div>
              <div className="tc-picker-grid">
                {STARTER_CHOICES.map(p => (
                  <button key={p.id} className={`tc-pick-btn ${favPokemon.id===p.id?'tc-pick-btn--active':''}`} onClick={() => saveChoice(p)}>
                    <img src={spriteUrl(p.id)} alt={p.name} className="tc-pick-sprite"/>
                    <span className="tc-pick-name">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
