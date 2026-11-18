import {  useEffect, useState, useCallback, useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, X, Search } from "lucide-react";
import config from "../../../config";

const HISTORY_KEY = "search_history";
const HISTORY_LIMIT = 6;

interface SparePart {
  id: string;
  brand: string;
  vehicle_type: string;
  category: string;
  name?: string;
}

interface SearchOption {
  label: string;
  value: string;
  searchableText: string;
  isGroup?: boolean;
  isHistory?: boolean;
  parts?: SparePart[];
  part?: SparePart;
  brand?: string;
  vehicleType?: string;
  category?: string;
}

interface SparePartsResponse {
  items: SparePart[];
}

type TranslateFunction = (
  key: string,
  options?: { defaultValue?: string }
) => string;

const CATEGORY_KEYS: Record<string, string> = {
  tyre: "productCategories.tyre",
  tyres: "productCategories.tyre",
  tire: "productCategories.tyre",
  tires: "productCategories.tyre",
  rim: "productCategories.rim",
  rims: "productCategories.rim",
  battery: "productCategories.battery",
  batteries: "productCategories.battery",
  filter: "productCategories.filter",
  filters: "productCategories.filter",
  "oil filter": "productCategories.filter",
  "oil filters": "productCategories.filter",
};

const VEHICLE_KEYS: Record<string, string> = {
  sedan: "productCategories.sedan",
  suv: "productCategories.suv",
  truck: "productCategories.truck",
  bus: "productCategories.bus",
};

const normalizeSearchWord = (word: string): string => {
  const pluralMap: Record<string, string> = {
    tyres: "tyre",
    tires: "tire",
    rims: "rim",
    batteries: "battery",
    filters: "filter",
    oils: "oil",
    parts: "part",
    buses: "bus",
    trucks: "truck",
    suvs: "suv",
    sedans: "sedan",
  };

  return pluralMap[word] ?? word;
};

const normalizeSearchText = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map(normalizeSearchWord)
    .join(" ");

const translatePartValue = (
  value: string,
  type: "category" | "vehicle",
  t: TranslateFunction
): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ");

  const key =
    type === "category"
      ? CATEGORY_KEYS[normalized]
      : VEHICLE_KEYS[normalized];

  return key ? t(key, { defaultValue: value }) : value;
};

