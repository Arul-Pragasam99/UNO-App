import { Card, CardColor, GameState, GameRoom } from './types';

// ─── Deck Generation ───────────────────────────────────────────────────────────

/** Generate a standard 108-card deck and shuffle it */
export const generateUnoDeck = (): Card[] => {
  const deck: Card[] = [];
  const colors: ('red' | 'yellow' | 'blue' | 'green')[] = ['red', 'yellow', 'blue', 'green'];
  const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'DrawTwo'];

  colors.forEach((color) => {
    values.forEach((value, idx) => {
      if (value === '0') {
        // Only one zero per color
        deck.push({ id: `${color}-${value}-0`, color, value });
      } else {
        deck.push({ id: `${color}-${value}-0`, color, value });
        deck.push({ id: `${color}-${value}-1`, color, value });
      }
    });
  });

  // 4 Wild and 4 Wild Draw Four
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}`, color: 'wild', value: 'Wild' });
    deck.push({ id: `wild-drawfour-${i}`, color: 'wild', value: 'DrawFour' });
  }

  return shuffleDeck(deck);
};

/** Fisher-Yates shuffle */
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ─── Card Playability (FIXED) ──────────────────────────────────────────────────────────

/** Check if a card can be played on the current top card */
export const canPlayCard = (card: Card, topCard: Card, currentColor: string): boolean => {
  // Wild cards can always be played
  if (card.color === 'wild') return true;
  
  // If top card is wild, use the current game color
  const topColor = topCard.color === 'wild' ? currentColor : topCard.color;
  
  // Same color
  if (card.color === topColor) return true;
  
  // Same value (number or action) - only if top card is not wild
  if (topCard.color !== 'wild' && card.value === topCard.value) return true;
  
  return false;
};

// ─── Draw Pile Reshuffle (NEW) ──────────────────────────────────────────────────────────

/** Reshuffle discard pile into draw pile when draw pile is empty */
export const reshuffleDiscardPile = (state: GameState): GameState => {
  if (state.drawPile.length > 0) return state;
  
  const topCard = state.discardPile[state.discardPile.length - 1];
  const cardsToShuffle = state.discardPile.slice(0, -1);
  const shuffled = shuffleDeck(cardsToShuffle);
  
  return {
    ...state,
    drawPile: shuffled,
    discardPile: [topCard],
  };
};

/** Draw cards with automatic reshuffle handling */
export const drawCardsWithReshuffle = (
  state: GameState,
  count: number
): { newState: GameState; drawnCards: Card[] } => {
  let currentState = { ...state };
  let drawnCards: Card[] = [];
  
  for (let i = 0; i < count; i++) {
    if (currentState.drawPile.length === 0) {
      currentState = reshuffleDiscardPile(currentState);
    }
    
    if (currentState.drawPile.length === 0) {
      // No cards left to draw
      break;
    }
    
    const card = currentState.drawPile[0];
    drawnCards.push(card);
    currentState.drawPile = currentState.drawPile.slice(1);
  }
  
  return { newState: currentState, drawnCards };
};

// ─── Game Code ─────────────────────────────────────────────────────────────────

export const generateGameCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// ─── Card Drawing ──────────────────────────────────────────────────────────────

export const drawCards = (
  drawPile: Card[],
  count: number
): { newCards: Card[]; remainingPile: Card[] } => {
  const newCards = drawPile.slice(0, count);
  const remainingPile = drawPile.slice(count);
  return { newCards, remainingPile };
};

// ─── Multi-Player Turn Management ──────────────────────────────────────────────

export const getNextPlayerIndex = (
  currentIndex: number,
  direction: 1 | -1,
  playerCount: number,
  skip: number = 0
): number => {
  const steps = 1 + skip;
  let next = (currentIndex + direction * steps) % playerCount;
  if (next < 0) next += playerCount;
  return next;
};

export const getNextPlayerId = (state: GameState, skip: number = 0): string => {
  const nextIndex = getNextPlayerIndex(
    state.currentPlayerIndex,
    state.direction,
    state.playerOrder.length,
    skip
  );
  return state.playerOrder[nextIndex];
};

export const getCurrentPlayerId = (state: GameState): string => {
  return state.playerOrder[state.currentPlayerIndex];
};

export const getTopCard = (state: GameState): Card => {
  return state.discardPile[state.discardPile.length - 1];
};

export const getPlayerHand = (state: GameState, playerId: string): Card[] => {
  return state.playerHands[playerId] || [];
};

export const getPlayableCards = (state: GameState, playerId: string): Card[] => {
  const hand = getPlayerHand(state, playerId);
  const topCard = getTopCard(state);
  return hand.filter((card) => canPlayCard(card, topCard, state.currentColor));
};

// ─── Initialize Game State ─────────────────────────────────────────────────────

export const initializeGameState = (
  roomId: string,
  playerOrder: string[]
): GameState => {
  const deck = generateUnoDeck();
  const cardsPerPlayer = 7;

  const playerHands: Record<string, Card[]> = {};
  let cardIndex = 0;

  playerOrder.forEach((uid) => {
    playerHands[uid] = deck.slice(cardIndex, cardIndex + cardsPerPlayer);
    cardIndex += cardsPerPlayer;
  });

  const remainingDeck = deck.slice(cardIndex);

  let discardIndex = 0;
  while (discardIndex < remainingDeck.length && remainingDeck[discardIndex].color === 'wild') {
    discardIndex++;
  }
  if (discardIndex >= remainingDeck.length) discardIndex = 0;

  const discardCard = remainingDeck[discardIndex];
  const drawPile = [
    ...remainingDeck.slice(0, discardIndex),
    ...remainingDeck.slice(discardIndex + 1),
  ];

  return {
    roomId,
    playerHands,
    playerOrder,
    currentPlayerIndex: 0,
    direction: 1,
    discardPile: [discardCard],
    drawPile,
    pendingDraw: 0,
    currentColor: discardCard.color === 'wild' ? 'red' : (discardCard.color as 'red' | 'yellow' | 'blue' | 'green'),
    unoCalledBy: [],
    status: 'playing',
  };
};

// ─── Handle Special Cards (FIXED - added reshuffle support) ──────────────────────────────────────────────────────

export const applyCardEffect = (
  state: GameState,
  card: Card,
  playerId: string,
  chosenColor?: 'red' | 'yellow' | 'blue' | 'green'
): GameState => {
  let newState = { ...state };
  const playerCount = newState.playerOrder.length;

  // Ensure draw pile has cards before drawing
  const ensureDrawPile = (count: number) => {
    let tempState = newState;
    for (let i = 0; i < count; i++) {
      if (tempState.drawPile.length === 0) {
        tempState = reshuffleDiscardPile(tempState);
      }
    }
    return tempState;
  };

  switch (card.value) {
    case 'Skip': {
      newState.currentPlayerIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount,
        1
      );
      newState.currentColor = card.color as 'red' | 'yellow' | 'blue' | 'green';
      newState.lastAction = {
        type: 'skipPlayed',
        playerId,
        card,
        timestamp: Date.now(),
      };
      break;
    }

    case 'Reverse': {
      if (playerCount === 2) {
        newState.currentPlayerIndex = getNextPlayerIndex(
          newState.currentPlayerIndex,
          newState.direction,
          playerCount,
          1
        );
      } else {
        newState.direction = (newState.direction * -1) as 1 | -1;
        newState.currentPlayerIndex = getNextPlayerIndex(
          newState.currentPlayerIndex,
          newState.direction,
          playerCount
        );
      }
      newState.currentColor = card.color as 'red' | 'yellow' | 'blue' | 'green';
      newState.lastAction = {
        type: 'reversePlayed',
        playerId,
        card,
        timestamp: Date.now(),
      };
      break;
    }

    case 'DrawTwo': {
      const targetIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount
      );
      const targetId = newState.playerOrder[targetIndex];

      // Ensure draw pile has cards
      newState = ensureDrawPile(2);
      
      const { newCards, remainingPile } = drawCards(newState.drawPile, 2);
      newState.playerHands = { ...newState.playerHands };
      newState.playerHands[targetId] = [
        ...(newState.playerHands[targetId] || []),
        ...newCards,
      ];
      newState.drawPile = remainingPile;

      newState.currentPlayerIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount,
        1
      );
      newState.currentColor = card.color as 'red' | 'yellow' | 'blue' | 'green';
      newState.lastAction = {
        type: 'drawTwoPlayed',
        playerId,
        card,
        targetPlayerId: targetId,
        timestamp: Date.now(),
      };
      break;
    }

    case 'DrawFour': {
      const targetIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount
      );
      const targetId = newState.playerOrder[targetIndex];

      // Ensure draw pile has cards
      newState = ensureDrawPile(4);
      
      const { newCards, remainingPile } = drawCards(newState.drawPile, 4);
      newState.playerHands = { ...newState.playerHands };
      newState.playerHands[targetId] = [
        ...(newState.playerHands[targetId] || []),
        ...newCards,
      ];
      newState.drawPile = remainingPile;

      newState.currentPlayerIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount,
        1
      );
      newState.currentColor = chosenColor || 'red';
      newState.lastAction = {
        type: 'drawFourPlayed',
        playerId,
        card,
        targetPlayerId: targetId,
        timestamp: Date.now(),
      };
      break;
    }

    case 'Wild': {
      newState.currentColor = chosenColor || 'red';
      newState.currentPlayerIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount
      );
      newState.lastAction = {
        type: 'wildPlayed',
        playerId,
        card,
        timestamp: Date.now(),
      };
      break;
    }

    default: {
      newState.currentPlayerIndex = getNextPlayerIndex(
        newState.currentPlayerIndex,
        newState.direction,
        playerCount
      );
      newState.currentColor = card.color as 'red' | 'yellow' | 'blue' | 'green';
      newState.lastAction = {
        type: 'cardPlayed',
        playerId,
        card,
        timestamp: Date.now(),
      };
      break;
    }
  }

  return newState;
};

// ─── Scoring ───────────────────────────────────────────────────────────────────

export const getCardPoints = (card: Card): number => {
  const num = parseInt(card.value);
  if (!isNaN(num)) return num;
  if (card.value === 'Skip' || card.value === 'Reverse' || card.value === 'DrawTwo')
    return 20;
  if (card.value === 'Wild' || card.value === 'DrawFour') return 50;
  return 0;
};

export const calculateWinnerPoints = (state: GameState, winnerId: string): number => {
  let total = 0;
  for (const [uid, hand] of Object.entries(state.playerHands)) {
    if (uid !== winnerId) {
      total += hand.reduce((sum, card) => sum + getCardPoints(card), 0);
    }
  }
  return total;
};

export const initializeGameRoom = (
  roomId: string,
  createdBy: string,
  gameType: 'oneVsOne' | 'room' = 'room'
): GameRoom => {
  return {
    roomId,
    createdBy,
    players: {},
    playerOrder: [],
    gameType,
    status: 'waiting',
    createdAt: new Date(),
    gameCode: generateGameCode(),
    maxPlayers: gameType === 'oneVsOne' ? 2 : 10,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
};