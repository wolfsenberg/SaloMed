'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, SmartphoneNfc, Globe, ChevronRight } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

const SLIDES = [
  {
    Icon: ShieldCheck,
    title: 'Your Health Alkansya',
    text: 'Unlike regular e-wallets, SaloMed vaults are Purpose-Bound. The funds you save here are strictly locked and can exclusively be spent on healthcare at whitelisted hospitals and pharmacies.',
  },
  {
    Icon: SmartphoneNfc,
    title: 'Zero-Crypto Anxiety',
    text: 'Enjoy a seamless app experience that feels exactly like your everyday e-wallet. Fund your vault in PHP and scan to pay instantly, while unbreakable Stellar blockchain security runs quietly in the background.',
  },
  {
    Icon: Globe,
    title: 'The Ultimate Health Pasaload',
    text: 'Send instant medical support to your family anywhere. With all transactions permanently recorded on-chain, you have guaranteed peace of mind that your padala is spent exactly on medicine and healthcare.',
  },
];

export default function OnboardingSlides({ onComplete }: Props) {
  const [current, setCurrent] = useState(0);

  function nextSlide() {
    if (current < SLIDES.length - 1) {
      setCurrent(current + 1);
    } else {
      onComplete();
    }
  }

  const { Icon, title, text } = SLIDES[current];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6">
      <div className="bg-blue-600 sm:rounded-[2rem] shadow-2xl flex flex-col w-full h-full sm:h-[85vh] sm:max-h-[850px] sm:max-w-md relative overflow-hidden">
      {/* Top action bar */}
      <div className="flex justify-end p-5 shrink-0">
        <button
          onClick={onComplete}
          className="text-blue-200 hover:text-white text-sm font-semibold tracking-wide transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col items-center max-w-sm"
          >
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-8 shadow-inner">
              <Icon size={48} className="text-white drop-shadow-md" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
              {title}
            </h2>
            <p className="text-blue-100 text-[15px] leading-relaxed">
              {text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="p-8 shrink-0 flex flex-col items-center gap-8 pb-12">
        {/* Indicators */}
        <div className="flex gap-2.5">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-white' : 'w-1.5 bg-blue-400'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={nextSlide}
          className="w-full max-w-xs py-4 rounded-2xl bg-white text-blue-600 font-bold text-base hover:bg-blue-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          {current === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
    </div>
  );
}
