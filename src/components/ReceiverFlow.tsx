import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Calendar,
  Check,
  Clock,
  Heart,
  Loader2,
  Pencil,
  RotateCcw,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DODGE_LABELS,
  getCopy,
  OUTING_TOPIC_PRESETS,
  PLAN_OPTIONS,
  TREAT_RECEIVER_PAYS_SHRINK_LABELS,
  TREAT_SENDER_PAYS_SHRINK_LABELS,
} from '../i18n';
import {
  fetchProposal,
  generateLetter,
  incrementNoDodges,
  incrementTreatClicks,
  markProposalOpened,
  markProposalSaidYes,
  sealProposal,
} from '../services/proposalService';
import type { Language, Proposal, TreatPayer } from '../types';
import {
  fireConfettiExplosion,
  playCelebrationChime,
  playDodgeSound,
  playGenerousShrinkSound,
  playPoofSound,
  playPopSound,
  playShrinkSound,
  playSparklePoofSound,
} from '../utils/effects';
import { ConfettiHearts, SwayingFlower } from './SwayingFlower';
import keepsakeWaxSealImg from '../assets/images/keepsake_wax_seal_1795111854426.jpg';

interface ReceiverFlowProps {
  proposalId: string;
  lang: Language;
  onToggleLang: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  onStartOver: () => void;
}

type ScreenStep = 1 | 2 | 3 | 4;

