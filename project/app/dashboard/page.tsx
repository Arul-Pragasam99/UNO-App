'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuth } from '@/lib/authContext';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
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
  const [timeLeft, setTimeLeft] = useState(60);
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
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
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

  const startCountdown = (roomId: string, code: string) => {
    setTimeLeft(60);
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
          alert(`Game code ${code} has expired after 1 minute. Please create a new game.`);
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
      expiryTime.setMinutes(expiryTime.getMinutes() + 1);

      const roomId = user.uid + '_' + Date.now();
      const room: GameRoom = {
        roomId,
        createdBy: user.uid,
        players: { [user.uid]: playerData },   // ✅ fixed
        playerOrder: [user.uid],               // ✅ fixed
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
      startCountdown(roomId, code);
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
      expiryTime.setMinutes(expiryTime.getMinutes() + 1);

      const roomId = user.uid + '_room_' + Date.now();
      const room: GameRoom = {
        roomId,
        createdBy: user.uid,
        players: { [user.uid]: playerData },   // ✅ fixed
        playerOrder: [user.uid],               // ✅ fixed
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
      startCountdown(roomId, code);
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setIsCreatingGame(false);
    }
  };

  const joinGame = async () => {
    if (!user || !playerData || !joinCode) return;
    try {
      const q = query(collection(db, 'gameRooms'), where('gameCode', '==', joinCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert('Game code not found or expired');
        return;
      }

      const roomDoc = querySnapshot.docs[0];
      const roomData = roomDoc.data() as GameRoom;

      // Check expiry
      if (roomData.expiresAt && new Date(roomData.expiresAt) < new Date()) {
        alert('Game code has expired. Please ask the host to create a new game.');
        await deleteDoc(doc(db, 'gameRooms', roomDoc.id));
        return;
      }

      const currentPlayerCount = Object.keys(roomData.players || {}).length;

      // Check if already in room
      if (roomData.players?.[user.uid]) {
        router.push(`/game/${roomDoc.id}`);
        return;
      }

      // Check if full
      if (currentPlayerCount >= roomData.maxPlayers) {
        alert(`Game is full (max ${roomData.maxPlayers} players)`);
        return;
      }

      // Add player to the players map and playerOrder
      const updatedPlayers = { ...roomData.players, [user.uid]: playerData };
      const updatedPlayerOrder = [...(roomData.playerOrder || []), user.uid];
      const updatedStatus = updatedPlayerOrder.length >= 2 ? 'playing' : 'waiting';

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
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Failed to join game');
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-800">
        <div className="animate-spin">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 pb-20"
    >
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-3xl font-display font-bold text-white">
            <span className="text-yellow-300">U</span>
            <span className="text-red-300">N</span>
            <span className="text-green-300">O</span>
          </div>
          <div className="flex items-center gap-4">
            {playerData?.photoURL && (
              <Image
                src={playerData.photoURL}
                alt={playerData.name}
                width={40}
                height={40}
                className="rounded-full border-2 border-white"
              />
            )}
            <div className="hidden md:block text-white">
              <p className="font-semibold">{playerData?.name}</p>
              <p className="text-sm text-gray-200">{playerData?.email}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
            <p className="text-gray-200 text-sm mb-2">Total Games</p>
            <p className="text-4xl font-bold text-white">{stats.totalGames}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
            <p className="text-gray-200 text-sm mb-2">Wins</p>
            <p className="text-4xl font-bold text-green-300">{stats.wins}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
            <p className="text-gray-200 text-sm mb-2">Losses</p>
            <p className="text-4xl font-bold text-red-300">{stats.losses}</p>
          </div>
        </div>

        {/* Game Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div
            className="group bg-gradient-to-br from-pink-500 to-red-600 rounded-3xl p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            onClick={createOneVsOneGame}
          >
            <div className="text-5xl mb-4">⚔️</div>
            <h2 className="text-3xl font-display font-bold text-white mb-2">1v1 Battle</h2>
            <p className="text-white/90 mb-4">Challenge your friend to an epic one-on-one match</p>
            <button
              disabled={isCreatingGame}
              className="w-full bg-white text-red-600 font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isCreatingGame ? 'Creating...' : 'Create Game'}
            </button>
          </div>

          <div
            className="group bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            onClick={createRoomGame}
          >
            <div className="text-5xl mb-4">👥</div>
            <h2 className="text-3xl font-display font-bold text-white mb-2">Room Game</h2>
            <p className="text-white/90 mb-4">Create a room and invite up to 10 friends</p>
            <button
              disabled={isCreatingGame}
              className="w-full bg-white text-blue-600 font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isCreatingGame ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>

        {/* Join Game */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
          <h3 className="text-2xl font-display font-bold text-white mb-4">Join a Game</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter game code"
              className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:border-white/50"
            />
            <button
              onClick={joinGame}
              className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-100 transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <h2 className="text-2xl font-display font-bold text-gray-800 mb-4">Game Created!</h2>
            <p className="text-gray-600 mb-6">Share this code with your friends:</p>

            <div className="bg-gradient-to-r from-yellow-300 to-red-300 rounded-2xl p-6 mb-6 text-center">
              <p className="text-4xl font-display font-bold text-gray-800 tracking-widest">
                {gameCode}
              </p>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-1">Code expires in:</p>
              <p className={`text-3xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                {formatTime(timeLeft)}
              </p>
              {timeLeft <= 10 && (
                <p className="text-xs text-red-500 mt-1">⚠️ Expiring soon!</p>
              )}
            </div>

            <button
              onClick={() => copyGameCode(gameCode)}
              className="w-full mb-4 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
            >
              Copy Code
            </button>

            <button
              onClick={closeModal}
              className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}