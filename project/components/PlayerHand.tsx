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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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
            duration: 0.3,
            ease: 'back.out(1.2)',
          }
        );
      }
    }
  }, [cards.length]);

  // Reset selection when cards change or turn changes
  useEffect(() => {
    setSelectedCardId(null);
  }, [cards.length, isMyTurn]);

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) {
      vibrateError();
      return;
    }

    const playable = canPlayCard(card, topCard, currentColor);

    if (!playable) {
      vibrateError();
      return;
    }

    // If card is already selected, play it
    if (selectedCardId === card.id) {
      vibrateCardPlay();
      setSelectedCardId(null);
      onCardClick(card);
      return;
    }

    // If different card selected, switch selection
    if (selectedCardId !== null) {
      setSelectedCardId(null);
      // Small delay before selecting new card to avoid conflicts
      setTimeout(() => {
        setSelectedCardId(card.id);
      }, 50);
    } else {
      // Select the card
      setSelectedCardId(card.id);
    }
  };

  const isCardPlayable = (card: Card): boolean => {
    return canPlayCard(card, topCard, currentColor);
  };

  if (cards.length === 0) {
    return (
      <div className="w-full text-center py-4">
        <p className="text-gray-400 text-sm">No cards left!</p>
      </div>
    );
  }

  const getCardSize = () => {
    if (cards.length > 14) return 'xs';
    if (cards.length > 10) return 'sm';
    return 'md';
  };

  return (
    <div className="w-full px-1">
      {/* Turn indicator */}
      <div className="text-center mb-1">
        <p className={`text-[10px] sm:text-xs font-semibold ${isMyTurn ? 'text-gray-700' : 'text-gray-400'}`}>
          {isMyTurn ? '👆 Tap a card, tap again to play' : '⏳ Waiting...'}
        </p>
      </div>

      {/* Cards */}
      <div
        ref={containerRef}
        className="flex items-end gap-0.5 sm:gap-1 md:gap-1.5 overflow-x-auto overflow-y-visible pb-1 px-1 scroll-smooth snap-x snap-mandatory scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card) => {
          const playable = isCardPlayable(card);
          const isSelected = selectedCardId === card.id;
          
          return (
            <div
              key={card.id}
              className="flex-shrink-0 snap-center"
              style={{
                transform: isSelected ? 'translateY(-10px)' : 'none',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <GameCard
                card={card}
                onClick={() => handleCardClick(card)}
                isSelectable={isMyTurn}
                isSelected={isSelected}
                isPlayable={playable}
                size={getCardSize()}
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