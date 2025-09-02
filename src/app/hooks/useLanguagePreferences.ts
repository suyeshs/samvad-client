import { useLocalStorageString } from "./useLocalStorage";
import {
  LanguageConfig,
  CFData,
  DEFAULT_LANGUAGES
} from "../services/LanguageDetectionService";

export interface LanguagePreferences {
  currentLanguage: LanguageConfig;
  cfData: CFData | null;

  // Methods
  setCurrentLanguage: (language: LanguageConfig) => void;
  setCfData: (cfData: CFData) => void;
  detectAndSetLanguage: (cfData?: CFData) => void;
}

export function useLanguagePreferences(): LanguagePreferences {
  // Persistent language preferences in localStorage
  const [languageCode, setLanguageCode] = useLocalStorageString(
    "preferredLanguage",
    DEFAULT_LANGUAGES[0].code
  );
  const [cfData, setCfDataStorage] = useLocalStorageString("cfData", "");

  // Find the current language config based on stored code
  const currentLanguage =
    DEFAULT_LANGUAGES.find((lang) => lang.code === languageCode) ||
    DEFAULT_LANGUAGES[0];

  const setCurrentLanguage = (language: LanguageConfig) => {
    setLanguageCode(language.code);
  };

  const setCfData = (newCfData: CFData) => {
    setCfDataStorage(JSON.stringify(newCfData));
  };

  const detectAndSetLanguage = (newCfData?: CFData) => {
    if (newCfData && newCfData.locale) {
      // Simple language detection based on locale
      const locale = newCfData.locale;
      const detectedLanguage =
        DEFAULT_LANGUAGES.find(
          (lang) => locale.startsWith(lang.code) || locale.includes(lang.code)
        ) || DEFAULT_LANGUAGES[0];

      setCurrentLanguage(detectedLanguage);
      setCfData(newCfData);
    }
  };

  return {
    currentLanguage,
    cfData: cfData && cfData !== "" ? JSON.parse(cfData) : null,
    setCurrentLanguage,
    setCfData,
    detectAndSetLanguage
  };
}