const SearchBar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [options, setOptions] = useState<SearchOption[]>([]);
  const [historyOptions, setHistoryOptions] = useState<SearchOption[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(HISTORY_KEY) ?? "[]"
      );

      if (Array.isArray(saved)) {
        setHistoryOptions(saved as SearchOption[]);
      }
    } catch {
      setHistoryOptions([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${config.API_BASE_URL}/spareparts/?per_page=1000`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load spare parts");
        }

        return response.json();
      })
      .then((data: SparePartsResponse) => {
        const parts = data.items ?? [];
        const groupedMap: Record<string, SearchOption> = {};

        parts.forEach((part) => {
          const key = [
            part.brand,
            part.vehicle_type,
            part.category,
          ]
            .map(normalizeSearchText)
            .join("|");

          if (!groupedMap[key]) {
            groupedMap[key] = {
              label: `${part.brand} ${part.vehicle_type} ${part.category}`,
              value: key,
              brand: part.brand,
              vehicleType: part.vehicle_type,
              category: part.category,
              searchableText: [
                part.brand,
                part.vehicle_type,
                part.category,
              ].join(" "),
              parts: [],
              isGroup: true,
            };
          }

          groupedMap[key].parts!.push(part);

          if (part.name) {
            groupedMap[key].searchableText += ` ${part.name}`;
          }
        });

        if (!controller.signal.aborted) {
          setOptions(Object.values(groupedMap));
        }
      })
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setOptions([]);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const getOptionLabel = useCallback(
    (option: SearchOption): string => {
      if (
        !option.brand ||
        !option.vehicleType ||
        !option.category
      ) {
        return option.label;
      }

      const vehicle = translatePartValue(
        option.vehicleType,
        "vehicle",
        t
      );

      const category = translatePartValue(
        option.category,
        "category",
        t
      );

      return [option.brand, vehicle, category]
        .filter(Boolean)
        .join(" ");
    },
    [t]
  );

  const saveToHistory = useCallback(
    (option: SearchOption): void => {
      const updated: SearchOption[] = [
        {
          ...option,
          isHistory: true,
          searchableText:
            option.searchableText ||
            normalizeSearchText(option.label),
        },
        ...historyOptions.filter(
          (historyItem) => historyItem.value !== option.value
        ),
      ].slice(0, HISTORY_LIMIT);

      setHistoryOptions(updated);

      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Keep the current session usable if storage is unavailable.
      }
    },
    [historyOptions]
  );

  const removeHistoryItem = useCallback(
    (value: string): void => {
      const updated = historyOptions.filter(
        (item) => item.value !== value
      );

      setHistoryOptions(updated);

      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Keep the current session usable if storage is unavailable.
      }
    },
    [historyOptions]
  );

  const handleSelect = (option: SearchOption): void => {
    saveToHistory(option);
    setSearchFocused(false);

    if (
      option.isGroup &&
      option.brand &&
      option.vehicleType &&
      option.category
    ) {
      const params = new URLSearchParams({
        brand: option.brand,
        vehicle: option.vehicleType,
        category: option.category,
      });

      navigate(`/search-results?${params.toString()}`, {
        state: {
          fromSearchBar: true,
        },
      });
    } else {
      navigate(`/items/${option.value}`, {
        state: {
          fromSearchBar: true,
        },
      });
    }
  };

  const handleHistoryRemove = (
    event: MouseEvent<HTMLButtonElement>,
    value: string
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    removeHistoryItem(value);
  };

  const normalizedInput = normalizeSearchText(inputValue);

  const filteredOptions = normalizedInput
    ? options.filter((option) => {
        const words = normalizedInput.split(/\s+/).filter(Boolean);

        const searchableText = normalizeSearchText(
          [
            option.searchableText,
            option.label,
            getOptionLabel(option),
          ].join(" ")
        );

        return words.every((word) =>
          searchableText.includes(word)
        );
      })
    : [];

  const showHistory =
    searchFocused &&
    !normalizedInput &&
    historyOptions.length > 0;

  const showDropdown =
    searchFocused &&
    (showHistory || normalizedInput.length > 0);

  return (
    <div
      className="
        relative z-[1] mx-auto  mt-[40px] flex 
        w-full items-start justify-center px-4 pt-32
        font-[Arial,sans-serif] sm:px-6
      "
    >
      <div
        className="
          fixed inset-0 -z-10 overflow-hidden bg-cover bg-center
          bg-no-repeat
          bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('https://i.imgur.com/6R1dsG5.jpeg')]
          blur-sm scale-105
        "
      />

      <div className="w-full max-w-[760px]">
        <div ref={searchContainerRef} className="relative">
          <Search
            size={18}
            strokeWidth={2}
            className="
              pointer-events-none absolute left-3 top-1/2 z-10
              -translate-y-1/2 text-gray-400
            "
          />

          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={t("searchBar.placeholder")}
            aria-label={t("searchBar.placeholder")}
            className="
              h-[46px] w-full rounded-[10px] border border-gray-300
              bg-white pl-10 pr-10 text-[14px] text-black outline-none
              transition placeholder:text-gray-400
              hover:border-[#004080] focus:border-[#004080]
              focus:ring-1 focus:ring-[#004080]
            "
          />

          {inputValue && (
            <button
              type="button"
              onClick={() => setInputValue("")}
              className="
                absolute right-2 top-1/2 flex h-8 w-8
                -translate-y-1/2 items-center justify-center
                rounded-md text-gray-400 transition
                hover:bg-gray-100 hover:text-gray-700
              "
              aria-label={t("searchBar.clearSearch")}
            >
              <X size={17} />
            </button>
          )}

          {showDropdown && (
            <div
              className="
                absolute left-0 right-0 top-[calc(100%+6px)]
                overflow-hidden rounded-[10px] border border-gray-200
                bg-[#1b1b1b] shadow-2xl
              "
            >
              {showHistory && (
                <div>
                  <div
                    className="
                      bg-[#161616] px-[15px] py-[10px]
                      text-xs font-bold text-gray-400
                    "
                  >
                    {t("searchBar.recentSearches")}
                  </div>

                  {historyOptions.map((option) => (
                    <div
                      key={option.value}
                      className="
                        flex items-center gap-2 px-[15px] py-3
                        text-[14px] font-semibold text-gray-200
                        transition hover:bg-[#004080] hover:text-white
                      "
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(option)}
                        className="
                          flex min-w-0 flex-1 cursor-pointer
                          items-center gap-3 text-left
                        "
                      >
                        <Clock
                          size={16}
                          strokeWidth={1.8}
                          className="shrink-0 text-gray-300"
                        />

                        <span className="truncate">
                          {getOptionLabel(option)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(event) =>
                          handleHistoryRemove(event, option.value)
                        }
                        className="
                          flex h-7 w-7 shrink-0 cursor-pointer
                          items-center justify-center rounded-md
                          text-gray-300 transition hover:bg-white/10
                          hover:text-white
                        "
                        aria-label={t("searchBar.removeFromHistory", {
                          label: getOptionLabel(option),
                        })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {normalizedInput && (
                <div>
                  <div
                    className="
                      bg-[#161616] px-[15px] py-[10px]
                      text-xs font-bold text-gray-400
                    "
                  >
                    {t("searchBar.categories")}
                  </div>

                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className="
                          block w-full cursor-pointer px-[15px] py-3
                          text-left text-[14px] font-semibold
                          text-gray-200 transition
                          hover:bg-[#004080] hover:text-white
                        "
                      >
                        {getOptionLabel(option)}
                      </button>
                    ))
                  ) : (
                    <div className="px-[15px] py-4 text-sm text-gray-400">
                      {t("searchBar.noMatchingCategories")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
