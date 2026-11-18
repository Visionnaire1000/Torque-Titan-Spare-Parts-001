import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Globe , Search, Check } from "lucide-react";


interface LanguageOption {
  code: string;
  nativeName: string;
  englishName: string;
}

const languages: LanguageOption[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "fr", nativeName: "Français", englishName: "French" },

  { code: "zh", nativeName: "中文", englishName: "Chinese" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "it", nativeName: "Italiano", englishName: "Italian" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "ko", nativeName: "한국어", englishName: "Korean" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish" },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch" },
];

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeCode = (
    i18n.resolvedLanguage ||
    i18n.language ||
    "en"
  )
    .toLowerCase()
    .split("-")[0];

  const currentLanguage =
    languages.find((language) => language.code === activeCode) ??
    languages[0];

  const availableLanguages = languages.filter((language) =>
    i18n.hasResourceBundle(language.code, "translation"),
  );

  useEffect(() => {
    const languageCode = (
      i18n.resolvedLanguage ||
      i18n.language ||
      "en"
    )
      .toLowerCase()
      .split("-")[0];

    document.documentElement.lang = languageCode;
    document.documentElement.dir =
      languageCode === "ar" ? "rtl" : "ltr";
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  const query = search.trim().toLowerCase();

  const filteredLanguages = availableLanguages.filter((language) => {
    return (
      language.nativeName.toLowerCase().includes(query) ||
      language.englishName.toLowerCase().includes(query) ||
      language.code.toLowerCase().includes(query)
    );
  });

  async function handleLanguageChange(language: LanguageOption) {
    try {
      await i18n.changeLanguage(language.code);
      setIsOpen(false);
      setSearch("");
    } catch (error) {
      console.error("Unable to change language:", error);
    }
  }

  return (
    <div
      ref={selectorRef}
      className="relative z-[1000] inline-flex shrink-0"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${t("selectLanguage", {
          defaultValue: "Select language",
        })}. ${currentLanguage.englishName}`}
        className="inline-flex cursor-pointer items-center justify-center gap-[7px] 
                   whitespace-nowrap rounded-lg px-[10px] py-[9px] text-[13px] 
                   text-[#222] transition-colors focus-visible:outline-2 
                   focus-visible:outline-offset-2 focus-visible:outline-blue-600
                   max-[480px]:gap-[5px] max-[480px]:px-2 max-[480px]:py-2 max-[480px]:text-xs"
      >
        <span className="text-white">
         <Globe size={26} aria-hidden="true" />
        </span>

        <span className="text-white">
         {currentLanguage.code.toUpperCase()}
        </span>

        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform text-white duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[min(220px,calc(100vw-24px))] 
                        overflow-hidden rounded-[10px] border border-gray-200 bg-white text-[#222]
                        shadow-[0_10px_30px_rgb(0_0_0_/_15%)] max-[480px]:right-[-5px] mr-[20px]">
          <div className="flex items-center gap-[9px] border-b border-gray-200 p-3">
            <Search
              size={16}
              className="shrink-0 text-gray-500"
              aria-hidden="true"
            />

            <input
              ref={searchRef}
              type="search"
              placeholder={t("languageSelector.searchLanguage")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("languageSelector.searchLanguage")}
              className="w-full min-w-0 border-0 bg-transparent py-[5px] text-sm text-[#222] outline-none placeholder:text-gray-500"
            />
          </div>

          <div
            role="listbox"
            aria-label={t("selectLanguage", {
              defaultValue: "Languages",
            })}
            className="max-h-[300px] overflow-y-auto p-[5px]"
          >
            {filteredLanguages.length > 0 ? (
              filteredLanguages.map((language) => {
                const selected =
                  currentLanguage.code === language.code;

                return (
                  <button
                    key={language.code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() =>
                      void handleLanguageChange(language)
                    }
                    className={`flex w-full cursor-pointer flex-col items-start gap-[3px] 
                                rounded-md border-0 p-[10px] text-left transition-colors ${
                      selected
                        ? "bg-[#f0f4f8]"
                        : "bg-transparent hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                      {language.nativeName}

                      {selected && (
                        <Check
                          size={15}
                          className="shrink-0 text-blue-600"
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    <span className="text-xs text-gray-500">
                      {language.englishName}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-[13px] text-gray-500">
                {t("noLanguagesFound")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
