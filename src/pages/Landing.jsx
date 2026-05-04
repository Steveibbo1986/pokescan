// src/pages/Landing.jsx
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

// Animated counter hook
function useCounter(target, duration = 1500, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// Intersection observer hook
function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// Floating creature SVGs — original designs, no IP
const CREATURES = [
  { color: '#FFD700', shape: 'round', label: '⚡' },
  { color: '#FF6B6B', shape: 'spiky', label: '🔥' },
  { color: '#4ECDC4', shape: 'smooth', label: '💧' },
  { color: '#A8E063', shape: 'leaf', label: '🌿' },
  { color: '#C77DFF', shape: 'mystic', label: '✨' },
  { color: '#FFB347', shape: 'flame', label: '⭐' },
];

export default function Landing() {
  const [statsRef, statsInView] = useInView();
  const [heroVisible, setHeroVisible] = useState(false);

  const cards   = useCounter(20000, 1800, statsInView);
  const pokemon = useCounter(1025,  1500, statsInView);
  const sets    = useCounter(150,   1200, statsInView);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="lp">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-logo">
          <span className="lp-bolt">⚡</span>
          <span>Scanachu</span>
        </div>
        <nav className="lp-nav">
          <a href="#how" className="lp-nav-link">How it works</a>
          <a href="#features" className="lp-nav-link">Features</a>
          <Link to="/auth" className="lp-nav-signin">Sign in</Link>
          <Link to="/auth" className="lp-nav-cta">Get started free →</Link>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="lp-hero">
        {/* Animated background particles */}
        <div className="lp-particles" aria-hidden="true">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="lp-particle" style={{
              '--delay': `${(i * 0.3) % 3}s`,
              '--x': `${(i * 17 + 5) % 95}%`,
              '--dur': `${3 + (i % 4)}s`,
              '--size': `${4 + (i % 6)}px`,
              '--col': CREATURES[i % CREATURES.length].color,
            }} />
          ))}
        </div>

        {/* Electric arc lines */}
        <svg className="lp-arc" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,300 Q200,100 400,300 T800,300 T1200,300" className="arc-line arc-1"/>
          <path d="M0,350 Q300,150 600,350 T1200,350" className="arc-line arc-2"/>
          <path d="M0,250 Q400,450 800,250 T1200,250" className="arc-line arc-3"/>
        </svg>

        <div className={`lp-hero-content ${heroVisible ? 'visible' : ''}`}>
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" />
            The card tracker for every collector
          </div>

          <h1 className="lp-hero-h1">
            <span className="lp-h1-line lp-h1-line--1">Scan your cards.</span>
            <span className="lp-h1-line lp-h1-line--2">
              Build your <span className="lp-h1-glow">legend.</span>
            </span>
          </h1>

          <p className="lp-hero-sub">
            Point your camera at any trading card — AI identifies it instantly,
            tracks your collection, shows its value today and what it could be
            worth in 30 years. For collectors of all ages.
          </p>

          <div className="lp-hero-btns">
            <Link to="/auth" className="lp-btn-primary">
              <span className="lp-btn-shine" />
              Start collecting free
              <span>→</span>
            </Link>
            <a href="#how" className="lp-btn-ghost">See how it works</a>
          </div>

          {/* Floating creature cards */}
          <div className="lp-creature-row" aria-hidden="true">
            {CREATURES.map((c, i) => (
              <div key={i} className="lp-creature-card" style={{
                '--delay': `${i * 0.15}s`,
                '--float-delay': `${i * 0.4}s`,
                background: `linear-gradient(135deg, ${c.color}22, ${c.color}08)`,
                borderColor: `${c.color}44`,
              }}>
                <div className="lp-creature-icon" style={{ color: c.color }}>{c.label}</div>
                <div className="lp-creature-bar" style={{ background: c.color }} />
                <div className="lp-creature-lines">
                  <div className="lp-creature-line" style={{ background: `${c.color}66` }} />
                  <div className="lp-creature-line lp-creature-line--short" style={{ background: `${c.color}44` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────── */}
      <section className="lp-stats" ref={statsRef}>
        <div className="lp-container">
          <div className="lp-stats-grid">
            <div className="lp-stat">
              <div className="lp-stat-num">{cards.toLocaleString()}+</div>
              <div className="lp-stat-label">Cards in database</div>
            </div>
            <div className="lp-stat-divider" />
            <div className="lp-stat">
              <div className="lp-stat-num">{pokemon.toLocaleString()}</div>
              <div className="lp-stat-label">Creatures to collect</div>
            </div>
            <div className="lp-stat-divider" />
            <div className="lp-stat">
              <div className="lp-stat-num">{sets}+</div>
              <div className="lp-stat-label">Card sets supported</div>
            </div>
            <div className="lp-stat-divider" />
            <div className="lp-stat">
              <div className="lp-stat-num">Free</div>
              <div className="lp-stat-label">To get started</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="lp-how" id="how">
        <div className="lp-container">
          <div className="lp-section-eyebrow">How it works</div>
          <h2 className="lp-section-h2">From photo to collection<br/>in three steps</h2>

          <div className="lp-steps">
            {[
              {
                num: '01', icon: '📷',
                title: 'Snap your cards',
                desc: 'Hold up to 9 cards in a binder page, take one photo. Or snap individual cards. Works on any phone camera — even older, vintage cards.',
                color: '#FFD700',
              },
              {
                num: '02', icon: '🤖',
                title: 'AI does the rest',
                desc: 'Our AI reads every card — name, set, number, rarity. Matched against 20,000+ cards in seconds. Tap to fix anything it gets wrong.',
                color: '#4ECDC4',
              },
              {
                num: '03', icon: '📈',
                title: 'Watch your value grow',
                desc: "See what your collection is worth today in GBP. See which creatures you're still missing. Discover what it could be worth in 10, 20 or 30 years.",
                color: '#A8E063',
              },
            ].map((step, i) => (
              <StepCard key={i} {...step} delay={i * 0.15} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-section-eyebrow">Features</div>
          <h2 className="lp-section-h2">Everything a collector needs</h2>

          <div className="lp-feat-grid">
            <FeatureCard
              icon="📖" color="#FFD700" size="large"
              title="Living Pokédex"
              desc="All 1,025 collectable creatures in one grid, Gen 1 through Gen 9. Green means you have a card for them — grey means they're still out there. Tap any missing one to hunt it down."
              extra={
                <div className="lp-dex-dots">
                  {[1,1,1,0,1,0,1,1,0,1,1,0,0,1,0,1,1,1].map((o,i) => (
                    <div key={i} className={`lp-dex-dot ${o ? 'on' : 'off'}`} />
                  ))}
                </div>
              }
            />
            <FeatureCard
              icon="💰" color="#4ade80"
              title="Real-time GBP value"
              desc="Live market prices for every card you own. See your total collection value and a breakdown by set."
            />
            <FeatureCard
              icon="📈" color="#60a5fa"
              title="30-year forecast"
              desc="Trading cards have appreciated year-on-year for decades. See a projection of what your collection could be worth — great motivation to keep them in perfect condition!"
            />
            <FeatureCard
              icon="⇄" color="#c084fc"
              title="Trade with friends"
              desc="Add friends, browse each other's collections, and propose trades. Swap duplicates, complete sets, and help each other catch them all."
            />
            <FeatureCard
              icon="⭐" color="#f97316"
              title="Wishlist & buy links"
              desc="Add any card to your wishlist with one tap. See the current price range and instant links to buy on TCGPlayer and eBay."
            />
            <FeatureCard
              icon="🔢" color="#FFD700" size="large"
              title="Find any card, any way"
              desc="Search by creature name, browse complete sets, or type the card number from the card itself (e.g. 004/102). Every result shows the current price and lets you add to collection or wishlist instantly."
              extra={
                <div className="lp-search-demo">
                  <div className="lp-search-bar">
                    <span style={{opacity:.5}}>🔍</span>
                    <span style={{color:'#FFD700'}}>004/102</span>
                    <span className="lp-search-cursor"/>
                  </div>
                  <div className="lp-search-pill">🔥 Charizard · Base Set · £189</div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* ── Value prediction ───────────────────────────────── */}
      <section className="lp-prediction">
        <div className="lp-container">
          <div className="lp-prediction-inner">
            <div className="lp-prediction-text">
              <div className="lp-section-eyebrow">Investment potential</div>
              <h2 className="lp-section-h2" style={{marginBottom:16}}>
                Your collection could be<br/>
                <span className="lp-gold-text">worth a fortune</span>
              </h2>
              <p className="lp-prediction-body">
                Trading cards have consistently grown in value for over 25 years. A card worth £3 in 1999
                can be worth £200+ today. Scanachu shows you exactly what every card in your collection is
                worth right now — and projects where it could be heading. The better you look after them,
                the more they'll be worth.
              </p>
              <div className="lp-prediction-tips">
                <div className="lp-tip">🛡️ Keep cards in sleeves</div>
                <div className="lp-tip">📁 Store in binders</div>
                <div className="lp-tip">🌡️ Avoid heat & humidity</div>
                <div className="lp-tip">✋ Handle by the edges</div>
              </div>
              <Link to="/auth" className="lp-btn-primary" style={{marginTop:28,display:'inline-flex'}}>
                Track your collection free →
              </Link>
            </div>
            <ValueChart />
          </div>
        </div>
      </section>

      {/* ── For everyone ───────────────────────────────────── */}
      <section className="lp-everyone">
        <div className="lp-container">
          <div className="lp-section-eyebrow">Who is Scanachu for?</div>
          <h2 className="lp-section-h2">Built for every kind of collector</h2>
          <div className="lp-audience-grid">
            {[
              { icon:'🧒', title:'Young collectors', desc:'Start your living Pokédex from scratch. See which creatures you still need and build towards completing every generation.' },
              { icon:'🧑', title:'Seasoned trainers', desc:'You have hundreds of cards in binders. Scanachu digitises your whole collection in minutes and tells you what it\'s all worth.' },
              { icon:'👨‍👩‍👧', title:'Families', desc:'Collect together. Add family members as friends, see each other\'s collections, and trade cards between you to help complete sets.' },
              { icon:'💼', title:'Investors', desc:'Treat rare cards as assets. Track market value over time, see predicted appreciation, and know exactly what\'s in your portfolio.' },
            ].map((a, i) => (
              <div key={i} className="lp-audience-card" style={{'--delay':`${i*0.1}s`}}>
                <div className="lp-audience-icon">{a.icon}</div>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community ──────────────────────────────────────── */}
      <section className="lp-community">
        <div className="lp-container">
          <div className="lp-community-inner">
            <div className="lp-community-icon">👥</div>
            <h2 className="lp-section-h2" style={{marginBottom:12}}>Better together</h2>
            <p className="lp-community-desc">
              Add friends by username, browse their collections and propose trades in seconds.
              The quickest way to fill in the gaps in your collection.
            </p>
            <div className="lp-community-chips">
              {['Add friends by username','Browse friends\' collections','Propose trades','See who wants which cards','Real-time notifications'].map(c => (
                <div key={c} className="lp-chip">✓ {c}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-container">
          <div className="lp-cta-inner">
            <div className="lp-cta-bolts" aria-hidden="true">
              {[...Array(5)].map((_,i) => (
                <span key={i} className="lp-cta-bolt" style={{'--i':i}}>⚡</span>
              ))}
            </div>
            <h2 className="lp-cta-h2">Ready to catch them all?</h2>
            <p className="lp-cta-sub">Free to use. No credit card needed. Start scanning in minutes.</p>
            <Link to="/auth" className="lp-btn-primary lp-btn-primary--xl">
              <span className="lp-btn-shine" />
              Create your free account
              <span>→</span>
            </Link>
            <div className="lp-cta-signin">
              Already have an account? <Link to="/auth" className="lp-cta-link">Sign in here</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-logo" style={{fontSize:18,justifyContent:'center'}}>
          <span className="lp-bolt">⚡</span> Scanachu
        </div>
        <p className="lp-footer-note">
          Built for card collectors everywhere. Not affiliated with Nintendo, Game Freak, or The Pokémon Company.
        </p>
      </footer>

    </div>
  );
}

// ─── Step card with scroll animation ─────────────────────────
function StepCard({ num, icon, title, desc, color, delay }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`lp-step ${inView ? 'lp-step--visible' : ''}`} style={{'--delay':`${delay}s`,'--col':color}}>
      <div className="lp-step-num" style={{color}}>{num}</div>
      <div className="lp-step-icon">{icon}</div>
      <h3 className="lp-step-title">{title}</h3>
      <p className="lp-step-desc">{desc}</p>
      <div className="lp-step-bar" style={{background:color}} />
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────
function FeatureCard({ icon, color, title, desc, extra, size }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`lp-feat ${inView ? 'lp-feat--visible' : ''} ${size === 'large' ? 'lp-feat--large' : ''}`}
      style={{'--col':color}}>
      <div className="lp-feat-icon" style={{color}}>{icon}</div>
      <h3 className="lp-feat-title">{title}</h3>
      <p className="lp-feat-desc">{desc}</p>
      {extra}
    </div>
  );
}

// ─── Animated value chart ─────────────────────────────────────
function ValueChart() {
  const [ref, inView] = useInView(0.2);
  const bars = [
    { label: 'Now',   val: '£120',   h: 20,  col: '#666' },
    { label: '10yr',  val: '£310',   h: 40,  col: '#4ade80' },
    { label: '20yr',  val: '£820',   h: 65,  col: '#60a5fa' },
    { label: '30yr',  val: '£2,100', h: 100, col: '#FFD700' },
  ];
  return (
    <div ref={ref} className="lp-chart">
      <div className="lp-chart-title">Estimated collection value over time</div>
      <div className="lp-chart-bars">
        {bars.map((b, i) => (
          <div key={i} className="lp-chart-col">
            <div className="lp-chart-val" style={{color: b.col, opacity: inView ? 1 : 0, transition:`opacity .4s ${i*0.15}s`}}>
              {b.val}
            </div>
            <div className="lp-chart-bar-wrap">
              <div className="lp-chart-bar" style={{
                background: b.col,
                height: inView ? `${b.h}%` : '0%',
                transitionDelay: `${i * 0.15}s`,
                boxShadow: inView ? `0 0 16px ${b.col}66` : 'none',
              }} />
            </div>
            <div className="lp-chart-label">{b.label}</div>
          </div>
        ))}
      </div>
      <div className="lp-chart-note">* Illustrative estimate based on historical appreciation rates</div>
    </div>
  );
}