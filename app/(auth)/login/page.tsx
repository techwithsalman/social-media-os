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

  // Entrance and idle animation lifecycle
  const [entranceDone, setEntranceDone] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError === 'google_auth_error') {
      setError('Google authentication could not be completed. Please try again or check database connectivity.');
    } else if (urlError === 'google_auth_failed') {
      setError('Google sign-in was cancelled or denied.');
    } else if (urlError === 'google_config_missing') {
      setError('Google OAuth is not configured on the server.');
    }
    // 2.5s cinematic entrance animation duration
    const timer = setTimeout(() => {
      setEntranceDone(true);
    }, 2500);
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

      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect');
      const targetPath =
        redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
          ? redirectTo
          : '/dashboard';

      router.push(targetPath);
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
    <div className="relative min-h-screen w-full overflow-x-hidden lg:overflow-hidden bg-[#040103] font-sans flex items-center justify-center lg:justify-end select-none">
      {/* Sci-Fi Global Animation & Keyframe Styles */}
      <style jsx global>{`
        /* Cinematic Entrance with subtle 3D tilt and smooth settling */
        @keyframes helmetCinematicEntrance {
          0% {
            transform: perspective(1400px) translateY(125%) rotateY(-8deg) rotateZ(-1deg) scale(0.95);
            opacity: 0;
            filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.1));
          }
          45% {
            opacity: 0.9;
            filter: drop-shadow(0 0 50px rgba(239, 68, 68, 0.65));
          }
          82% {
            /* Gentle overshoot and cinematic 3D settle */
            transform: perspective(1400px) translateY(-12px) rotateY(1.2deg) rotateZ(0.2deg) scale(1.01);
          }
          100% {
            transform: perspective(1400px) translateY(0) rotateY(0deg) rotateZ(0deg) scale(1);
            opacity: 1;
            filter: drop-shadow(0 0 40px rgba(239, 68, 68, 0.5));
          }
        }

        /* Minimal high-end idle breathing float */
        @keyframes helmetIdleBreathing {
          0%, 100% {
            transform: perspective(1400px) translateY(0) rotateY(0deg);
          }
          50% {
            transform: perspective(1400px) translateY(-8px) rotateY(-0.8deg);
          }
        }

        /* Energy Ring Breathing Glow */
        @keyframes energyRingBreathing {
          0%, 100% {
            opacity: 0.55;
            filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.4)) drop-shadow(0 0 50px rgba(239, 68, 68, 0.2));
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            filter: drop-shadow(0 0 45px rgba(239, 68, 68, 0.75)) drop-shadow(0 0 80px rgba(239, 68, 68, 0.35));
            transform: scale(1.025);
          }
        }

        /* Orbital nodes pulsing */
        @keyframes nodePulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 15px rgba(239, 68, 68, 0.8), 0 0 30px rgba(239, 68, 68, 0.5);
          }
          50% {
            transform: scale(1.3);
            box-shadow: 0 0 25px rgba(248, 113, 113, 1), 0 0 45px rgba(239, 68, 68, 0.85);
          }
        }

        /* Slow atmospheric mist drift */
        @keyframes mistDriftOne {
          0% {
            transform: translateX(-4%) translateY(0);
            opacity: 0.15;
          }
          50% {
            transform: translateX(4%) translateY(-8px);
            opacity: 0.26;
          }
          100% {
            transform: translateX(-4%) translateY(0);
            opacity: 0.15;
          }
        }

        @keyframes mistDriftTwo {
          0% {
            transform: translateX(5%) scale(1);
            opacity: 0.12;
          }
          50% {
            transform: translateX(-3%) scale(1.04);
            opacity: 0.22;
          }
          100% {
            transform: translateX(5%) scale(1);
            opacity: 0.12;
          }
        }

        /* Slow-moving cosmic particles */
        @keyframes cosmicParticleFloat {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          25% {
            opacity: 0.75;
          }
          75% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-260px) translateX(30px);
            opacity: 0;
          }
        }

        /* Card entrance */
        @keyframes cardSmoothSlideIn {
          0% {
            opacity: 0;
            transform: translateX(30px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-helmet-cinematic {
          animation: helmetCinematicEntrance 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }

        .animate-helmet-idle-breathe {
          animation: helmetIdleBreathing 6s ease-in-out infinite;
          will-change: transform;
        }

        .animate-card-slide {
          animation: cardSmoothSlideIn 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards;
          opacity: 0;
          will-change: transform, opacity;
        }

        .animate-energy-ring {
          animation: energyRingBreathing 5s ease-in-out infinite;
        }

        .animate-mist-1 {
          animation: mistDriftOne 14s ease-in-out infinite;
        }

        .animate-mist-2 {
          animation: mistDriftTwo 18s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-helmet-cinematic,
          .animate-helmet-idle-breathe,
          .animate-card-slide,
          .animate-energy-ring,
          .animate-mist-1,
          .animate-mist-2,
          .cosmic-particle {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Layer 1: Cinematic Sci-Fi Background (16:9 Landscape) */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: 'url(/scifi-login-bg.jpg)',
        }}
      >
        {/* Cinematic Vignette Overlays for High-End Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/75" />
      </div>

      {/* Layer 2: Soft Atmospheric Smoke / Mist Layers */}
      <div className="absolute inset-0 z-[3] pointer-events-none overflow-hidden">
        <div className="animate-mist-1 absolute -bottom-20 -left-20 w-[80vw] h-[50vh] bg-gradient-to-tr from-red-950/20 via-rose-900/10 to-transparent blur-3xl rounded-full" />
        <div className="animate-mist-2 absolute bottom-0 right-0 w-[60vw] h-[45vh] bg-gradient-to-tl from-red-950/25 via-red-900/10 to-transparent blur-3xl rounded-full" />
      </div>

      {/* Layer 3: Animated Red Glow on the Circular Energy Ring */}
      <div className="hidden lg:block absolute left-[2%] xl:left-[4%] 2xl:left-[6%] top-[5%] xl:top-[4%] w-[580px] h-[580px] xl:w-[660px] xl:h-[660px] 2xl:w-[720px] 2xl:h-[720px] rounded-full pointer-events-none z-[6]">
        {/* Outer Pulsing Halo */}
        <div className="w-full h-full rounded-full border border-red-500/35 animate-energy-ring box-border">
          <div className="w-full h-full rounded-full border border-red-600/20 bg-gradient-to-tr from-red-600/[0.04] via-transparent to-rose-600/[0.03]" />
        </div>

        {/* Pulsing Orbital Energy Nodes */}
        <div
          className="absolute top-[16%] left-[9%] w-3.5 h-3.5 rounded-full bg-red-400"
          style={{ animation: 'nodePulse 3.5s ease-in-out infinite' }}
        />
        <div
          className="absolute top-[14%] right-[19%] w-3.5 h-3.5 rounded-full bg-red-400"
          style={{ animation: 'nodePulse 3.8s ease-in-out infinite 0.6s' }}
        />
        <div
          className="absolute bottom-[24%] right-[9%] w-4 h-4 rounded-full bg-rose-400"
          style={{ animation: 'nodePulse 4.2s ease-in-out infinite 1.2s' }}
        />
      </div>

      {/* Layer 4: Slow Floating Cosmic Particles / Embers */}
      <div className="absolute inset-0 z-[8] pointer-events-none overflow-hidden">
        {isMounted && (
          <>
            <div
              className="cosmic-particle absolute w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
              style={{
                left: '16%',
                bottom: '22%',
                animation: 'cosmicParticleFloat 9s ease-in infinite',
                animationDelay: '0s',
              }}
            />
            <div
              className="cosmic-particle absolute w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.95)]"
              style={{
                left: '26%',
                bottom: '28%',
                animation: 'cosmicParticleFloat 11s ease-in infinite',
                animationDelay: '1.8s',
              }}
            />
            <div
              className="cosmic-particle absolute w-1 h-1 rounded-full bg-red-300 shadow-[0_0_6px_rgba(252,165,165,0.9)]"
              style={{
                left: '10%',
                bottom: '18%',
                animation: 'cosmicParticleFloat 8s ease-in infinite',
                animationDelay: '3.4s',
              }}
            />
            <div
              className="cosmic-particle absolute w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
              style={{
                left: '34%',
                bottom: '20%',
                animation: 'cosmicParticleFloat 12s ease-in infinite',
                animationDelay: '5s',
              }}
            />
            <div
              className="cosmic-particle absolute w-1 h-1 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.85)]"
              style={{
                left: '20%',
                bottom: '32%',
                animation: 'cosmicParticleFloat 9.5s ease-in infinite',
                animationDelay: '6.2s',
              }}
            />
          </>
        )}
      </div>

      {/* Layer 5: Helmet Character (Anchored bottom-left, Dominant Scale) */}
      <div
        className="absolute bottom-0 pointer-events-none select-none z-10 flex items-end
                   left-1/2 -translate-x-1/2 opacity-25 h-[58vh] max-h-[520px]
                   md:left-[-6%] md:translate-x-0 md:opacity-45 md:h-[75vh] md:max-h-[750px]
                   lg:left-[0%] lg:opacity-100 lg:h-[94vh] lg:max-h-[1020px]
                   xl:left-[3%] xl:h-[96vh] xl:max-h-[1080px]
                   2xl:left-[5%] 2xl:h-[98vh] 2xl:max-h-[1140px]"
      >
        <img
          src="/scifi-helmet-character.png"
          alt="Futuristic Armored Helmet Character"
          className={`h-full w-auto object-contain object-bottom ${
            entranceDone ? 'animate-helmet-idle-breathe' : 'animate-helmet-cinematic'
          }`}
          style={{
            filter: 'drop-shadow(0 0 38px rgba(220, 38, 38, 0.45))',
          }}
        />
      </div>

      {/* Layer 6: Exact Reference Glassmorphism Login Card */}
      <div className="relative z-20 w-full max-w-[480px] sm:max-w-[500px] lg:max-w-[515px] xl:max-w-[525px] px-4 sm:px-6 lg:px-0 lg:mr-[4%] xl:mr-[7%] 2xl:mr-[10%] py-6">
        <div className="animate-card-slide relative rounded-[24px] pt-6 pb-6 px-7 sm:px-9 bg-[#0c0406]/70 backdrop-blur-2xl border border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.32),0_20px_50px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden">
          
          {/* Subtle Ambient Red Glows */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-red-900/10 rounded-full blur-2xl pointer-events-none" />

          {/* Logo & Branding Area (Exact Reference Style) */}
          <div className="relative z-10 text-center flex flex-col items-center">
            <div className="w-16 sm:w-20 h-auto mb-2 relative drop-shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:scale-105 transition-transform duration-500">
              <img
                src="/tws-logo-transparent.png"
                alt="Tech With Salman"
                className="w-full h-auto object-contain"
              />
            </div>

            <h1 className="text-sm sm:text-[15px] font-black tracking-[0.2em] text-red-500 uppercase drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              TECH WITH SALMAN
            </h1>
            <h2 className="text-[10px] sm:text-[10.5px] font-bold tracking-[0.3em] text-red-400 uppercase mt-0.5">
              SOCIAL MEDIA OS
            </h2>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="relative z-10 mt-3 p-2.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-100 text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 shadow-[0_0_6px_rgba(248,113,113,0.9)]" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Controls (Exact Reference: Clean, Compact, No External Labels) */}
          <form onSubmit={handleSubmit} className="relative z-10 mt-5 space-y-3">
            {/* Email Address Input */}
            <div className="group relative rounded-xl bg-black/60 border border-zinc-700/60 hover:border-zinc-500/80 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/40 transition-all duration-200">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-red-400 transition-colors">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className="block w-full pl-10 pr-3.5 py-3 text-sm bg-transparent text-white placeholder-zinc-400 focus:outline-none font-normal"
              />
            </div>

            {/* Password Input */}
            <div className="group relative rounded-xl bg-black/60 border border-zinc-700/60 hover:border-zinc-500/80 focus-within:border-red-500/80 focus-within:ring-1 focus-within:ring-red-500/40 transition-all duration-200">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-red-400 transition-colors">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-10 py-3 text-sm bg-transparent text-white placeholder-zinc-400 focus:outline-none font-normal"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-zinc-200 cursor-pointer hover:text-white transition-colors select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded-[4px] border-0 bg-red-600 text-red-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer accent-red-600"
                />
                <span className="font-medium text-zinc-200 text-xs">Remember me</span>
              </label>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Password reset instructions will be sent to your email.');
                }}
                className="font-semibold text-red-500 hover:text-red-400 hover:underline transition-colors text-xs"
              >
                Forgot password?
              </a>
            </div>

            {/* Sign In Button (Reference: Vibrant Red-to-Pink Pill) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-sm text-white tracking-wide
                         bg-gradient-to-r from-[#e50914] via-[#ee1d36] to-[#f43f5e] hover:from-[#f0141f] hover:to-[#fb7185]
                         shadow-[0_0_24px_rgba(239,68,68,0.55)] hover:shadow-[0_0_35px_rgba(239,68,68,0.75)]
                         transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.985] cursor-pointer"
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
          <div className="relative z-10 mt-4 flex items-center">
            <div className="w-full border-t border-zinc-800/80"></div>
            <span className="px-3 text-[10px] text-zinc-400 font-semibold uppercase tracking-widest">
              OR
            </span>
            <div className="w-full border-t border-zinc-800/80"></div>
          </div>

          {/* Google Sign In (Reference: Clean White Button) */}
          <div className="relative z-10 mt-4">
            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-sm font-bold transition-all shadow-md active:scale-[0.985]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <div className="relative z-10 mt-3 pt-3 border-t border-zinc-800/80">
              <button
                onClick={handleQuickDemo}
                disabled={loading}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <span>1-Click Instant Demo Login (Dev Only)</span>
              </button>
            </div>
          )}

          {/* Footer - Sign Up (Exact Reference) */}
          <div className="relative z-10 mt-4 text-center text-xs text-zinc-300">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-bold text-red-500 hover:text-red-400 hover:underline transition-colors ml-1"
            >
              Sign Up
            </Link>
          </div>

          {/* Legal / Terms */}
          <div className="relative z-10 mt-3 pt-2.5 border-t border-zinc-900/80 text-center text-[10px] text-zinc-500">
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
