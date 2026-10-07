import { useEffect, useState, useCallback, useRef, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
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
}

interface SparePartsResponse {
  items: SparePart[];
}

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

const normalizeSearchText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(normalizeSearchWord)
    .join(" ");
};

const SearchBar = () => {
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
    fetch(`${config.API_BASE_URL}/spareparts/?per_page=1000`)
      .then((res) => res.json())
      .then((data: SparePartsResponse) => {
        const parts = data.items ?? [];

        const groupedMap: Record<string, SearchOption> = {};

        parts.forEach((part) => {
          const rawLabel = `${part.brand} ${part.vehicle_type} ${part.category}`;
          const key = normalizeSearchText(rawLabel);

          if (!groupedMap[key]) {
            groupedMap[key] = {
              label: rawLabel,
              value: key,
              searchableText: key,
              parts: [],
              isGroup: true,
            };
          }

          groupedMap[key].parts!.push(part);
        });

        setOptions(Object.values(groupedMap));
      })
      .catch(() => {
        setOptions([]);
      });
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

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updated)
      );
    },
    [historyOptions]
  );

  const removeHistoryItem = useCallback(
    (value: string): void => {
      const updated = historyOptions.filter(
        (item) => item.value !== value
      );

      setHistoryOptions(updated);

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updated)
      );
    },
    [historyOptions]
  );

  const handleSelect = (option: SearchOption): void => {
    saveToHistory(option);
    setSearchFocused(false);

    if (option.isGroup) {
      const [brand, vehicleType, ...rest] =
        option.label.split(" ");

      const category = rest.join(" ");

      navigate(
        `/search-results?brand=${encodeURIComponent(
          brand
        )}&vehicle=${encodeURIComponent(
          vehicleType
        )}&category=${encodeURIComponent(
          category
        )}`,
        {
          state: {
            fromSearchBar: true,
          },
        }
      );
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
        const words = normalizedInput
          .split(/\s+/)
          .filter(Boolean);

        const searchableText = normalizeSearchText(
          option.searchableText
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
        relative
        z-[1]
        mx-auto
        mt-[-10px]
        flex
        min-h-screen
        w-full
        items-start
        justify-center
        pt-32
        font-[Arial,sans-serif]
        px-4
        sm:px-6
      "
    >
      <div
        className="
          fixed
          inset-0
          -z-10
          overflow-hidden
          bg-cover
          bg-center
          bg-no-repeat
          bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('https://i.imgur.com/6R1dsG5.jpeg')]
          blur-sm scale-105
          bg-[url('https://i.imgur.com/6R1dsG5.jpeg')]
        "
      />

      <div className="w-full max-w-[760px] ">
        <div
          ref={searchContainerRef}
          className="relative"
        >
          <Search
            size={18}
            strokeWidth={2}
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              z-10
              -translate-y-1/2
              text-gray-400
            "
          />

          <input
            type="text"
            value={inputValue}
            onChange={(event) =>
              setInputValue(event.target.value)
            }
            onFocus={() => setSearchFocused(true)}
            placeholder="Search spare parts..."
            className="
              h-[46px]
              w-full
              rounded-[10px]
              border
              border-gray-300
              bg-white
              pl-10
              pr-10
              text-[14px]
              text-black
              outline-none
              transition
              placeholder:text-gray-400
              hover:border-[#004080]
              focus:border-[#004080]
              focus:ring-1
              focus:ring-[#004080]
            "
          />

          {inputValue && (
            <button
              type="button"
              onClick={() => setInputValue("")}
              className="
                absolute
                right-2
                top-1/2
                flex
                h-8
                w-8
                -translate-y-1/2
                items-center
                justify-center
                rounded-md
                text-gray-400
                transition
                hover:bg-gray-100
                hover:text-gray-700
              "
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}

          {showDropdown && (
            <div
              className="
                absolute
                left-0
                right-0
                top-[calc(100%+6px)]
                overflow-hidden
                rounded-[10px]
                border
                border-gray-200
                bg-[#1b1b1b]
                shadow-2xl
              "
            >
              {showHistory && (
                <div>
                  <div
                    className="
                      bg-[#161616]
                      px-[15px]
                      py-[10px]
                      text-xs
                      font-bold
                      text-gray-400
                    "
                  >
                    Recent Searches
                  </div>

                  {historyOptions.map((option) => (
                    <div
                      key={option.value}
                      className="
                        flex
                        items-center
                        gap-2
                        px-[15px]
                        py-3
                        text-[14px]
                        font-semibold
                        text-gray-200
                        transition
                        hover:bg-[#004080]
                        hover:text-white
                      "
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleSelect(option)
                        }
                        className="
                          flex
                          min-w-0
                          flex-1
                          cursor-pointer
                          items-center
                          gap-3
                          text-left
                        "
                      >
                        <Clock
                          size={16}
                          strokeWidth={1.8}
                          className="shrink-0 text-gray-300"
                        />

                        <span className="truncate">
                          {option.label}
                        </span>
                      </button>

                      <button
                        type="button"
                        onMouseDown={(event) =>
                          handleHistoryRemove(
                            event,
                            option.value
                          )
                        }
                        className="
                          flex
                          h-7
                          w-7
                          shrink-0
                          items-center
                          justify-center
                          rounded-md
                          text-gray-300
                          transition
                          cursor-pointer
                          hover:bg-white/10
                          hover:text-white
                        "
                        aria-label={`Remove ${option.label} from search history`}
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
                      bg-[#161616]
                      px-[15px]
                      py-[10px]
                      text-xs
                      font-bold
                      text-gray-400
                    "
                  >
                    Categories
                  </div>

                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          handleSelect(option)
                        }
                        className="
                          block
                          w-full
                          cursor-pointer
                          px-[15px]
                          py-3
                          text-left
                          text-[14px]
                          font-semibold
                          text-gray-200
                          transition
                          hover:bg-[#004080]
                          hover:text-white
                        "
                      >
                        {option.label}
                      </button>
                    ))
                  ) : (
                    <div
                      className="
                        px-[15px]
                        py-4
                        text-sm
                        text-gray-400
                      "
                    >
                      No matching categories found.
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