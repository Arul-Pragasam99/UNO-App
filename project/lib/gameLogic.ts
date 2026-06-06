import { Card } from './types';

// Generate a standard Uno deck
export const generateUnoDeck = (): Card[] => {
  const deck: Card[] = [];
  const colors: ('red' | 'yellow' | 'blue' | 'green')[] = ['red', 'yellow', 'blue', 'green'];
  const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'DrawTwo'];

  colors.forEach(color => {
    values.forEach((value, idx) => {
      if (idx === 0) {
        deck.push({ id: `${color}-${value}-0`, color, value });
      } else {
        deck.push({ id: `${color}-${value}-0`, color, value });
        deck.push({ id: `${color}-${value}-1`, color, value });
      }
    });
  });

  // Add Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}`, color: 'wild', value: 'Wild' });
    deck.push({ id: `wild-drawfour-${i}`, color: 'wild', value: 'DrawFour' });
  }

  return shuffleDeck(deck);
};

export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const canPlayCard = (card: Card, topCard: Card): boolean => {
  if (card.color === 'wild') return true;
  if (card.color === topCard.color) return true;
  if (card.value === topCard.value) return true;
  return false;
};

export const generateGameCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const drawCards = (
  drawPile: Card[],
  count: number
): { newCards: Card[]; remainingPile: Card[] } => {
  const newCards = drawPile.slice(0, count);
  const remainingPile = drawPile.slice(count);
  return { newCards, remainingPile };
};

export const calculateWinnerPoints = (opponentHandSize: number): number => {
  return opponentHandSize * 10;
};
