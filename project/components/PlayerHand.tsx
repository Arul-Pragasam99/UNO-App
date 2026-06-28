'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { Card } from '@/lib/types';
import { canPlayCard } from '@/lib/gameLogic';
import { vibrateCardPlay, vibrateError } from '@/lib/haptics';
import GameCard from './GameCard';

interface PlayerHandProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  isMyTurn: boolean;
  topCard: Card;
  currentColor: string;
}

const PlayerHand = ({
  cards,
  onCardClick,
  isMyTurn,
  topCard,
  currentColor,
}: PlayerHandProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  useEffect(() => {
    if (containerRef.current && cards.length > 0) {
      const cardElements = containerRef.current.querySelectorAll('[data-card-id]');
      if (cardElements.length > 0) {
        gsap.fromTo(
          cardElements,
          { opacity: 0, y: 20, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            stagger: { each: 0.03, from: 'center' },
            duration: 0.4,
            ease: 'back.out(1.2)',
          }
        );
      }
    }
  }, [cards.length]);

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    const playable = canPlayCard(card, topCard, currentColor);

    if (!playable) {
      vibrateError();
      return;
    }

    if (selectedCard === card.id) {
      vibrateCardPlay();
      setSelectedCard(null);
      onCardClick(card);
    } else {
      setSelectedCard(card.id);
    }
  };

  const isCardPlayable = (card: Card): boolean => {
    return canPlayCard(card, topCard, currentColor);
  };

  if (cards.length === 0) {
    return (
      <div className="w-full text-center py-2">
        <p className="text-gray-400 text-sm">No cards left!</p>
      </div>
    );
  }

  return (
    <div className="w-full px-1 sm:px-4">
      {/* Turn indicator - Compact */}
      <div className="text-center mb-1 sm:mb-2">
        <p className={`text-[10px] sm:text-xs font-semibold ${isMyTurn ? 'text-gray-700' : 'text-gray-400'}`}>
          {isMyTurn ? '✨ Tap card to select, tap again to play' : '⏳ Waiting for opponent...'}
        </p>
      </div>

      {/* Cards */}
      <div
        ref={containerRef}
        className="flex items-end gap-0.5 sm:gap-1 md:gap-1.5 overflow-x-auto overflow-y-visible pb-1 px-1 sm:px-2 scroll-smooth snap-x snap-mandatory justify-start sm:justify-center scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card) => {
          const playable = isCardPlayable(card);
          const isSelected = selectedCard === card.id;
          
          return (
            <div
              key={card.id}
              className="flex-shrink-0 snap-center"
              style={{
                transform: isSelected ? 'translateY(-8px)' : 'none',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <GameCard
                card={card}
                onClick={() => handleCardClick(card)}
                isSelectable={isMyTurn}
                isSelected={isSelected}
                isPlayable={playable}
                size={cards.length > 12 ? 'xs' : cards.length > 8 ? 'sm' : 'md'}
              />
            </div>
          );
        })}
      </div>

      {/* Card count */}
      <div className="text-center mt-0.5">
        <span className="text-gray-400 text-[8px] sm:text-[10px] bg-white/50 px-2 py-0.5 rounded-full">
          🃏 {cards.length}
        </span>
      </div>
    </div>
  );
};

export default PlayerHand;