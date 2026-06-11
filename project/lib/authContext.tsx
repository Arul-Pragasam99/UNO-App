'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { Player } from './types';
import { initializePlayerStats } from './statsService';

interface AuthContextType {
  user: User | null;
  playerData: Player | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        setUser(authUser);

        // Check if player data exists in Firestore
        const playerRef = doc(db, 'players', authUser.uid);
        const playerSnap = await getDoc(playerRef);

        const playerInfo: Player = {
          uid: authUser.uid,
          name: authUser.displayName || 'Unknown',
          email: authUser.email || '',
          photoURL: authUser.photoURL || undefined,
          createdAt: playerSnap.exists() ? (playerSnap.data() as Player).createdAt : new Date(),
        };

        if (playerSnap.exists()) {
          // Update profile data on each login (name, photo may change)
          await updateDoc(playerRef, {
            name: playerInfo.name,
            email: playerInfo.email,
            photoURL: playerInfo.photoURL,
          });
          setPlayerData({ ...(playerSnap.data() as Player), ...playerInfo });
        } else {
          // Create new player document
          await setDoc(playerRef, playerInfo);
          setPlayerData(playerInfo);
        }

        // Initialize / update player stats
        await initializePlayerStats(
          authUser.uid,
          playerInfo.name,
          playerInfo.email,
          playerInfo.photoURL
        );
      } else {
        setUser(null);
        setPlayerData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, playerData, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};