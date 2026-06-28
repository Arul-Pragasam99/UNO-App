'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Card } from '@/lib/types';
import CardFace from './CardFace';

interface GameCardProps {
  card: Card;
  onClick?: () => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  isPlayable?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const GameCard = ({
  card,
  onClick,
  isSelectable = false,
  isSelected = false,
  isPlayable = true,
  size = 'md',
  animate = true,
}: GameCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animate && cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.8, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
      );
    }
  }, [animate]);

  const handleClick = () => {
    if (!isSelectable || !onClick) return;

    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 0.92,
        duration: 0.08,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
      });
    }

    onClick();
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs': return 'w-10 h-[60px] sm:w-12 sm:h-[72px]';
      case 'sm': return 'w-12 h-[72px] sm:w-14 sm:h-[84px]';
      case 'lg': return 'w-20 h-[120px] sm:w-24 sm:h-36';
      default: return 'w-16 h-[96px] sm:w-[72px] sm:h-[108px]';
    }
  };

  const getGlowColor = (color: string): string => {
    switch (color) {
      case 'red': return 'rgba(239,68,68,0.4)';
      case 'yellow': return 'rgba(234,179,8,0.4)';
      case 'blue': return 'rgba(59,130,246,0.4)';
      case 'green': return 'rgba(34,197,94,0.4)';
      default: return 'rgba(168,85,247,0.4)';
    }
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      data-card-id={card.id}
      className={`
        ${getSizeClasses()}
        relative flex items-center justify-center
        rounded-xl transition-all duration-200
        ${isSelectable ? 'cursor-pointer active:scale-95' : ''}
        ${isSelected ? 'ring-2 ring-gray-700 ring-offset-2 ring-offset-white -translate-y-2 sm:-translate-y-3' : ''}
        ${isSelectable && isPlayable ? 'hover:-translate-y-1 sm:hover:-translate-y-2 hover:shadow-lg' : ''}
        ${!isPlayable && isSelectable ? 'opacity-40 grayscale-[30%]' : ''}
        transform-gpu
      `}
      style={{ perspective: '600px' }}
    >
      <div className="w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
        <CardFace card={card} size={size} />
      </div>

      {/* Playable glow */}
      {isSelectable && isPlayable && (
        <div 
          className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            boxShadow: `0 0 12px ${getGlowColor(card.color)}, 0 0 24px ${getGlowColor(card.color)}`,
          }}
        />
      )}
    </div>
  );
};

export default GameCard;