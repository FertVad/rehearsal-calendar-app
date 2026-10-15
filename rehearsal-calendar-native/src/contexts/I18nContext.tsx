import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, Translations, translations } from '../i18n/translations';
import { onAccountLanguage } from '../shared/utils/storage';

import { logger } from '../shared/utils/logger';
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = 'userLanguage';

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>('en');
  const [loading, setLoading] = useState(true);

  const loadLanguage = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && saved in translations) {
        setLanguageState(saved as Language);
      }
    } catch (error) {
      logger.warn('Failed to load language preference:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load saved language on mount
  useEffect(() => {
    loadLanguage();
  }, [loadLanguage]);

  // The signed-in account's language, whenever its preferences are written —
  // at sign-in, at start, after a profile change (HC01).
  useEffect(() => onAccountLanguage((locale) => {
    if (locale in translations) setLanguageState(locale as Language);
  }), []);

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      logger.warn('Failed to save language preference:', error);
    }
  }, []);

  const value: I18nContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  // Don't render children until language is loaded
  if (loading) {
    return null;
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
