'use client';

import { useEffect, useRef } from 'react';

interface Props {
  localMultiplayer: boolean;
  onBack: () => void;
}

export default function PhaserGame({ localMultiplayer, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      import('phaser'),
      import('@/game/ArenaScene'),
    ]).then(([Phaser, { default: ArenaScene }]) => {
      if (!mounted || gameRef.current || !containerRef.current) return;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 800,
        height: 600,
        backgroundColor: '#060810',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        // No physics — server is authoritative, Phaser is pure renderer
        scene: [],
      };

      const game = new Phaser.Game(config);
      game.scene.add('ArenaScene', ArenaScene, true, {
        localMultiplayer,
        onBack,
      });
      gameRef.current = game;
    });

    return () => {
      mounted = false;
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [localMultiplayer, onBack]);

  return <div ref={containerRef} className="game-wrapper" />;
}
