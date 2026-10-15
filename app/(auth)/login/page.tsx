'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation states
  const [entranceDone, setEntranceDone] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // 2.4s entrance animation timer
    const timer = setTimeout(() => {
      setEntranceDone(true);
    }, 2400);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setEmail('demo@socialos.dev');
    setPassword('demo123456');

    setLoading(true);
    setError('');

    try {
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'demo@socialos.dev',
          password: 'demo123456',
          rememberMe: true,
        }),
      });

      if (!res.ok) {
        await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Alex',
            lastName: 'Rivera',
            email: 'demo@socialos.dev',
            password: 'demo123456',
            confirmPassword: 'demo123456',
          }),
        });

        await fetch('/api/seed', { method: 'POST' });

        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'demo@socialos.dev',
            password: 'demo123456',
            rememberMe: true,
          }),
        });
      }

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Demo initialization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-sans flex items-center justify-center lg:justify-end select-none">
      {/* Sci-Fi Global Animation Styles */}
      <style jsx global>{`
        @keyframes helmetRiseEntrance {
          0% {
            transform: translateY(115%);
            opacity: 0;
            filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.15));
          }
          40% {
            opacity: 0.85;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
            filter: drop-shadow(0 0 35px rgba(239, 68, 68, 0.45));
          }
        }

        @keyframes helmetIdleFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes ringPulse {
          0%, 100% {
            opacity: 0.75;
            transform: scale(1);
            filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.35));
          }
          50% {
            opacity: 0.95;
            transform: scale(1.02);
            filter: drop-shadow(0 0 45px rgba(239, 68, 68, 0.65));
          }
        }

        @keyframes particleDrift {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-240px) translateX(25px);
            opacity: 0;
          }
        }

        @keyframes cardFadeSlide {
          0% {
            opacity: 0;
            transform: translateX(25px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-helmet-rise {
          animation: helmetRiseEntrance 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }

        .animate-helmet-idle {
          animation: helmetIdleFloat 5.5s ease-in-out infinite;
          will-change: transform;
        }

        .animate-card-entrance {
          animation: cardFadeSlide 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
          will-change: transform, opacity;
        }

        .animate-ring-pulse {
          animation: ringPulse 4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-helmet-rise,
          .animate-helmet-idle,
          .animate-card-entrance,
          .animate-ring-pulse,
          .cosmic-particle {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Layer 1: Background Environment (16:9 Sci-Fi Landscape) */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: 'url(/scifi-login-bg.jpg)',
        }}
      >
        {/* Subtle Atmospheric Dark Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/70 pointer-events-none" />
      </div>

      {/* Layer 2: Subtle Cosmic Particles & Embers */}
      <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
        {isMounted && (
          <>
            <div
              className="cosmic-particle absolute w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
              style={{
                left: '18%',
                bottom: '25%',
                animation: 'particleDrift 6s ease-in infinite',
                animationDelay: '0s',
              }}
            />
            <div
              className="cosmic-particle absolute w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]"
              style={{
                left: '28%',
                bottom: '30%',
                animation: 'particleDrift 7.5s ease-in infinite',
                animationDelay: '1.2s',
              }}
            />
            <div
              className="cosmic-particle absolute w-1 h-1 rounded-full bg-red-300 shadow-[0_0_6px_rgba(252,165,165,0.9)]"
              style={{
                left: '12%',
                bottom: '20%',
                animation: 'particleDrift 5s ease-in infinite',
                animationDelay: '2.5s',
              }}
            />
            <div
              className="cosmic-particle absolute w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
              style={{
                left: '35%',
                bottom: '22%',
                animation: 'particleDrift 8s ease-in infinite',
                animationDelay: '3.8s',
              }}
            />
            <div
              className="cosmic-particle absolute w-1 h-1 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]"
              style={{
                left: '22%',
                bottom: '35%',
                animation: 'particleDrift 6.5s ease-in infinite',
                animationDelay: '4.5s',
              }}
            />
          </>
        )}
      </div>

      {/* Layer 3: Red Energy Halo Glow Behind Helmet */}
      <div className="hidden lg:block absolute left-[3%] xl:left-[6%] 2xl:left-[8%] top-[8%] w-[580px] h-[580px] rounded-full pointer-events-none z-[8]">
        <div className="w-full h-full rounded-full border border-red-500/25 bg-red-600/[0.04] animate-ring-pulse blur-[1px]" />
      </div>

      {/* Layer 4: Armored Helmet Character (Enters from Bottom) */}
      <div
        className="absolute bottom-0 left-[-5%] sm:left-[0%] md:left-[2%] lg:left-[3%] xl:left-[6%] 2xl:left-[8%] pointer-events-none select-none z-10 flex items-end"
        style={{
          // Reserve layout height to avoid layout shift
          height: '86vh',
          maxHeight: '880px',
        }}
      >
        <img
          src="/scifi-helmet-character.png"
          alt="Futuristic Armored Helmet Character"
          className={`h-full w-auto object-contain object-bottom transition-all duration-300 ${
            entranceDone ? 'animate-helmet-idle' : 'animate-helmet-rise'
          }`}
          style={{
            filter: 'drop-shadow(0 0 30px rgba(220, 38, 38, 0.4))',
          }}
        />
      </div>

      {/* Layer 5: Premium Dark Glassmorphism Login Card */}
      <div className="relative z-20 w-full max-w-[450px] lg:max-w-[440px] xl:max-w-[460px] px-4 sm:px-6 lg:px-0 lg:mr-[6%] xl:mr-[9%] 2xl:mr-[12%] py-8">
        <div className="animate-card-entrance bg-[#0c0507]/80 backdrop-blur-2xl rounded-3xl p-7 sm:p-9 border border-red-500/35 shadow-[0_0_50px_rgba(239,68,68,0.22)] ring-1 ring-white/5">
          
          {/* Logo & Branding Area */}
          <div className="text-center flex flex-col items-center">
            <div className="w-20 sm:w-24 h-auto mb-2 relative drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:scale-105 transition-transform duration-500">
              <img
                src="/tws-logo-transparent.png"
                alt="Tech With Salman"
                className="w-full h-auto object-contain"
              />
            </div>
            
            <h1 className="text-base sm:text-lg font-black tracking-wider text-red-600 uppercase drop-shadow-[0_0_12px_rgba(220,38,38,0.5)]">
              TECH WITH SALMAN
            </h1>
            <h2 className="text-[10px] sm:text-[11px] font-bold tracking-[0.25em] text-red-500 uppercase mt-0.5">
              SOCIAL MEDIA OS
            </h2>

            {/* Hello ! Welcome Back */}
            <div className="mt-4 sm:mt-5 text-center">
              <p className="text-white font-bold text-base sm:text-lg tracking-wide">
                Hello !
              </p>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                Welcome Back
              </h3>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-100 text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="block w-full pl-10 pr-3.5 py-3 text-sm bg-black/70 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner shadow-black/60"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-3 text-sm bg-black/70 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/50 transition-all shadow-inner shadow-black/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-zinc-300 cursor-pointer hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-black w-3.5 h-3.5 cursor-pointer accent-blue-600"
                />
                <span className="font-medium text-zinc-300">Remember me</span>
              </label>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Password reset instructions will be sent to your email.');
                }}
                className="font-semibold text-red-500 hover:text-red-400 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-[0_0_28px_rgba(239,68,68,0.5)] hover:shadow-[0_0_35px_rgba(239,68,68,0.7)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-5 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
            <span className="px-3 text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
              OR
            </span>
            <div className="w-full border-t border-zinc-800"></div>
          </div>

          {/* Google Sign In */}
          <div className="mt-5">
            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-bold transition-all shadow-md active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            </a>
          </div>

          {/* Quick Demo Button (Dev Only) */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-4 pt-4 border-t border-zinc-800/80">
              <button
                onClick={handleQuickDemo}
                disabled={loading}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <span>1-Click Instant Demo Login (Dev Only)</span>
              </button>
            </div>
          )}

          {/* Footer - Sign Up */}
          <div className="mt-6 text-center text-xs text-zinc-300">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-bold text-red-500 hover:text-red-400 transition-colors ml-1"
            >
              Sign Up
            </Link>
          </div>

          {/* Terms & Privacy */}
          <div className="mt-4 pt-3 border-t border-zinc-900 text-center text-[10px] text-zinc-500">
            By continuing, you agree to our{' '}
            <a
              href="https://techwithsalman.online/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-300 transition-colors"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://techwithsalman.online/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-300 transition-colors"
            >
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
