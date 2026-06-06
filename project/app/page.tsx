'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useAuth } from '@/lib/authContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, loginWithGoogle } = useAuth();
  const containerRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading) {
      // Animate on mount
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out' }
      );

      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.3, ease: 'power2.out' }
      );
    }
  }, [loading]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-800">
        <div className="animate-spin">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-red-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8 md:p-10"
      >
        {/* UNO Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="text-5xl md:text-6xl font-display font-bold text-center">
              <span className="text-red-500">U</span>
              <span className="text-yellow-500">N</span>
              <span className="text-green-500">O</span>
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 h-1 w-20 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full blur-sm"></div>
          </div>
        </div>

        {/* Title and Description */}
        <div className="text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-800 mb-2">
            Play with Friends
          </h1>
          <p className="text-gray-600 font-body text-sm md:text-base">
            Challenge your friends to exciting UNO matches. Create rooms or play 1v1 games.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎮</span>
            <div>
              <h3 className="font-semibold text-gray-800">Real-time Gameplay</h3>
              <p className="text-sm text-gray-600">Play live matches with instant updates</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <h3 className="font-semibold text-gray-800">Create Rooms</h3>
              <p className="text-sm text-gray-600">Share codes with friends to join games</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="font-semibold text-gray-800">Track Stats</h3>
              <p className="text-sm text-gray-600">Monitor your wins, losses, and rankings</p>
            </div>
          </div>
        </div>

        {/* Login Button with Original Google Icon */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl border border-gray-300"
        >
          {/* Original Google SVG Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          By continuing, you agree to our Terms of Service
        </p>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}