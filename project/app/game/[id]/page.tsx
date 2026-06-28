'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
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
  getNextPlayerIndex,
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
  const [isMoveInFlight, setIsMoveInFlight] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const handContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

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
            setLoadingMessage('Waiting for players to join...');
            setError(null);
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

  useEffect(() => {
    if (!roomId || !gameInitialized) return;

    const gameStateRef = doc(db, 'gameStates', roomId);
    const unsubscribe = onSnapshot(
      gameStateRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const newState = snapshot.data() as GameState;
          setGameState(newState);

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

  const handleColorSelect = async (color: 'red' | 'yellow' | 'blue' | 'green') => {
    if (!pendingWildCard || !gameState || !user) return;
    if (isMoveInFlight) return;
    setIsMoveInFlight(true);

    setShowColorPicker(false);

    try {
      let newGameState = { ...gameState };

      newGameState.playerHands = { ...newGameState.playerHands };
      newGameState.playerHands[user.uid] = newGameState.playerHands[user.uid].filter(
        (c) => c.id !== pendingWildCard.id
      );

      newGameState.discardPile = [...newGameState.discardPile, pendingWildCard];

      newGameState = applyCardEffect(newGameState, pendingWildCard, user.uid, color);

      if (newGameState.playerHands[user.uid].length === 0) {
        newGameState.status = 'finished';
        newGameState.winner = user.uid;

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

        const points = calculateWinnerPoints(newGameState, user.uid);
        await updateGameResult(user.uid, true, points, gameState.playerHands[user.uid].length, 0, roomId);

        for (const playerId of newGameState.playerOrder) {
          if (playerId !== user.uid) {
            await updateGameResult(playerId, false, 0, 0, 0, roomId);
          }
        }

        animateWinCelebration();
        vibrateWin();
        showToast('🎉 You won! 🎉', 'success', 5000);

        setPendingWildCard(null);
        setError(null);
        return;
      }

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
    } finally {
      setIsMoveInFlight(false);
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

    if (card.value === 'Wild' || card.value === 'DrawFour') {
      setPendingWildCard(card);
      setShowColorPicker(true);
      return;
    }

    if (isMoveInFlight) return;
    setIsMoveInFlight(true);

    try {
      let newGameState = { ...gameState };

      newGameState.playerHands = { ...newGameState.playerHands };
      newGameState.playerHands[user.uid] = newGameState.playerHands[user.uid].filter(
        (c) => c.id !== card.id
      );

      newGameState.discardPile = [...newGameState.discardPile, card];

      newGameState = applyCardEffect(newGameState, card, user.uid);

      if (newGameState.playerHands[user.uid].length === 0) {
        newGameState.status = 'finished';
        newGameState.winner = user.uid;

        const gameStateRefEarly = doc(db, 'gameStates', roomId);
        await updateDoc(gameStateRefEarly, {
          playerHands: newGameState.playerHands,
          discardPile: newGameState.discardPile,
          currentPlayerIndex: newGameState.currentPlayerIndex,
          currentColor: newGameState.currentColor,
          direction: newGameState.direction,
          status: newGameState.status,
          winner: newGameState.winner,
          lastAction: newGameState.lastAction,
        });

        const points = calculateWinnerPoints(newGameState, user.uid);
        await updateGameResult(user.uid, true, points, gameState.playerHands[user.uid].length, 0, roomId);

        for (const playerId of newGameState.playerOrder) {
          if (playerId !== user.uid) {
            await updateGameResult(playerId, false, 0, 0, 0, roomId);
          }
        }

        animateWinCelebration();
        vibrateWin();
        showToast('🎉 You won! 🎉', 'success', 5000);

        setError(null);
        vibrateCardPlay();
        return;
      }

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

      setSelectedCardId(null);
      setError(null);
    } catch (err) {
      console.error('Error playing card:', err);
      setError('Failed to play card');
    } finally {
      setIsMoveInFlight(false);
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

    if (isMoveInFlight) return;
    setIsMoveInFlight(true);

    try {
      const { newState, drawnCards } = drawCardsWithReshuffle(gameState, 1);

      if (drawnCards.length === 0) {
        setError('No cards left to draw!');
        return;
      }

      let newGameState = { ...newState };

      newGameState.playerHands = { ...newGameState.playerHands };
      newGameState.playerHands[user.uid] = [
        ...newGameState.playerHands[user.uid],
        ...drawnCards,
      ];

      newGameState.currentPlayerIndex = getNextPlayerIndex(
        newGameState.currentPlayerIndex,
        newGameState.direction,
        newGameState.playerOrder.length
      );

      const gameStateRef = doc(db, 'gameStates', roomId);
      await updateDoc(gameStateRef, {
        playerHands: newGameState.playerHands,
        drawPile: newGameState.drawPile,
        currentPlayerIndex: newGameState.currentPlayerIndex,
      });

      setSelectedCardId(null);
      setError(null);
    } catch (err) {
      console.error('Error drawing card:', err);
      setError('Failed to draw card');
    } finally {
      setIsMoveInFlight(false);
    }
  };

  // ========== IMPROVED LOADING SCREEN ==========
  if (authLoading || !gameInitialized || !room || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="absolute top-4 left-4 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm transition-colors text-sm z-10"
        >
          ← Cancel
        </button>

        <div className="text-center max-w-sm w-full">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-28 sm:w-24 sm:h-36 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg flex items-center justify-center animate-bounce-card relative">
              <span className="text-4xl sm:text-5xl">🎮</span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-display font-bold text-gray-800 mb-2">
            {loadingMessage}
          </h2>

          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-gray-700 rounded-full animate-progress" style={{ width: '45%' }} />
          </div>

          {room && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
              <p className="text-gray-500 text-xs mb-1">Game Code</p>
              <div className="flex items-center justify-center gap-3">
                <p className="text-3xl sm:text-4xl font-mono font-bold text-gray-800 tracking-widest">
                  {room.gameCode}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(room.gameCode);
                    showToast('Copied!', 'success', 1500);
                  }}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {room.playerOrder.length < 2 ? (
                  `Need ${2 - room.playerOrder.length} more player${2 - room.playerOrder.length !== 1 ? 's' : ''}`
                ) : (
                  `Ready! (${room.playerOrder.length}/${room.maxPlayers})`
                )}
              </p>
            </div>
          )}

          {/* Players List */}
          {room && (
            <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {room.playerOrder.map((playerId) => {
                  const player = room.players[playerId];
                  return (
                    <div key={playerId} className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5">
                      <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                        {player?.photoURL ? (
                          <img src={player.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-gray-600">
                            {player?.name?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-700 truncate max-w-[60px]">
                        {player?.name?.split(' ')[0] || 'Player'}
                      </span>
                    </div>
                  );
                })}
                {Array.from({ length: Math.max(0, 2 - room.playerOrder.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-1.5 opacity-50">
                    <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300" />
                    <span className="text-xs text-gray-400">Waiting</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-xl transition-colors"
            >
              Retry
            </button>
          )}
        </div>

        <style jsx>{`
          @keyframes bounce-card {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-10px) scale(1.02); }
          }
          .animate-bounce-card { animation: bounce-card 1.5s ease-in-out infinite; }
          @keyframes progress {
            0% { width: 10%; }
            50% { width: 70%; }
            100% { width: 10%; }
          }
          .animate-progress { animation: progress 2.5s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  // ========== GAME UI ==========
  const currentPlayerId = getCurrentPlayerId(gameState);
  const isCurrentPlayer = user?.uid === currentPlayerId;
  const playerHand = getPlayerHand(gameState, user!.uid);
  const otherPlayerIds = gameState.playerOrder.filter((id) => id !== user?.uid);
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen bg-gray-100">
      <ColorPicker isOpen={showColorPicker} onColorSelect={handleColorSelect} />

      {/* Header - Compact */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-3 sm:px-4 py-2 flex items-center justify-between sticky top-0 z-10 safe-top">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs hidden sm:inline">Code:</span>
          <span className="font-mono font-bold text-gray-800 text-sm sm:text-base">{room.gameCode}</span>
        </div>
        <div className="w-8" />
      </div>

      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {/* Players List - Sidebar */}
          <div className="col-span-1 bg-white rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-sm overflow-y-auto max-h-[calc(100vh-200px)]">
            <p className="text-gray-500 text-xs font-medium mb-3 text-center">
              {otherPlayerIds.length === 1 ? 'Opponent' : `Players (${otherPlayerIds.length + 1})`}
            </p>
            <div className="space-y-2">
              {otherPlayerIds.map((id) => {
                const p = room.players[id];
                const handCount = getPlayerHand(gameState, id).length;
                const isTheirTurn = currentPlayerId === id;
                const initial = p?.name?.charAt(0)?.toUpperCase() || '?';

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-2 rounded-xl p-2 border transition-all ${
                      isTheirTurn ? 'border-gray-400 bg-gray-50 ring-1 ring-gray-300' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p?.photoURL ? (
                        <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-600 font-bold text-xs sm:text-sm">{initial}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 font-semibold text-xs sm:text-sm truncate">
                        {p?.name?.split(' ')[0] || 'Player'}
                      </p>
                      <p className="text-gray-400 text-[10px] sm:text-xs">🃏 {handCount}</p>
                    </div>
                    {isTheirTurn && (
                      <span className="text-[8px] sm:text-[10px] bg-gray-700 text-white px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0">
                        Turn
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Game Board */}
          <div className="col-span-2 flex flex-col items-center justify-center">
            <GameBoard
              topCard={topCard}
              drawPileSize={gameState.drawPile.length}
              currentColor={gameState.currentColor}
              direction={gameState.direction}
              onDrawCard={drawCard}
              isMyTurn={isCurrentPlayer && gameState.status !== 'finished' && !isMoveInFlight}
            />
          </div>

          {/* Player Info */}
          <div className="col-span-1 bg-white rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                  {playerData?.photoURL ? (
                    <img src={playerData.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-600 font-bold text-xl sm:text-2xl">
                      {playerData?.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-gray-500 text-[10px] sm:text-xs">You</p>
              <p className="text-gray-800 font-semibold text-xs sm:text-sm truncate">{playerData?.name}</p>
              <div className="mt-2 bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500 text-[10px] sm:text-xs">Cards</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{playerHand.length}</p>
              </div>
              {isCurrentPlayer && gameState.status !== 'finished' && (
                <p className="mt-2 text-green-600 font-bold text-xs sm:text-sm animate-pulse">Your Turn</p>
              )}
              {gameState.status === 'finished' && gameState.winner === user?.uid && (
                <p className="mt-2 text-yellow-600 font-bold text-sm">🎉 WINNER!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto bg-red-500 text-white p-3 rounded-xl text-sm z-50 shadow-lg">
          {error}
        </div>
      )}

      {/* Player Hand - Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-3 pb-3 sm:pb-4 safe-bottom border-t border-gray-200">
        <PlayerHand
          cards={playerHand}
          onCardClick={playCard}
          isMyTurn={isCurrentPlayer && gameState.status !== 'finished' && !isMoveInFlight}
          topCard={topCard}
          currentColor={gameState.currentColor}
        />
      </div>
    </div>
  );
}