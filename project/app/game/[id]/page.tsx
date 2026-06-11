'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { GameRoom, Card, GameState } from '@/lib/types';
import {
  initializeGameState,
  canPlayCard,
  drawCards,
  getCurrentPlayerId,
  getPlayerHand,
  getPlayableCards,
} from '@/lib/gameLogic';
import GameCard from '@/components/GameCard';
import PlayerHand from '@/components/PlayerHand';
import GameBoard from '@/components/GameBoard';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const { user, playerData, loading: authLoading } = useAuth();

  // State management
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading game...');

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Initialize game on mount
  useEffect(() => {
    if (!roomId || !user || authLoading) return;

    let isMounted = true;

    const initGame = async () => {
      try {
        setLoadingMessage('Loading game room...');

        // Get room data
        const roomRef = doc(db, 'gameRooms', roomId);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          setError('Game room not found');
          return;
        }

        const roomData = roomSnap.data() as GameRoom;
        if (isMounted) {
          setRoom(roomData);
        }

        // Check if game state exists
        const gameStateRef = doc(db, 'gameStates', roomId);
        const gameStateSnap = await getDoc(gameStateRef);

        if (!gameStateSnap.exists()) {
          // Create new game state if it doesn't exist
          if (roomData.playerOrder.length >= 2) {
            setLoadingMessage('Initializing game...');
            const newGameState = initializeGameState(roomId, roomData.playerOrder);
            await setDoc(gameStateRef, newGameState);

            if (isMounted) {
              setGameState(newGameState);
              setGameInitialized(true);
            }

            // Update room status
            await updateDoc(roomRef, { status: 'playing' });
          } else {
            setError('Waiting for other players to join...');
          }
        } else {
          if (isMounted) {
            setGameState(gameStateSnap.data() as GameState);
            setGameInitialized(true);
          }
        }
      } catch (err) {
        console.error('Error initializing game:', err);
        if (isMounted) {
          setError('Failed to load game. Please try again.');
        }
      }
    };

    initGame();

    return () => {
      isMounted = false;
    };
  }, [roomId, user, authLoading]);

  // Subscribe to game state updates
  useEffect(() => {
    if (!roomId || !gameInitialized) return;

    const gameStateRef = doc(db, 'gameStates', roomId);
    const unsubscribe = onSnapshot(
      gameStateRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setGameState(snapshot.data() as GameState);
        }
      },
      (err) => {
        console.error('Error listening to game state:', err);
      }
    );

    return () => unsubscribe();
  }, [roomId, gameInitialized]);

  const playCard = async (card: Card) => {
    if (!gameState || !user || !room) return;

    const currentPlayerId = getCurrentPlayerId(gameState);

    if (user.uid !== currentPlayerId) {
      setError('It is not your turn');
      return;
    }

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      setError('This card cannot be played!');
      return;
    }

    try {
      let newGameState = { ...gameState };

      // Remove card from hand
      newGameState.playerHands = { ...newGameState.playerHands };
      newGameState.playerHands[user.uid] = newGameState.playerHands[user.uid].filter(
        (c) => c.id !== card.id
      );

      // Add to discard pile
      newGameState.discardPile = [...newGameState.discardPile, card];

      // Move to next player
      newGameState.currentPlayerIndex =
        (newGameState.currentPlayerIndex + 1) % newGameState.playerOrder.length;
      newGameState.currentColor = card.color as 'red' | 'yellow' | 'blue' | 'green';

      // Check for winner
      if (newGameState.playerHands[user.uid].length === 0) {
        newGameState.status = 'finished';
        newGameState.winner = user.uid;
      }

      // Update Firestore
      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, {
        playerHands: newGameState.playerHands,
        discardPile: newGameState.discardPile,
        currentPlayerIndex: newGameState.currentPlayerIndex,
        currentColor: newGameState.currentColor,
        status: newGameState.status,
        winner: newGameState.winner,
      });

      setError(null);
    } catch (err) {
      console.error('Error playing card:', err);
      setError('Failed to play card');
    }
  };

  const drawCard = async () => {
    if (!gameState || !user) return;

    const currentPlayerId = getCurrentPlayerId(gameState);

    if (user.uid !== currentPlayerId) {
      setError('It is not your turn');
      return;
    }

    try {
      let newGameState = { ...gameState };

      const { newCards, remainingPile } = drawCards(newGameState.drawPile, 1);

      if (newCards.length === 0 && newGameState.discardPile.length > 1) {
        const shuffled = newGameState.discardPile.slice(0, -1).reverse();
        newGameState.drawPile = shuffled;
        const { newCards: drawnAgain, remainingPile: remaining } = drawCards(
          newGameState.drawPile,
          1
        );
        newGameState.drawPile = remaining;
        newGameState.playerHands[user.uid].push(...drawnAgain);
      } else {
        newGameState.playerHands[user.uid].push(...newCards);
        newGameState.drawPile = remainingPile;
      }

      newGameState.currentPlayerIndex =
        (newGameState.currentPlayerIndex + 1) % newGameState.playerOrder.length;

      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, {
        playerHands: newGameState.playerHands,
        drawPile: newGameState.drawPile,
        currentPlayerIndex: newGameState.currentPlayerIndex,
      });

      setError(null);
    } catch (err) {
      console.error('Error drawing card:', err);
      setError('Failed to draw card');
    }
  };

  // Loading screen
  if (authLoading || !gameInitialized || !room || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-red-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 text-center max-w-md">
          {/* UNO Card Loading Animation */}
          <div className="mb-8 flex justify-center">
            <div className="relative w-24 h-36">
              {/* Animated cards */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg animate-pulse"
                style={{
                  animation: 'float 3s ease-in-out infinite',
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">U</span>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg translate-x-2 translate-y-2 opacity-60 animate-pulse"
                style={{
                  animation: 'float 3s ease-in-out infinite 0.1s',
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">N</span>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg translate-x-4 translate-y-4 opacity-30 animate-pulse"
                style={{
                  animation: 'float 3s ease-in-out infinite 0.2s',
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">O</span>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Title */}
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-3">
            {loadingMessage}
          </h2>

          {/* Loading Bar */}
          <div className="mb-6">
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur">
              <div className="h-full bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-full animate-pulse"
                style={{
                  width: '45%',
                  animation: 'loading 2s ease-in-out infinite',
                }}
              />
            </div>
          </div>

          {/* Room Info */}
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20 mb-6">
            <p className="text-white/70 text-sm mb-1">Game Room</p>
            <p className="text-white font-mono font-bold text-lg">{roomId?.slice(0, 12)}...</p>
          </div>

          {/* Status Messages */}
          <p className="text-white/80 text-base font-medium mb-2">
            {error ? '⚠️ ' : '✓ '}
            {error || 'Preparing game...'}
          </p>

          {/* Tip */}
          {!error && (
            <p className="text-white/60 text-xs mt-4 italic">
              Making sure everything is ready for an amazing game
            </p>
          )}

          {/* Error Retry Button */}
          {error && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur"
            >
              Retry
            </button>
          )}
        </div>

        <style jsx>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }

          @keyframes loading {
            0% { width: 10%; }
            50% { width: 80%; }
            100% { width: 10%; }
          }

          .animate-blob {
            animation: blob 7s infinite;
          }

          .animation-delay-2000 {
            animation-delay: 2s;
          }

          .animation-delay-4000 {
            animation-delay: 4s;
          }
        `}</style>
      </div>
    );
  }

  // Get player info
  const currentPlayerId = getCurrentPlayerId(gameState);
  const isCurrentPlayer = user?.uid === currentPlayerId;
  const playerHand = getPlayerHand(gameState, user!.uid);
  const opponentId = gameState.playerOrder.find((id) => id !== user?.uid);
  const opponentHand = opponentId ? getPlayerHand(gameState, opponentId) : [];
  const opponentPlayer = room.players[opponentId || ''];
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
        {/* Opponent Info */}
        <div className="lg:col-span-1 bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm">Opponent</p>
            <p className="text-white font-bold">{opponentPlayer?.name || 'Loading...'}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center">
            <p className="text-white/70 text-sm mb-2">Cards in Hand</p>
            <p className="text-2xl font-bold text-white">{opponentHand.length}</p>
          </div>
          {currentPlayerId === opponentId && (
            <div className="mt-4 animate-pulse">
              <p className="text-yellow-300 text-center font-bold">Their Turn</p>
            </div>
          )}
        </div>

        {/* Game Board */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center gap-4">
          <GameBoard
            topCard={topCard}
            drawPileSize={gameState.drawPile.length}
            currentColor={gameState.currentColor}
            direction={gameState.direction}
            onDrawCard={drawCard}
            isMyTurn={isCurrentPlayer}
          />

          <div className="flex gap-4 w-full">
            <button
              onClick={drawCard}
              disabled={!isCurrentPlayer}
              className="flex-1 px-4 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg backdrop-blur transition-colors"
            >
              🎴 Draw Card
            </button>
            <button
              disabled={!isCurrentPlayer}
              className="flex-1 px-4 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg backdrop-blur transition-colors"
            >
              Pass
            </button>
          </div>
        </div>

        {/* Player Info */}
        <div className="lg:col-span-1 bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm">You</p>
            <p className="text-white font-bold">{playerData?.name}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center">
            <p className="text-white/70 text-sm mb-2">Cards in Hand</p>
            <p className="text-2xl font-bold text-white">{playerHand.length}</p>
          </div>
          {isCurrentPlayer && (
            <div className="mt-4 animate-pulse">
              <p className="text-green-300 text-center font-bold">Your Turn</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto bg-red-500/90 text-white p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Player Hand */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-4">
        <PlayerHand
          cards={playerHand}
          onCardClick={playCard}
          isMyTurn={isCurrentPlayer}
          topCard={topCard}
          currentColor={gameState.currentColor}
        />
      </div>
    </div>
  );
}