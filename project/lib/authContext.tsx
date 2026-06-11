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
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      try {
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

          setError(null);
        } else {
          setUser(null);
          setPlayerData(null);
        }
      } catch (err: any) {
        console.error('Auth state change error:', err);
        setError(err.message || 'An error occurred during authentication');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();

      // Set custom parameters for better UX
      provider.setCustomParameters({
        prompt: 'select_account',
      });

      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Handle specific Firebase auth errors gracefully
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup was closed by user');
        // Don't throw - silently return, user can try again
        setError(null);
        return;
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.log('Login popup request was cancelled');
        // Don't throw - silently return, user can try again
        setError(null);
        return;
      } else if (error.code === 'auth/popup-blocked') {
        const message = 'Popup blocked by browser. Please disable your popup blocker and try again.';
        console.error(message);
        setError(message);
        throw error;
      } else if (error.code === 'auth/operation-not-supported-in-this-environment') {
        const message = 'Authentication is not available in this environment.';
        console.error(message);
        setError(message);
        throw error;
      } else if (error.code === 'auth/network-request-failed') {
        const message = 'Network error. Please check your connection and try again.';
        console.error(message);
        setError(message);
        throw error;
      } else {
        console.error('Google login error:', error.message);
        setError(error.message || 'Login failed. Please try again.');
        throw error;
      }
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'Logout failed');
      throw err;
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, playerData, loading, error, loginWithGoogle, logout, clearError }}
    >
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