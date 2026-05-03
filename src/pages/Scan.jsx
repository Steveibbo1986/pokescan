// src/pages/Scan.jsx
import { useState } from 'react';
import ScanUploader from '../components/ScanUploader';
import { useNavigate } from 'react-router-dom';

export default function Scan() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Scan cards</h1>
        <p>Add up to 9 card photos at once. We'll identify each one automatically.</p>
      </div>
      <ScanUploader onComplete={() => { setDone(true); setTimeout(() => navigate('/collection'), 2500); }} />
    </div>
  );
}
