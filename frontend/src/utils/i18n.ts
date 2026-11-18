
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en.json";
import fr from "../locales/fr.json";
import zh from "../locales/zh.json";
import hi from "../locales/hi.json";
import es from "../locales/es.json";
import pt from "../locales/pt.json";
import de from "../locales/de.json";
import it from "../locales/it.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import ru from "../locales/ru.json";
import tr from "../locales/tr.json";
import nl from "../locales/nl.json"; 

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  zh: { translation: zh },
  hi: { translation: hi },
  es: { translation: es },
  pt: { translation: pt },
  de: { translation: de },
  it: { translation: it },
  ja: { translation: ja },
  ko: { translation: ko },
  ru: { translation: ru },
  tr: { translation: tr },
  nl: { translation: nl }, 
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: Object.keys(resources),
    load: "languageOnly",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "titan_language",
      caches: ["localStorage"],
    },
  });

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
});

export default i18n;
