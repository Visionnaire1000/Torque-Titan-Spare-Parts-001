import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from "react";
import { ArrowLeft, Edit, Trash2, X, Image as ImageIcon, Clock, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import config from "../../config";

const HISTORY_KEY = "spareparts_history";
const HISTORY_LIMIT = 6;

interface SparePart {
  id: string;
  image: string;
  brand: string;
  category: string;
  vehicle_type: string;
  colour: string;
  buying_price: number | string;
  marked_price: number | string;
}

interface SearchOption {
  label: string;
  value: string;
  searchableText: string;
  isGroup?: boolean;
  isHistory: boolean;
  parts: SparePart[];
}

interface SparePartsResponse {
  items?: SparePart[];
}

interface FormData {
  brand: string;
  category: string;
  vehicle_type: string;
  colour: string;
  buying_price: string;
  marked_price: string;
  image: File | null;
}

const emptyForm: FormData = {
  brand: "",
  category: "",
  vehicle_type: "",
  colour: "",
  buying_price: "",
  marked_price: "",
  image: null,
};

const singularizeWord = (word: string): string => {
  if (word === "tires" || word === "tyres") {
    return "tyre";
  }

  if (word.endsWith("ies") && word.length > 3) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.endsWith("ses") && word.length > 3) {
    return word.slice(0, -2);
  }

  if (
    word.endsWith("s") &&
    !word.endsWith("ss") &&
    word.length > 2
  ) {
    return word.slice(0, -1);
  }

  return word;
};

const normalizeSearchText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizeWord)
    .join(" ");
};

const normalizePrice = (
  value: number | string | null | undefined
): string => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(Math.trunc(numericValue));
};

