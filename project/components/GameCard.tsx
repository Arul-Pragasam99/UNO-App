'use client';

import { Card } from '@/lib/types';

interface GameCardProps {
  card: Card;
  onClick?: () => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const GameCard = ({
  card,
  onClick,
  isSelectable = false,
  isSelected = false,
  size = 'md',
}: GameCardProps) => {
  const getCardColor = () => {
    switch (card.color) {
      case 'red':
        return 'bg-red-500';
      case 'yellow':
        return 'bg-yellow-400';
      case 'blue':
        return 'bg-blue-500';
      case 'green':
        return 'bg-green-500';
      case 'wild':
        return 'bg-gradient-to-br from-gray-800 to-black';
      default:
        return 'bg-gray-500';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-16 h-24';
      case 'lg':
        return 'w-28 h-40';
      default:
        return 'w-20 h-32';
    }
  };

  const getCardValue = () => {
    const valueMap: { [key: string]: string } = {
      Skip: '⏩',
      Reverse: '🔄',
      DrawTwo: '+2',
      Wild: '🌈',
      DrawFour: '+4',
    };
    return valueMap[card.value] || card.value;
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${getSizeClasses()}
        ${getCardColor()}
        ${isSelectable ? 'cursor-pointer hover:shadow-2xl' : ''}
        ${isSelected ? 'ring-4 ring-yellow-300 transform scale-110' : ''}
        rounded-lg p-2 flex flex-col items-center justify-center
        transition-all duration-300 transform hover:scale-105
        shadow-lg border-2 border-white/30
        relative
      `}
    >
      {/* Card content */}
      <div className="text-white font-display font-bold text-center">
        <div className={`text-${size === 'sm' ? '2xl' : size === 'lg' ? '5xl' : '3xl'}`}>
          {getCardValue()}
        </div>
        {card.color !== 'wild' && (
          <div className="text-xs mt-1 opacity-75">{card.color.toUpperCase()}</div>
        )}
      </div>

      {/* Corner markers for larger cards */}
      {size !== 'sm' && (
        <>
          <div className="absolute top-1 left-1 text-white/50 text-xs">
            {getCardValue()}
          </div>
          <div className="absolute bottom-1 right-1 text-white/50 text-xs">
            {getCardValue()}
          </div>
        </>
      )}
    </div>
  );
};

export default GameCard;