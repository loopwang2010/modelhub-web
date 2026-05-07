'use client';

// Pruned in S10: removed WorkflowStudio + AgentStudio (depended on
// Vibe-Workflow + Open-Poe-AI submodules which are gone). Removed all
// workflow/agent routing logic and the fromWorkflowBuilder reload kludge.
//
// This file will be replaced in the main S10 task when we swap muapi.js
// for modelhub-client.js. For now it's the minimum surface that compiles
// and lets the existing tests + dev server boot.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ImageStudio,
  VideoStudio,
  LipSyncStudio,
  CinemaStudio,
  MarketingStudio,
  AppsStudio,
  getUserBalance,
} from 'studio';
import ApiKeyModal from './ApiKeyModal';

const TABS = [
  { id: 'image',     label: 'Image Studio' },
  { id: 'video',     label: 'Video Studio' },
  { id: 'lipsync',   label: 'Lip Sync' },
  { id: 'cinema',    label: 'Cinema Studio' },
  { id: 'marketing', label: 'Marketing Studio' },
  { id: 'apps',      label: 'Explore Apps' },
];

const STORAGE_KEY = 'muapi_key';

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

  const [apiKey, setApiKey] = useState(null);
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

  const fetchBalance = useCallback(async (key) => {
    try {
      const data = await getUserBalance(key);
      setBalance(data.balance);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      fetchBalance(stored);
    }
  }, [fetchBalance]);

  const handleSaveKey = (key) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
    fetchBalance(key);
  };

  if (!hasMounted) return null;

  if (!apiKey) {
    return <ApiKeyModal onSave={handleSaveKey} />;
  }

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
        <div className="text-sm text-white/60">
          {balance != null ? `$${balance.toFixed(2)}` : '—'}
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {activeTab === 'image' && <ImageStudio apiKey={apiKey} />}
        {activeTab === 'video' && <VideoStudio apiKey={apiKey} />}
        {activeTab === 'lipsync' && <LipSyncStudio apiKey={apiKey} />}
        {activeTab === 'cinema' && <CinemaStudio apiKey={apiKey} />}
        {activeTab === 'marketing' && <MarketingStudio apiKey={apiKey} />}
        {activeTab === 'apps' && <AppsStudio apiKey={apiKey} />}
      </main>
    </div>
  );
}
