'use client';

// S10b: replaced ApiKeyModal (muapi key paste) with LoginModal (email +
// password against /v1/auth/login). Auth lives in a HttpOnly
// modelhub_session cookie set by the backend; we never read it from
// JavaScript and never store credentials in localStorage (AP-4).
//
// Balance is fetched from /v1/wallet/balance via getBalance() once the
// user is authenticated. Studio components no longer need an apiKey prop
// — they ride the same cookie via modelhub-client. The prop is kept on
// the wire (passed empty) until each studio drops its `apiKey` argument
// in a follow-up.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ImageStudio,
  VideoStudio,
  LipSyncStudio,
  CinemaStudio,
  MarketingStudio,
  AppsStudio,
  getBalance,
  getMe,
  logout as apiLogout,
} from 'studio';
import LoginModal from './LoginModal';

const TABS = [
  { id: 'image',     label: 'Image Studio' },
  { id: 'video',     label: 'Video Studio' },
  { id: 'lipsync',   label: 'Lip Sync' },
  { id: 'cinema',    label: 'Cinema Studio' },
  { id: 'marketing', label: 'Marketing Studio' },
  { id: 'apps',      label: 'Explore Apps' },
];

// Balance arrives in micro-USD (per WalletBalance schema). 1_000_000 = $1.
const MICRO_USD_PER_USD = 1_000_000;

export default function StandaloneShell() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug || [];

  const getInitialTab = () => {
    const firstSegment = slug[0];
    if (firstSegment && TABS.find(t => t.id === firstSegment)) return firstSegment;
    if (slug.includes('apps')) return 'apps';
    return 'image';
  };

  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [balance, setBalance] = useState(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const firstSegment = slug[0];
    if (firstSegment && TABS.find(t => t.id === firstSegment)) {
      setActiveTab(firstSegment);
    }
  }, [slug]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    router.push(`/studio/${tabId}`);
  };

  const fetchBalance = useCallback(async () => {
    try {
      const data = await getBalance();
      setBalance(data?.balance ?? null);
    } catch (err) {
      // 401s are silenced — the axios interceptor in modelhub-client
      // handles the redirect. Surface other errors for visibility.
      if (err?.response?.status !== 401) {
        // eslint-disable-next-line no-console
        console.error('Balance fetch failed:', err);
      }
    }
  }, []);

  // On mount, ask /v1/auth/me whether the cookie is valid. If yes, we're
  // logged in; if 401, LoginModal renders. We deliberately do NOT keep
  // any auth state in localStorage.
  useEffect(() => {
    setHasMounted(true);
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          fetchBalance();
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchBalance]);

  const handleAuthenticated = async () => {
    setAuthChecking(true);
    try {
      const me = await getMe();
      setUser(me);
      fetchBalance();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Post-auth getMe failed:', err);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore — clear local state regardless
    }
    setUser(null);
    setBalance(null);
  };

  if (!hasMounted || authChecking) return null;

  if (!user) {
    return <LoginModal onAuthenticated={handleAuthenticated} />;
  }

  const balanceUSD = balance != null ? balance / MICRO_USD_PER_USD : null;

  return (
    <div className="flex flex-col h-screen bg-app-bg text-white">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <h1 className="text-lg font-semibold">Modelhub Playground</h1>
        <nav className="flex gap-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`px-3 py-1 rounded ${activeTab === t.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-sm text-white/60">
          <span title="Wallet balance">
            {balanceUSD != null ? `$${balanceUSD.toFixed(2)}` : '—'}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-white/40 hover:text-white/80 transition-colors text-xs"
            title={user?.email}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {activeTab === 'image' && <ImageStudio apiKey="" />}
        {activeTab === 'video' && <VideoStudio apiKey="" />}
        {activeTab === 'lipsync' && <LipSyncStudio apiKey="" />}
        {activeTab === 'cinema' && <CinemaStudio apiKey="" />}
        {activeTab === 'marketing' && <MarketingStudio apiKey="" />}
        {activeTab === 'apps' && <AppsStudio apiKey="" />}
      </main>
    </div>
  );
}
