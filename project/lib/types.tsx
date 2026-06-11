// ─── Player Types ───────────────────────────────────────────────────────────────

export interface Player {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Date;
}

export interface PlayerStats {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  cardsPlayed: number;
  unosCalled: number;
  currentStreak: number;
  longestWinStreak: number;
  lastPlayedAt?: Date;
  joinedAt: Date;
}

// ─── Card Types ─────────────────────────────────────────────────────────────────

export type CardColor = 'red' | 'yellow' | 'blue' | 'green' | 'wild';

export interface Card {
  id: string;
  color: CardColor;
  value: string;
  /** When a wild card is played, this stores the chosen color */
  chosenColor?: 'red' | 'yellow' | 'blue' | 'green';
}

// ─── Game Room Types ────────────────────────────────────────────────────────────

export interface GameRoom {
  roomId: string;
  createdBy: string;
  /** Dynamic players map: key is the player UID */
  players: Record<string, Player>;
  /** Ordered list of player UIDs for turn order */
  playerOrder: string[];
  gameType: 'oneVsOne' | 'room';
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  gameCode: string;
  maxPlayers: number;
  expiresAt?: Date;
}

// ─── Game State & Action Types ──────────────────────────────────────────────────

export type GameAction =
  | 'cardPlayed'
  | 'cardDrawn'
  | 'skipPlayed'
  | 'reversePlayed'
  | 'drawTwoPlayed'
  | 'drawFourPlayed'
  | 'wildPlayed'
  | 'unoCalled'
  | 'unoFailed'
  | 'gameStarted'
  | 'gameWon';

export interface LastAction {
  type: GameAction;
  playerId: string;
  card?: Card;
  targetPlayerId?: string;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  /** Dynamic player hands: key is player UID, value is their hand */
  playerHands: Record<string, Card[]>;
  /** Ordered list of player UIDs for turn rotation */
  playerOrder: string[];
  /** Index into playerOrder for the current turn */
  currentPlayerIndex: number;
  /** 1 = clockwise, -1 = counterclockwise */
  direction: 1 | -1;
  /** Discard pile (top card is the last element) */
  discardPile: Card[];
  /** Remaining cards in draw pile */
  drawPile: Card[];
  /** Pending draw count from stacked +2/+4 */
  pendingDraw: number;
  /** Current active color (changes when wild is played) */
  currentColor: 'red' | 'yellow' | 'blue' | 'green';
  /** Players who have called UNO (when they have 1 card left) */
  unoCalledBy: string[];
  /** Last action for animation triggers */
  lastAction?: LastAction;
  /** Winner's UID (set when game is finished) */
  winner?: string;
  /** Game status */
  status: 'playing' | 'finished';
}

// ─── Toast Types ────────────────────────────────────────────────────────────────

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// ─── Helper Type Guard Functions ────────────────────────────────────────────────

/** Type guard to check if a value is a valid card color */
export const isValidCardColor = (color: any): color is 'red' | 'yellow' | 'blue' | 'green' => {
  return ['red', 'yellow', 'blue', 'green'].includes(color);
};

/** Type guard to check if a value is a valid direction */
export const isValidDirection = (direction: any): direction is 1 | -1 => {
  return direction === 1 || direction === -1;
};