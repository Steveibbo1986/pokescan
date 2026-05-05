// src/components/CoinToast.jsx
// Pops up when coins are earned — bottom of screen, auto-dismisses
import { useEffect, useState } from 'react';
import { useCoins } from '../hooks/useCoins';

export default function CoinToast() {
  const { toast } = useCoins();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (toast) {
      setCurrent(toast);
      setVisible(true);
    } else {
      // Fade out then clear
      setTimeout(() => { setVisible(false); setCurrent(null); }, 300);
    }
  }, [toast]);

  if (!current) return null;

  return (
    <div className={`coin-toast ${visible ? 'coin-toast--visible' : 'coin-toast--hidden'}`}>
      <span className="coin-toast-bolt">⚡</span>
      <span className="coin-toast-label">{current.label}</span>
    </div>
  );
}
