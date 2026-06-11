'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Card } from '@/lib/types';
import GameCard from './GameCard';
import { CardBack } from './CardFace';

interface GameBoardProps {
  topCard: Card;
  drawPileSize: number;
  currentColor: string;
  direction: 1 | -1;
  onDrawCard?: () => void;
  isMyTurn?: boolean;
}

const GameBoard = ({
  topCard,
  drawPileSize,
  currentColor,
  direction,
  onDrawCard,
  isMyTurn = false,
}: GameBoardProps) => {
  const discardRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (discardRef.current) {
      gsap.fromTo(
        discardRef.current,
        { scale: 0.8, rotateZ: gsap.utils.random(-10, 10) },
        { scale: 1, rotateZ: 0, duration: 0.3, ease: 'back.out(1.5)' }
      );
    }
  }, [topCard.id]);

  useEffect(() => {
    if (directionRef.current) {
      gsap.to(directionRef.current, {
        rotateZ: direction === 1 ? 0 : 180,
        duration: 0.5,
        ease: 'back.out(2)',
      });
    }
  }, [direction]);

  const colorIndicatorMap: Record<string, string> = {
    red: '#EF4444',
    yellow: '#EAB308',
    blue: '#3B82F6',
    green: '#22C55E',
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Direction indicator */}
      <div className="flex justify-center mb-3 sm:mb-4">
        <div
          ref={directionRef}
          className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-1.5 border border-white/20"
        >
          <span className="text-white/70 text-xs sm:text-sm font-medium">
            {direction === 1 ? '→ Clockwise' : '← Counter-clockwise'}
          </span>
          <span className="text-lg">🔄</span>
        </div>
      </div>

      {/* Current color indicator */}
      <div className="flex justify-center mb-3 sm:mb-4">
        <div className="flex items-center gap-2 bg-black/30 backdrop-blur rounded-full px-4 py-2 border border-white/10">
          <span className="text-white/70 text-xs sm:text-sm">Current Color:</span>
          <div
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white/50 transition-colors duration-300"
            style={{
              backgroundColor: colorIndicatorMap[currentColor] || '#888',
              boxShadow: `0 0 12px ${colorIndicatorMap[currentColor] || '#888'}`,
            }}
          />
          <span className="text-white font-semibold text-xs sm:text-sm capitalize">{currentColor}</span>
        </div>
      </div>

      {/* Card piles */}
      <div className="grid grid-cols-2 gap-6 sm:gap-10 px-4">
        {/* Discard Pile */}
        <div className="flex flex-col items-center">
          <p className="text-white/60 text-xs sm:text-sm mb-2 font-medium">Discard Pile</p>
          <div ref={discardRef} id="discard-pile" className="relative">
            {/* Shadow cards underneath */}
            <div className="absolute inset-0 translate-x-1 translate-y-1 opacity-30">
              <GameCard card={topCard} size="lg" animate={false} />
            </div>
            <GameCard card={topCard} size="lg" animate={false} />
          </div>
        </div>

        {/* Draw Pile */}
        <div className="flex flex-col items-center">
          <p className="text-white/60 text-xs sm:text-sm mb-2 font-medium">Draw Pile</p>
          <button
            ref={drawRef}
            onClick={onDrawCard}
            disabled={!isMyTurn}
            className={`
              relative group
              ${isMyTurn ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed opacity-60'}
              transition-transform duration-200
            `}
          >
            {/* Stacked card effect */}
            <div className="relative">
              {[2, 1, 0].map((i) => (
                <div
                  key={i}
                  className="absolute inset-0"
                  style={{
                    transform: `translateX(${i * 2}px) translateY(${i * 2}px)`,
                    zIndex: 3 - i,
                    opacity: i === 0 ? 1 : 0.7 - i * 0.2,
                  }}
                >
                  <CardBack size="lg" />
                </div>
              ))}
              <div className="relative z-10">
                <CardBack size="lg" />
              </div>
            </div>

            {/* Draw count badge */}
            <div className="absolute -top-2 -right-2 z-20 bg-indigo-600 text-white text-xs font-bold rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border-2 border-white/30 shadow-lg">
              {drawPileSize}
            </div>

            {/* Tap to draw hint */}
            {isMyTurn && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-yellow-300/80 text-[10px] sm:text-xs font-medium animate-pulse">
                  Tap to draw
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;