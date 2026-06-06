export interface Player {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Date;
}

export interface PlayerStats {
  uid: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPoints: number;
  lastPlayedAt?: Date;
  joinedAt: Date;
}

export interface Card {
  id: string;
  color: 'red' | 'yellow' | 'blue' | 'green' | 'wild';
  value: string;
}

export interface GameRoom {
  roomId: string;
  createdBy: string;
  player1: Player;
  player2?: Player;
  gameType: 'oneVsOne' | 'room';
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  gameCode: string;
  maxPlayers: number;
}

export interface GameState {
  roomId: string;
  player1Id: string;
  player2Id: string;
  currentTurn: string;
  player1Hand: Card[];
  player2Hand: Card[];
  discardPile: Card[];
  drawPile: Card[];
  winner?: string;
  status: 'playing' | 'finished';
}
