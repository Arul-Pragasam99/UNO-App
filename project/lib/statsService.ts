import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { PlayerStats } from './types';

// ─── Initialize Player Stats ───────────────────────────────────────────────────

export const initializePlayerStats = async (
  uid: string,
  name: string,
  email: string,
  photoURL?: string
): Promise<void> => {
  const statsRef = doc(db, 'playerStats', uid);
  const statsSnap = await getDoc(statsRef);

  if (!statsSnap.exists()) {
    const initialStats: PlayerStats = {
      uid,
      name,
      email,
      photoURL,
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPoints: 0,
      cardsPlayed: 0,
      unosCalled: 0,
      currentStreak: 0,
      longestWinStreak: 0,
      joinedAt: new Date(),
    };
    await setDoc(statsRef, initialStats);
  } else {
    // Update profile info on each login
    await updateDoc(statsRef, { name, email, photoURL });
  }
};

// ─── Update Game Result ────────────────────────────────────────────────────────

export const updateGameResult = async (
  uid: string,
  won: boolean,
  points: number = 0,
  cardsPlayed: number = 0,
  unosCalled: number = 0
): Promise<void> => {
  const statsRef = doc(db, 'playerStats', uid);

  try {
    const statsSnap = await getDoc(statsRef);
    const currentStats = statsSnap.data() as PlayerStats | undefined;

    const currentStreak = currentStats?.currentStreak || 0;
    const longestWinStreak = currentStats?.longestWinStreak || 0;

    const newStreak = won ? currentStreak + 1 : 0;
    const newLongest = Math.max(longestWinStreak, newStreak);
    const newWins = (currentStats?.wins || 0) + (won ? 1 : 0);
    const newTotal = (currentStats?.totalGames || 0) + 1;
    const newWinRate = newTotal > 0 ? Math.round((newWins / newTotal) * 100) : 0;

    await updateDoc(statsRef, {
      totalGames: increment(1),
      wins: increment(won ? 1 : 0),
      losses: increment(won ? 0 : 1),
      totalPoints: increment(points),
      cardsPlayed: increment(cardsPlayed),
      unosCalled: increment(unosCalled),
      currentStreak: newStreak,
      longestWinStreak: newLongest,
      winRate: newWinRate,
      lastPlayedAt: new Date(),
    });
  } catch (error) {
    console.error('Error updating game result:', error);
  }
};

// ─── Get Player Stats ──────────────────────────────────────────────────────────

export const getPlayerStats = async (uid: string): Promise<PlayerStats | null> => {
  try {
    const statsRef = doc(db, 'playerStats', uid);
    const statsSnap = await getDoc(statsRef);
    if (statsSnap.exists()) {
      return statsSnap.data() as PlayerStats;
    }
    return null;
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return null;
  }
};

// ─── Leaderboard ───────────────────────────────────────────────────────────────

export const getLeaderboard = async (count: number = 10): Promise<PlayerStats[]> => {
  try {
    const q = query(
      collection(db, 'playerStats'),
      orderBy('wins', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as PlayerStats);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
};