export function ReceiverFlow({
  proposalId,
  lang,
  onToggleLang,
  soundMuted,
  onToggleSound,
  onStartOver,
}: ReceiverFlowProps) {
  const t = getCopy(lang);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [step, setStep] = useState<ScreenStep>(1);

  // Screen 1: Ask & Dodging No state
  const [noDodges, setNoDodges] = useState(0);
  const [noPos, setNoPos] = useState<{ x: number; y: number } | null>(null);
  const [savingYes, setSavingYes] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const openedMarkedRef = useRef(false);
  const lastDodgeAtRef = useRef(0);

  // Screen 3: Plan & Who's treating state
  const [day, setDay] = useState('');
  const [time, setTime] = useState('18:30');
  const [planChoice, setPlanChoice] = useState('');
  const [customPlanText, setCustomPlanText] = useState('');
  const [treatTaps, setTreatTaps] = useState(0);
  const [showPoof, setShowPoof] = useState(false);
  const [treatChoice, setTreatChoice] = useState<'' | TreatPayer>('');
  const [sealing, setSealing] = useState(false);

  // Screen 4: Letter & Share state
  const [letter, setLetter] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMsg('');
      try {
        const data = await fetchProposal(proposalId);
        if (!active) return;

        if (!data) {
          setProposal(null);
          setLoading(false);
          return;
        }

        setProposal(data);
        setNoDodges(data.noDodges);
        setTreatTaps(Math.min(data.treatClicks, 5));

        if (data.letter) {
          setDay(data.day);
          setTime(data.time);
          const isPreset = PLAN_OPTIONS.some((opt) => opt.id === data.plan);
          if (isPreset || !data.plan) {
            setPlanChoice(data.plan);
          } else {
            setPlanChoice('__custom__');
            setCustomPlanText(data.plan);
          }
          setTreatChoice(data.treatChoice);
          setLetter(data.letter);
          setStep(4);
        } else if (data.status === 'said_yes') {
          setStep(3);
        } else {
          setStep(1);
          if (data.status === 'waiting' && !openedMarkedRef.current) {
            openedMarkedRef.current = true;
            await markProposalOpened(proposalId);
            if (active) {
              setProposal((prev) => (prev ? { ...prev, status: 'opened' } : prev));
            }
          }
        }
      } catch (err) {
        if (active) {
          setErrorMsg(
            err instanceof Error ? err.message : 'Unable to load this invitation.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [proposalId]);

  const handleDodgeNo = useCallback(() => {
    if (!proposal || savingYes) return;
    const now = Date.now();
    if (now - lastDodgeAtRef.current < 160) return;
    lastDodgeAtRef.current = now;

    const stage = stageRef.current;
    let nextX = (Math.random() - 0.5) * 180;
    let nextY = (Math.random() - 0.5) * 100;

    if (stage) {
      const rect = stage.getBoundingClientRect();
      const maxOffsetX = Math.max(40, rect.width / 2 - 64);
      const maxOffsetY = Math.max(30, rect.height / 2 - 28);
      nextX = (Math.random() * 2 - 1) * maxOffsetX;
      nextY = (Math.random() * 2 - 1) * maxOffsetY;
    }

    setNoPos({ x: nextX, y: nextY });
    setNoDodges((prev) => prev + 1);
    setProposal((prev) => (prev ? { ...prev, noDodges: prev.noDodges + 1 } : prev));
    playDodgeSound();

    void incrementNoDodges(proposal.id).catch((err) => {
      console.error('Failed to increment noDodges:', err);
    });
  }, [proposal, savingYes]);

  const handleSayYes = async () => {
    if (!proposal || savingYes) return;
    setSavingYes(true);
    setErrorMsg('');
    try {
      await markProposalSaidYes(proposal.id);
      setProposal((prev) => (prev ? { ...prev, status: 'said_yes' } : prev));
      setStep(2);
      playCelebrationChime();
      fireConfettiExplosion('yes');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save your response.');
    } finally {
      setSavingYes(false);
    }
  };

  const handleTapShrinkingTreat = () => {
    if (!proposal || treatTaps >= 5) return;
    const nextTap = treatTaps + 1;
    setTreatTaps(nextTap);
    setProposal((prev) => (prev ? { ...prev, treatClicks: prev.treatClicks + 1 } : prev));

    const isSenderPaysMode = proposal.treatPayer === 'sender';

    if (nextTap >= 5) {
      if (isSenderPaysMode) {
        playSparklePoofSound();
      } else {
        playPoofSound();
      }
      setShowPoof(true);
      setTimeout(() => setShowPoof(false), 750);
    } else if (isSenderPaysMode) {
      playGenerousShrinkSound(nextTap);
    } else {
      playShrinkSound(nextTap);
    }

    void incrementTreatClicks(proposal.id).catch((err) => {
      console.error('Failed to increment treatClicks:', err);
    });
  };

  const resolvedPlan =
    planChoice === '__custom__' ? customPlanText.trim().slice(0, 120) : planChoice;

  const handleSealWithLetter = async () => {
    if (
      !proposal ||
      !day ||
      !time ||
      !resolvedPlan ||
      treatChoice !== proposal.treatPayer ||
      sealing
    ) {
      return;
    }

    playPopSound();
    setSealing(true);
    setErrorMsg('');
    try {
      const generated = await generateLetter({
        senderName: proposal.senderName,
        receiverName: proposal.receiverName,
        outingTopic: proposal.outingTopic || 'Date',
        day,
        time,
        plan: resolvedPlan,
        treatPayer: proposal.treatPayer,
        treatChoice: proposal.treatPayer,
        treatClicks: proposal.treatClicks,
        noDodges: proposal.noDodges,
        lang,
      });

      await sealProposal(proposal.id, {
        day,
        time,
        plan: resolvedPlan,
        treatChoice: proposal.treatPayer,
        letter: generated,
      });

      setLetter(generated);
      setProposal((prev) =>
        prev
          ? {
              ...prev,
              day,
              time,
              plan: resolvedPlan,
              treatChoice: proposal.treatPayer,
              letter: generated,
            }
          : prev,
      );
      setStep(4);
      playCelebrationChime();
      fireConfettiExplosion('sealed');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not seal your letter. Please try again.',
      );
    } finally {
      setSealing(false);
    }
  };

  const handleShareGoodNews = async () => {
    if (!proposal) return;
    playPopSound();
    const summary = `${proposal.senderName} & ${proposal.receiverName} — ${resolvedPlan} on ${day} at ${time}!\n\n${letter}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `It's a plan!`,
          text: summary,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      // Ignore
    }
  };

  const formatTimeLabel = (val: string) => {
    if (!val || !val.includes(':')) return val;
    const [hStr, mStr] = val.split(':');
    const h = Number(hStr);
    if (Number.isNaN(h)) return val;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mStr} ${suffix}`;
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

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-8 sm:p-10 text-center space-y-4">
          <SwayingFlower className="w-12 h-12 mx-auto" />
          <h1 className="font-display text-2xl font-semibold text-[#181414]">{t.notFoundTitle}</h1>
          <p className="text-sm text-[#6B5F5B]">{t.notFoundBody}</p>
        </div>
      </div>
    );
  }

  const dodgeLabelList = DODGE_LABELS[lang];
  const currentNoLabel = dodgeLabelList[Math.min(noDodges, dodgeLabelList.length - 1)];
  const askSubtitleIdx =
    noDodges === 0 ? 0 : noDodges <= 2 ? 1 : noDodges <= 5 ? 2 : 3;
  const yesScale = 1 + Math.min(noDodges, 8) * 0.08;

  // Outing topic display (Screen 1)
  const rawTopic = proposal.outingTopic.trim();
  const matchedTopicPreset = OUTING_TOPIC_PRESETS.find((item) => item.id === rawTopic);
  const localizedTopic = matchedTopicPreset ? matchedTopicPreset[lang] : rawTopic;
  const useCustomAskHeading = Boolean(rawTopic && rawTopic !== 'Date');

  // Dual Treat Logic based on proposal.treatPayer ('receiver' | 'sender')
  const isSenderPaysMode = proposal.treatPayer === 'sender';
  const shrinkingCardGone = treatTaps >= 5;
  const shrinkingCardScale = Math.max(0.2, 1 - treatTaps * 0.2);

  const receiverPaysLabels = TREAT_RECEIVER_PAYS_SHRINK_LABELS[lang];
  const senderPaysLabels = TREAT_SENDER_PAYS_SHRINK_LABELS[lang];

  const shrinkingCardTitle = isSenderPaysMode
    ? senderPaysLabels[Math.min(treatTaps, senderPaysLabels.length - 1)]
    : treatTaps === 0
      ? `${proposal.senderName} ${receiverPaysLabels[0]}`
      : receiverPaysLabels[Math.min(treatTaps, receiverPaysLabels.length - 1)];

  const winningCardTitle = isSenderPaysMode
    ? `${proposal.senderName} ${t.senderTreatsSuffix}`
    : t.iWillTreat;
  const winningCardSub = isSenderPaysMode ? t.senderTreatsWinsSub : t.iWillTreatSub;
  const shrinkingCardSub = isSenderPaysMode
    ? t.receiverTreatsGenerousSub
    : t.senderTreatsBrokeSub;

  const poofBannerText = isSenderPaysMode ? t.poofLineSenderPays : t.poofLineReceiverPays;
  const mustPickHint = isSenderPaysMode
    ? t.mustPickWinnerSender(proposal.senderName)
    : t.mustPickWinnerReceiver;

  const canSeal = Boolean(
    day && time && resolvedPlan && treatChoice === proposal.treatPayer,
  );

  const selectedPlanLabel =
    PLAN_OPTIONS.find((item) => item.id === resolvedPlan)?.[lang] || resolvedPlan;

  const badgeText =
    step === 1
      ? `${t.askBadgePrefix}${proposal.senderName}`
      : step === 2
        ? t.confirmedBadge
        : step === 3
          ? t.planBadge
          : t.letterBadge;

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#181414] flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-[#EAE0D5] shadow-[0_24px_60px_-20px_rgba(68,45,38,0.12)] p-6 sm:p-10 overflow-hidden">
        {step === 2 && <ConfettiHearts />}

        {/* Top Badge + Sound & Language Toggles */}
        <div className="relative z-10 flex items-center justify-between gap-3 mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FAF2EC] text-[#B91C3B] text-xs font-semibold tracking-wide">
            {badgeText}
          </span>

          <div className="flex items-center gap-2">
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

        <AnimatePresence mode="wait">
          {/* SCREEN 1 — THE ASK */}
          {step === 1 && (
            <motion.div
              key="screen-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 flex flex-col items-center text-center space-y-6"
            >
              <SwayingFlower className="w-16 h-16" />

              <div className="space-y-2.5">
                <p className="text-sm font-medium text-[#B91C3B]">
                  {lang === 'bn'
                    ? `প্রিয় ${proposal.receiverName},`
                    : `Hey ${proposal.receiverName},`}
                </p>
                <h1
                  className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-[#181414] leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  {useCustomAskHeading ? (
                    <>
                      {t.askCustomTopicBefore}
                      <em className="italic text-[#B91C3B] font-semibold">{localizedTopic}</em>
                      {t.askCustomTopicAfter}
                    </>
                  ) : (
                    <>
                      {t.askTitleBefore}
                      <em className="italic text-[#B91C3B] font-semibold">{t.askTitleAccent}</em>
                      {t.askTitleAfter}
                    </>
                  )}
                </h1>
                <p className="text-sm text-[#6B5F5B] max-w-sm mx-auto min-h-[40px] flex items-center justify-center">
                  {t.askSubtitles[askSubtitleIdx]}
                </p>
              </div>

              {/* Interactive YES / Dodging No Stage */}
              <div
                ref={stageRef}
                className="relative w-full min-h-[190px] rounded-2xl bg-[#FAF6F0]/70 border border-[#EFE6DC] flex flex-col items-center justify-center gap-5 p-6 overflow-hidden"
              >
                <motion.button
                  type="button"
                  onClick={handleSayYes}
                  disabled={savingYes}
                  animate={{ scale: yesScale }}
                  transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                  className="min-h-[54px] min-w-[140px] px-8 py-3.5 rounded-2xl bg-[#5C7C65] text-white text-lg font-bold shadow-md hover:bg-[#4B6B54] transition-colors cursor-pointer z-10"
                >
                  {savingYes ? '...' : t.yesBtn}
                </motion.button>

                <motion.button
                  type="button"
                  onMouseEnter={handleDodgeNo}
                  onTouchStart={handleDodgeNo}
                  onClick={handleDodgeNo}
                  animate={noPos ? { x: noPos.x, y: noPos.y } : { x: 0, y: 0 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                  className="min-h-[36px] px-4 py-1.5 rounded-xl border border-[#DFD3C6] bg-white text-xs font-medium text-[#6B5F5B] hover:text-[#181414] shadow-sm cursor-pointer z-20"
                >
                  {currentNoLabel}
                </motion.button>
              </div>

              <p className="text-xs font-mono-tabular text-[#8A7D77]">
                {t.dodgesLabel} <span className="font-semibold text-[#181414]">{noDodges}</span>
              </p>

              {errorMsg && (
                <p className="text-sm text-[#B91C3B] font-medium" role="alert">
                  {errorMsg}
                </p>
              )}
            </motion.div>
          )}

          {/* SCREEN 2 — CONFIRMED */}
          {step === 2 && (
            <motion.div
              key="screen-2"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 flex flex-col items-center text-center space-y-6 py-4"
            >
              <div className="relative">
                <SwayingFlower className="w-16 h-16" />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="absolute -right-2 -top-1 text-[#B91C3B]"
                >
                  <Heart className="w-5 h-5 fill-[#B91C3B]" />
                </motion.div>
              </div>

              <div className="space-y-3">
                <h1
                  className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-[#181414] leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  {t.confirmedTitleBefore}
                  <em className="italic text-[#B91C3B] font-semibold">{t.confirmedTitleAccent}</em>
                  {t.confirmedTitleAfter}
                </h1>
                <p className="text-sm sm:text-base text-[#6B5F5B] max-w-sm mx-auto leading-relaxed">
                  {t.confirmedSubtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  playPopSound();
                  setStep(3);
                }}
                className="min-h-[52px] px-8 py-3.5 rounded-2xl bg-[#B91C3B] text-white text-base font-semibold hover:bg-[#9F1239] transition-colors shadow-sm cursor-pointer"
              >
                {t.planItBtn}
              </button>
            </motion.div>
          )}

          {/* SCREEN 3 — PLAN IT + WHO'S TREATING */}
          {step === 3 && (
            <motion.div
              key="screen-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="relative z-10 space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <SwayingFlower className="w-12 h-12" />
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#181414]">
                  {t.planTitleBefore}
                  <em className="italic text-[#B91C3B] font-semibold">{t.planTitleAccent}</em>
                  {t.planTitleAfter}
                </h1>
              </div>

              {/* Date & Time pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="date-picker"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A403D]"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#B91C3B]" />
                    {t.dayLabel}
                  </label>
                  <input
                    id="date-picker"
                    type="date"
                    min={todayIso}
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-sm text-[#181414] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="time-picker"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A403D]"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#B91C3B]" />
                    {t.timeLabel}
                  </label>
                  <input
                    id="time-picker"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-sm text-[#181414] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
                  />
                </div>
              </div>

              {/* Plan Pills + Custom Option */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#4A403D]">{t.whatLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {PLAN_OPTIONS.map((opt) => {
                    const active = planChoice === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          playPopSound();
                          setPlanChoice(opt.id);
                        }}
                        className={`min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#B91C3B] text-white shadow-sm'
                            : 'bg-[#FAF6F0] text-[#4A403D] border border-[#E3D8CC] hover:border-[#B91C3B]/40'
                        }`}
                      >
                        {opt[lang]}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setPlanChoice('__custom__');
                    }}
                    className={`min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                      planChoice === '__custom__'
                        ? 'bg-[#B91C3B] text-white shadow-sm'
                        : 'bg-[#FAF6F0] text-[#4A403D] border border-[#E3D8CC] hover:border-[#B91C3B]/40'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t.customPlanBtn}
                  </button>
                </div>

                {planChoice === '__custom__' && (
                  <input
                    type="text"
                    maxLength={120}
                    value={customPlanText}
                    onChange={(e) => setCustomPlanText(e.target.value)}
                    placeholder={t.customPlanPlaceholder}
                    aria-label={t.customPlanBtn}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E3D8CC] bg-[#FAF6F0]/70 text-sm text-[#181414] placeholder:text-[#A3958E] focus:outline-none focus:ring-2 focus:ring-[#B91C3B]/25 focus:border-[#B91C3B]"
                  />
                )}
              </div>

              {/* WHO'S TREATING? (Driven by proposal.treatPayer) */}
              <div className="pt-2 border-t border-[#EFE7DE] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#4A403D]">{t.whoTreatingLabel}</p>
                  {shrinkingCardGone && treatChoice !== proposal.treatPayer && (
                    <span className="text-xs font-medium text-[#B91C3B]">{mustPickHint}</span>
                  )}
                </div>

                {shrinkingCardGone && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-medium text-[#B91C3B] bg-[#FDF2F4] border border-[#F5D0D8] rounded-xl px-4 py-2.5 text-center"
                  >
                    {poofBannerText}
                  </motion.p>
                )}

                <div
                  className={`grid gap-4 items-center ${
                    shrinkingCardGone ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {/* Winning Card (matches proposal.treatPayer — normal size, always clickable) */}
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setTreatChoice(proposal.treatPayer);
                    }}
                    className={`w-full min-h-[112px] p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      treatChoice === proposal.treatPayer
                        ? 'border-[#5C7C65] bg-[#F2F7F3] shadow-sm'
                        : 'border-[#E3D8CC] bg-[#FAF6F0]/60 hover:border-[#5C7C65]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xl font-semibold text-[#181414]">
                        {winningCardTitle}
                      </span>
                      {treatChoice === proposal.treatPayer && (
                        <span className="w-6 h-6 rounded-full bg-[#5C7C65] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B5F5B] mt-2">{winningCardSub}</p>
                  </button>

                  {/* Shrinking Card (starts BIG & glowing, shrinks 20% each tap with 2-4 word lines, poofs on tap 5) */}
                  {(!shrinkingCardGone || showPoof) && (
                    <div className="relative flex items-center justify-center min-h-[132px]">
                      <AnimatePresence>
                        {showPoof && (
                          <motion.div
                            key="poof-burst"
                            initial={{ scale: 0.4, opacity: 1 }}
                            animate={{ scale: 1.7, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          >
                            <div className="flex items-center gap-2 text-[#B91C3B] font-display italic text-lg font-semibold">
                              <Sparkles className="w-5 h-5" />
                              <span>{isSenderPaysMode ? 'Poof! ❤️' : 'Poof!'}</span>
                              <Sparkles className="w-5 h-5" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!shrinkingCardGone && (
                        <motion.button
                          type="button"
                          onClick={handleTapShrinkingTreat}
                          animate={{
                            scale: shrinkingCardScale,
                          }}
                          transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                          whileTap={{ scale: shrinkingCardScale * 0.94 }}
                          className={`w-full min-h-[132px] p-5 rounded-2xl border-2 text-left cursor-pointer flex flex-col justify-between ${
                            isSenderPaysMode
                              ? 'border-[#D97706] bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] shadow-[0_0_28px_-4px_rgba(217,119,6,0.32)]'
                              : 'border-[#B91C3B] bg-gradient-to-br from-[#FFF5F6] to-[#FFE4E8] shadow-[0_0_28px_-4px_rgba(185,28,59,0.38)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-display text-2xl font-semibold leading-tight ${
                                isSenderPaysMode ? 'text-[#92400E]' : 'text-[#9F1239]'
                              }`}
                            >
                              {shrinkingCardTitle}
                            </span>
                            <Sparkles
                              className={`w-5 h-5 shrink-0 ${
                                isSenderPaysMode ? 'text-[#D97706]' : 'text-[#B91C3B]'
                              }`}
                            />
                          </div>
                          <p
                            className={`text-xs mt-2 ${
                              isSenderPaysMode ? 'text-[#78350F]' : 'text-[#7F1D2E]'
                            }`}
                          >
                            {shrinkingCardSub}
                          </p>
                        </motion.button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && (
                <p className="text-sm text-[#B91C3B] font-medium" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="button"
                disabled={!canSeal || sealing}
                onClick={handleSealWithLetter}
                className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-[#B91C3B] text-white text-sm font-semibold hover:bg-[#9F1239] disabled:bg-[#D8CEC4] disabled:text-[#847872] disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {sealing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.sealingBtn}
                  </>
                ) : (
                  t.sealBtn
                )}
              </button>
            </motion.div>
          )}

          {/* SCREEN 4 — THE LETTER */}
          {step === 4 && (
            <motion.div
              key="screen-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <img
                  src={keepsakeWaxSealImg}
                  alt="Crimson wax seal stamped on cream stationery"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover border border-[#E7DDD2] shadow-sm"
                />
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#181414]">
                  {t.letterTitleBefore}
                  <em className="italic text-[#B91C3B] font-semibold">{t.letterTitleAccent}</em>
                  {t.letterTitleAfter}
                </h1>
              </div>

              {/* Summary chips */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#E5DAD0] text-xs font-medium text-[#4A403D]">
                  {day}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#E5DAD0] text-xs font-medium text-[#4A403D]">
                  {formatTimeLabel(time)}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#E5DAD0] text-xs font-medium text-[#4A403D]">
                  {selectedPlanLabel}
                </span>
                <span className="px-3 py-1 rounded-full bg-[#F2F7F3] border border-[#CFE0D4] text-xs font-semibold text-[#4B6B54]">
                  {winningCardTitle}
                </span>
              </div>

              {/* Generated Letter */}
              <div className="p-6 sm:p-7 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD2] space-y-3">
                <p className="font-display text-base sm:text-lg leading-relaxed text-[#181414] whitespace-pre-line">
                  {letter}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleShareGoodNews}
                  className="flex-1 min-h-[48px] px-5 py-3 rounded-2xl bg-[#B91C3B] text-white text-sm font-semibold hover:bg-[#9F1239] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedShare ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t.copiedGoodNews}
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      {t.shareGoodNews}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playPopSound();
                    onStartOver();
                  }}
                  className="min-h-[48px] px-5 py-3 rounded-2xl border border-[#DFD3C6] bg-white text-sm font-medium text-[#4A403D] hover:text-[#181414] hover:bg-[#FAF6F0] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t.startOver}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
