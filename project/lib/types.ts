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

export type CardColor = 'red' | 'yellow' | 'blue' | 'green' | 'wild';

export interface Card {
  id: string;
  color: CardColor;
  value: string;
  /** When a wild card is played, this stores the chosen color */
  chosenColor?: 'red' | 'yellow' | 'blue' | 'green';
}

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
  discardPile: Card[];
  drawPile: Card[];
  /** Pending draw count from stacked +2/+4 */
  pendingDraw: number;
  /** Current active color (changes when wild is played) */
  currentColor: 'red' | 'yellow' | 'blue' | 'green';
  /** Players who have called UNO (when they have 2 cards) */
  unoCalledBy: string[];
  /** Last action for animation triggers */
  lastAction?: LastAction;
  winner?: string;
  status: 'playing' | 'finished';
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}