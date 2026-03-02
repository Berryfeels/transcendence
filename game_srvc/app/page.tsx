'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const PhaserGame = dynamic(() => import('@/components/PhaserGame'), {
  ssr: false,
  loading: () => (
    <div className="menu-container">
      <div className="menu-title" style={{ fontSize: '1.5rem' }}>Loading game engine...</div>
    </div>
  ),
});

export default function Home() {
  const [mode, setMode] = useState<'menu' | 'remote' | 'local'>('menu');

  if (mode !== 'menu') {
    return <PhaserGame localMultiplayer={mode === 'local'} onBack={() => setMode('menu')} />;
  }

  return (
    <div className="menu-container">
      <div className="menu-title">SPACE ARENA</div>
      <div className="menu-subtitle">Top-down multiplayer space combat</div>

      <button className="menu-btn" onClick={() => setMode('remote')}>
        PLAY ONLINE
      </button>
      <button className="menu-btn" onClick={() => setMode('local')}>
        LOCAL 2-PLAYER
      </button>

      <div className="menu-controls">
        P1: WASD to move · SPACE to shoot<br />
        P2 (local): Arrow keys · ENTER to shoot<br />
        ESC to return to menu
      </div>
    </div>
  );
}
