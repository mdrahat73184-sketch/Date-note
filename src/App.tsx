import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReceiverFlow } from './components/ReceiverFlow';
import { SenderCreator } from './components/SenderCreator';
import { SenderDashboard } from './components/SenderDashboard';
import type { Language } from './types';
import { isSoundMuted, playPopSound, setSoundMuted } from './utils/effects';

type RouteState =
  | { mode: 'create' }
  | { mode: 'receiver'; proposalId: string }
  | { mode: 'dashboard'; proposalId: string; pin?: string };

function parseRouteFromLocation(): RouteState {
  if (typeof window === 'undefined') return { mode: 'create' };
  const params = new URLSearchParams(window.location.search);
  const p = params.get('p')?.trim();
  if (p && /^[a-zA-Z0-9_-]{8,64}$/.test(p)) {
    return { mode: 'receiver', proposalId: p };
  }
  const d = params.get('d')?.trim();
  if (d && /^[a-zA-Z0-9_-]{8,64}$/.test(d)) {
    const pin = params.get('pin')?.trim() || undefined;
    return { mode: 'dashboard', proposalId: d, pin };
  }
  return { mode: 'create' };
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRouteFromLocation());
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('date_proposal_lang');
      return saved === 'bn' ? 'bn' : 'en';
    } catch {
      return 'en';
    }
  });
  const [muted, setMuted] = useState<boolean>(() => isSoundMuted());

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const toggleLang = () => {
    playPopSound();
    setLang((prev) => {
      const next = prev === 'en' ? 'bn' : 'en';
      try {
        localStorage.setItem('date_proposal_lang', next);
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const toggleSound = () => {
    setMuted((prev) => {
      const next = !prev;
      setSoundMuted(next);
      if (!next) {
        playPopSound();
      }
      return next;
    });
  };

  const navigate = (url: string) => {
    window.history.pushState({}, '', url);
    setRoute(parseRouteFromLocation());
  };

  const basePath =
    typeof window !== 'undefined'
      ? window.location.pathname.replace(/\/index\.html$/, '') || '/'
      : '/';

  return (
    <ErrorBoundary>
      {route.mode === 'receiver' && (
        <ReceiverFlow
          proposalId={route.proposalId}
          lang={lang}
          onToggleLang={toggleLang}
          soundMuted={muted}
          onToggleSound={toggleSound}
          onStartOver={() => navigate(basePath)}
        />
      )}

      {route.mode === 'dashboard' && (
        <SenderDashboard
          proposalId={route.proposalId}
          initialPin={route.pin}
          lang={lang}
          onToggleLang={toggleLang}
          soundMuted={muted}
          onToggleSound={toggleSound}
          onBackHome={() => navigate(basePath)}
        />
      )}

      {route.mode === 'create' && (
        <SenderCreator
          lang={lang}
          onToggleLang={toggleLang}
          soundMuted={muted}
          onToggleSound={toggleSound}
          onOpenProposal={(id) => navigate(`${basePath}?p=${encodeURIComponent(id)}`)}
          onOpenDashboard={(id) => navigate(`${basePath}?d=${encodeURIComponent(id)}`)}
        />
      )}
    </ErrorBoundary>
  );
}
