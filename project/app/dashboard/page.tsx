'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuth } from '@/lib/authContext';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { generateGameCode } from '@/lib/gameLogic';
import { GameRoom, Player } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const { user, playerData, loading, logout } = useAuth();
  const containerRef = useRef(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalGames: 0 });
  const [showModal, setShowModal] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoiningGame, setIsJoiningGame] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // Default 2 min
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const statsRef = doc(db, 'playerStats', user.uid);
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
          const data = statsSnap.data();
          setStats({
            wins: data.wins || 0,
            losses: data.losses || 0,
            totalGames: (data.wins || 0) + (data.losses || 0),
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [user]);

  useEffect(() => {
    if (!loading && containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
    }
  }, [loading]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // ✅ UPDATED: Accept gameType parameter
  const startCountdown = (roomId: string, code: string, gameType: 'oneVsOne' | 'room') => {
    // ✅ 2 minutes for 1v1, 5 minutes for room
    const totalSeconds = gameType === 'oneVsOne' ? 120 : 300;
    setTimeLeft(totalSeconds);
    setCurrentRoomId(roomId);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(async () => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          const roomRef = doc(db, 'gameRooms', roomId);
          deleteDoc(roomRef).catch(console.error);
          setShowModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const createOneVsOneGame = async () => {
    if (!user || !playerData) return;
    setIsCreatingGame(true);
    try {
      const code = generateGameCode();
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 2); // ✅ 2 minutes for 1v1

      const roomId = user.uid + '_' + Date.now();
      const room: GameRoom = {
        roomId,
        createdBy: user.uid,
        players: { [user.uid]: playerData },
        playerOrder: [user.uid],
        gameType: 'oneVsOne',
        status: 'waiting',
        createdAt: new Date(),
        gameCode: code,
        maxPlayers: 2,
        expiresAt: expiryTime,
      };

      await setDoc(doc(db, 'gameRooms', room.roomId), room);
      setGameCode(code);
      setShowModal(true);
      startCountdown(roomId, code, 'oneVsOne'); // ✅ Pass game type
    } catch (error) {
      console.error('Error creating game:', error);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const createRoomGame = async () => {
    if (!user || !playerData) return;
    setIsCreatingGame(true);
    try {
      const code = generateGameCode();
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 5); // ✅ 5 minutes for room

      const roomId = user.uid + '_room_' + Date.now();
      const room: GameRoom = {
        roomId,
        createdBy: user.uid,
        players: { [user.uid]: playerData },
        playerOrder: [user.uid],
        gameType: 'room',
        status: 'waiting',
        createdAt: new Date(),
        gameCode: code,
        maxPlayers: 10,
        expiresAt: expiryTime,
      };

      await setDoc(doc(db, 'gameRooms', room.roomId), room);
      setGameCode(code);
      setShowModal(true);
      startCountdown(roomId, code, 'room'); // ✅ Pass game type
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const joinGame = async () => {
    if (!user || !playerData || !joinCode) return;
    setIsJoiningGame(true);
    try {
      const q = query(collection(db, 'gameRooms'), where('gameCode', '==', joinCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert('Game code not found or expired');
        return;
      }

      const roomDoc = querySnapshot.docs[0];
      const roomData = roomDoc.data() as GameRoom;

      const expiresAtDate =
        roomData.expiresAt instanceof Timestamp
          ? roomData.expiresAt.toDate()
          : roomData.expiresAt
          ? new Date(roomData.expiresAt as any)
          : null;

      if (expiresAtDate && expiresAtDate < new Date()) {
        alert('Game code has expired. Please ask the host to create a new game.');
        await deleteDoc(doc(db, 'gameRooms', roomDoc.id)).catch(() => {});
        return;
      }

      // Check if game already started
      if (roomData.status === 'playing') {
        alert('This game has already started. You cannot join now.');
        return;
      }

      const currentPlayerCount = Object.keys(roomData.players || {}).length;

      if (roomData.players?.[user.uid]) {
        router.push(`/game/${roomDoc.id}`);
        return;
      }

      if (currentPlayerCount >= roomData.maxPlayers) {
        alert(`Game is full (max ${roomData.maxPlayers} players)`);
        return;
      }

      const updatedPlayers = { ...roomData.players, [user.uid]: playerData };
      const updatedPlayerOrder = [...(roomData.playerOrder || []), user.uid];

      // Room games always wait for host to start
      const updatedStatus = roomData.gameType === 'oneVsOne' 
        ? (updatedPlayerOrder.length >= 2 ? 'playing' : 'waiting')
        : 'waiting';

      await setDoc(
        doc(db, 'gameRooms', roomDoc.id),
        {
          players: updatedPlayers,
          playerOrder: updatedPlayerOrder,
          status: updatedStatus,
        },
        { merge: true }
      );

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      router.push(`/game/${roomDoc.id}`);
    } catch (error: any) {
      console.error('Error joining game:', error);
      const code = error?.code || 'unknown';
      if (code === 'permission-denied') {
        alert('Could not join: permission denied. The room may be full or already started.');
      } else if (code === 'unavailable' || code === 'network-request-failed') {
        alert('Network error. Check your connection and try again.');
      } else {
        alert('Failed to join game. Please try again.');
      }
    } finally {
      setIsJoiningGame(false);
    }
  };

  const copyGameCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Game code copied to clipboard!');
  };

  const closeModal = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setShowModal(false);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-2xl sm:text-3xl font-display font-bold">
            <span className="text-gray-800">U</span>
            <span className="text-gray-700">N</span>
            <span className="text-gray-600">O</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {playerData?.photoURL && (
              <Image
                src={playerData.photoURL}
                alt={playerData.name}
                width={36}
                height={36}
                className="rounded-full border-2 border-gray-300"
              />
            )}
            <div className="hidden sm:block">
              <p className="font-semibold text-gray-800 text-sm">{playerData?.name}</p>
              <p className="text-xs text-gray-500">{playerData?.email}</p>
            </div>
            <button
              onClick={logout}
              className="px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors min-h-[40px]"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          {[
            { label: 'Games', value: stats.totalGames, color: 'text-gray-800' },
            { label: 'Wins', value: stats.wins, color: 'text-green-600' },
            { label: 'Losses', value: stats.losses, color: 'text-red-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200 shadow-sm text-center">
              <p className="text-gray-500 text-xs sm:text-sm">{stat.label}</p>
              <p className={`text-2xl sm:text-4xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Game Modes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <div
            className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={createOneVsOneGame}
          >
            <div className="text-4xl sm:text-5xl mb-3">⚔️</div>
            <h2 className="text-xl sm:text-3xl font-display font-bold text-white">1v1 Battle</h2>
            <p className="text-gray-300 text-sm sm:text-base mt-1 mb-4">Challenge a friend</p>
            <button
              disabled={isCreatingGame}
              className="w-full bg-white text-gray-800 font-bold py-2.5 sm:py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              {isCreatingGame ? 'Creating...' : 'Create Game'}
            </button>
          </div>

          <div
            className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={createRoomGame}
          >
            <div className="text-4xl sm:text-5xl mb-3">👥</div>
            <h2 className="text-xl sm:text-3xl font-display font-bold text-white">Room Game</h2>
            <p className="text-gray-300 text-sm sm:text-base mt-1 mb-4">Invite up to 10 players</p>
            <button
              disabled={isCreatingGame}
              className="w-full bg-white text-gray-800 font-bold py-2.5 sm:py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              {isCreatingGame ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>

        {/* Join Game */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          <h3 className="text-xl sm:text-2xl font-display font-bold text-gray-800 mb-4">Join a Game</h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter game code"
              className="flex-1 px-4 py-3 rounded-xl bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-200 focus:outline-none focus:border-gray-400 text-sm sm:text-base"
              maxLength={6}
            />
            <button
              onClick={joinGame}
              disabled={isJoiningGame || !joinCode}
              className="px-6 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[48px]"
            >
              {isJoiningGame ? 'Joining...' : 'Join'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl mx-4">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-gray-800 mb-3">Game Created!</h2>
            <p className="text-gray-600 text-sm sm:text-base mb-4">Share this code:</p>

            <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl p-4 sm:p-6 mb-4 text-center">
              <p className="text-3xl sm:text-4xl font-mono font-bold text-gray-800 tracking-widest">
                {gameCode}
              </p>
            </div>

            <div className="text-center mb-4">
              <p className="text-gray-500 text-sm">Code expires in:</p>
              <p className={`text-2xl sm:text-3xl font-bold ${timeLeft <= 30 ? 'text-red-500 animate-pulse' : 'text-gray-700'}`}>
                {formatTime(timeLeft)}
              </p>
              {timeLeft <= 30 && (
                <p className="text-xs text-red-500 mt-1">⚠️ Expiring soon!</p>
              )}
            </div>

            <button
              onClick={() => copyGameCode(gameCode)}
              className="w-full mb-3 px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl transition-colors text-sm sm:text-base min-h-[48px]"
            >
              Copy Code
            </button>

            <button
              onClick={closeModal}
              className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-colors text-sm sm:text-base min-h-[48px]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}