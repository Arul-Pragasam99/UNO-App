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
  const [isStarting, setIsStarting] = useState(false);
  const [expiryTimeLeft, setExpiryTimeLeft] = useState<number | null>(null);
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
          if (roomData.gameType === 'oneVsOne' && roomData.playerOrder.length >= 2) {
            setLoadingMessage('Initializing game...');
            const newGameState = initializeGameState(roomId, roomData.playerOrder);
            await setDoc(gameStateRef, newGameState);

            if (isMounted) {
              setGameState(newGameState);
              setGameInitialized(true);
            }

            await updateDoc(roomRef, { status: 'playing' });
          } else if (roomData.gameType === 'room' && roomData.status === 'playing') {
            setLoadingMessage('Starting game...');
            const newGameState = initializeGameState(roomId, roomData.playerOrder);
            await setDoc(gameStateRef, newGameState);

            if (isMounted) {
              setGameState(newGameState);
              setGameInitialized(true);
            }
          } else {
            setLoadingMessage(roomData.gameType === 'room' ? 'Waiting for host to start...' : 'Waiting for players to join...');
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
    if (!room?.expiresAt) {
      setExpiryTimeLeft(null);
      return;
    }
    
    const updateExpiry = () => {
      try {
        const now = new Date();
        let expiryDate: Date;
        
        if (room.expiresAt instanceof Date) {
          expiryDate = room.expiresAt;
        } else if (typeof room.expiresAt === 'string') {
          expiryDate = new Date(room.expiresAt);
        } else if (room.expiresAt && typeof room.expiresAt === 'object' && 'toDate' in room.expiresAt) {
          expiryDate = (room.expiresAt as any).toDate();
        } else {
          expiryDate = new Date(room.expiresAt as any);
        }
        
        const diff = Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000));
        setExpiryTimeLeft(diff);
      } catch (e) {
        console.error('Error calculating expiry time:', e);
        setExpiryTimeLeft(null);
      }
    };
    
    updateExpiry();
    const interval = setInterval(updateExpiry, 1000);
    return () => clearInterval(interval);
  }, [room?.expiresAt]);

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

  useEffect(() => {
    if (!roomId) return;

    const roomRef = doc(db, 'gameRooms', roomId);
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const roomData = snapshot.data() as GameRoom;
          setRoom(roomData);

          if (roomData.status === 'playing' && !gameInitialized && !gameState) {
            const initGameState = async () => {
              try {
                const gameStateRef = doc(db, 'gameStates', roomId);
                const gameStateSnap = await getDoc(gameStateRef);
                
                if (!gameStateSnap.exists()) {
                  const newGameState = initializeGameState(roomId, roomData.playerOrder);
                  await setDoc(gameStateRef, newGameState);
                  setGameState(newGameState);
                  setGameInitialized(true);
                }
              } catch (err) {
                console.error('Error initializing game from room update:', err);
              }
            };
            initGameState();
          }
        }
      },
      (err) => {
        console.error('Error listening to room updates:', err);
      }
    );

    return () => unsubscribe();
  }, [roomId, gameInitialized, gameState]);

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
      setSelectedCardId(null);
      return;
    }

    const currentPlayerId = getCurrentPlayerId(gameState);

    if (user.uid !== currentPlayerId) {
      setError('It is not your turn');
      vibrateError();
      setSelectedCardId(null);
      return;
    }

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      setError('This card cannot be played!');
      vibrateError();
      setSelectedCardId(null);
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
        setSelectedCardId(null);
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
      setSelectedCardId(null);
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

  const startGame = async () => {
    if (!room || !user || room.createdBy !== user.uid) {
      showToast('Only the host can start the game!', 'error', 2000);
      return;
    }

    if (room.status === 'playing') {
      showToast('Game has already started!', 'warning', 2000);
      return;
    }

    if (room.playerOrder.length < 2) {
      showToast('Need at least 2 players to start!', 'warning', 2000);
      return;
    }

    if (isStarting) return;
    setIsStarting(true);

    try {
      setLoadingMessage('Starting game...');
      
      const roomRef = doc(db, 'gameRooms', roomId);
      await updateDoc(roomRef, { status: 'playing' });
      
      showToast('Game started! Good luck! 🎮', 'success', 2000);
      
    } catch (err) {
      console.error('Error starting game:', err);
      showToast('Failed to start game. Please try again.', 'error', 3000);
    } finally {
      setIsStarting(false);
    }
  };

  // ========== LOADING SCREEN ==========
  if (authLoading || !gameInitialized || !room || !gameState) {
    const isHost = room?.createdBy === user?.uid;
    const isRoomGame = room?.gameType === 'room';
    const playerCount = room?.playerOrder?.length || 0;
    const canStart = isHost && isRoomGame && playerCount >= 2 && room?.status !== 'playing' && expiryTimeLeft !== 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative">
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
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 mb-4">
              <p className="text-gray-500 text-xs text-center mb-1">Game Code</p>
              <div 
                className="flex items-center justify-center cursor-pointer select-none"
                onClick={() => {
                  navigator.clipboard.writeText(room.gameCode);
                  showToast('Game code copied! 📋', 'success', 1500);
                }}
              >
                <div className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-xl px-4 py-2 transition-colors">
                  <p className="text-2xl sm:text-3xl font-mono font-bold text-gray-800 tracking-widest">
                    {room.gameCode}
                  </p>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center mt-2">
                {isRoomGame ? (
                  `👥 ${playerCount} / ${room.maxPlayers} players joined`
                ) : (
                  playerCount < 2 ? 
                    `Need ${2 - playerCount} more player${2 - playerCount !== 1 ? 's' : ''}` :
                    `Game ready! (${playerCount}/2)`
                )}
              </p>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-400 text-[10px]">Room auto-closes in:</span>
                  <span className={`text-xs font-mono font-bold ${expiryTimeLeft !== null && expiryTimeLeft <= 30 ? 'text-red-500 animate-pulse' : 'text-gray-600'}`}>
                    {expiryTimeLeft !== null ? (
                      `${Math.floor(expiryTimeLeft / 60)}:${(expiryTimeLeft % 60).toString().padStart(2, '0')}`
                    ) : (
                      '--:--'
                    )}
                  </span>
                  {expiryTimeLeft !== null && expiryTimeLeft <= 30 && (
                    <span className="text-[10px] text-red-500 font-medium animate-pulse">⚠️</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-1">
                  Room will be deleted when timer reaches 0
                </p>
              </div>
            </div>
          )}

          {room && (
            <div className="bg-white border border-gray-100 rounded-xl p-3 sm:p-4 mb-4">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {room.playerOrder.map((playerId) => {
                  const player = room.players[playerId];
                  return (
                    <div key={playerId} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {player?.photoURL ? (
                          <img src={player.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] sm:text-xs font-bold text-gray-600">
                            {player?.name?.charAt(0) || '?'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-700 truncate max-w-[50px] sm:max-w-[60px]">
                        {player?.name?.split(' ')[0] || 'Player'}
                      </span>
                      {playerId === room.createdBy && (
                        <span className="text-[8px] sm:text-[10px] text-gray-400 ml-0.5">👑</span>
                      )}
                    </div>
                  );
                })}
                {Array.from({ length: Math.max(0, (room?.maxPlayers || 0) - (room?.playerOrder?.length || 0)) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 opacity-50">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-dashed border-gray-300 flex-shrink-0" />
                    <span className="text-[10px] sm:text-xs text-gray-400">Waiting</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {room && isRoomGame && isHost && room.status === 'waiting' && (
            <div className="mt-4">
              <button
                onClick={startGame}
                disabled={!canStart || isStarting || (expiryTimeLeft !== null && expiryTimeLeft === 0)}
                className={`
                  w-full py-3 px-6 rounded-xl font-bold text-white text-sm sm:text-base transition-all duration-200
                  ${canStart && !isStarting && expiryTimeLeft !== 0
                    ? 'bg-green-600 hover:bg-green-700 transform hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-gray-400 cursor-not-allowed'}
                `}
              >
                {isStarting ? (
                  'Starting...'
                ) : expiryTimeLeft === 0 ? (
                  'Room Expired'
                ) : canStart ? (
                  `🚀 Start Game (${playerCount} players)`
                ) : (
                  `Need ${2 - playerCount} more player${2 - playerCount !== 1 ? 's' : ''} to start`
                )}
              </button>
              {canStart && !isStarting && expiryTimeLeft !== 0 && (
                <p className="text-gray-400 text-xs text-center mt-2">
                  👑 As host, you control when the game begins
                </p>
              )}
              {!canStart && playerCount >= 2 && room.createdBy !== user?.uid && expiryTimeLeft !== 0 && (
                <p className="text-gray-400 text-xs text-center mt-2">
                  ⏳ Waiting for host to start the game...
                </p>
              )}
              {expiryTimeLeft === 0 && (
                <p className="text-red-500 text-xs text-center mt-2">
                  ⚠️ Room has expired and will be deleted
                </p>
              )}
            </div>
          )}

          {room && !isRoomGame && room.status === 'waiting' && (
            <p className="text-gray-400 text-xs text-center mt-4">
              {playerCount < 2 ? 
                `⏳ Waiting for ${2 - playerCount} more player${2 - playerCount !== 1 ? 's' : ''} to join...` :
                '🎮 Game will start automatically when both players are ready!'
              }
            </p>
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

  // ========== MOBILE-FIRST GAME UI ==========
  const currentPlayerId = getCurrentPlayerId(gameState);
  const isCurrentPlayer = user?.uid === currentPlayerId;
  const playerHand = getPlayerHand(gameState, user!.uid);
  const otherPlayerIds = gameState.playerOrder.filter((id) => id !== user?.uid);
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <ColorPicker isOpen={showColorPicker} onColorSelect={handleColorSelect} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-3 py-2 flex items-center justify-between flex-shrink-0 safe-top">
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
          <span className="font-mono font-bold text-gray-800 text-sm">{room.gameCode}</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Section: Opponents & Game Board */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          
          {/* Opponents - Horizontal Scroll on Mobile */}
          {otherPlayerIds.length > 0 && (
            <div className="mb-3">
              <p className="text-gray-500 text-[10px] font-medium mb-2 text-center">
                {otherPlayerIds.length === 1 ? 'Opponent' : `Players (${otherPlayerIds.length})`}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {otherPlayerIds.map((id) => {
                  const p = room.players[id];
                  const handCount = getPlayerHand(gameState, id).length;
                  const isTheirTurn = currentPlayerId === id;
                  const initial = p?.name?.charAt(0)?.toUpperCase() || '?';

                  return (
                    <div
                      key={id}
                      className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-all min-w-[80px] ${
                        isTheirTurn ? 'border-gray-400 bg-gray-50 ring-1 ring-gray-300' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p?.photoURL ? (
                          <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-600 font-bold text-xs">{initial}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-800 font-semibold text-xs truncate">
                          {p?.name?.split(' ')[0] || 'Player'}
                          {id === room.createdBy && <span className="text-gray-400 text-[10px] ml-0.5">👑</span>}
                        </p>
                        <p className="text-gray-400 text-[10px]">🃏 {handCount}</p>
                      </div>
                      {isTheirTurn && (
                        <span className="text-[8px] bg-gray-700 text-white px-1.5 py-0.5 rounded-full animate-pulse flex-shrink-0">
                          Turn
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Game Board */}
          <div className="flex justify-center py-2">
            <GameBoard
              topCard={topCard}
              drawPileSize={gameState.drawPile.length}
              currentColor={gameState.currentColor}
              direction={gameState.direction}
              onDrawCard={drawCard}
              isMyTurn={isCurrentPlayer && gameState.status !== 'finished' && !isMoveInFlight}
            />
          </div>

          {/* Your Info */}
          <div className="mt-3 flex items-center justify-center gap-4 bg-white rounded-2xl p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                {playerData?.photoURL ? (
                  <img src={playerData.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-600 font-bold text-sm">
                    {playerData?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="text-gray-800 font-semibold text-xs truncate max-w-[80px]">{playerData?.name}</p>
                <p className="text-gray-400 text-[10px]">🃏 {playerHand.length} cards</p>
              </div>
            </div>
            {isCurrentPlayer && gameState.status !== 'finished' && (
              <span className="text-green-600 font-bold text-xs animate-pulse">Your Turn</span>
            )}
            {gameState.status === 'finished' && gameState.winner === user?.uid && (
              <span className="text-yellow-600 font-bold text-sm">🎉 WINNER!</span>
            )}
          </div>

          {/* Draw Button */}
          <div className="mt-3">
            <button
              onClick={drawCard}
              disabled={!isCurrentPlayer || gameState.status === 'finished' || isMoveInFlight}
              className="w-full py-3 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm min-h-[48px]"
            >
              🎴 Draw Card
            </button>
          </div>
        </div>

        {/* Player Hand - Bottom */}
        <div className="flex-shrink-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-2 pb-2 safe-bottom border-t border-gray-200">
          <PlayerHand
            cards={playerHand}
            onCardClick={playCard}
            isMyTurn={isCurrentPlayer && gameState.status !== 'finished' && !isMoveInFlight}
            topCard={topCard}
            currentColor={gameState.currentColor}
          />
        </div>
      </div>

      {error && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto bg-red-500 text-white p-3 rounded-xl text-sm z-50 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}