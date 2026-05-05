// src/pages/TrainerShop.jsx
// The Scana-bucks shop — cosmetics only, no payments yet
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCoins } from '../hooks/useCoins';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { id: 'all',        label: 'All items' },
  { id: 'hat',        label: '🎩 Hats' },
  { id: 'border',     label: '✨ Borders' },
  { id: 'background', label: '🎨 Backgrounds' },
  { id: 'effect',     label: '🎆 Effects' },
];

// Visual preview of each item — rendered on the trainer card
export const ITEM_VISUALS = {
  // Hats — emoji + position offset
  hat_red_cap:   { emoji: '🧢', color: '#E53935' },
  hat_top_hat:   { emoji: '🎩', color: '#1a1d23' },
  hat_crown:     { emoji: '👑', color: '#FFD700' },
  hat_shades:    { emoji: '🕶', color: '#546E7A' },
  hat_party:     { emoji: '🎉', color: '#9B59B6' },
  hat_beanie:    { emoji: '🧶', color: '#3B9DD2' },
  // Borders
  border_default: { style: 'solid', color: '#F5A623' },
  border_gold:    { style: 'gold',     color: '#FFD700' },
  border_rainbow: { style: 'rainbow',  color: null },
  border_fire:    { style: 'fire',     color: '#E8563A' },
  border_water:   { style: 'water',    color: '#3B9DD2' },
  // Backgrounds
  bg_default: { style: 'plain',   color: null },
  bg_stars:   { style: 'stars',   color: '#1a237e' },
  bg_forest:  { style: 'forest',  color: '#2e7d32' },
  bg_sunset:  { style: 'sunset',  color: '#f57c00' },
  bg_holo:    { style: 'holo',    color: null },
};

