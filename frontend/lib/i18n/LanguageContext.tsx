'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { TRANSLATIONS, Language, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  hasChosenLanguage: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>('taglish');
  const [hasChosenLanguage, setHasChosenLanguage] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only access localStorage on client side
    const savedLang = localStorage.getItem('salomed_lang') as Language;
    if (savedLang && ['taglish', 'en', 'tl'].includes(savedLang)) {
      setLang(savedLang);
      setHasChosenLanguage(true);
    }
    setMounted(true);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    setHasChosenLanguage(true);
    localStorage.setItem('salomed_lang', lang);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    let text = TRANSLATIONS[language]?.[key] || TRANSLATIONS['taglish'][key] || key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }
    
    return text;
  }, [language]);

  // Always render the Provider so the context is available during SSR and initial render
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, hasChosenLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
