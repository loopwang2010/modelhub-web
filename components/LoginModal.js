'use client';

// LoginModal — replaces ApiKeyModal (the muapi-key paste UX from OGAI).
// Per S11-S13-OPS-DESIGN.md §1 and AP-4:
//   - Email + password fields ONLY. No API keys.
//   - On submit, modelhub-client.login() POSTs /v1/auth/login. Backend
//     sets the modelhub_session HttpOnly cookie. We never touch the JWT.
//   - "Sign up" link toggles to register form which calls register().
//   - On success, parent receives onAuthenticated() and routes to /studio.

import { useState } from 'react';
import { login, register } from 'studio';

export default function LoginModal({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isLogin = mode === 'login';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError('Please enter your email'); return; }
    if (!password) { setError('Please enter your password'); return; }

    setSubmitting(true);
    try {
      const fn = isLogin ? login : register;
      const data = await fn(trimmedEmail, password);
      onAuthenticated?.(data);
    } catch (err) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || err?.message
        || (isLogin ? 'Login failed' : 'Registration failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-sm bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/10 rounded-xl p-10 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 bg-[#d9ff00]/5 rounded-2xl flex items-center justify-center border border-[#d9ff00]/10 mb-6 group hover:border-[#d9ff00]/30 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
              <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">
            {isLogin ? 'Sign in to Modelhub' : 'Create your Modelhub account'}
          </h1>
          <p className="text-white/40 text-[13px] leading-relaxed px-4">
            {isLogin ? 'Use your modelhub credentials to start creating' : 'A wallet account is set up automatically — top up via admin to unlock generation'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-white/30 ml-1">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 focus:bg-white/[0.07] transition-all"
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-white/30 ml-1">
              Password
            </label>
            <input
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder={isLogin ? 'Your password' : 'Choose a strong password'}
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 focus:bg-white/[0.07] transition-all"
              suppressHydrationWarning
            />
            {error && <p className="mt-2 text-red-500/80 text-[11px] font-medium ml-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#d9ff00] text-black font-medium py-2.5 rounded-md hover:bg-[#e5ff33] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[#d9ff00]/5 disabled:opacity-50 disabled:hover:scale-100"
            suppressHydrationWarning
          >
            {submitting ? '...' : (isLogin ? 'Sign in' : 'Create account')}
          </button>

          <p className="text-center text-[12px] text-white/30 pt-2">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}
              className="text-white/50 hover:text-[#d9ff00] transition-colors font-medium underline-offset-2 hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
