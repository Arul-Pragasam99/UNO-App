import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, orderBy, limit, getDocs, runTransaction } from 'firebase/firestore';
import { PlayerStats } from './types';

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
    await updateDoc(statsRef, { name, email, photoURL });
  }
};

// FIXED: Using transaction to prevent race conditions
// FIXED: Added roomId param — required by Firestore rules so the winner's
// client is allowed to write the loser's stats doc (see sharesFinishedGameWith
// in firestore.rules). Without this field the write is permission-denied.
export const updateGameResult = async (
  uid: string,
  won: boolean,
  points: number = 0,
  cardsPlayed: number = 0,
  unosCalled: number = 0,
  roomId?: string
): Promise<void> => {
  const statsRef = doc(db, 'playerStats', uid);

  try {
    await runTransaction(db, async (transaction) => {
      const statsDoc = await transaction.get(statsRef);
      const currentStats = statsDoc.data() as PlayerStats | undefined;

      const currentStreak = currentStats?.currentStreak || 0;
      const longestWinStreak = currentStats?.longestWinStreak || 0;
      const currentWins = currentStats?.wins || 0;
      const currentTotal = currentStats?.totalGames || 0;

      const newStreak = won ? currentStreak + 1 : 0;
      const newLongest = Math.max(longestWinStreak, newStreak);
      const newWins = currentWins + (won ? 1 : 0);
      const newTotal = currentTotal + 1;
      const newWinRate = newTotal > 0 ? Math.round((newWins / newTotal) * 100) : 0;

      transaction.update(statsRef, {
        totalGames: newTotal,
        wins: newWins,
        losses: (currentStats?.losses || 0) + (won ? 0 : 1),
        totalPoints: (currentStats?.totalPoints || 0) + points,
        cardsPlayed: (currentStats?.cardsPlayed || 0) + cardsPlayed,
        unosCalled: (currentStats?.unosCalled || 0) + unosCalled,
        currentStreak: newStreak,
        longestWinStreak: newLongest,
        winRate: newWinRate,
        lastPlayedAt: new Date(),
        lastGameRoomId: roomId || null,
      });
    });
  } catch (error) {
    console.error('Error updating game result:', error);
  }
};

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