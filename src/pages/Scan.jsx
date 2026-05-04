// src/pages/Scan.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScanUploader from '../components/ScanUploader';
import LiveScanner from '../components/LiveScanner';

export default function Scan() {
  const navigate  = useNavigate();
  const [mode, setMode] = useState('choose'); // 'choose' | 'live' | 'upload'

  const handleComplete = () => setTimeout(() => navigate('/collection'), 2500);

  if (mode === 'live') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Live scanner</h1>
          <p>Hold a card up to the camera — it identifies automatically</p>
        </div>
        <LiveScanner onComplete={handleComplete} onBack={() => setMode('choose')} />
      </div>
    );
  }

  if (mode === 'upload') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Scan cards</h1>
          <p>Upload photos or take a binder page photo</p>
        </div>
        <ScanUploader onComplete={handleComplete} />
      </div>
    );
  }

  // Choose scan method
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Scan cards</h1>
        <p>Choose how you want to add cards to your collection</p>
      </div>

      <div className="scan-entry-grid">

        <button className="scan-entry-card scan-entry-card--featured" onClick={() => setMode('live')}>
          <div className="sec-badge">New ⚡</div>
          <div className="sec-icon">📸</div>
          <div className="sec-title">Live camera scan</div>
          <div className="sec-desc">
            Hold a card up and Scanachu identifies it automatically — no button tap needed.
            Like scanning a credit card number.
          </div>
          <div className="sec-hint">Best for scanning one card at a time quickly</div>
        </button>

        <button className="scan-entry-card" onClick={() => setMode('upload')}>
          <div className="sec-icon">🗂</div>
          <div className="sec-title">Photo upload / binder scan</div>
          <div className="sec-desc">
            Take one photo of a full binder page (up to 9 cards), select photos from your gallery,
            or search by card number.
          </div>
          <div className="sec-hint">Best for scanning multiple cards at once</div>
        </button>

      </div>
    </div>
  );
}