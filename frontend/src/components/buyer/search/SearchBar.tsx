import { useEffect, useState, useCallback } from "react";
import Select, { components, type GroupBase, type FilterOptionOption,
                 type StylesConfig, type OptionProps } from "react-select";
import { useNavigate } from "react-router-dom";
import { Clock, X } from "lucide-react";
import config from "../../../config";

const HISTORY_KEY = "search_history";
const HISTORY_LIMIT = 6;

interface SparePart {
  id: number;
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

const SearchBar = () => {
  const navigate = useNavigate();

  const [options, setOptions] = useState<SearchOption[]>([]);
  const [historyOptions, setHistoryOptions] = useState<SearchOption[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const saved: SearchOption[] = JSON.parse(
      localStorage.getItem(HISTORY_KEY) ?? "[]"
    );

    setHistoryOptions(saved);
  }, []);

  useEffect(() => {
    fetch(`${config.API_BASE_URL}/spareparts?per_page=1000`)
      .then((res) => res.json())
      .then((data: SparePartsResponse) => {
        const parts = data.items ?? [];

        const groupedMap: Record<string, SearchOption> = {};

        parts.forEach((part) => {
          const key =
            `${part.brand} ${part.vehicle_type} ${part.category}`.toLowerCase();

          if (!groupedMap[key]) {
            groupedMap[key] = {
              label: `${part.brand} ${part.vehicle_type} ${part.category}`,
              value: key,
              searchableText: key,
              parts: [],
              isGroup: true,
            };
          }

          groupedMap[key].parts!.push(part);
        });

        setOptions(Object.values(groupedMap));
      });
  }, []);

  const saveToHistory = useCallback(
    (option: SearchOption) => {
      const updated: SearchOption[] = [
        {
          ...option,
          isHistory: true,
          searchableText:
            option.searchableText || option.label.toLowerCase(),
        },
        ...historyOptions.filter((h) => h.value !== option.value),
      ].slice(0, HISTORY_LIMIT);

      setHistoryOptions(updated);

      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    },
    [historyOptions]
  );

  const removeHistoryItem = useCallback(
    (value: string) => {
      const updated = historyOptions.filter(
        (item) => item.value !== value
      );

      setHistoryOptions(updated);

      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    },
    [historyOptions]
  );

  const filterOption = (
    option: FilterOptionOption<SearchOption>,
    inputVal: string
  ): boolean => {
    if (option.data.isHistory && !inputVal) return true;

    if (!inputVal) return false;

    const words = inputVal
      .toLowerCase()
      .trim()
      .split(/\s+/);

    return words.every((word) =>
      option.data.searchableText.includes(word)
    );
  };

  const handleInputChange = (value: string): void => {
    setInputValue(value);
  };

  const handleSelect = (
    option: SearchOption | null
  ): void => {
    if (!option) return;

    saveToHistory(option);

    if (option.isGroup) {
      const [brand, vehicle_type, ...rest] =
        option.label.split(" ");

      const category = rest.join(" ");

      navigate(
        `/search-results?brand=${encodeURIComponent(
          brand
        )}&vehicle=${encodeURIComponent(
          vehicle_type
        )}&category=${encodeURIComponent(category)}`
      );
    } else {
      navigate(`/items/${option.value}`);
    }
  };

    const CustomOption = (
    props: OptionProps<SearchOption, false, GroupBase<SearchOption>>
  ) => {
    const { data } = props;

    return (
      <components.Option {...props}>
        <div className="flex items-center justify-between gap-2">

          {data.isHistory && (
            <Clock
              className="mr-3 shrink-0"
              size={16}
              strokeWidth={1.8}
            />
          )}

          <div className="flex flex-1 flex-col">
            <strong>
              {data.isGroup ? data.label : data.part?.name}
            </strong>

            <small className="text-xs text-gray-300">
              {data.part &&
                `${data.part.brand} ${data.part.category} for ${data.part.vehicle_type}`}
            </small>
          </div>

          {data.isHistory && (
            <button
              className="
                shrink-0
                cursor-pointer
                bg-transparent
                px-1
                text-sm
                text-white
                transition-colors
                duration-200
                hover:text-red-500
              "
              onMouseDown={(
                e: React.MouseEvent<HTMLButtonElement>
              ) => {
                e.preventDefault();
                e.stopPropagation();
                removeHistoryItem(data.value);
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}

        </div>
      </components.Option>
    );
  };

  const groupedOptions: GroupBase<SearchOption>[] = [
    ...(
      historyOptions.length > 0 && !inputValue
        ? [
            {
              label: "Recent Searches",
              options: historyOptions,
            },
          ]
        : []
    ),

    ...(
      inputValue
        ? [
            {
              label: "Categories",
              options,
            },
          ]
        : []
    ),
  ];

  const styles: StylesConfig<SearchOption, false> = {
    container: (base) => ({
      ...base,
      flex: 1,
    }),

    control: (base, state) => ({
      ...base,
      minHeight: "44px",
      backgroundColor: "#fff",
      borderColor: state.isFocused
        ? "rgb(0,64,128)"
        : "#ccc",
      boxShadow: state.isFocused
        ? "0 0 0 1px rgb(0,64,128)"
        : "none",

      "&:hover": {
        borderColor: "rgb(0,64,128)",
      },
    }),

    menu: (base) => ({
      ...base,
      backgroundColor: "#1b1b1b",
      borderRadius: "10px",
      overflow: "hidden",
      zIndex: 1000,
    }),

    menuList: (base) => ({
      ...base,
      paddingTop: 0,
      paddingBottom: 0,
    }),

    groupHeading: (base) => ({
      ...base,
      color: "#bdbdbd",
      fontWeight: 700,
      fontSize: "12px",
      padding: "10px 15px",
      backgroundColor: "#161616",
    }),

    option: (base, state) => ({
      ...base,
      padding: "12px 15px",
      backgroundColor: state.isFocused
        ? "rgb(0,64,128)"
        : "#1b1b1b",
      color: state.isFocused ? "#fff" : "#ddd",
      cursor: "pointer",
    }),

    placeholder: (base) => ({
      ...base,
      color: "#777",
    }),

    singleValue: (base) => ({
      ...base,
      color: "#222",
    }),
  };

    return (
    <div
      className="
        relative
        z-[1]
        mx-auto
        mt-[-10px] 
        max-w-[500px]
        font-[Arial,sans-serif]
        max-[480px]:w-[88%]
        max-[480px]:max-w-[480px]
        flex min-h-screen 
        items-start
        justify-center pt-32"
    >
      {/* Background */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://i.imgur.com/6R1dsG5.jpeg')",
        }}
      />
      
      {/* Search Bar */}
      <div className="w-full">
        <Select<SearchOption, false, GroupBase<SearchOption>>
          autoFocus
          options={groupedOptions}
          isClearable
          placeholder="Search spare parts..."
          filterOption={filterOption}
          onChange={handleSelect}
          onInputChange={handleInputChange}
          inputValue={inputValue}
          components={{
            Option: CustomOption,
          }}
          styles={styles}
        />
      </div>
    </div>
  );
};

export default SearchBar;