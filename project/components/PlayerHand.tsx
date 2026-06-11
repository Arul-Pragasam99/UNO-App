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
    if (containerRef.current) {
      const cardElements = containerRef.current.querySelectorAll('[data-card-id]');
      gsap.fromTo(
        cardElements,
        { opacity: 0, y: 30, scale: 0.8 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: { each: 0.04, from: 'center' },
          duration: 0.4,
          ease: 'back.out(1.2)',
        }
      );
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
      // Double-tap to play
      vibrateCardPlay();
      setSelectedCard(null);
      onCardClick(card);
    } else {
      // First tap to select
      setSelectedCard(card.id);
    }
  };

  const isCardPlayable = (card: Card): boolean => {
    return canPlayCard(card, topCard, currentColor);
  };

  return (
    <div className="w-full">
      {/* Turn indicator */}
      <div className="text-center mb-2 sm:mb-3">
        <p className={`text-xs sm:text-sm font-semibold ${isMyTurn ? 'text-yellow-300' : 'text-white/50'}`}>
          {isMyTurn ? '✨ Your Turn — Tap a card, then tap again to play' : '⏳ Waiting for opponent...'}
        </p>
      </div>

      {/* Card hand — horizontally scrollable on mobile, centered on desktop */}
      <div
        ref={containerRef}
        className="
          flex items-end gap-1 sm:gap-1.5 md:gap-2
          overflow-x-auto overflow-y-visible
          pb-2 px-2 sm:px-4
          scroll-smooth snap-x snap-mandatory
          justify-start sm:justify-center
          -mx-2 sm:mx-0
          scrollbar-hide
        "
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card) => {
          const playable = isCardPlayable(card);
          return (
            <div
              key={card.id}
              className="flex-shrink-0 snap-center"
            >
              <GameCard
                card={card}
                onClick={() => handleCardClick(card)}
                isSelectable={isMyTurn}
                isSelected={selectedCard === card.id}
                isPlayable={playable}
                size={cards.length > 10 ? 'xs' : cards.length > 6 ? 'sm' : 'md'}
              />
            </div>
          );
        })}
      </div>

      {/* Card count badge */}
      <div className="text-center mt-1">
        <span className="inline-flex items-center gap-1 text-white/60 text-xs bg-white/10 rounded-full px-3 py-0.5">
          🃏 {cards.length} card{cards.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

export default PlayerHand;