'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { Language } from '@/lib/i18n/translations';
import { Globe, Check } from 'lucide-react';

export default function LanguageSelectionModal({ onComplete }: { onComplete: () => void }) {
  const { language, setLanguage, t } = useTranslation();

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <Globe size={24} />
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 text-center mb-1">
          {t('lang_select_title')}
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          {t('lang_select_desc')}
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {(['taglish', 'en', 'tl'] as Language[]).map((lang) => {
            const isSelected = language === lang;
            return (
              <button
                key={lang}
                onClick={() => handleSelect(lang)}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                  {t(`lang_${lang}` as any)}
                </span>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onComplete}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors"
        >
          {t('lang_continue')}
        </button>
      </motion.div>
    </div>
  );
}
