'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Card } from '@/lib/types';
import GameCard from './GameCard';

interface PlayerHandProps {
  cards: Card[];
  onCardClick: (card: Card) => void;
  isMyTurn: boolean;
  topCard: Card;
}

const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  onCardClick,
  isMyTurn,
  topCard,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCard, setSelectedCard] = React.useState<string | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      const cardElements = containerRef.current.querySelectorAll('[data-card-id]');
      gsap.fromTo(
        cardElements,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.05, duration: 0.5, ease: 'power2.out' }
      );
    }
  }, [cards]);

  const handleCardClick = (card: Card) => {
    setSelectedCard(card.id);
    onCardClick(card);
  };

  const canPlayCard = (card: Card): boolean => {
    if (card.color === 'wild') return true;
    if (card.color === topCard.color) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-4">
        <p className="text-white/70 text-sm">
          {isMyTurn ? '✨ Your Turn - Click a card to play' : 'Waiting for opponent...'}
        </p>
      </div>
      <div
        ref={containerRef}
        className="flex justify-center items-center gap-2 overflow-x-auto pb-4 px-4 flex-wrap"
      >
        {cards.map((card, index) => (
          <div
            key={card.id}
            data-card-id={card.id}
            className={`
              transition-all duration-300
              ${!canPlayCard(card) && isMyTurn ? 'opacity-50' : ''}
              ${selectedCard === card.id ? 'ring-4 ring-yellow-300' : ''}
            `}
          >
            <div
              onClick={() => handleCardClick(card)}
              className={`
                transition-all duration-300 transform
                ${canPlayCard(card) && isMyTurn ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
              `}
            >
              <GameCard
                card={card}
                isSelectable={isMyTurn && canPlayCard(card)}
                isSelected={selectedCard === card.id}
                size="md"
              />
              {!canPlayCard(card) && isMyTurn && (
                <p className="text-red-300 text-xs text-center mt-1 font-bold">
                  Can't Play
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerHand;
