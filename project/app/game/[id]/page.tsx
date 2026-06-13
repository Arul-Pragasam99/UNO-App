'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { GameRoom, Card, GameState } from '@/lib/types';
import {
  initializeGameState,
  canPlayCard,
  drawCardsWithReshuffle,
  getCurrentPlayerId,
  getPlayerHand,
  getPlayableCards,
  applyCardEffect,
  calculateWinnerPoints,
} from '@/lib/gameLogic';
import { updateGameResult } from '@/lib/statsService';
import GameBoard from '@/components/GameBoard';
import PlayerHand from '@/components/PlayerHand';
import ColorPicker from '@/components/ColorPicker';
import { vibrateCardPlay, vibrateError, vibrateDrawTwo, vibrateDrawFour, vibrateWin } from '@/lib/haptics';
import { useToast } from '@/lib/toastContext';
import {
  animateCardPlay,
  animateCardDraw,
  animateDrawPenalty,
  animateSkipTurn,
  animateReverse,
  animateWinCelebration,
} from '@/lib/animations';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const { user, playerData, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading game...');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<Card | null>(null);

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

        const gameStateRef = doc(db, 'gameStates', roomId);
        const gameStateSnap = await getDoc(gameStateRef);

        if (!gameStateSnap.exists()) {
          if (roomData.playerOrder.length >= 2) {
            setLoadingMessage('Initializing game...');
            const newGameState = initializeGameState(roomId, roomData.playerOrder);
            await setDoc(gameStateRef, newGameState);

            if (isMounted) {
              setGameState(newGameState);
              setGameInitialized(true);
            }

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
          const newState = snapshot.data() as GameState;
          setGameState(newState);
          
          // Check for winner
          if (newState.status === 'finished' && newState.winner === user?.uid) {
            animateWinCelebration();
            vibrateWin();
            showToast('🎉 You won the game! 🎉', 'success', 5000);
          }
        }
      },
      (err) => {
        console.error('Error listening to game state:', err);
      }
    );

    return () => unsubscribe();
  }, [roomId, gameInitialized, user?.uid, showToast]);

  // Handle color selection for wild cards
  const handleColorSelect = async (color: 'red' | 'yellow' | 'blue' | 'green') => {
    if (!pendingWildCard || !gameState || !user) return;
    
    setShowColorPicker(false);
    
    try {
      let newGameState = { ...gameState };
      
      // Remove card from hand
      newGameState.playerHands = { ...newGameState.playerHands };
      newGameState.playerHands[user.uid] = newGameState.playerHands[user.uid].filter(
        (c) => c.id !== pendingWildCard.id
      );
      
      // Add to discard pile
      newGameState.discardPile = [...newGameState.discardPile, pendingWildCard];
      
      // Apply card effect with chosen color
      newGameState = applyCardEffect(newGameState, pendingWildCard, user.uid, color);
      
      // Check for winner
      if (newGameState.playerHands[user.uid].length === 0) {
        newGameState.status = 'finished';
        newGameState.winner = user.uid;
        
        // Update stats
        const points = calculateWinnerPoints(newGameState, user.uid);
        await updateGameResult(user.uid, true, points, gameState.playerHands[user.uid].length);
        
        // Update loser stats
        for (const playerId of newGameState.playerOrder) {
          if (playerId !== user.uid) {
            await updateGameResult(playerId, false, 0, 0);
          }
        }
      }
      
      // Update Firestore
      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, {
        playerHands: newGameState.playerHands,
        discardPile: newGameState.discardPile,
        currentPlayerIndex: newGameState.currentPlayerIndex,
        currentColor: newGameState.currentColor,
        direction: newGameState.direction,
        status: newGameState.status,
        winner: newGameState.winner,
        lastAction: newGameState.lastAction,
      });
      
      setPendingWildCard(null);
      setError(null);
    } catch (err) {
      console.error('Error playing wild card:', err);
      setError('Failed to play card');
    }
  };

  const playCard = async (card: Card) => {
    if (!gameState || !user || !room) return;

    if (gameState.status === 'finished') {
      setError('Game is already finished');
      return;
    }

    const currentPlayerId = getCurrentPlayerId(gameState);

    if (user.uid !== currentPlayerId) {
      setError('It is not your turn');
      vibrateError();
      return;
    }

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      setError('This card cannot be played!');
      vibrateError();
      return;
    }

    // Handle wild cards - need color selection
    if (card.value === 'Wild' || card.value === 'DrawFour') {
      setPendingWildCard(card);
      setShowColorPicker(true);
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
      
      // Apply card effect
      newGameState = applyCardEffect(newGameState, card, user.uid);
      
      // Check for winner
      if (newGameState.playerHands[user.uid].length === 0) {
        newGameState.status = 'finished';
        newGameState.winner = user.uid;
        
        const points = calculateWinnerPoints(newGameState, user.uid);
        await updateGameResult(user.uid, true, points, gameState.playerHands[user.uid].length);
        
        for (const playerId of newGameState.playerOrder) {
          if (playerId !== user.uid) {
            await updateGameResult(playerId, false, 0, 0);
          }
        }
        
        animateWinCelebration();
        vibrateWin();
        showToast('🎉 You won! 🎉', 'success', 5000);
      }
      
      // Update Firestore
      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, {
        playerHands: newGameState.playerHands,
        discardPile: newGameState.discardPile,
        currentPlayerIndex: newGameState.currentPlayerIndex,
        currentColor: newGameState.currentColor,
        direction: newGameState.direction,
        status: newGameState.status,
        winner: newGameState.winner,
        lastAction: newGameState.lastAction,
      });
      
      // Trigger animations based on card type
      vibrateCardPlay();
      if (card.value === 'DrawTwo') {
        vibrateDrawTwo();
        animateDrawPenalty(2);
        showToast('Draw Two! Next player draws 2 cards', 'warning', 2000);
      } else if (card.value === 'DrawFour') {
        vibrateDrawFour();
        animateDrawPenalty(4);
        showToast('Wild Draw Four! Next player draws 4 cards', 'warning', 2000);
      } else if (card.value === 'Skip') {
        animateSkipTurn();
        showToast('Skip! Next player is skipped', 'info', 1500);
      } else if (card.value === 'Reverse') {
        animateReverse();
        showToast('Reverse! Direction changed', 'info', 1500);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error playing card:', err);
      setError('Failed to play card');
    }
  };

  const drawCard = async () => {
    if (!gameState || !user) return;

    if (gameState.status === 'finished') {
      setError('Game is already finished');
      return;
    }

    const currentPlayerId = getCurrentPlayerId(gameState);

    if (user.uid !== currentPlayerId) {
      setError('It is not your turn');
      vibrateError();
      return;
    }

    try {
      const { newState, drawnCards } = drawCardsWithReshuffle(gameState, 1);

      if (drawnCards.length === 0) {
        setError('No cards left to draw!');
        return;
      }

      let newGameState = { ...newState };
      
      // Add drawn cards to player's hand
      newGameState.playerHands = { ...newGameState.playerHands };
      newGameState.playerHands[user.uid] = [
        ...newGameState.playerHands[user.uid],
        ...drawnCards,
      ];
      
      // Move to next player
      newGameState.currentPlayerIndex = (newGameState.currentPlayerIndex + 1) % newGameState.playerOrder.length;
      
      // Update Firestore
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="absolute top-4 left-4 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg backdrop-blur transition-colors"
        >
          ← Back to Dashboard
        </button>
        <div className="text-center">
          <div className="animate-spin mb-4">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"></div>
          </div>
          <h2 className="text-2xl font-bold text-white">{loadingMessage}</h2>
          {room && (
            <div className="mt-4 bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-white/70 text-sm">Game Code</p>
              <p className="text-white font-mono font-bold text-2xl">{room.gameCode}</p>
            </div>
          )}
          {error && (
            <div className="mt-4">
              <p className="text-red-300">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-white/20 rounded-lg text-white"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentPlayerId = getCurrentPlayerId(gameState);
  const isCurrentPlayer = user?.uid === currentPlayerId;
  const playerHand = getPlayerHand(gameState, user!.uid);
  const opponentId = gameState.playerOrder.find((id) => id !== user?.uid);
  const opponentPlayer = opponentId ? room.players[opponentId] : null;
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 p-4">
      {/* Color Picker Modal */}
      <ColorPicker
        isOpen={showColorPicker}
        onColorSelect={handleColorSelect}
      />

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
        <div className="w-20" />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-100px)]">
        {/* Opponent Info */}
        <div className="lg:col-span-1 bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
          <div className="text-center mb-4">
            <p className="text-white/70 text-sm">Opponent</p>
            <p className="text-white font-bold">{opponentPlayer?.name || 'Waiting...'}</p>
          </div>
          <div className="bg-black/30 rounded-lg p-4 text-center">
            <p className="text-white/70 text-sm mb-2">Cards in Hand</p>
            <p className="text-2xl font-bold text-white">{opponentId ? getPlayerHand(gameState, opponentId).length : 0}</p>
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
            isMyTurn={isCurrentPlayer && gameState.status !== 'finished'}
          />

          <div className="flex gap-4 w-full">
            <button
              onClick={drawCard}
              disabled={!isCurrentPlayer || gameState.status === 'finished'}
              className="flex-1 px-4 py-3 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg backdrop-blur transition-colors"
            >
              🎴 Draw Card
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
          {isCurrentPlayer && gameState.status !== 'finished' && (
            <div className="mt-4 animate-pulse">
              <p className="text-green-300 text-center font-bold">Your Turn</p>
            </div>
          )}
          {gameState.status === 'finished' && gameState.winner === user?.uid && (
            <div className="mt-4">
              <p className="text-yellow-300 text-center font-bold">🎉 WINNER! 🎉</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto bg-red-500/90 text-white p-3 rounded-lg text-sm z-50">
          {error}
        </div>
      )}

      {/* Player Hand */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-4 pb-4">
        <PlayerHand
          cards={playerHand}
          onCardClick={playCard}
          isMyTurn={isCurrentPlayer && gameState.status !== 'finished'}
          topCard={topCard}
          currentColor={gameState.currentColor}
        />
      </div>
    </div>
  );
}