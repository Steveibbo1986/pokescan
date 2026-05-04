// src/pages/Landing.jsx
// Marketing landing page for Scanachu - shown to logged-out users

import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export default function Landing() {
  const heroRef = useRef(null);

  // Parallax lightning bolts on mouse move
  useEffect(() => {
    const handler = (e) => {
      const bolts = document.querySelectorAll('.bolt-parallax');
      bolts.forEach((bolt, i) => {
        const speed = (i + 1) * 0.015;
        const x = (e.clientX - window.innerWidth / 2) * speed;
        const y = (e.clientY - window.innerHeight / 2) * speed;
        bolt.style.transform = `translate(${x}px, ${y}px)`;
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div className="landing">

      {/* Nav */}
      <header className="landing-header">
        <div className="landing-logo">
          <span className="landing-logo-bolt">⚡</span>
          Scanachu
        </div>
        <div className="landing-header-actions">
          <Link to="/auth" className="landing-signin">Sign in</Link>
          <Link to="/auth" className="landing-cta-sm">Get started free</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero" ref={heroRef}>
        {/* Animated background */}
        <div className="hero-bg">
          <div className="hero-grid" />
          <div className="bolt-parallax bolt-1">⚡</div>
          <div className="bolt-parallax bolt-2">⚡</div>
          <div className="bolt-parallax bolt-3">⚡</div>
          <div className="hero-glow" />
        </div>

        <div className="hero-content">
          <div className="hero-eyebrow">The Pokémon card tracker for serious collectors</div>
          <h1 className="hero-title">
            Scan. Collect.<br />
            <span className="hero-title-accent">Trade. Grow.</span>
          </h1>
          <p className="hero-subtitle">
            Photograph your cards and Scanachu identifies them instantly — tracking your collection,
            finding missing Pokémon, calculating value, and predicting what they'll be worth in 30 years.
          </p>
          <div className="hero-actions">
            <Link to="/auth" className="hero-btn-primary">
              <span>Start your Pokédex</span>
              <span className="hero-btn-arrow">→</span>
            </Link>
            <a href="#features" className="hero-btn-secondary">See how it works</a>
          </div>
          <div className="hero-social-proof">
            <div className="hero-proof-item">
              <span className="hero-proof-num">1,025</span>
              <span className="hero-proof-label">Pokémon to collect</span>
            </div>
            <div className="hero-proof-divider" />
            <div className="hero-proof-item">
              <span className="hero-proof-num">20,000+</span>
              <span className="hero-proof-label">Cards in database</span>
            </div>
            <div className="hero-proof-divider" />
            <div className="hero-proof-item">
              <span className="hero-proof-num">Free</span>
              <span className="hero-proof-label">To get started</span>
            </div>
          </div>
        </div>

        {/* Floating card mockups */}
        <div className="hero-cards">
          <div className="hero-card hero-card-1">
            <div className="hero-card-inner">
              <div className="hero-card-shine" />
              <div className="hero-card-body">
                <div className="hero-card-type">⚡ Electric</div>
                <div className="hero-card-name">Pikachu</div>
                <div className="hero-card-hp">HP 70</div>
                <div className="hero-card-value">£24.50</div>
                <div className="hero-card-badge owned">✓ Owned</div>
              </div>
            </div>
          </div>
          <div className="hero-card hero-card-2">
            <div className="hero-card-inner">
              <div className="hero-card-shine" />
              <div className="hero-card-body">
                <div className="hero-card-type">🔥 Fire</div>
                <div className="hero-card-name">Charizard</div>
                <div className="hero-card-hp">HP 120</div>
                <div className="hero-card-value">£189.00</div>
                <div className="hero-card-badge holo">★ Holo Rare</div>
              </div>
            </div>
          </div>
          <div className="hero-card hero-card-3">
            <div className="hero-card-inner">
              <div className="hero-card-shine" />
              <div className="hero-card-body">
                <div className="hero-card-type">🔮 Psychic</div>
                <div className="hero-card-name">Mewtwo</div>
                <div className="hero-card-hp">HP 100</div>
                <div className="hero-card-value">£67.20</div>
                <div className="hero-card-badge wishlist">♡ Wishlist</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="landing-how" id="features">
        <div className="landing-container">
          <div className="landing-section-label">How it works</div>
          <h2 className="landing-section-title">From photo to collection<br />in seconds</h2>

          <div className="how-steps">
            <div className="how-step">
              <div className="how-step-num">01</div>
              <div className="how-step-icon">📷</div>
              <h3>Photograph your cards</h3>
              <p>Take one photo of a full binder page — up to 9 cards at once. Or photograph individual cards. Even works from older sets like Base Set and Jungle.</p>
            </div>
            <div className="how-connector">⚡</div>
            <div className="how-step">
              <div className="how-step-num">02</div>
              <div className="how-step-icon">🤖</div>
              <h3>AI identifies everything</h3>
              <p>Claude AI reads each card — name, set, card number, rarity. Matched against a database of 20,000+ cards. Any it gets wrong you can fix in one tap.</p>
            </div>
            <div className="how-connector">⚡</div>
            <div className="how-step">
              <div className="how-step-num">03</div>
              <div className="how-step-icon">📊</div>
              <h3>Track, value & predict</h3>
              <p>See your live collection value in GBP. Find out which Pokémon you're still missing. Get a 30-year value prediction for every card you own.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="landing-features">
        <div className="landing-container">
          <div className="landing-section-label">Features</div>
          <h2 className="landing-section-title">Everything a Pokémon<br />collector needs</h2>

          <div className="features-grid">
            <div className="feature-card feature-card--large">
              <div className="feature-icon">📖</div>
              <h3>Living Pokédex</h3>
              <p>See all 1,025 Pokémon — Gen 1 to Gen 9. Green means you have a card for them. Grey means they're still missing. Tap any missing one to find cards instantly.</p>
              <div className="feature-dex-preview">
                {['🟡','🟡','🟡','⬛','🟡','⬛','🟡','🟡','⬛'].map((c,i) => (
                  <div key={i} className={`feature-dex-dot ${c === '🟡' ? 'owned' : 'missing'}`} />
                ))}
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Real-time value</h3>
              <p>Current GBP market prices for every card. See your total collection value at a glance, broken down by set.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>30-year prediction</h3>
              <p>Based on historical Pokémon card appreciation. See what your collection could be worth in 10, 20 and 30 years — great motivation to keep them in good condition!</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⇄</div>
              <h3>Trade with friends</h3>
              <p>Add friends, browse each other's collections, and propose trades. The perfect way for collectors to swap duplicates and complete sets together.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⭐</div>
              <h3>Wishlist & prices</h3>
              <p>Found a card you want? Add it to your wishlist with a tap. See the current price, low/high range, and links to buy on TCGPlayer and eBay.</p>
            </div>

            <div className="feature-card feature-card--large">
              <div className="feature-icon">🔍</div>
              <h3>Find any card, any way</h3>
              <p>Search by Pokémon name, browse complete sets, or type the card number straight from the card (e.g. 004/102). Add to collection or wishlist in one tap — with prices shown for every card.</p>
              <div className="feature-search-preview">
                <div className="feature-search-bar">
                  <span>🔍</span>
                  <span>023/088</span>
                </div>
                <div className="feature-search-result">
                  <div className="feature-search-dot" />
                  <span>Charizard · Base Set · £189</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value prediction teaser */}
      <section className="landing-prediction">
        <div className="landing-container">
          <div className="prediction-teaser">
            <div className="prediction-teaser-text">
              <div className="landing-section-label">Investment potential</div>
              <h2>Your son's cards could be<br /><span className="prediction-highlight">worth a fortune</span></h2>
              <p>Pokémon cards have consistently appreciated in value over 25+ years. A Base Set Charizard that cost £3 in 1999 is worth £200+ today. Scanachu shows you the projected value of every card you own — encouraging collectors to keep their cards in great condition.</p>
              <Link to="/auth" className="hero-btn-primary" style={{marginTop:24,display:'inline-flex'}}>
                Start tracking your collection →
              </Link>
            </div>
            <div className="prediction-teaser-chart">
              <div className="ptc-label">Collection value over time</div>
              <div className="ptc-bars">
                <div className="ptc-bar-group">
                  <div className="ptc-bar" style={{height:'20%'}} />
                  <div className="ptc-year">Now</div>
                  <div className="ptc-val">£120</div>
                </div>
                <div className="ptc-connector">→</div>
                <div className="ptc-bar-group">
                  <div className="ptc-bar" style={{height:'42%'}} />
                  <div className="ptc-year">10yr</div>
                  <div className="ptc-val">£310</div>
                </div>
                <div className="ptc-connector">→</div>
                <div className="ptc-bar-group">
                  <div className="ptc-bar" style={{height:'68%'}} />
                  <div className="ptc-year">20yr</div>
                  <div className="ptc-val">£820</div>
                </div>
                <div className="ptc-connector">→</div>
                <div className="ptc-bar-group ptc-bar-group--gold">
                  <div className="ptc-bar ptc-bar--gold" style={{height:'100%'}} />
                  <div className="ptc-year">30yr</div>
                  <div className="ptc-val ptc-val--gold">£2,100</div>
                </div>
              </div>
              <div className="ptc-note">* Illustrative. Based on historical avg. appreciation rates.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Social / community */}
      <section className="landing-community">
        <div className="landing-container">
          <div className="community-inner">
            <div className="community-icon">👥</div>
            <h2>Built for families and friend groups</h2>
            <p>Scanachu isn't just a tracker — it's a community. Add friends and family, see each other's collections, and propose trades to help everyone complete their sets. Perfect for parents and kids collecting together.</p>
            <div className="community-features">
              <div className="community-feat">✓ Add friends by username</div>
              <div className="community-feat">✓ Browse friends' collections</div>
              <div className="community-feat">✓ Propose and accept trades</div>
              <div className="community-feat">✓ See who wants which cards</div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-final-cta">
        <div className="landing-container">
          <div className="final-cta-inner">
            <div className="final-cta-bolt">⚡</div>
            <h2>Ready to catch them all?</h2>
            <p>Free to use. No credit card. Start scanning your collection in minutes.</p>
            <Link to="/auth" className="hero-btn-primary hero-btn-primary--large">
              <span>Create your free account</span>
              <span className="hero-btn-arrow">→</span>
            </Link>
            <div className="final-cta-small">Already have an account? <Link to="/auth" className="final-cta-link">Sign in</Link></div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-logo" style={{fontSize:18}}>
          <span className="landing-logo-bolt">⚡</span> Scanachu
        </div>
        <div className="landing-footer-note">Built for Pokémon collectors everywhere. Not affiliated with Nintendo or The Pokémon Company.</div>
      </footer>

    </div>
  );
}
