'use client';

import { useEffect, useState, useCallback } from 'react';
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
  // FIXED: in-flight guard against double-tap / double-fire calling playCard,
  // handleColorSelect, or drawCard twice for the same move before the first
  // call's Firestore writes (and updateGameResult calls) have completed.
  // Without this, a fast double-tap on a winning move can double-write
  // stats for every player in the room even with the rules-side fixes in
  // place, since those only prevent UNAUTHORIZED writes, not duplicate
  // legitimate ones from the same authenticated client.
  const [isMoveInFlight, setIsMoveInFlight] = useState(false);

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
    // FIXED: bail out if a move is already being processed — prevents a
    // double-tap from queuing two color selections for the same wild card,
    // which would otherwise double-write gameStates and double-call
    // updateGameResult for every player when the move is a winning one.
    if (isMoveInFlight) return;
    setIsMoveInFlight(true);

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

        // IMPORTANT: write gameStates with status:'finished' to Firestore
        // BEFORE calling updateGameResult for the other players. The rule
        // that allows this client to write another player's stats doc
        // checks gameStates/{roomId}.status == 'finished' at write time —
        // if that hasn't landed yet, the rule still sees 'playing' and
        // denies the cross-player write. (Same fix already applied in
        // playCard — this brings handleColorSelect in line with it.)
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

        // Update winner stats
        const points = calculateWinnerPoints(newGameState, user.uid);
        await updateGameResult(user.uid, true, points, gameState.playerHands[user.uid].length, 0, roomId);

        // Update loser stats — gameStates is already 'finished' at this point,
        // so the cross-player write is permitted by the rule.
        for (const playerId of newGameState.playerOrder) {
          if (playerId !== user.uid) {
            await updateGameResult(playerId, false, 0, 0, 0, roomId);
          }
        }

        setPendingWildCard(null);
        setError(null);
        return;
      }

      // Non-winning move: update Firestore as normal
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

    // Handle wild cards - need color selection
    if (card.value === 'Wild' || card.value === 'DrawFour') {
      setPendingWildCard(card);
      setShowColorPicker(true);
      return;
    }

    // FIXED: bail out if a move is already being processed — prevents a
    // fast double-tap on the second confirm-tap (see PlayerHand.tsx) from
    // calling playCard twice for the same card before the first call's
    // Firestore writes and updateGameResult calls have completed.
    if (isMoveInFlight) return;
    setIsMoveInFlight(true);

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

        // IMPORTANT: write the finished game state to Firestore BEFORE
        // calling updateGameResult for other players. The Firestore rule
        // that allows this client to update another player's stats doc
        // checks gameStates/{roomId}.status == 'finished' — if that write
        // hasn't landed yet, the rule still sees 'playing' and denies it.
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
      
      // Update Firestore (non-winning move)
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

    // FIXED: same in-flight guard — a fast double-tap on the draw pile
    // shouldn't be able to draw two cards (and advance the turn twice)
    // before the first draw's Firestore write completes.
    if (isMoveInFlight) return;
    setIsMoveInFlight(true);

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
    } finally {
      setIsMoveInFlight(false);
    }
  };

  // ========== LOADING SCREEN WITH FIXED MESSAGE ==========
  if (authLoading || !gameInitialized || !room || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, #333 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Cancel Button - Top Left */}
        <button
          onClick={() => router.push('/dashboard')}
          className="absolute top-4 left-4 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm transition-all duration-200 flex items-center gap-2 text-sm font-medium z-20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Cancel
        </button>

        <div className="relative z-10 text-center max-w-md w-full">
          {/* Bouncing Card Animation with White Glow */}
          <div className="mb-8 flex justify-center">
            <div className="w-28 h-40 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl shadow-lg flex items-center justify-center animate-bounce-card relative">
              <div className="absolute inset-0 rounded-xl bg-white/20 blur-xl"></div>
              <span className="text-5xl relative z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]">🎮</span>
            </div>
          </div>

          {/* Loading Title */}
          <h2 className="text-2xl md:text-3xl font-display font-bold text-gray-800 mb-2">
            {loadingMessage}
          </h2>

          {/* Loading Progress Bar */}
          <div className="mb-6 max-w-xs mx-auto">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-700 rounded-full animate-progress"
                style={{ width: '45%' }}
              />
            </div>
          </div>

          {/* GAME CODE - Large and Shareable */}
          {room && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
              <p className="text-gray-500 text-sm mb-2 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Share this code with friends
              </p>
              <div className="relative">
                <p className="text-5xl md:text-6xl font-mono font-bold text-gray-800 tracking-widest mb-3 break-all">
                  {room.gameCode}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(room.gameCode);
                    showToast('Game code copied!', 'success', 1500);
                  }}
                  className="absolute -top-2 -right-2 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  title="Copy code"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                </button>
              </div>
              {/* ===== FIXED: Correct message for 2-10 players ===== */}
              <p className="text-xs text-gray-400 mt-2">
                {room.playerOrder.length < 2 ? (
                  `Game will start when ${2 - room.playerOrder.length} more player${2 - room.playerOrder.length !== 1 ? 's' : ''} join`
                ) : (
                  `Game is ready! (${room.playerOrder.length} / ${room.maxPlayers} players)`
                )}
              </p>
            </div>
          )}

          {/* Room Info - Compact */}
          <div className="bg-gray-50 rounded-xl p-3 mb-6">
            <p className="text-gray-500 text-xs mb-1">Room ID</p>
            <p className="text-gray-700 font-mono text-sm break-all">{roomId?.slice(0, 20)}...</p>
          </div>

          {/* Players Count with Avatars */}
          {room && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-600 text-sm font-medium">Players</p>
                <p className="text-gray-800 font-bold">{room.playerOrder.length} / {room.maxPlayers}</p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {room.playerOrder.map((playerId, index) => {
                  const player = room.players[playerId];
                  const initialName = player?.name?.charAt(0)?.toUpperCase() || '?';
                  const displayName = player?.name?.split(' ')[0] || 'Player';
                  
                  return (
                    <div key={playerId} className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                        {player?.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={player.photoURL} 
                            alt={player.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                const span = document.createElement('span');
                                span.className = 'text-gray-600 font-bold text-lg';
                                span.textContent = initialName;
                                parent.appendChild(span);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-gray-600 font-bold text-lg">
                            {initialName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 max-w-[60px] truncate font-medium">
                        {displayName}
                      </p>
                      {index === 0 && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-0.5">
                          Host
                        </span>
                      )}
                    </div>
                  );
                })}
                {/* Empty slots - waiting players */}
                {Array.from({ length: Math.max(0, (room?.maxPlayers || 0) - (room?.playerOrder.length || 0)) }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex flex-col items-center opacity-60">
                    <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Waiting</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Message with Icon */}
          <div className="mb-6">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              error ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {!error ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">{loadingMessage || 'Waiting for players to join...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </>
              )}
            </div>
          </div>

          {/* Retry Button - Only Shows When Error Occurs */}
          {error && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-5 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {/* Tip */}
          {!error && (
            <p className="text-gray-400 text-xs mt-6 italic">
              Share the game code with your friends to start playing
            </p>
          )}
        </div>

        {/* CSS Animations */}
        <style jsx>{`
          @keyframes bounce-card {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-15px) scale(1.02); }
          }
          .animate-bounce-card {
            animation: bounce-card 1.5s ease-in-out infinite;
          }
          
          @keyframes progress {
            0% { width: 10%; }
            50% { width: 70%; }
            100% { width: 10%; }
          }
          .animate-progress {
            animation: progress 2.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // ========== ACTUAL GAME UI ==========
  const currentPlayerId = getCurrentPlayerId(gameState);
  const isCurrentPlayer = user?.uid === currentPlayerId;
  const playerHand = getPlayerHand(gameState, user!.uid);
  const opponentId = gameState.playerOrder.find((id) => id !== user?.uid);
  const opponentPlayer = opponentId ? room.players[opponentId] : null;
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Color Picker Modal */}
      <ColorPicker
        isOpen={showColorPicker}
        onColorSelect={handleColorSelect}
      />

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-4 flex justify-between items-center">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm">
          <span className="text-gray-500 text-sm">Game Code: </span>
          <span className="font-mono font-bold text-gray-800">{room.gameCode}</span>
        </div>
        <div className="w-20" />
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-100px)]">
        {/* Opponent Info - WITH AVATAR */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="text-center mb-4">
            {/* Opponent Avatar */}
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                {opponentPlayer?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={opponentPlayer.photoURL} 
                    alt={opponentPlayer.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        const span = document.createElement('span');
                        span.className = 'text-gray-600 font-bold text-2xl';
                        span.textContent = opponentPlayer?.name?.charAt(0)?.toUpperCase() || '?';
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span className="text-gray-600 font-bold text-2xl">
                    {opponentPlayer?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
            </div>
            <p className="text-gray-500 text-sm">Opponent</p>
            <p className="text-gray-800 font-bold">{opponentPlayer?.name || 'Waiting...'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm mb-2">Cards in Hand</p>
            <p className="text-3xl font-bold text-gray-800">{opponentId ? getPlayerHand(gameState, opponentId).length : 0}</p>
          </div>
          {currentPlayerId === opponentId && (
            <div className="mt-4 animate-pulse">
              <p className="text-gray-600 text-center font-bold">Their Turn</p>
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
            isMyTurn={isCurrentPlayer && gameState.status !== 'finished' && !isMoveInFlight}
          />

          <div className="flex gap-4 w-full">
            <button
              onClick={drawCard}
              disabled={!isCurrentPlayer || gameState.status === 'finished' || isMoveInFlight}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
            >
              🎴 Draw Card
            </button>
          </div>
        </div>

        {/* Player Info - WITH AVATAR */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="text-center mb-4">
            {/* Your Avatar */}
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                {playerData?.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={playerData.photoURL} 
                    alt={playerData.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        const span = document.createElement('span');
                        span.className = 'text-gray-600 font-bold text-2xl';
                        span.textContent = playerData?.name?.charAt(0)?.toUpperCase() || '?';
                        parent.appendChild(span);
                      }
                    }}
                  />
                ) : (
                  <span className="text-gray-600 font-bold text-2xl">
                    {playerData?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                )}
              </div>
            </div>
            <p className="text-gray-500 text-sm">You</p>
            <p className="text-gray-800 font-bold">{playerData?.name}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-gray-500 text-sm mb-2">Cards in Hand</p>
            <p className="text-3xl font-bold text-gray-800">{playerHand.length}</p>
          </div>
          {isCurrentPlayer && gameState.status !== 'finished' && (
            <div className="mt-4 animate-pulse">
              <p className="text-green-600 text-center font-bold">Your Turn</p>
            </div>
          )}
          {gameState.status === 'finished' && gameState.winner === user?.uid && (
            <div className="mt-4">
              <p className="text-yellow-600 text-center font-bold text-lg">🎉 WINNER! 🎉</p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto bg-red-500 text-white p-3 rounded-lg text-sm z-50 shadow-lg">
          {error}
        </div>
      )}

      {/* Player Hand */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-4 pb-4 border-t border-gray-200">
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