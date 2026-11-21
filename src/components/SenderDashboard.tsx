import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getCopy, OUTING_TOPIC_PRESETS, PLAN_OPTIONS } from '../i18n';
import { subscribeToProposal } from '../services/proposalService';
import type { Language, Proposal } from '../types';
import { getShareableOrigin, playPopSound } from '../utils/effects';
import { SwayingFlower } from './SwayingFlower';

interface SenderDashboardProps {
  proposalId: string;
  initialPin?: string;
  lang: Language;
  onToggleLang: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  onBackHome: () => void;
}

export function SenderDashboard({
  proposalId,
  initialPin = '',
  lang,
  onToggleLang,
  soundMuted,
  onToggleSound,
  onBackHome,
}: SenderDashboardProps) {
  const t = getCopy(lang);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [pinEntry, setPinEntry] = useState(initialPin);
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setLoading(true);
    setErrorMsg('');

    const unsubscribe = subscribeToProposal(
      proposalId,
      (data) => {
        setProposal(data);
        setLoading(false);
        if (data && initialPin && initialPin === data.pin) {
          setUnlocked(true);
        }
      },
      (err) => {
        setErrorMsg(err.message || 'Unable to connect to live updates.');
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [proposalId, initialPin]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposal) return;
    if (pinEntry.trim() === proposal.pin) {
      playPopSound();
      setUnlocked(true);
      setPinError('');
    } else {
      setPinError(t.pinWrong);
    }
  };

  const { origin: shareableOrigin } = getShareableOrigin();
  const currentPath =
    typeof window !== 'undefined'
      ? window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '')
      : '';
  const receiverUrl = `${shareableOrigin}${currentPath}/?p=${proposalId}`;

  const copyReceiverUrl = async () => {
    playPopSound();
    try {
      await navigator.clipboard.writeText(receiverUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-10 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-7 h-7 text-[#B91C3B] animate-spin" />
          <p className="text-sm font-medium text-[#6B5F5B]">{t.loadingText}</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !proposal) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-8 sm:p-10 text-center space-y-5">
          <SwayingFlower className="w-12 h-12 mx-auto" />
          <h1 className="font-display text-2xl font-semibold text-[#181414]">{t.notFoundTitle}</h1>
          <p className="text-sm text-[#6B5F5B]">{errorMsg || t.notFoundBody}</p>
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#181414] text-white text-sm font-medium hover:bg-[#2F2726] transition-colors cursor-pointer"
          >
            {t.backHome}
          </button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] text-[#181414] flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-6 sm:p-9 space-y-6"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF2EC] text-[#B91C3B] text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              {t.dashBadge}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleSound}
                aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                title={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
                className="min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-full border border-[#E5DAD0] bg-[#FAF6F0] text-[#4A403D] hover:bg-[#F3ECE3] hover:text-[#181414] inline-flex items-center justify-center cursor-pointer"
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onToggleLang}
                className="min-h-[36px] px-3 py-1 rounded-full border border-[#E5DAD0] bg-[#FAF6F0] text-xs font-medium text-[#181414] hover:bg-[#F3ECE3] cursor-pointer"
              >
                {t.langToggleLabel}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center text-center space-y-3">
            <SwayingFlower className="w-12 h-12" />
            <h1 className="font-display text-3xl font-semibold text-[#181414]">
              {t.pinGateTitleBefore}
              <em className="italic text-[#B91C3B] font-semibold">{t.pinGateTitleAccent}</em>
            </h1>
            <p className="text-sm text-[#6B5F5B] leading-relaxed">
              {proposal.senderName} &rarr; {proposal.receiverName} · {t.pinGateSubtitle}
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#8A7D77] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                value={pinEntry}
                onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                aria-label="4-digit PIN"
                className="w-full min-h-[50px] pl-11 pr-4 py-2.5 rounded-2xl border border-[#E3D8CC] bg-[#FAF6F0] text-center text-xl font-mono-tabular tracking-[0.4em] text-[#181414] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
              />
            </div>

            {pinError && (
              <p className="text-sm text-[#B91C3B] text-center font-medium" role="alert">
                {pinError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-[#B91C3B] text-white text-sm font-semibold hover:bg-[#9F1239] transition-colors cursor-pointer"
            >
              {t.pinGateBtn}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B5F5B] hover:text-[#181414] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.backHome}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const statusText =
    proposal.status === 'said_yes'
      ? t.statusSaidYes
      : proposal.status === 'opened'
        ? t.statusOpened
        : t.statusWaiting;

  const statusTone =
    proposal.status === 'said_yes'
      ? 'bg-[#EBF4EE] text-[#3F6349] border-[#CBE0D1]'
      : proposal.status === 'opened'
        ? 'bg-[#FEF6E6] text-[#9A5B13] border-[#F5DFB5]'
        : 'bg-[#F5F1EC] text-[#6B5F5B] border-[#E3D8CC]';

  const planDisplay =
    PLAN_OPTIONS.find((item) => item.id === proposal.plan)?.[lang] || proposal.plan;

  const outingTopicDisplay =
    OUTING_TOPIC_PRESETS.find((item) => item.id === proposal.outingTopic)?.[lang] ||
    proposal.outingTopic ||
    OUTING_TOPIC_PRESETS[0][lang];

  const isSenderPaysMode = proposal.treatPayer === 'sender';
  const treatClicksMsg = isSenderPaysMode
    ? proposal.treatClicks === 0
      ? t.treatClicksZeroSender(proposal.receiverName)
      : t.treatClicksFunSender(proposal.receiverName, proposal.treatClicks)
    : proposal.treatClicks === 0
      ? t.treatClicksZeroReceiver(proposal.receiverName)
      : t.treatClicksFunReceiver(proposal.receiverName, proposal.treatClicks);

  const finalTreatDisplay =
    proposal.treatChoice === 'receiver'
      ? t.treatingFinalReceiver(proposal.receiverName)
      : proposal.treatChoice === 'sender'
        ? t.treatingFinalSender(proposal.senderName)
        : t.notChosenYet;

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#181414] flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-6 sm:p-10 space-y-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FAF2EC] text-[#B91C3B] text-xs font-semibold">
              {t.dashBadge}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C7C65]">
              <Radio className="w-3.5 h-3.5" />
              {t.dashLiveLabel}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={copyReceiverUrl}
              className="min-h-[36px] px-3 py-1 rounded-full border border-[#E5DAD0] bg-white text-xs font-medium text-[#181414] hover:bg-[#FAF6F0] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#5C7C65]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? t.copiedBtn : t.receiverLinkLabel}
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-full border border-[#E5DAD0] bg-[#FAF6F0] text-[#4A403D] hover:bg-[#F3ECE3] hover:text-[#181414] inline-flex items-center justify-center cursor-pointer"
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleLang}
              className="min-h-[36px] px-3 py-1 rounded-full border border-[#E5DAD0] bg-[#FAF6F0] text-xs font-medium text-[#181414] hover:bg-[#F3ECE3] cursor-pointer"
            >
              {t.langToggleLabel}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 border-b border-[#EFE7DE] pb-5">
          <SwayingFlower className="w-12 h-12 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#6B5F5B]">
              {proposal.senderName} &rarr; {proposal.receiverName} · {outingTopicDisplay}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#181414] truncate">
              {t.dashTitleBefore}
              <em className="italic text-[#B91C3B]">{proposal.receiverName}</em>
            </h1>
          </div>
          <span className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap ${statusTone}`}>
            {statusText}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 p-6 rounded-2xl bg-[#FDF4F5] border border-[#F2D5DA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#9F1239]">{t.treatClicksLabel}</p>
              <p className="text-base sm:text-lg font-semibold text-[#181414]">
                {treatClicksMsg}
              </p>
            </div>
            <div className="font-mono-tabular text-5xl font-bold text-[#B91C3B] shrink-0">
              {proposal.treatClicks}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD2] space-y-1.5">
            <p className="text-xs font-semibold text-[#6B5F5B]">{t.statusLabel}</p>
            <p className="font-display text-2xl font-semibold text-[#181414]">{statusText}</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD2] space-y-1.5">
            <p className="text-xs font-semibold text-[#6B5F5B]">{t.noDodgesMetric}</p>
            <p className="font-mono-tabular text-3xl font-bold text-[#181414]">
              {proposal.noDodges}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD2] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#6B5F5B]">{t.chosenDetailsLabel}</p>
            <span className="text-xs font-medium text-[#6B5F5B]">
              {t.outingTopicSummaryLabel}: <strong className="text-[#181414]">{outingTopicDisplay}</strong>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#8A7D77]">{t.dayLabel}</p>
              <p className="font-semibold text-[#181414] mt-0.5">
                {proposal.day || t.notChosenYet}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A7D77]">{t.timeLabel}</p>
              <p className="font-semibold text-[#181414] mt-0.5">
                {proposal.time
                  ? (() => {
                      const [hStr, mStr] = proposal.time.split(':');
                      const h = Number(hStr);
                      if (Number.isNaN(h) || mStr === undefined) return proposal.time;
                      const suffix = h >= 12 ? 'PM' : 'AM';
                      const h12 = h % 12 === 0 ? 12 : h % 12;
                      return `${h12}:${mStr} ${suffix}`;
                    })()
                  : t.notChosenYet}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A7D77]">{t.locationLabel}</p>
              <p className="font-semibold text-[#181414] mt-0.5 break-words">
                {proposal.location || t.notChosenYet}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A7D77]">{t.whatLabel}</p>
              <p className="font-semibold text-[#181414] mt-0.5">
                {planDisplay || t.notChosenYet}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A7D77]">{t.whoTreatingLabel}</p>
              <p className="font-semibold text-[#5C7C65] mt-0.5">
                {finalTreatDisplay}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E7DDD2] space-y-3">
          <p className="text-xs font-semibold text-[#6B5F5B]">{t.letterSectionLabel}</p>
          {proposal.letter ? (
            <p className="font-display text-base sm:text-lg leading-relaxed text-[#181414] whitespace-pre-line">
              {proposal.letter}
            </p>
          ) : (
            <p className="text-sm text-[#8A7D77] italic">{t.letterPending}</p>
          )}
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B5F5B] hover:text-[#181414] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.backHome}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
