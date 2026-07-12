'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, SmartphoneNfc, Globe, ChevronRight, Lock, QrCode, Send } from 'lucide-react';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface Props {
  onComplete: () => void;
  environmentNotice?: string;
  liveSettlementEnabled?: boolean;
}

export default function OnboardingSlides({ onComplete, environmentNotice, liveSettlementEnabled = false }: Props) {
  const [current, setCurrent] = useState(0);
  const { t } = useTranslation();

  const SLIDES = [
    {
      // Slide 1 — The Problem / What SaloMed is
      visual: (
        <div className="relative flex items-center justify-center w-full h-full">
          {/* Big alkansya metaphor */}
          <div className="w-32 h-32 rounded-3xl bg-white/15 flex items-center justify-center shadow-inner">
            <Image
              src="/SaloMed_logo.png"
              alt="SaloMed"
              width={80}
              height={80}
              className="object-contain drop-shadow-lg"
            />
          </div>
          {/* Floating lock badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center"
          >
            <Lock size={18} className="text-blue-600" />
          </motion.div>
        </div>
      ),
      tag: 'Your Health Alkansya',
      title: t('onboard_slide1_title'),
      desc: liveSettlementEnabled
        ? 'Use a purpose-bound health vault that can move funds only through configured healthcare flows.'
        : t('onboard_slide1_desc'),
    },
    {
      // Slide 2 — How it works (familiar UX)
      visual: (
        <div className="relative flex items-center justify-center w-full h-full gap-5">
          {/* Phone mockup */}
          <div className="w-28 h-28 rounded-3xl bg-white/15 flex items-center justify-center shadow-inner">
            <QrCode size={52} className="text-white/90" strokeWidth={1.5} />
          </div>
          {/* Arrow + hospital */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-8 h-0.5 bg-white/40 rounded-full" />
            <div className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center">
              <SmartphoneNfc size={20} className="text-blue-600" />
            </div>
          </motion.div>
        </div>
      ),
      tag: 'Familiar. Simple. Secure.',
      title: t('onboard_slide2_title'),
      desc: liveSettlementEnabled
        ? 'Review PHP reference amounts and confirm each healthcare transaction before settlement.'
        : t('onboard_slide2_desc'),
    },
    {
      // Slide 3 — Remittance / OFW
      visual: (
        <div className="relative flex items-center justify-center w-full h-full">
          <div className="w-32 h-32 rounded-3xl bg-white/15 flex items-center justify-center shadow-inner">
            <Globe size={60} className="text-white/90" strokeWidth={1.4} />
          </div>
          {/* Floating send badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center"
          >
            <Send size={16} className="text-blue-600" />
          </motion.div>
          {/* On-chain tag */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
            className="absolute -top-2 -left-2 bg-white/20 border border-white/30 rounded-full px-2.5 py-1"
          >
            <span className="text-[10px] font-bold text-white">On-chain ✓</span>
          </motion.div>
        </div>
      ),
      tag: 'For OFWs & Families',
      title: t('onboard_slide3_title'),
      desc: liveSettlementEnabled
        ? 'Send purpose-bound health support and review confirmed settlement records in your activity history.'
        : t('onboard_slide3_desc'),
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
        style={{ height: 'min(92dvh, 680px)' }}
      >
        <div className="flex flex-col h-full">

          {/* Skip */}
          <div className="flex justify-end px-6 pt-5 shrink-0">
            <button
              onClick={onComplete}
              className="text-white/50 hover:text-white/80 text-sm font-medium transition-colors"
            >
              {t('onboard_skip')}
            </button>
          </div>

          {/* Visual area */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 min-h-0">

            {/* Illustration */}
            <div className="w-44 h-44 flex items-center justify-center shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current + '-visual'}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  {slide.visual}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Text content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={current + '-text'}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="text-center space-y-3 max-w-sm"
              >
                {/* Tag */}
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.15em]">
                  {slide.tag}
                </p>

                {/* Title */}
                <h2 className="text-[1.6rem] font-bold text-white leading-tight tracking-tight">
                  {slide.title}
                </h2>

                {/* Description */}
                <p className="text-blue-100/80 text-[14px] leading-relaxed">
                  {slide.desc}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom — dots + button */}
          <div className="px-6 pb-8 pt-4 shrink-0 space-y-5">
            <div className="rounded-xl border border-white/15 bg-slate-950/15 px-3 py-2 text-center">
              <p className="text-xs font-semibold text-blue-50 leading-relaxed">
                {environmentNotice ?? 'Secured on the Stellar network · Every transaction is verifiable on-chain'}
              </p>
            </div>
            {/* Step dots */}
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

            {/* CTA button */}
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
