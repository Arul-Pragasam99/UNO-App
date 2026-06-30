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
  const directionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (discardRef.current) {
      gsap.fromTo(
        discardRef.current,
        { scale: 0.9, rotateZ: 0 },
        { scale: 1, rotateZ: 0, duration: 0.3, ease: 'back.out(1.5)' }
      );
    }
  }, [topCard.id]);

  useEffect(() => {
    if (directionRef.current) {
      gsap.to(directionRef.current, {
        rotateZ: direction === 1 ? 0 : 180,
        duration: 0.4,
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
    <div className="w-full max-w-xs sm:max-w-sm mx-auto">
      {/* Direction & Color - Compact */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
        <div
          ref={directionRef}
          className="flex items-center gap-1 bg-white/80 backdrop-blur rounded-full px-2.5 sm:px-3 py-0.5 border border-gray-200 shadow-sm"
        >
          <span className="text-gray-600 text-[10px] sm:text-xs font-medium">
            {direction === 1 ? '→' : '←'}
          </span>
          <span className="text-gray-400 text-[8px] sm:text-[10px]">🔄</span>
        </div>

        <div className="flex items-center gap-1 bg-white/80 backdrop-blur rounded-full px-2.5 sm:px-3 py-0.5 border border-gray-200 shadow-sm">
          <div
            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full border border-gray-300 transition-colors"
            style={{
              backgroundColor: colorIndicatorMap[currentColor] || '#888',
              boxShadow: `0 0 8px ${colorIndicatorMap[currentColor] || '#888'}40`,
            }}
          />
          <span className="text-gray-600 text-[10px] sm:text-xs font-medium capitalize">
            {currentColor}
          </span>
        </div>
      </div>

      {/* Card piles - Centered */}
      <div className="flex items-center justify-center gap-6 sm:gap-8">
        {/* Discard Pile */}
        <div className="flex flex-col items-center">
          <p className="text-gray-400 text-[8px] sm:text-xs font-medium">Discard</p>
          <div ref={discardRef} className="relative mt-1">
            <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 opacity-30">
              <GameCard card={topCard} size="lg" animate={false} />
            </div>
            <GameCard card={topCard} size="lg" animate={false} />
          </div>
        </div>

        {/* Draw Pile - Bigger touch target */}
        <div className="flex flex-col items-center">
          <p className="text-gray-400 text-[8px] sm:text-xs font-medium">Draw</p>
          <button
            onClick={onDrawCard}
            disabled={!isMyTurn}
            className={`relative mt-1 transition-transform duration-200 ${
              isMyTurn ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'
            }`}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <div className="relative">
              {/* Stacked cards */}
              <div className="relative">
                <CardBack size="lg" />
                <div className="absolute -top-1 -right-1 z-20 bg-gray-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border border-white shadow-sm">
                  {drawPileSize}
                </div>
              </div>
            </div>

            {isMyTurn && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-gray-500 text-[8px] sm:text-[10px] font-medium animate-pulse">
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