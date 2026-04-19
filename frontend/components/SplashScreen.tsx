'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500);
    }, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white px-8"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex flex-col items-center gap-5"
          >
            {/* Logo */}
            <div className="w-28 h-28 relative drop-shadow-md">
              <Image
                src="/SaloMed_logo.png"
                alt="SaloMed"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* App name */}
            <div className="text-center space-y-2">
              <p className="text-3xl font-bold text-slate-900 tracking-tight">SaloMed</p>

              {/* Tagline */}
              <p className="text-sm text-slate-500 leading-snug max-w-[260px] text-center italic">
                &ldquo;Pondong protektado, kalusugan mo&apos;y salo.&rdquo;
              </p>
            </div>

            {/* Pulse loader */}
            <div className="flex gap-2 mt-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: i * 0.22, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
