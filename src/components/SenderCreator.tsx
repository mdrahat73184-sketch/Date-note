import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Lock,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { createProposal } from '../services/proposalService';
import { getCopy, OUTING_TOPIC_PRESETS } from '../i18n';
import type { Language, StoredProposalLink, TreatPayer } from '../types';
import { getShareableOrigin, playPopSound } from '../utils/effects';
import { SwayingFlower } from './SwayingFlower';

const STORAGE_KEY = 'sealed_created_proposals_v1';

interface SenderCreatorProps {
  lang: Language;
  onToggleLang: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  onOpenProposal: (proposalId: string) => void;
  onOpenDashboard: (proposalId: string) => void;
}

export function SenderCreator({
  lang,
  onToggleLang,
  soundMuted,
  onToggleSound,
  onOpenProposal,
  onOpenDashboard,
}: SenderCreatorProps) {
  const t = getCopy(lang);

  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [outingPreset, setOutingPreset] = useState<string>('Date');
  const [customOuting, setCustomOuting] = useState('');
  const [treatPayer, setTreatPayer] = useState<TreatPayer>('receiver');
  const [pinInput, setPinInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [created, setCreated] = useState<{
    proposalId: string;
    pin: string;
    senderName: string;
    receiverName: string;
    outingTopic: string;
    treatPayer: TreatPayer;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'receiver' | 'dashboard' | 'pin' | null>(null);
  const [recentLinks, setRecentLinks] = useState<StoredProposalLink[]>([]);
  const [lookupId, setLookupId] = useState('');
  const [showLookup, setShowLookup] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredProposalLink[];
        if (Array.isArray(parsed)) {
          setRecentLinks(parsed.slice(0, 4));
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }, []);

  const saveRecentLink = (entry: StoredProposalLink) => {
    try {
      const next = [
        entry,
        ...recentLinks.filter((item) => item.proposalId !== entry.proposalId),
      ].slice(0, 4);
      setRecentLinks(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write errors
    }
  };

  const resolvedOutingTopic =
    outingPreset === '__custom__'
      ? customOuting.trim().slice(0, 80) || 'Date'
      : outingPreset;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanSender = senderName.trim();
    const cleanReceiver = receiverName.trim();
    const cleanPin = pinInput.trim();

    if (!cleanSender || !cleanReceiver) {
      setErrorMsg(t.missingNamesError);
      return;
    }

    if (cleanPin && !/^[0-9]{4}$/.test(cleanPin)) {
      setErrorMsg(t.pinError);
      return;
    }

    setCreating(true);
    try {
      const { proposalId, pin } = await createProposal(cleanSender, cleanReceiver, {
        optionalPin: cleanPin,
        outingTopic: resolvedOutingTopic,
        treatPayer,
      });
      const entry: StoredProposalLink = {
        proposalId,
        pin,
        senderName: cleanSender.slice(0, 60),
        receiverName: cleanReceiver.slice(0, 60),
        outingTopic: resolvedOutingTopic,
        treatPayer,
        createdAtIso: new Date().toISOString(),
      };
      saveRecentLink(entry);
      playPopSound();
      setCreated({
        proposalId,
        pin,
        senderName: entry.senderName,
        receiverName: entry.receiverName,
        outingTopic: entry.outingTopic,
        treatPayer: entry.treatPayer,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to create proposal. Please try again.',
      );
    } finally {
      setCreating(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentPath =
    typeof window !== 'undefined'
      ? window.location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '')
      : '';
  const { origin: shareableOrigin, isDevPreview } = getShareableOrigin();
  const receiverUrl = created ? `${shareableOrigin}${currentPath}/?p=${created.proposalId}` : '';
  const dashboardUrl = created ? `${currentOrigin}${currentPath}/?d=${created.proposalId}` : '';

  const copyText = async (text: string, field: 'receiver' | 'dashboard' | 'pin') => {
    playPopSound();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const shareReceiverLink = async () => {
    if (!created) return;
    playPopSound();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `A little question for ${created.receiverName}`,
          text: `${created.senderName} sent you an invitation.`,
          url: receiverUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await copyText(receiverUrl, 'receiver');
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = lookupId.trim();
    if (!clean) return;
    const match = clean.match(/[?&]d=([a-zA-Z0-9_-]+)/);
    const id = match ? match[1] : clean;
    playPopSound();
    onOpenDashboard(id);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#181414] flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-6 sm:p-10 space-y-7"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FAF2EC] text-[#B91C3B] text-xs font-semibold tracking-wide">
            {created ? t.createBadge : t.brandBadge}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                playPopSound();
                setShowLookup((prev) => !prev);
              }}
              className="text-xs font-medium text-[#6B5F5B] hover:text-[#181414] transition-colors whitespace-nowrap cursor-pointer"
            >
              {t.openExistingDashBtn}
            </button>
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              title={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-full border border-[#E5DAD0] bg-[#FAF6F0] text-[#4A403D] hover:bg-[#F3ECE3] hover:text-[#181414] transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleLang}
              className="min-h-[36px] px-3 py-1 rounded-full border border-[#E5DAD0] bg-[#FAF6F0] text-xs font-medium text-[#181414] hover:bg-[#F3ECE3] transition-colors whitespace-nowrap cursor-pointer"
            >
              {t.langToggleLabel}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center text-center space-y-3">
          <SwayingFlower className="w-14 h-14" />

          {!created ? (
            <>
              <h1
                className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#181414] leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {t.createTitlePrefix}
                <em className="italic text-[#B91C3B] font-semibold">{t.createTitleAccent}</em>
                {t.createTitleSuffix}
              </h1>
              <p className="text-sm text-[#6B5F5B] max-w-md leading-relaxed">
                {t.createSubtitle}
              </p>
            </>
          ) : (
            <h1
              className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#181414] leading-tight"
              style={{ textWrap: 'balance' }}
            >
              {t.linksReadyTitlePrefix}
              <em className="italic text-[#B91C3B] font-semibold">{t.linksReadyTitleAccent}</em>
              {t.linksReadyTitleSuffix}
            </h1>
          )}
        </div>

        {showLookup && (
          <form
            onSubmit={handleLookupSubmit}
            className="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD2] flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Proposal ID or ?d=... link"
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DFD3C6] bg-white text-sm text-[#181414] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#181414] text-white text-sm font-medium hover:bg-[#2F2726] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.openDashBtn}
            </button>
          </form>
        )}

        {!created ? (
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="senderName" className="block text-xs font-semibold text-[#4A403D]">
                  {t.senderLabel}
                </label>
                <input
                  id="senderName"
                  type="text"
                  required
                  maxLength={60}
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder={t.senderPlaceholder}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-base text-[#181414] placeholder:text-[#A3958E] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="receiverName" className="block text-xs font-semibold text-[#4A403D]">
                  {t.receiverLabel}
                </label>
                <input
                  id="receiverName"
                  type="text"
                  required
                  maxLength={60}
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder={t.receiverPlaceholder}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-base text-[#181414] placeholder:text-[#A3958E] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
                />
              </div>
            </div>

            {/* Outing / Custom Invitation Topic */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#4A403D]">{t.outingLabel}</p>
              <div className="flex flex-wrap gap-2">
                {OUTING_TOPIC_PRESETS.map((preset) => {
                  const active = outingPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        playPopSound();
                        setOutingPreset(preset.id);
                      }}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#B91C3B] text-white shadow-sm'
                          : 'bg-[#FAF6F0] text-[#4A403D] border border-[#E3D8CC] hover:border-[#B91C3B]/40'
                      }`}
                    >
                      {preset[lang]}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setOutingPreset('__custom__');
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                    outingPreset === '__custom__'
                      ? 'bg-[#B91C3B] text-white shadow-sm'
                      : 'bg-[#FAF6F0] text-[#4A403D] border border-[#E3D8CC] hover:border-[#B91C3B]/40'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.customChipLabel}
                </button>
              </div>

              {outingPreset === '__custom__' && (
                <input
                  type="text"
                  maxLength={80}
                  value={customOuting}
                  onChange={(e) => setCustomOuting(e.target.value)}
                  placeholder={t.outingPlaceholder}
                  aria-label={t.outingLabel}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-sm text-[#181414] placeholder:text-[#A3958E] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
                />
              )}
            </div>

            {/* Who's Paying / Treating Selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#4A403D]">{t.treatPayerLabel}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setTreatPayer('receiver');
                  }}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 ${
                    treatPayer === 'receiver'
                      ? 'border-[#B91C3B] bg-[#FDF4F5] shadow-sm'
                      : 'border-[#E3D8CC] bg-[#FAF6F0]/60 hover:border-[#B91C3B]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#181414]">
                      {t.treatPayerReceiverBtn}
                    </span>
                    {treatPayer === 'receiver' && (
                      <span className="w-5 h-5 rounded-full bg-[#B91C3B] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B5F5B] leading-snug">
                    {t.treatPayerReceiverSub}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setTreatPayer('sender');
                  }}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer space-y-1 ${
                    treatPayer === 'sender'
                      ? 'border-[#5C7C65] bg-[#F2F7F3] shadow-sm'
                      : 'border-[#E3D8CC] bg-[#FAF6F0]/60 hover:border-[#5C7C65]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#181414]">
                      {t.treatPayerSenderBtn}
                    </span>
                    {treatPayer === 'sender' && (
                      <span className="w-5 h-5 rounded-full bg-[#5C7C65] text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B5F5B] leading-snug">
                    {t.treatPayerSenderSub}
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="pinInput" className="block text-xs font-semibold text-[#4A403D]">
                {t.pinLabel}
              </label>
              <input
                id="pinInput"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={t.pinPlaceholder}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-base font-mono-tabular tracking-widest text-[#181414] placeholder:tracking-normal placeholder:font-sans placeholder:text-[#A3958E] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-[#B91C3B] font-medium" role="alert">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full min-h-[50px] px-6 py-3 rounded-2xl bg-[#B91C3B] text-white text-sm font-semibold hover:bg-[#9F1239] disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {creating ? (
                t.creatingBtn
              ) : (
                <>
                  {t.createBtn}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD2] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#181414]">
                  1. {t.receiverLinkLabel} ({created.receiverName})
                </span>
              </div>

              <input
                type="text"
                readOnly
                value={receiverUrl}
                aria-label={t.receiverLinkLabel}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#DFD3C6] bg-white text-xs sm:text-sm font-mono-tabular text-[#181414] truncate"
              />

              {isDevPreview && (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#6B5F5B] bg-white/80 border border-[#E7DDD2] rounded-xl px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-[#B91C3B] shrink-0 mt-0.5" />
                  <span>{t.devPreviewLinkTip}</span>
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => copyText(receiverUrl, 'receiver')}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#181414] text-white text-xs sm:text-sm font-medium hover:bg-[#2F2726] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {copiedField === 'receiver' ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t.copiedBtn}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t.copyBtn}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={shareReceiverLink}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-[#B91C3B] text-white text-xs sm:text-sm font-medium hover:bg-[#9F1239] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  {t.shareBtn}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onOpenProposal(created.proposalId);
                  }}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#DFD3C6] bg-white text-xs font-medium text-[#4A403D] hover:text-[#181414] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {t.openPreviewBtn}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#FDF4F5] border border-[#F2D5DA] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#181414]">
                  <Lock className="w-4 h-4 text-[#B91C3B]" />
                  2. {t.dashboardLinkLabel}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white border border-[#F0CCD3]">
                <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#4A403D]">
                  <KeyRound className="w-4 h-4 text-[#B91C3B]" />
                  {t.pinNote}:
                  <strong className="font-mono-tabular text-base text-[#181414] tracking-widest">
                    {created.pin}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => copyText(created.pin, 'pin')}
                  className="text-xs font-semibold text-[#B91C3B] hover:text-[#9F1239] whitespace-nowrap cursor-pointer"
                >
                  {copiedField === 'pin' ? t.copiedBtn : t.copyBtn}
                </button>
              </div>

              <input
                type="text"
                readOnly
                value={dashboardUrl}
                aria-label={t.dashboardLinkLabel}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#EBCAD1] bg-white text-xs sm:text-sm font-mono-tabular text-[#181414] truncate"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => copyText(dashboardUrl, 'dashboard')}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DFD3C6] bg-white text-[#181414] text-xs sm:text-sm font-medium hover:bg-[#FAF6F0] transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {copiedField === 'dashboard' ? (
                    <>
                      <Check className="w-4 h-4 text-[#5C7C65]" />
                      {t.copiedBtn}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t.copyBtn}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onOpenDashboard(created.proposalId);
                  }}
                  className="flex-1 min-h-[44px] px-5 py-2 rounded-xl bg-[#B91C3B] text-white text-xs sm:text-sm font-semibold hover:bg-[#9F1239] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  {t.openDashBtn}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  setCreated(null);
                  setSenderName('');
                  setReceiverName('');
                  setCustomOuting('');
                  setOutingPreset('Date');
                  setTreatPayer('receiver');
                  setPinInput('');
                }}
                className="text-xs font-medium text-[#6B5F5B] hover:text-[#181414] underline underline-offset-4 cursor-pointer"
              >
                {t.createAnotherBtn}
              </button>
            </div>
          </div>
        )}

        {!created && recentLinks.length > 0 && (
          <div className="pt-5 border-t border-[#EFE7DE] space-y-3">
            <p className="text-xs font-medium text-[#6B5F5B]">Recent on this device</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {recentLinks.map((item) => (
                <button
                  key={item.proposalId}
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onOpenDashboard(item.proposalId);
                  }}
                  className="text-left p-3 rounded-xl border border-[#EAE0D5] bg-[#FAF6F0]/60 hover:bg-[#FAF6F0] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#181414] truncate">
                      {item.senderName} &rarr; {item.receiverName}
                    </p>
                    <p className="text-[11px] font-mono-tabular text-[#6B5F5B] truncate">
                      PIN {item.pin}
                      {item.outingTopic ? ` · ${item.outingTopic}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B91C3B] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
