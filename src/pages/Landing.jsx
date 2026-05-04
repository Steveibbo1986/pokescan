// src/pages/Landing.jsx
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

function useCounter(target, duration = 1400, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let t0 = null;
    const step = (ts) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

const TYPES = [
  { e:'⚡', n:'Electric', c:'#F5A623' },
  { e:'🔥', n:'Fire',     c:'#E8563A' },
  { e:'💧', n:'Water',    c:'#3B9DD2' },
  { e:'🌿', n:'Grass',    c:'#5BAD3A' },
  { e:'✨', n:'Psychic',  c:'#9B59B6' },
  { e:'🌙', n:'Dark',     c:'#546E7A' },
];

const FEATS = [
  { i:'📷', c:'#F5A623', t:'AI card scanner — no limits',
    d:'Point your camera and scan up to 9 cards at once. AI identifies every single one in seconds. No scan limits, no paywalls, ever.' },
  { i:'📖', c:'#5BAD3A', t:'Living Pokédex',
    d:'All 1,025 creatures across every generation in one beautiful grid. Tap any missing one and instantly find cards to add.' },
  { i:'💰', c:'#3B9DD2', t:'Live GBP collection value',
    d:'Real market prices in pounds for everything you own, updated live. Know exactly what your whole collection is worth.' },
  { i:'📈', c:'#9B59B6', t:'30-year value forecast',
    d:"Cards appreciate. See what yours could be worth in 10, 20 and 30 years — great motivation to keep them in top condition!" },
  { i:'⇄', c:'#E8563A', t:'Trade with friends & family',
    d:'Add friends, browse each other\'s collections, and swap cards to fill gaps. The cheapest way to complete your sets.' },
  { i:'⭐', c:'#F5A623', t:'Wishlist with buy links',
    d:'Spot a card you need? Add it to your wishlist in one tap. Get instant price comparisons and direct buy links.' },
];

const RIVALS = [
  { name:'Collectr',     scan:'Limited free scans', free:'Paid scanner', trade:'No', forecast:'No' },
  { name:'Dex',          scan:'Poor reviews',       free:'Paid extras',  trade:'Basic', forecast:'No' },
  { name:'TCGPlayer',    scan:'None',               free:'Marketplace',  trade:'No',    forecast:'No' },
  { name:'Scanachu ⚡',  scan:'✓ AI, unlimited',    free:'✓ Free to start', trade:'✓ Full', forecast:'✓ 30yr', us:true },
];

export default function Landing() {
  const [statsRef, statsInView] = useInView();
  const [loaded, setLoaded] = useState(false);
  const cards   = useCounter(20000, 1600, statsInView);
  const pokemon = useCounter(1025,  1300, statsInView);

  useEffect(() => { const t = setTimeout(() => setLoaded(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div className="lp3">

      {/* ── Header ── */}
      <header className="lp3-hdr">
        <div className="lp3-logo">
          <span className="lp3-bolt">⚡</span>Scanachu
        </div>
        <nav className="lp3-nav">
          <a href="#features" className="lp3-navlink">Features</a>
          <a href="#compare"  className="lp3-navlink">Compare</a>
          <Link to="/auth" className="lp3-navlink">Sign in</Link>
          <Link to="/auth" className="lp3-nav-cta">Start free →</Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="lp3-hero">
        {/* Animated confetti dots */}
        <div className="lp3-confetti" aria-hidden>
          {[...Array(28)].map((_,i)=>(
            <div key={i} className="lp3-dot" style={{
              '--x':`${(i*13+5)%94}%`,
              '--c': TYPES[i%6].c,
              '--d':`${(i*.22)%3.5}s`,
              '--t':`${3.5+(i%3.5)}s`,
              '--s':`${5+(i%6)}px`,
            }}/>
          ))}
        </div>

        <div className={`lp3-hero-body ${loaded?'in':''}`}>

          {/* Free badge — bold differentiator */}
          <div className="lp3-free-badge">
            <span className="lp3-free-star">★</span>
            Free to start · Unlimited AI scans · No credit card
            <span className="lp3-free-star">★</span>
          </div>

          <h1 className="lp3-h1">
            The card tracker<br/>
            that doesn't cost a thing.<span className="lp3-spark"/>
          </h1>

          <p className="lp3-hero-p">
            Scan trading cards with AI, track your living collection,
            see what everything's worth today — and what it could be
            worth in 30 years. For every collector, every age.
          </p>

          <div className="lp3-hero-btns">
            <Link to="/auth" className="lp3-cta">
              <span className="lp3-cta-shine"/>
              Start your collection — it's free
              <span>→</span>
            </Link>
            <a href="#how" className="lp3-ghost">See how it works ↓</a>
          </div>

          {/* Type chips */}
          <div className="lp3-chips">
            {TYPES.map((t,i)=>(
              <div key={i} className="lp3-chip" style={{
                '--c':t.c,'--d':`${i*.11}s`,'--fd':`${i*.45}s`
              }}>
                <span>{t.e}</span><span>{t.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating card mockups */}
        <div className={`lp3-cards ${loaded?'in':''}`} aria-hidden>
          {[
            { e:'⚡', n:'Zapchu', v:'£24', r:'Holo Rare', c:'#F5A623', d:0 },
            { e:'🔥', n:'Flareosaurus', v:'£189', r:'Ultra Rare', c:'#E8563A', d:.18 },
            { e:'💧', n:'Aquabite', v:'£12', r:'Uncommon', c:'#3B9DD2', d:.34 },
          ].map((card,i)=>(
            <div key={i} className="lp3-card" style={{'--d':`${card.d}s`,'--c':card.c}}>
              <div className="lp3-card-shine"/>
              <div className="lp3-card-type">{card.e} {card.r}</div>
              <div className="lp3-card-name">{card.n}</div>
              <div className="lp3-card-val">{card.v}</div>
              <div className="lp3-card-bar" style={{background:card.c}}/>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="lp3-stats" ref={statsRef}>
        <Stat n={`${cards.toLocaleString()}+`} l="Cards in database" />
        <div className="lp3-sep"/>
        <Stat n={pokemon.toLocaleString()} l="Creatures to collect" />
        <div className="lp3-sep"/>
        <Stat n="Free" l="To get started" gold />
        <div className="lp3-sep"/>
        <Stat n="0" l="Scan limits" />
      </div>

      {/* ── How ── */}
      <section className="lp3-how" id="how">
        <div className="lp3-wrap">
          <div className="lp3-eyebrow">How it works</div>
          <h2 className="lp3-h2">From photo to collection<br/>in three easy steps</h2>
          <div className="lp3-steps">
            {[
              { n:'1', i:'📷', c:'#F5A623', t:'Snap your cards', b:'Lay up to 9 cards flat and take one photo, or snap individually. Works on any phone — even vintage Base Set cards from the 90s.' },
              { n:'2', i:'🤖', c:'#3B9DD2', t:'AI reads every card', b:'Name, set, number, rarity — identified in seconds from our 20,000+ card database. Tap to fix anything in one go.' },
              { n:'3', i:'💎', c:'#9B59B6', t:'Watch it grow', b:'Live GBP values, missing card tracking, set completion, and a peek at what your collection could be worth decades from now.' },
            ].map((s,i)=><Step key={i} {...s} delay={i*.12}/>)}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp3-feats" id="features">
        <div className="lp3-wrap">
          <div className="lp3-eyebrow">Features</div>
          <h2 className="lp3-h2">Everything you need,<br/>nothing behind a paywall</h2>
          <div className="lp3-feat-grid">
            {FEATS.map((f,i)=><Feat key={i} {...f} delay={i*.08}/>)}
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="lp3-compare" id="compare">
        <div className="lp3-wrap">
          <div className="lp3-eyebrow">How we compare</div>
          <h2 className="lp3-h2">The only one built<br/>for collectors, not profit</h2>
          <div className="lp3-table-wrap">
            <table className="lp3-table">
              <thead>
                <tr>
                  <th>App</th>
                  <th>AI card scanner</th>
                  <th>Pricing model</th>
                  <th>Friend trading</th>
                  <th>Value forecast</th>
                </tr>
              </thead>
              <tbody>
                {RIVALS.map((r,i)=>(
                  <tr key={i} className={r.us?'lp3-us-row':''}>
                    <td className="lp3-app-name">{r.name}</td>
                    <td>{r.scan}</td>
                    <td>{r.free}</td>
                    <td>{r.trade}</td>
                    <td>{r.forecast}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lp3-compare-note">
            Competitors either charge for scanning, limit free scans, or lock features behind subscriptions.
            Scanachu is free to start with no scan limits. We believe great tools should be accessible to all collectors.
          </p>
        </div>
      </section>

      {/* ── Value / forecast ── */}
      <section className="lp3-value">
        <div className="lp3-wrap lp3-value-inner">
          <div className="lp3-value-text">
            <div className="lp3-eyebrow">Investment potential</div>
            <h2 className="lp3-h2" style={{marginBottom:16}}>
              Looking after your cards<br/>
              <span className="lp3-gold">really pays off</span>
            </h2>
            <p className="lp3-value-p">
              Trading cards have grown in value almost every year since the late 90s.
              Scanachu shows you what every card is worth right now in GBP — and
              projects where it could be heading. The better condition you keep them in,
              the more they'll be worth.
            </p>
            <div className="lp3-tips">
              {['🛡️ Use card sleeves','📁 Store in binders','🌡️ Avoid heat & damp','✋ Handle by the edges'].map(t=>(
                <span key={t} className="lp3-tip">{t}</span>
              ))}
            </div>
            <Link to="/auth" className="lp3-cta" style={{marginTop:28,display:'inline-flex'}}>
              Start tracking free →
            </Link>
          </div>
          <ValueChart/>
        </div>
      </section>

      {/* ── For everyone ── */}
      <section className="lp3-everyone">
        <div className="lp3-wrap">
          <div className="lp3-eyebrow">Who's it for?</div>
          <h2 className="lp3-h2">Built for every collector</h2>
          <div className="lp3-aud-grid">
            {[
              { i:'🧒', c:'#F5A623', t:'Young collectors',  b:"Start from scratch. Build your collection one card at a time and track every creature you've caught." },
              { i:'🧑', c:'#3B9DD2', t:'Seasoned trainers', b:"Hundreds of cards in binders? Scan the whole lot in minutes and finally know what it's all worth." },
              { i:'👨‍👩‍👧', c:'#5BAD3A', t:'Families',           b:"Collect together! Add family as friends, browse each other's cards and trade to fill the gaps." },
              { i:'💼', c:'#9B59B6', t:'Savvy investors',   b:"Track market prices, spot trends and see projected appreciation — treat your rarest cards as real assets." },
            ].map((a,i)=><AudCard key={i} {...a} delay={i*.1}/>)}
          </div>
        </div>
      </section>

      {/* ── Community ── */}
      <section className="lp3-community">
        <div className="lp3-wrap">
          <div className="lp3-comm-box">
            <span className="lp3-comm-emoji">👥</span>
            <h2 className="lp3-h2" style={{marginBottom:12}}>Better together</h2>
            <p className="lp3-comm-p">
              Add friends by username, browse their collections and propose card trades in a few taps.
              The quickest way to complete your collection — without spending more than you need to.
            </p>
            <div className="lp3-comm-pills">
              {['Add friends by username','Browse their collections','Propose & accept trades','See who wants which cards'].map(p=>(
                <span key={p} className="lp3-cpill">✓ {p}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp3-final">
        <div className="lp3-wrap lp3-final-inner">
          <div className="lp3-final-bolts" aria-hidden>
            {[...Array(6)].map((_,i)=><span key={i} className="lp3-fb" style={{'--i':i}}>⚡</span>)}
          </div>
          <div className="lp3-final-icon">🎴</div>
          <h2 className="lp3-final-h2">Ready to start collecting?</h2>
          <p className="lp3-final-sub">Free to start. No credit card. Scan your first card in under a minute.</p>
          <Link to="/auth" className="lp3-cta lp3-cta--xl">
            <span className="lp3-cta-shine"/>
            Create your free account →
          </Link>
          <p className="lp3-final-small">
            Already have an account? <Link to="/auth" className="lp3-final-link">Sign in</Link>
          </p>
        </div>
      </section>

      <footer className="lp3-footer">
        <div className="lp3-logo"><span className="lp3-bolt">⚡</span>Scanachu</div>
        <p className="lp3-foot-note">Not affiliated with Nintendo, Game Freak or The Pokémon Company. Built with ♥ for collectors everywhere.</p>
      </footer>
    </div>
  );
}

function Stat({ n, l, gold }) {
  return (
    <div className="lp3-stat">
      <span className={`lp3-stat-n${gold?' lp3-stat-gold':''}`}>{n}</span>
      <span className="lp3-stat-l">{l}</span>
    </div>
  );
}

function Step({ n, i, c, t, b, delay }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`lp3-step${inView?' in':''}`} style={{'--d':`${delay}s`,'--c':c}}>
      <div className="lp3-step-n" style={{color:c}}>{n}</div>
      <div className="lp3-step-i">{i}</div>
      <h3 className="lp3-step-t">{t}</h3>
      <p  className="lp3-step-b">{b}</p>
    </div>
  );
}

function Feat({ i, c, t, d, delay }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`lp3-feat${inView?' in':''}`} style={{'--d':`${delay}s`,'--c':c}}>
      <div className="lp3-feat-i">{i}</div>
      <h3 className="lp3-feat-t">{t}</h3>
      <p  className="lp3-feat-d">{d}</p>
    </div>
  );
}

function AudCard({ i, c, t, b, delay }) {
  const [ref, inView] = useInView(0.1);
  return (
    <div ref={ref} className={`lp3-aud${inView?' in':''}`} style={{'--d':`${delay}s`,'--c':c}}>
      <div className="lp3-aud-i" style={{background:`${c}22`,borderColor:`${c}55`}}>{i}</div>
      <h3 className="lp3-aud-t">{t}</h3>
      <p  className="lp3-aud-b">{b}</p>
    </div>
  );
}

function ValueChart() {
  const [ref, inView] = useInView(0.2);
  const bars = [
    { l:'Today', v:'£120', h:16, c:'#aaa' },
    { l:'10 yr', v:'£310', h:37, c:'#5BAD3A' },
    { l:'20 yr', v:'£820', h:62, c:'#3B9DD2' },
    { l:'30 yr', v:'£2,100',h:100,c:'#F5A623' },
  ];
  return (
    <div ref={ref} className="lp3-chart">
      <div className="lp3-chart-ttl">Estimated growth over time</div>
      <div className="lp3-chart-bars">
        {bars.map((b,i)=>(
          <div key={i} className="lp3-chart-col">
            <span className="lp3-chart-v" style={{color:b.c,opacity:inView?1:0,transition:`opacity .5s ${i*.15}s`}}>{b.v}</span>
            <div className="lp3-chart-track">
              <div className="lp3-chart-bar" style={{
                background:b.c, height:inView?`${b.h}%`:'0%',
                transitionDelay:`${i*.15}s`,
                boxShadow:inView?`0 0 14px ${b.c}88`:'none',
              }}/>
            </div>
            <span className="lp3-chart-l">{b.l}</span>
          </div>
        ))}
      </div>
      <p className="lp3-chart-note">* Illustrative, based on historical appreciation rates</p>
    </div>
  );
}