export default function TrainerShop() {
  const { profile }         = useAuth();
  const { coins, spendCoins, loadCoins } = useCoins();
  const [items, setItems]   = useState([]);
  const [owned, setOwned]   = useState(new Set());
  const [equipped, setEquipped] = useState({});
  const [category, setCategory] = useState('all');
  const [buying, setBuying] = useState(null);   // item being purchased
  const [confirm, setConfirm] = useState(null); // item awaiting confirm
  const [msg, setMsg]       = useState(null);

  useEffect(() => { loadShop(); }, [profile]);

  async function loadShop() {
    // Load shop items
    const { data: shopData } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setItems(shopData || []);

    if (!profile?.id) return;

    // Load owned items
    const { data: ownedData } = await supabase
      .from('user_items')
      .select('item_id')
      .eq('user_id', profile.id);
    const ownedSet = new Set((ownedData || []).map(o => o.item_id));
    // Free items always owned
    (shopData || []).filter(i => i.cost === 0).forEach(i => ownedSet.add(i.id));
    setOwned(ownedSet);

    // Load equipped
    setEquipped(profile?.equipped_items || {});
  }

  const equip = async (item) => {
    const newEquipped = { ...equipped, [item.category]: item.id };
    setEquipped(newEquipped);
    await supabase.from('profiles')
      .update({ equipped_items: newEquipped })
      .eq('id', profile.id);
    setMsg(`✓ ${item.name} equipped!`);
    setTimeout(() => setMsg(null), 2000);
  };

  const unequip = async (category) => {
    const defaults = { hat: 'hat_none', border: 'border_default', background: 'bg_default', effect: null };
    const newEquipped = { ...equipped, [category]: defaults[category] };
    setEquipped(newEquipped);
    await supabase.from('profiles').update({ equipped_items: newEquipped }).eq('id', profile.id);
  };

  const startPurchase = (item) => {
    if (owned.has(item.id)) { equip(item); return; }
    if (coins < item.cost)  { setMsg('Not enough ⚡ — scan more cards to earn!'); setTimeout(() => setMsg(null), 3000); return; }
    setConfirm(item);
  };

  const confirmPurchase = async () => {
    if (!confirm) return;
    setBuying(confirm.id);
    const result = await spendCoins(confirm.cost, confirm.id, confirm.name);
    if (result.ok) {
      setOwned(prev => new Set([...prev, confirm.id]));
      await equip(confirm);
      setMsg(`✓ ${confirm.name} purchased and equipped!`);
    } else {
      setMsg(result.reason === 'insufficient' ? 'Not enough Scana-bucks!' : 'Purchase failed. Try again.');
    }
    setBuying(null);
    setConfirm(null);
    setTimeout(() => setMsg(null), 3000);
    loadCoins();
  };

  const visible = category === 'all' ? items : items.filter(i => i.category === category);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Trainer shop</h1>
          <p>Customise your trainer card with Scana-bucks</p>
        </div>
        {/* Coin balance */}
        <div className="shop-coin-balance">
          <span className="shop-coin-icon">⚡</span>
          <span className="shop-coin-amount">{coins.toLocaleString()}</span>
          <span className="shop-coin-label">Scana-bucks</span>
        </div>
      </div>

      {/* Coming soon: buy coins */}
      <div className="shop-coming-soon">
        <span className="shop-cs-icon">🚀</span>
        <div>
          <div className="shop-cs-title">Buy Scana-bucks — coming soon</div>
          <div className="shop-cs-sub">Earn free coins by scanning cards, unlocking badges and logging in daily. Coin packs coming in a future update!</div>
        </div>
      </div>

      {/* How to earn */}
      <div className="shop-earn-banner">
        <div className="shop-earn-title">How to earn Scana-bucks free</div>
        <div className="shop-earn-list">
          {[
            ['Scan a card', '+5 ⚡'],
            ['Scan a rare', '+15 ⚡'],
            ['Scan an ultra rare', '+50 ⚡'],
            ['Unlock a badge', '+25–100 ⚡'],
            ['Daily login', '+3 ⚡'],
            ['7-day streak', '+50 ⚡'],
            ['Complete a trade', '+30 ⚡'],
            ['Reach 100 cards', '+150 ⚡'],
          ].map(([label, val]) => (
            <div key={label} className="shop-earn-row">
              <span>{label}</span>
              <span className="shop-earn-val">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message */}
      {msg && <div className="shop-msg">{msg}</div>}

      {/* Confirm purchase */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:340,padding:24,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>{confirm.name.includes('hat') || confirm.name.includes('cap') || confirm.name.includes('crown') ? '🎩' : '✨'}</div>
            <h2 style={{marginBottom:6}}>{confirm.name}</h2>
            <p style={{fontSize:14,color:'var(--muted)',marginBottom:16}}>{confirm.description}</p>
            <div style={{fontSize:22,fontWeight:900,color:'var(--yellow)',marginBottom:16}}>
              ⚡ {confirm.cost.toLocaleString()} Scana-bucks
            </div>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:20}}>
              You have: ⚡ {coins.toLocaleString()} · After: ⚡ {(coins - confirm.cost).toLocaleString()}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-primary btn-full" onClick={confirmPurchase} disabled={!!buying}>
                {buying ? 'Buying...' : 'Buy & equip'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="shop-cats">
        {CATEGORIES.map(c => (
          <button key={c.id}
            className={`shop-cat-btn ${category === c.id ? 'shop-cat-btn--active' : ''}`}
            onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="shop-grid">
        {visible.map(item => {
          const isOwned    = owned.has(item.id);
          const isEquipped = equipped[item.category] === item.id;
          const canAfford  = item.cost === 0 || coins >= item.cost;
          const visual     = ITEM_VISUALS[item.id];

          return (
            <div
              key={item.id}
              className={`shop-item-card ${isEquipped ? 'shop-item-card--equipped' : ''} ${!canAfford && !isOwned ? 'shop-item-card--locked' : ''}`}
              onClick={() => startPurchase(item)}
            >
              {/* Visual preview */}
              <div className="shop-item-preview">
                <ItemPreview item={item} visual={visual} />
                {isEquipped && <div className="shop-item-equipped-badge">Equipped</div>}
                {!isOwned && !canAfford && <div className="shop-item-lock">🔒</div>}
              </div>

              <div className="shop-item-info">
                <div className="shop-item-name">{item.name}</div>
                <div className="shop-item-desc">{item.description}</div>
                <div className="shop-item-footer">
                  {isOwned ? (
                    <span className={`shop-item-status ${isEquipped ? 'shop-item-status--equipped' : 'shop-item-status--owned'}`}>
                      {isEquipped ? '✓ Equipped' : 'Owned'}
                    </span>
                  ) : item.cost === 0 ? (
                    <span className="shop-item-status shop-item-status--free">Free</span>
                  ) : (
                    <span className={`shop-item-price ${!canAfford ? 'shop-item-price--locked' : ''}`}>
                      ⚡ {item.cost.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemPreview({ item, visual }) {
  const emoji = {
    hat:        { hat_red_cap:'🧢', hat_top_hat:'🎩', hat_crown:'👑', hat_shades:'🕶', hat_party:'🎉', hat_beanie:'🧶', hat_none:'–' },
    border:     { border_default:'⬜', border_gold:'🟡', border_rainbow:'🌈', border_fire:'🔴', border_water:'🔵' },
    background: { bg_default:'⬜', bg_stars:'🌌', bg_forest:'🌿', bg_sunset:'🌅', bg_holo:'✨' },
    effect:     { effect_confetti:'🎊', effect_sparkle:'✨', effect_lightning:'⚡' },
  };
  const e = emoji[item.category]?.[item.id] || '🎁';
  return (
    <div className="shop-preview-inner">
      <span style={{fontSize:32}}>{e}</span>
    </div>
  );
}
