'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ChevronRight,
  CreditCard,
  Globe,
  HandCoins,
  Pill,
  QrCode,
  Send,
  ShieldCheck,
  SmartphoneNfc,
  Star,
  Wallet,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface Props {
  onComplete: () => void;
  environmentNotice?: string;
  liveSettlementEnabled?: boolean;
}

function SceneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 px-1">
      {children}
    </div>
  );
}

function FeatureChip({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 6 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ delay: 0.25, type: 'spring', stiffness: 240, damping: 18 }}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-2 text-[11px] font-bold text-slate-700 shadow-lg ring-1 ring-white/70"
    >
      {children}
    </motion.div>
  );
}

export default function OnboardingSlides({ onComplete, liveSettlementEnabled = false }: Props) {
  const [current, setCurrent] = useState(0);
  const { t } = useTranslation();
  const mockCardClass = 'w-60 rounded-[1.75rem] bg-white/95 p-4 text-slate-900 shadow-2xl ring-1 ring-white/70';

  const SLIDES = [
    {
      visual: (
        <SceneFrame>
          <div className={mockCardClass}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
                  <Image src="/SaloMed_logo.png" alt="SaloMed" width={24} height={24} className="object-contain" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vault</p>
                  <p className="text-sm font-bold">Health only</p>
                </div>
              </div>
              <ShieldCheck size={19} className="text-emerald-500" />
            </div>
            <p className="text-[2rem] font-bold leading-none tabular-nums">
              67.00 <span className="text-base font-semibold text-slate-400">XLM</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">~ PHP reference</p>
            <div className="mt-4 flex gap-2">
              <span className="flex-1 rounded-full bg-emerald-50 px-3 py-1.5 text-center text-[11px] font-bold text-emerald-700">Hospital</span>
              <span className="flex-1 rounded-full bg-blue-50 px-3 py-1.5 text-center text-[11px] font-bold text-blue-700">Pharmacy</span>
            </div>
          </div>
          <FeatureChip>
            <Wallet size={13} className="text-blue-600" /> Locked
          </FeatureChip>
        </SceneFrame>
      ),
      tag: 'Purpose-bound vault',
      title: t('onboard_slide1_title'),
      desc: liveSettlementEnabled
        ? 'Keep health funds in a vault designed for approved healthcare payments and family support.'
        : t('onboard_slide1_desc'),
    },
    {
      visual: (
        <SceneFrame>
          <div className="w-60 rounded-[1.75rem] bg-white/95 p-3.5 text-slate-900 shadow-2xl ring-1 ring-white/70">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Everyday flow</p>
                <p className="text-sm font-bold">Pay for care</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">PHP view</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Top up', Icon: CreditCard, color: 'bg-emerald-50 text-emerald-600' },
                { label: 'Scan', Icon: QrCode, color: 'bg-blue-50 text-blue-600' },
                { label: 'Pay', Icon: SmartphoneNfc, color: 'bg-violet-50 text-violet-600' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl bg-slate-50 px-2 py-2.5 text-center">
                  <div className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-xl ${item.color}`}>
                    <item.Icon size={16} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>PHP 850</span>
                <span className="text-blue-600">75.6 XLM</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-blue-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '76%' }}
                  transition={{ delay: 0.25, duration: 0.55 }}
                  className="h-1.5 rounded-full bg-blue-500"
                />
              </div>
            </div>
          </div>
          <FeatureChip>
            <QrCode size={13} className="text-blue-600" /> Familiar
          </FeatureChip>
        </SceneFrame>
      ),
      tag: 'Familiar finance app feel',
      title: t('onboard_slide2_title'),
      desc: liveSettlementEnabled
        ? 'Top up, review PHP reference amounts, and confirm each healthcare payment before settlement.'
        : t('onboard_slide2_desc'),
    },
    {
      visual: (
        <SceneFrame>
          <div className="flex items-center gap-2.5">
            <div className="w-24 rounded-[1.5rem] bg-white/95 p-3 text-center text-slate-900 shadow-2xl ring-1 ring-white/70">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
                <Globe size={21} className="text-blue-600" />
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Sender</p>
              <p className="text-xs font-bold">From Manila</p>
            </div>
            <motion.div
              initial={{ x: -6, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-xl ring-1 ring-white/70"
            >
              <Send size={18} className="text-blue-600" />
            </motion.div>
            <div className="w-24 rounded-[1.5rem] bg-white/95 p-3 text-center text-slate-900 shadow-2xl ring-1 ring-white/70">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50">
                <Pill size={21} className="text-emerald-600" />
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Family</p>
              <p className="text-xs font-bold">Anywhere</p>
            </div>
          </div>
          <FeatureChip>
            Healthcare only
          </FeatureChip>
        </SceneFrame>
      ),
      tag: 'Local and global Padala',
      title: t('onboard_slide3_title'),
      desc: liveSettlementEnabled
        ? 'Send purpose-bound health support to family vaults, then review the movement in Vault Activity.'
        : t('onboard_slide3_desc'),
    },
    {
      visual: (
        <SceneFrame>
          <div className={mockCardClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stellar rail</p>
                <p className="text-sm font-bold">Fast settlement</p>
              </div>
              <Zap size={20} className="text-yellow-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-blue-50 p-3">
                <p className="text-lg font-bold leading-none text-blue-700">Fast</p>
                <p className="text-[10px] font-semibold text-blue-500">confirmation</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3">
                <p className="text-lg font-bold leading-none text-emerald-700">Low</p>
                <p className="text-[10px] font-semibold text-emerald-500">network fees</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5">
              <ShieldCheck size={15} className="text-blue-600" />
              <p className="text-[11px] font-semibold text-slate-500">Activity appears in Vault Activity.</p>
            </div>
          </div>
        </SceneFrame>
      ),
      tag: 'Powered by Stellar',
      title: t('onboard_slide4_title'),
      desc: liveSettlementEnabled
        ? 'Stellar keeps settlement fast and low-cost while confirmed activity stays visible in your vault history.'
        : t('onboard_slide4_desc'),
    },
    {
      visual: (
        <SceneFrame>
          <div className={mockCardClass}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Salo tier</p>
                <p className="text-sm font-bold">Bronze</p>
              </div>
              <Star size={20} className="text-amber-500" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Bronze', '9%'],
                ['Silver', '5%'],
                ['Gold', '2%'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-400">{label}</p>
                  <p className="text-sm font-bold leading-tight text-blue-600">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-2.5">
              <HandCoins size={16} className="text-amber-600" />
              <p className="text-[11px] font-semibold text-amber-700">Points improve support options.</p>
            </div>
          </div>
          <FeatureChip>
            <Building2 size={13} className="text-blue-600" /> Partner review
          </FeatureChip>
        </SceneFrame>
      ),
      tag: 'SaloPoints and Salo',
      title: t('onboard_slide5_title'),
      desc: liveSettlementEnabled
        ? 'Earn SaloPoints from healthcare payments and use your activity to unlock better partner-reviewed Salo options.'
        : t('onboard_slide5_desc'),
    },
  ];

  function nextSlide() {
    if (current < SLIDES.length - 1) {
      setCurrent(current + 1);
    } else {
      onComplete();
    }
  }

  const slide = SLIDES[current];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-blue-600 w-full sm:rounded-[2rem] sm:max-w-md shadow-2xl overflow-hidden"
        style={{ height: 'min(92dvh, 700px)' }}
      >
        <div className="flex flex-col h-full">
          <div className="flex justify-end px-6 pt-5 shrink-0">
            <button
              onClick={onComplete}
              className="text-white/55 hover:text-white/85 text-sm font-medium transition-colors"
            >
              {t('onboard_skip')}
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-7 gap-6 min-h-0">
            <div className="h-64 w-full max-w-[18rem] flex items-center justify-center shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current + '-visual'}
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="h-full w-full"
                >
                  {slide.visual}
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current + '-text'}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="text-center space-y-3 max-w-sm"
              >
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">
                  {slide.tag}
                </p>
                <h2 className="text-[1.65rem] font-bold text-white leading-tight tracking-tight">
                  {slide.title}
                </h2>
                <p className="text-blue-100/80 text-[14px] leading-relaxed">
                  {slide.desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-6 pb-8 pt-4 shrink-0 space-y-5">
            <div className="flex justify-center gap-2">
              {SLIDES.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ width: i === current ? 24 : 6, opacity: i === current ? 1 : 0.35 }}
                  transition={{ duration: 0.3 }}
                  className="h-1.5 rounded-full bg-white"
                />
              ))}
            </div>

            <button
              onClick={nextSlide}
              className="w-full py-4 rounded-2xl bg-white text-blue-600 font-bold text-[15px] hover:bg-blue-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {current === SLIDES.length - 1 ? t('onboard_start') : t('onboard_next')}
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
