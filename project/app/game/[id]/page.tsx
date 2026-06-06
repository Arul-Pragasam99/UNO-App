'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import gsap from 'gsap';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { GameRoom, Card, GameState } from '@/lib/types';
import { generateUnoDeck, canPlayCard, drawCards } from '@/lib/gameLogic';
import GameCard from '@/components/GameCard';
import PlayerHand from '@/components/PlayerHand';
import GameBoard from '@/components/GameBoard';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const { user, playerData, loading } = useAuth();
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'player1' | 'player2'>('player1');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [gameLoading, setGameLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!roomId || !user) return;

    // Subscribe to room changes
    const roomRef = doc(db, 'gameRooms', roomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.data() as GameRoom;
        setRoom(roomData);

        // Initialize game if both players are present
        if (roomData.player2 && !gameState) {
          initializeGame(roomData);
        }
      }
    });

    return () => unsubscribeRoom();
  }, [roomId, user, gameState]);

  const initializeGame = async (roomData: GameRoom) => {
    try {
      const gameStateRef = doc(db, 'gameStates', roomId);
      const gameStateSnap = await getDoc(gameStateRef);

      if (!gameStateSnap.exists()) {
        // Create new game state
        const deck = generateUnoDeck();
        const player1Hand = deck.slice(0, 7);
        const player2Hand = deck.slice(7, 14);
        const remainingDeck = deck.slice(14);

        // Find first non-wild card for discard pile
        let discardCard = remainingDeck[0];
        let drawPile = remainingDeck.slice(1);

        const newGameState: GameState = {
          roomId,
          player1Id: roomData.player1.uid,
          player2Id: roomData.player2!.uid,
          currentTurn: roomData.player1.uid,
          player1Hand,
          player2Hand,
          discardPile: [discardCard],
          drawPile,
          status: 'playing',
        };

        await updateDoc(gameStateRef, newGameState);
        setGameState(newGameState);
        setGameLoading(false);
      } else {
        setGameState(gameStateSnap.data() as GameState);
        setGameLoading(false);
      }
    } catch (error) {
      console.error('Error initializing game:', error);
    }
  };

  const playCard = async (card: Card) => {
    if (!gameState || !user) return;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (!canPlayCard(card, topCard)) {
      alert('This card cannot be played!');
      return;
    }

    try {
      let newGameState = { ...gameState };
      const isPlayer1 = user.uid === gameState.player1Id;

      if (isPlayer1) {
        newGameState.player1Hand = newGameState.player1Hand.filter((c) => c.id !== card.id);
      } else {
        newGameState.player2Hand = newGameState.player2Hand.filter((c) => c.id !== card.id);
      }

      newGameState.discardPile.push(card);

      // Check for winner
      if (
        newGameState.player1Hand.length === 0 ||
        newGameState.player2Hand.length === 0
      ) {
        newGameState.status = 'finished';
        newGameState.winner = isPlayer1 ? gameState.player1Id : gameState.player2Id;
      }

      // Switch turn
      newGameState.currentTurn =
        newGameState.currentTurn === gameState.player1Id
          ? gameState.player2Id
          : gameState.player1Id;

      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, newGameState);
    } catch (error) {
      console.error('Error playing card:', error);
    }
  };

  const drawCard = async () => {
    if (!gameState || !user) return;

    try {
      let newGameState = { ...gameState };
      const isPlayer1 = user.uid === gameState.player1Id;

      let { newCards, remainingPile } = drawCards(newGameState.drawPile, 1);

      if (newCards.length === 0 && newGameState.discardPile.length > 1) {
        // Reshuffle discard pile into draw pile
        const shuffledDiscard = newGameState.discardPile.slice(0, -1);
        newGameState.drawPile = shuffledDiscard.reverse();
        ({ newCards, remainingPile } = drawCards(newGameState.drawPile, 1));
      }

      if (isPlayer1) {
        newGameState.player1Hand.push(...newCards);
      } else {
        newGameState.player2Hand.push(...newCards);
      }

      newGameState.drawPile = remainingPile;

      // Switch turn
      newGameState.currentTurn =
        newGameState.currentTurn === gameState.player1Id
          ? gameState.player2Id
          : gameState.player1Id;

      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, newGameState);
    } catch (error) {
      console.error('Error drawing card:', error);
    }
  };

  if (loading || gameLoading || !room || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-800">
        <div className="animate-spin">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  const isCurrentPlayer =
    user?.uid === gameState.currentTurn;
  const isPlayer1 = user?.uid === gameState.player1Id;
  const playerHand = isPlayer1 ? gameState.player1Hand : gameState.player2Hand;
  const opponentHand = isPlayer1 ? gameState.player2Hand : gameState.player1Hand;
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-4 flex justify-between items-center">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-display font-bold text-white">
          Game Code: {room.gameCode}
        </h1>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-100px)]">
        {/* Opponent */}
        <div className="lg:col-span-1 bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm">Opponent</p>
            <p className="text-white font-bold">
              {isPlayer1 ? room.player2?.name : room.player1.name}
            </p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center">
            <p className="text-white/70 text-sm mb-2">Cards in Hand</p>
            <p className="text-2xl font-bold text-white">{opponentHand.length}</p>
          </div>
          {gameState.currentTurn === (isPlayer1 ? gameState.player2Id : gameState.player1Id) && (
            <div className="mt-4 animate-pulse">
              <p className="text-yellow-300 text-center font-bold">Their Turn</p>
            </div>
          )}
        </div>

        {/* Game Board */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center gap-4">
          <GameBoard topCard={topCard} drawPileSize={gameState.drawPile.length} />

          <div className="flex gap-4 w-full">
            <button
              onClick={drawCard}
              disabled={!isCurrentPlayer}
              className="flex-1 px-4 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg backdrop-blur transition-colors"
            >
              🎴 Draw Card
            </button>
            <button
              onClick={() => {
                // Implement pass/uno logic
              }}
              disabled={!isCurrentPlayer}
              className="flex-1 px-4 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg backdrop-blur transition-colors"
            >
              Pass
            </button>
          </div>
        </div>

        {/* Player Stats */}
        <div className="lg:col-span-1 bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm">You</p>
            <p className="text-white font-bold">{playerData?.name}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center">
            <p className="text-white/70 text-sm mb-2">Cards in Hand</p>
            <p className="text-2xl font-bold text-white">{playerHand.length}</p>
          </div>
          {gameState.currentTurn === user?.uid && (
            <div className="mt-4 animate-pulse">
              <p className="text-green-300 text-center font-bold">Your Turn</p>
            </div>
          )}
        </div>
      </div>

      {/* Player Hand */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-4">
        <PlayerHand
          cards={playerHand}
          onCardClick={playCard}
          isMyTurn={isCurrentPlayer}
          topCard={topCard}
        />
      </div>
    </div>
  );
}
