'use client';

import React from 'react';
import { Card } from '@/lib/types';
import GameCard from './GameCard';

interface GameBoardProps {
  topCard: Card;
  drawPileSize: number;
}

const GameBoard: React.FC<GameBoardProps> = ({ topCard, drawPileSize }) => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="grid grid-cols-2 gap-8 md:gap-12 mb-4">
        {/* Discard Pile / Active Card */}
        <div className="flex flex-col items-center">
          <p className="text-white/70 text-sm mb-2">Active Card</p>
          <div className="transform perspective">
            <GameCard card={topCard} size="lg" />
          </div>
        </div>

        {/* Draw Pile */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-white/70 text-sm mb-2">Draw Pile</p>
          <div className="relative w-28 h-40">
            {/* Stacked card effect */}
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="absolute w-28 h-40 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg border-2 border-white/40 shadow-lg"
                style={{
                  transform: `translateY(${i * 4}px) translateX(${i * 4}px)`,
                  zIndex: 3 - i,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/50 text-4xl">🎴</span>
                </div>
              </div>
            ))}
            {/* Card count */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="bg-black/60 rounded-lg px-3 py-1 text-white font-bold text-center">
                <p className="text-2xl">{drawPileSize}</p>
                <p className="text-xs">Cards</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