const ItemsManagement = (): ReactElement => {
  const { authFetch } = useAuth();

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);

  const [inputValue, setInputValue] = useState("");
  const [historyOptions, setHistoryOptions] = useState<SearchOption[]>([]);
  const [selectedSearchValue, setSelectedSearchValue] =
    useState<string | null>(null);
  const [selectedPart, setSelectedPart] =
    useState<SparePart | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [imagePreview, setImagePreview] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const editScrollPositionRef = useRef<number | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);

      if (!stored) {
        setHistoryOptions([]);
        return;
      }

      const parsed: unknown = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        setHistoryOptions([]);
        return;
      }

      const validHistory: SearchOption[] = parsed
        .filter(
          (item): item is Record<string, unknown> =>
            item !== null &&
            typeof item === "object" &&
            typeof item.value === "string" &&
            typeof item.label === "string"
        )
        .map((item) => ({
          label: String(item.label),
          value: String(item.value),
          searchableText:
            typeof item.searchableText === "string"
              ? item.searchableText
              : String(item.value),
          isGroup: true,
          isHistory: true,
          parts: [],
        }));

      setHistoryOptions(validHistory.slice(0, HISTORY_LIMIT));
    } catch {
      setHistoryOptions([]);
    }
  };

  const fetchSpareParts = async () => {
    try {
      setLoading(true);

      const response = await authFetch(
        `${config.API_BASE_URL}/spareparts?per_page=1000`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch spare parts");
      }

      const data: SparePartsResponse = await response.json();

      setSpareParts(
        (data.items ?? []).map((part) => ({
          ...part,
          id: String(part.id),
        }))
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to load spare parts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    fetchSpareParts();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
          event.target as Node
        )
      ) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  const searchOptions = useMemo<SearchOption[]>(() => {
    const groupedMap = new Map<string, SearchOption>();

    spareParts.forEach((part) => {
      const rawKey = `${part.brand} ${part.vehicle_type} ${part.category}`;
      const key = normalizeSearchText(rawKey);

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          label: rawKey,
          value: key,
          searchableText: key,
          isGroup: true,
          isHistory: false,
          parts: [],
        });
      }

      groupedMap.get(key)!.parts.push(part);
    });

    return Array.from(groupedMap.values());
  }, [spareParts]);

  const hydratedHistoryOptions = useMemo<SearchOption[]>(() => {
    const hydrated: SearchOption[] = [];

    historyOptions.forEach((history) => {
      const currentGroup = searchOptions.find(
        (option) => option.value === history.value
      );

      if (!currentGroup || currentGroup.parts.length === 0) {
        return;
      }

      hydrated.push({
        ...currentGroup,
        isHistory: true,
      });
    });

    return hydrated;
  }, [historyOptions, searchOptions]);

  const selectedSearch = useMemo<SearchOption | null>(() => {
    if (!selectedSearchValue) {
      return null;
    }

    return (
      searchOptions.find(
        (option) => option.value === selectedSearchValue
      ) ?? null
    );
  }, [searchOptions, selectedSearchValue]);

  const filteredSearchOptions = useMemo<SearchOption[]>(() => {
    const normalizedInput = normalizeSearchText(inputValue);

    if (!normalizedInput) {
      return [];
    }

    const words = normalizedInput
      .split(/\s+/)
      .filter(Boolean);

    return searchOptions.filter((option) =>
      words.every((word) =>
        normalizeSearchText(option.searchableText).includes(word)
      )
    );
  }, [inputValue, searchOptions]);

  const saveToHistory = (option: SearchOption) => {
    const historyItem: SearchOption = {
      label: option.label,
      value: option.value,
      searchableText: option.searchableText,
      isGroup: true,
      isHistory: true,
      parts: [],
    };

    setHistoryOptions((previous) => {
      const withoutDuplicate = previous.filter(
        (item) => item.value !== historyItem.value
      );

      const updated = [historyItem, ...withoutDuplicate].slice(
        0,
        HISTORY_LIMIT
      );

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  const removeHistory = (
    event: React.MouseEvent<HTMLButtonElement>,
    value: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setHistoryOptions((previous) => {
      const updated = previous.filter(
        (item) => item.value !== value
      );

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setForm(emptyForm);
    setSelectedPart(null);
    setImagePreview("");
  };

  const clearSearch = () => {
    resetForm();
    setInputValue("");
    setSelectedSearchValue(null);
    setShowSearchDropdown(false);
  };

  const goBackToSearchResults = () => {
    resetForm();

    const scrollPosition = editScrollPositionRef.current;

    editScrollPositionRef.current = null;

    if (scrollPosition === null) {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollPosition,
        behavior: "auto",
      });
    });
  };

  const goBackToSearch = () => {
    resetForm();
    setSelectedSearchValue(null);
  };

  const handleSelectSearchOption = (option: SearchOption) => {
    saveToHistory(option);

    setSelectedSearchValue(option.value);
    setSelectedPart(null);
    setForm(emptyForm);
    setInputValue("");
    setShowSearchDropdown(false);

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview("");
  };

  const handleSelectPart = (part: SparePart) => {
    editScrollPositionRef.current = window.scrollY;

    setSelectedPart(part);

    setForm({
      brand: part.brand ?? "",
      category: part.category ?? "",
      vehicle_type: part.vehicle_type ?? "",
      colour: part.colour ?? "",
      buying_price: normalizePrice(part.buying_price),
      marked_price: normalizePrice(part.marked_price),
      image: null,
    });

    setImagePreview(part.image ?? "");

    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: "auto",
      });
    });
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setShowSearchDropdown(true);

    if (!value.trim()) {
      setSelectedSearchValue(null);
      setSelectedPart(null);
      setForm(emptyForm);

      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setImagePreview("");
    } else {
      setSelectedSearchValue(null);
      setSelectedPart(null);
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Escape") {
      setShowSearchDropdown(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const options = inputValue.trim()
        ? filteredSearchOptions
        : hydratedHistoryOptions;

      if (options.length > 0) {
        handleSelectSearchOption(options[0]);
      }
    }
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    if (
      name === "buying_price" ||
      name === "marked_price"
    ) {
      const wholeNumberValue = value.replace(/\D/g, "");

      setForm((previous) => ({
        ...previous,
        [name]: wholeNumberValue,
      }));

      return;
    }

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      event.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      toast.error("Image must be 5 MB or smaller");
      event.target.value = "";
      return;
    }

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setForm((previous) => ({
      ...previous,
      image: file,
    }));

    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  const isValidPrice = (value: string): boolean => {
    return (
      value !== "" &&
      /^\d+$/.test(value) &&
      Number(value) >= 0
    );
  };

  const isCreateFormComplete =
    form.brand.trim() !== "" &&
    form.category.trim() !== "" &&
    form.vehicle_type.trim() !== "" &&
    form.colour.trim() !== "" &&
    isValidPrice(form.buying_price) &&
    isValidPrice(form.marked_price) &&
    form.image !== null;

  const hasEditChanges = useMemo(() => {
    if (!selectedPart) {
      return false;
    }

    const originalBrand = selectedPart.brand ?? "";
    const originalCategory = selectedPart.category ?? "";
    const originalVehicleType =
      selectedPart.vehicle_type ?? "";
    const originalColour = selectedPart.colour ?? "";
    const originalBuyingPrice = normalizePrice(
      selectedPart.buying_price
    );
    const originalMarkedPrice = normalizePrice(
      selectedPart.marked_price
    );

    const textOrPriceChanged =
      form.brand.trim() !== originalBrand.trim() ||
      form.category.trim() !== originalCategory.trim() ||
      form.vehicle_type.trim() !==
        originalVehicleType.trim() ||
      form.colour.trim() !== originalColour.trim() ||
      form.buying_price !== originalBuyingPrice ||
      form.marked_price !== originalMarkedPrice;

    const imageChanged = form.image !== null;

    return textOrPriceChanged || imageChanged;
  }, [form, selectedPart]);

  const handleSubmit = async (
    event: React.SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (selectedPart && !hasEditChanges) {
      return;
    }

    if (!form.brand.trim()) {
      toast.error("Brand is required");
      return;
    }

    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }

    if (!form.vehicle_type.trim()) {
      toast.error("Vehicle type is required");
      return;
    }

    if (!form.colour.trim()) {
      toast.error("Colour is required");
      return;
    }

    if (!isValidPrice(form.buying_price)) {
      toast.error("Enter a valid buying price");
      return;
    }

    if (!isValidPrice(form.marked_price)) {
      toast.error("Enter a valid marked price");
      return;
    }

    if (!selectedPart && !form.image) {
      toast.error("Image is required");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();

      formData.append("brand", form.brand.trim());
      formData.append("category", form.category.trim());
      formData.append(
        "vehicle_type",
        form.vehicle_type.trim()
      );
      formData.append("colour", form.colour.trim());
      formData.append("buying_price", form.buying_price);
      formData.append("marked_price", form.marked_price);

      if (form.image) {
        formData.append("image", form.image);
      }

      const url = selectedPart
        ? `${config.API_BASE_URL}/admin/spareparts/${selectedPart.id}/`
        : `${config.API_BASE_URL}/admin/spareparts/`;

      const response = await authFetch(url, {
        method: selectedPart ? "PUT" : "POST",
        body: formData,
      });

      let data: Record<string, unknown> = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : typeof data.error === "string"
              ? data.error
              : "Failed to save spare part";

        throw new Error(message);
      }

      toast.success(
        selectedPart
          ? "Spare part updated successfully"
          : "Spare part created successfully"
      );

      await fetchSpareParts();

      if (selectedPart) {
        const updatedPart =
          data.sparepart &&
          typeof data.sparepart === "object"
            ? (data.sparepart as SparePart)
            : null;

        if (updatedPart) {
          const normalizedPart: SparePart = {
            ...updatedPart,
            id: String(updatedPart.id),
          };

          setSelectedPart(normalizedPart);

          setForm({
            brand: normalizedPart.brand ?? "",
            category: normalizedPart.category ?? "",
            vehicle_type:
              normalizedPart.vehicle_type ?? "",
            colour: normalizedPart.colour ?? "",
            buying_price: normalizePrice(
              normalizedPart.buying_price
            ),
            marked_price: normalizePrice(
              normalizedPart.marked_price
            ),
            image: null,
          });

          if (imagePreview.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreview);
          }

          setImagePreview(normalizedPart.image ?? "");
        }
      } else {
        clearSearch();
      }
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save spare part"
      );
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = () => {
    if (!selectedPart) {
      return;
    }

    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) {
      return;
    }

    setShowDeleteDialog(false);
  };

  const handleDelete = async () => {
    if (!selectedPart) {
      return;
    }

    try {
      setDeleting(true);

      const response = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts/${selectedPart.id}/`,
        {
          method: "DELETE",
        }
      );

      let data: Record<string, unknown> = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : typeof data.error === "string"
              ? data.error
              : "Failed to delete spare part";

        throw new Error(message);
      }

      toast.success(
        typeof data.message === "string"
          ? data.message
          : "Spare part deleted successfully"
      );

      setShowDeleteDialog(false);
      setSelectedPart(null);
      setForm(emptyForm);

      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setImagePreview("");

      await fetchSpareParts();
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete spare part"
      );
    } finally {
      setDeleting(false);
    }
  };

  const selectedParts = selectedSearch?.parts ?? [];

  const dropdownOptions = inputValue.trim()
    ? filteredSearchOptions
    : hydratedHistoryOptions;

  return (
    <>
      <div className="mt-20 w-full px-3 py-4 sm:px-5 lg:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                Items Management
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Search spare parts by brand, vehicle type,
                and category.
              </p>
            </div>
          </div>

          <div
            ref={searchContainerRef}
            onMouseDown={() => {
              setShowSearchDropdown(true);
            }}
            className="relative z-30 mb-6 rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-6"
          >
            <div className="relative">
              <div className="relative flex items-center">
                <Search
                  size={18}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-3 z-10 text-gray-400"
                />

                <input
                  type="text"
                  value={inputValue}
                  placeholder="Search spare part..."
                  onFocus={() => {
                    setShowSearchDropdown(true);
                  }}
                  onChange={(event) =>
                    handleInputChange(event.target.value)
                  }
                  onKeyDown={handleSearchKeyDown}
                  className="
                    h-[42px]
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
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      clearSearch();
                    }}
                    className="
                      absolute
                      right-2
                      flex
                      h-8
                      w-8
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
              </div>

              {showSearchDropdown && (
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
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <div className="max-h-80 overflow-y-auto">
                    {!inputValue.trim() ? (
                      hydratedHistoryOptions.length > 0 ? (
                        <>
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

                          {hydratedHistoryOptions.map((option) => (
                            <div
                              key={option.value}
                              className="
                                flex
                                cursor-pointer
                                items-center
                                gap-3
                                px-[15px]
                                py-3
                                text-gray-200
                                transition
                                hover:bg-[#004080]
                              "
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleSelectSearchOption(option);
                              }}
                            >
                              <Clock
                                size={16}
                                strokeWidth={1.8}
                                className="shrink-0 text-gray-300"
                              />

                              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                                {option.label}
                              </span>

                              <button
                                type="button"
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
                                  hover:bg-white/10
                                  hover:text-white
                                "
                                onMouseDown={(event) => {
                                  removeHistory(
                                    event,
                                    option.value
                                  );
                                }}
                                aria-label={`Remove ${option.label} from search history`}
                              >
                                <X
                                  size={16}
                                  strokeWidth={2}
                                />
                              </button>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="px-4 py-4 text-sm text-gray-400">
                          No recent searches
                        </div>
                      )
                    ) : filteredSearchOptions.length > 0 ? (
                      <>
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
                          All Results
                        </div>

                        {dropdownOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleSelectSearchOption(option);
                            }}
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
                            <span className="block truncate">
                              {option.label}
                            </span>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-4 text-sm text-gray-400">
                        No spare parts found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004080]" />

              <p className="text-sm text-gray-500">
                Loading spare parts...
              </p>
            </div>
          ) : selectedSearch && !selectedPart ? (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={goBackToSearch}
                    className="
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      text-gray-600
                      transition
                      hover:bg-gray-100
                      hover:text-[#004080]
                    "
                    aria-label="Back to search"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
                      {selectedSearch.label}
                    </h2>

                    <p className="text-sm text-gray-500">
                      {selectedParts.length}{" "}
                      {selectedParts.length === 1
                        ? "matching spare part"
                        : "matching spare parts"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSearch}
                  className="
                    hidden
                    rounded-[10px]
                    border
                    border-gray-300
                    px-3
                    py-2
                    text-sm
                    font-medium
                    text-gray-700
                    transition
                    hover:bg-gray-50
                    sm:block
                  "
                >
                  Clear Search
                </button>
              </div>

              {selectedParts.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                  <ImageIcon
                    size={38}
                    className="mx-auto mb-3 text-gray-300"
                  />

                  <p className="text-sm text-gray-500">
                    No spare parts found for this search.
                  </p>
                </div>
              ) : (
                <div
                  className="
                    grid
                    grid-cols-2
                    gap-2.5
                    min-[480px]:gap-3
                    sm:grid-cols-3
                    sm:gap-4
                    lg:grid-cols-4
                    xl:grid-cols-5
                  "
                >
                  {selectedParts.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => handleSelectPart(part)}
                      className="
                        group
                        min-w-0
                        overflow-hidden
                        rounded-xl
                        border
                        border-gray-200
                        bg-white
                        text-left
                        shadow-sm
                        transition
                        hover:-translate-y-0.5
                        hover:border-[#004080]
                        hover:shadow-md
                      "
                    >
                      <div
                        className="
                          relative
                          flex
                          h-28
                          items-center
                          justify-center
                          overflow-hidden
                          bg-gray-50
                          min-[480px]:h-32
                          sm:h-36
                          lg:h-40
                        "
                      >
                        {part.image ? (
                          <img
                            src={part.image}
                            alt={`${part.brand} ${part.vehicle_type} ${part.category}`}
                            className="
                              h-full
                              w-full
                              object-contain
                              p-2
                              transition
                              duration-300
                              group-hover:scale-105
                              min-[480px]:p-2.5
                              sm:p-3
                            "
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-400">
                            <ImageIcon
                              size={28}
                              className="sm:h-9 sm:w-9"
                            />

                            <span className="mt-1 text-[10px] sm:mt-2 sm:text-xs">
                              No image
                            </span>
                          </div>
                        )}

                        <div
                          className="
                            absolute
                            right-1.5
                            top-1.5
                            rounded-full
                            bg-white/95
                            p-1.5
                            text-gray-500
                            shadow-sm
                            transition
                            group-hover:text-[#004080]
                            sm:right-2.5
                            sm:top-2.5
                            sm:p-2
                          "
                        >
                          <Edit
                            size={13}
                            className="sm:h-[15px] sm:w-[15px]"
                          />
                        </div>
                      </div>

                      <div className="min-w-0 p-2.5 sm:p-3">
                        <h3
                          className="
                            truncate
                            text-[12px]
                            font-bold
                            capitalize
                            text-gray-900
                            sm:text-[14px]
                            lg:text-[15px]
                          "
                        >
                          {part.brand} {part.vehicle_type}{" "}
                          {part.category}
                        </h3>

                        {part.colour && (
                          <p className="mt-1 truncate text-[10px] text-gray-500 sm:text-xs">
                            Colour:{" "}
                            <span className="font-medium text-gray-700">
                              {part.colour}
                            </span>
                          </p>
                        )}

                        <div className="mt-2 border-t border-gray-100 pt-2 sm:mt-3 sm:pt-3">
                          <p className="text-[9px] text-gray-400 sm:text-xs">
                            Selling price
                          </p>

                          <div className="mt-0.5 flex items-center justify-between gap-1">
                            <p className="truncate text-sm font-bold text-red-600 sm:text-base lg:text-lg">
                              KES{" "}
                              {Number(
                                part.marked_price
                              ).toLocaleString()}
                            </p>

                            <span className="hidden text-xs font-semibold text-[#004080] sm:inline">
                              Manage
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="mx-auto w-full max-w-6xl rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-6">
              <div className="mb-5 flex items-start gap-2">
                {selectedPart && (
                  <button
                    type="button"
                    onClick={goBackToSearchResults}
                    disabled={saving || deleting}
                    className="
                      mt-0.5
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      text-gray-600
                      transition
                      hover:bg-gray-100
                      hover:text-[#004080]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                    aria-label="Back to search results"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}

                <div>
                  <h2 className="text-[22px] font-semibold text-[#222]">
                    {selectedPart
                      ? "Edit Spare Part"
                      : "Create Spare Part"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {selectedPart
                      ? "Update the selected spare part."
                      : "Add a new spare part to your inventory."}
                  </p>
                </div>
              </div>

              {imagePreview && (
                <div className="my-5 text-center">
                  <img
                    src={imagePreview}
                    alt={`${form.brand} ${form.vehicle_type}`}
                    className="
                      mx-auto
                      my-[15px]
                      max-h-[150px]
                      max-w-[160px]
                      rounded-[10px]
                      border
                      border-gray-300
                      object-contain
                    "
                  />
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="
                  mt-[15px]
                  grid
                  grid-cols-2
                  gap-[14px]
                  max-[640px]:grid-cols-1
                "
              >
                <input
                  className="w-full rounded-[10px] border border-gray-300 px-3 py-[10px] text-[14px] transition focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
                  name="category"
                  placeholder="Category"
                  value={form.category}
                  onChange={handleFormChange}
                />

                <input
                  className="w-full rounded-[10px] border border-gray-300 px-3 py-[10px] text-[14px] transition focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
                  name="vehicle_type"
                  placeholder="Vehicle Type"
                  value={form.vehicle_type}
                  onChange={handleFormChange}
                />

                <input
                  className="w-full rounded-[10px] border border-gray-300 px-3 py-[10px] text-[14px] transition focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
                  name="brand"
                  placeholder="Brand"
                  value={form.brand}
                  onChange={handleFormChange}
                />

                <input
                  className="w-full rounded-[10px] border border-gray-300 px-3 py-[10px] text-[14px] transition focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
                  name="colour"
                  placeholder="Colour"
                  value={form.colour}
                  onChange={handleFormChange}
                />

                <input
                  className="w-full rounded-[10px] border border-gray-300 px-3 py-[10px] text-[14px] transition focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
                  name="buying_price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Buying Price"
                  value={form.buying_price}
                  onChange={handleFormChange}
                />

                <input
                  className="w-full rounded-[10px] border border-gray-300 px-3 py-[10px] text-[14px] transition focus:border-[#004080] focus:outline-none focus:ring-2 focus:ring-[#004080]/20"
                  name="marked_price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Marked Price"
                  value={form.marked_price}
                  onChange={handleFormChange}
                />

                <div className="w-full">
                  <label
                    htmlFor="image"
                    className="mb-2 block text-[14px] font-medium text-gray-700"
                  >
                    Image
                  </label>

                  <input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="
                      w-full
                      cursor-pointer
                      rounded-[10px]
                      border
                      border-gray-300
                      bg-white
                      px-3
                      py-[8px]
                      text-[14px]
                      transition
                      file:mr-3
                      file:rounded-md
                      file:border-0
                      file:bg-[#004080]
                      file:px-3
                      file:py-2
                      file:text-[13px]
                      file:font-medium
                      file:text-white
                      hover:file:bg-[#004080]/80
                      focus:border-[#004080]
                      focus:outline-none
                      focus:ring-2
                      focus:ring-[#004080]/20
                    "
                  />

                  <p className="mt-1 text-[11px] text-gray-500">
                    JPG, JPEG, PNG, WEBP or GIF · Max 5 MB
                  </p>
                </div>

                <div
                  className="
                    col-span-2
                    mt-[10px]
                    flex
                    justify-center
                    gap-[10px]
                    max-[640px]:col-span-1
                    max-[640px]:flex-col
                  "
                >
                  {selectedPart ? (
                    <>
                      <button
                        type="submit"
                        disabled={
                          saving ||
                          deleting ||
                          !hasEditChanges
                        }
                        className="flex-1 rounded-[10px] bg-[#004080] py-[10px] font-medium text-white transition hover:bg-[#004080]/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? "Updating..." : "Update"}
                      </button>

                      <button
                        type="button"
                        onClick={openDeleteDialog}
                        disabled={saving || deleting}
                        className="flex-1 rounded-[10px] bg-red-600 py-[10px] font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </button>

                      <button
                        type="button"
                        onClick={goBackToSearchResults}
                        disabled={saving || deleting}
                        className="flex-1 rounded-[10px] border border-gray-300 bg-white py-[10px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        saving || !isCreateFormComplete
                      }
                      className="flex-1 rounded-[10px] bg-[#004080] py-[10px] font-medium text-white transition hover:bg-[#004080]/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Creating..." : "Create"}
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
        </div>
      </div>

      {showDeleteDialog && selectedPart && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete spare part?
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-900">
                    {selectedPart.brand}{" "}
                    {selectedPart.vehicle_type}{" "}
                    {selectedPart.category}
                  </span>
                  ? This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close delete dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="rounded-[10px] border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} />

                {deleting
                  ? "Deleting..."
                  : "Delete Spare Part"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ItemsManagement;