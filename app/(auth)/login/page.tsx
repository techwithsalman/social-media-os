'use client';

import React, { useState } from 'react';
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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans bg-black">
      
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url(/auth-bg.png)',
          opacity: 0.80
        }}
      />
      {/* Subtle Dark Overlay */}
      <div className="absolute inset-0 z-0 bg-black/25 pointer-events-none" />

      {/* Brand Area */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center flex flex-col items-center">
        <div className="w-24 sm:w-[130px] h-auto mb-4 relative drop-shadow-[0_0_25px_rgba(220,38,38,0.4)] hover:scale-105 transition-transform duration-500">
          <img src="/tws-logo-transparent.png" alt="Tech With Salman" className="w-full h-auto object-contain" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white uppercase drop-shadow-lg">
          <span className="text-red-600">TECH</span> <span className="text-slate-200">WITH</span> <span className="text-red-600">SALMAN</span>
        </h1>
        <h2 className="mt-0.5 text-sm font-medium tracking-widest text-slate-300 uppercase drop-shadow-md">
          Social Media <span className="text-red-500 font-bold">OS</span>
        </h2>
        <p className="mt-2 text-xs text-slate-200 drop-shadow-sm font-medium">
          Sign in to your multi-platform command center
        </p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[420px] relative z-10 px-4 sm:px-0">
        <div className="bg-[#080408]/85 py-8 px-6 sm:px-8 shadow-[0_0_40px_rgba(220,38,38,0.15)] rounded-2xl border border-red-500/30 backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-100 text-xs font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm bg-black/60 border border-red-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-500 transition-all shadow-inner shadow-black/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-10 py-2.5 text-sm bg-black/60 border border-red-500/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-500 transition-all shadow-inner shadow-black/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-red-900 bg-black text-red-600 focus:ring-red-600 focus:ring-offset-black w-3.5 h-3.5"
                />
                <span className="font-medium">Remember me</span>
              </label>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Password reset instructions will be sent to your email.');
                }}
                className="font-bold text-red-500 hover:text-red-400 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white text-sm font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all disabled:opacity-50 active:scale-[0.98]"
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
          <div className="mt-7 flex items-center">
            <div className="w-full border-t border-slate-700/50"></div>
            <span className="px-3 text-xs text-slate-400 font-medium">OR</span>
            <div className="w-full border-t border-slate-700/50"></div>
          </div>

          <div className="mt-7">
            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold transition-all shadow-sm active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>

          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-5 pt-5 border-t border-slate-700/50">
              <button
                onClick={handleQuickDemo}
                disabled={loading}
                type="button"
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <span>1-Click Instant Demo Login (Dev Only)</span>
              </button>
            </div>
          )}

          <div className="mt-8 text-center text-xs text-slate-300">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-bold text-red-500 hover:text-red-400 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
