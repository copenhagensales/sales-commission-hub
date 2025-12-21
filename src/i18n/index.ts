import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import da from './locales/da.json';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      da: { translation: da },
      en: { translation: en },
    },
    lng: 'da', // Force Danish as default
    fallbackLng: 'da',
    supportedLngs: ['da', 'en'],
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
