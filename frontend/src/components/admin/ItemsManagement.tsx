import { useEffect, useState, useCallback, useMemo,type ChangeEvent } from "react";
import Select, { components, type FilterOptionOption, type GroupBase, type StylesConfig } from "react-select";
import { Clock, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../contexts/AuthContext";
import config from "../../config";
import "../../styles/admin/itemsManagement.css";

const HISTORY_KEY = "spareparts_history";
const HISTORY_LIMIT = 6;

/* ---------------- Interfaces ---------------- */

interface SparePart {
  id: string;
  category: string;
  vehicle_type: string;
  brand: string;
  colour: string;
  buying_price: number | string;
  marked_price: number | string;
  image: string;
  description: string;
}

interface SparePartsResponse {
  items?: SparePart[];
}

interface SearchOption {
  label: string;
  value: string;
  part: SparePart;
  searchableText: string;
  isHistory?: boolean;
}

interface FormData {
  category: string;
  vehicle_type: string;
  brand: string;
  colour: string;
  buying_price: number | string;
  marked_price: number | string;
  image: string;
  description: string;
}

const ItemsManagement = () => {
  const { authFetch } = useAuth();

  const [options, setOptions] = useState<SearchOption[]>([]);
  const [historyOptions, setHistoryOptions] = useState<SearchOption[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

  const [formData, setFormData] = useState<FormData>({
    category: "",
    vehicle_type: "",
    brand: "",
    colour: "",
    buying_price: "",
    marked_price: "",
    image: "",
    description: "",
  });

  /* ---------------- Load history ---------------- */
  const reloadHistory = useCallback((): void => {
    const saved = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]"
    ) as SearchOption[];

    setHistoryOptions(saved);
  }, []);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  /* ---------------- Fetch spare parts ---------------- */
  const fetchSpareParts = useCallback((): void => {
    authFetch(`${config.API_BASE_URL}/spareparts?per_page=1000`)
      .then((res) => res.json() as Promise<SparePartsResponse>)
      .then((data) => {
        const parts = data.items ?? [];

        const individualOptions: SearchOption[] = parts.map((part) => ({
          label: `${part.brand} ${part.vehicle_type} ${part.category}`,
          value: part.id,
          part,
          searchableText:
            `${part.brand} ${part.vehicle_type} ${part.category}`.toLowerCase(),
        }));

        setOptions(individualOptions);
      });
  }, [authFetch]);

  useEffect(() => {
    fetchSpareParts();
  }, [fetchSpareParts]);

  /* ---------------- Save to history ---------------- */
  const saveToHistory = useCallback((option: SearchOption): void => {
    setHistoryOptions((prev) => {
      const updated = [
        { ...option, isHistory: true },
        ...prev.filter((h) => h.value !== option.value),
      ].slice(0, HISTORY_LIMIT);

      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

      return updated;
    });
  }, []);

  /* ---------------- Remove history item ---------------- */
  const removeHistoryItem = useCallback((value: string): void => {
    setHistoryOptions((prev) => {
      const updated = prev.filter((h) => h.value !== value);

      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

      return updated;
    });
  }, []);

  /* ---------------- Filtering ---------------- */
  const filterOption = (
    option: FilterOptionOption<SearchOption>,
    inputVal: string
  ): boolean => {
    if (option.data.isHistory && !inputVal) return true;

    if (!inputVal) return false;

    const words = inputVal
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words.every((word) =>
      option.data.searchableText.includes(word)
    );
  };

  /* ---------------- Handlers ---------------- */
  const handleInputChange = (value: string): void => {
    setInputValue(value);
  };

  const handleSelect = (option: SearchOption | null): void => {
    if (!option) return;

    saveToHistory(option);

    setSelectedPart(option.part);

    setFormData({
      category: option.part.category || "",
      vehicle_type: option.part.vehicle_type || "",
      brand: option.part.brand || "",
      colour: option.part.colour || "",
      buying_price: option.part.buying_price || "",
      marked_price: option.part.marked_price || "",
      image: option.part.image || "",
      description: option.part.description || "",
    });
  };

 /* ---------------- Custom Option ---------------- */
 const CustomOption = (props: any) => {
  const { data } = props;

  return (
    <components.Option {...props}>
      <div className="flex items-center justify-between gap-3">
        {data.isHistory && (
          <Clock
            className="text-gray-300"
            size={16}
            strokeWidth={1.8}
          />
        )}

        <div className="flex-1">
          <strong className="text-[14px] font-semibold text-white">
            {data.label}
          </strong>
        </div>

        {data.isHistory && (
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 transition hover:bg-white/10 hover:text-white"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeHistoryItem(data.value);
            }}
            aria-label="Remove search"
          >
            <X
              size={16}
              strokeWidth={2}
            />
          </button>
        )}
      </div>
    </components.Option>
  );
 };

  /* ---------------- Grouped options ---------------- */
  const groupedOptions = useMemo<
    GroupBase<SearchOption>[]
  >(() => {
    const groups: GroupBase<SearchOption>[] = [];

    if (historyOptions.length && !inputValue) {
      groups.push({
        label: "Recent Searches",
        options: historyOptions.map((item) => ({
          ...item,
          isHistory: true,
        })),
      });
    }

    if (inputValue || options.length) {
      groups.push({
        label: "All Results",
        options,
      });
    }

    return groups;
  }, [historyOptions, inputValue, options]);

  /* ---------------- Toast helpers ---------------- */
  const notifySuccess = (msg: string): void => {
    toast.success(msg, {
      position: "top-right",
    });
  };

  const notifyError = (msg: string): void => {
    toast.error(msg, {
      position: "top-right",
    });
  };

  /* ---------------- Form handlers ---------------- */
  const handleChange = (
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ): void => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

    const handleCreate = async (
    e: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e.preventDefault();

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await res.json();

      if (data.message) {
        notifySuccess(data.message);
        fetchSpareParts();
        reloadHistory();
      } else {
        notifyError(data.error);
      }
    } catch {
      notifyError("Error creating spare part");
    }
  };

  const handleUpdate = async (
    e: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!selectedPart) {
      notifyError("Select a spare part first");
      return;
    }

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts/${selectedPart.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await res.json();

      if (data.message) {
        notifySuccess(data.message);

        setHistoryOptions((prev) => {
          const updated = prev.map((h) =>
            h.value === selectedPart.id
              ? {
                  ...h,
                  part: {
                    ...formData,
                    id: selectedPart.id,
                  },
                }
              : h
          );

          localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(updated)
          );

          return updated;
        });

        fetchSpareParts();
      } else {
        notifyError(data.error);
      }
    } catch {
      notifyError("Error updating spare part");
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selectedPart) {
      notifyError("Select a spare part first");
      return;
    }

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts/${selectedPart.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (data.message) {
        notifySuccess(data.message);

        setHistoryOptions((prev) => {
          const updated = prev.filter(
            (h) => h.value !== selectedPart.id
          );

          localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(updated)
          );

          return updated;
        });

        setSelectedPart(null);

        setFormData({
          category: "",
          vehicle_type: "",
          brand: "",
          colour: "",
          buying_price: "",
          marked_price: "",
          image: "",
          description: "",
        });

        fetchSpareParts();
      } else {
        notifyError(data.error);
      }
    } catch {
      notifyError("Error deleting spare part");
    }
  };

  const selectStyles: StylesConfig<
    SearchOption,
    false,
    GroupBase<SearchOption>
  > = {
    container: (base) => ({
      ...base,
      width: "100%",
    }),

    control: (base, state) => ({
      ...base,
      backgroundColor: "#fff",
      borderColor: state.isFocused
        ? "rgb(0,64,128)"
        : "#ccc",
      boxShadow: state.isFocused
        ? "0 0 0 1px rgb(0,64,128)"
        : "none",
      minHeight: "42px",
    }),

    input: (base) => ({
      ...base,
      color: "#000",
    }),

    singleValue: (base) => ({
      ...base,
      color: "#000",
    }),

    placeholder: (base) => ({
      ...base,
      color: "#888",
    }),

    menu: (base) => ({
      ...base,
      backgroundColor: "#1b1b1b",
      borderRadius: "10px",
      zIndex: 1000,
    }),

    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? "rgb(0,64,128)"
        : "#1b1b1b",
      color: state.isFocused ? "#fff" : "#ddd",
      padding: "12px 15px",
      cursor: "pointer",
    }),
  };

  return (
  <div
    className="
      mx-auto
      mt-10
      max-w-[900px]
      rounded-2xl
      bg-white
      p-6
      shadow-[0_10px_30px_rgba(0,0,0,0.08)]
    "
  >
    <ToastContainer />

    <h2 className="mt-10 mb-5 text-[22px] font-semibold text-[#222]">
      Manage Spare Parts
    </h2>

    {/* SEARCH */}
    <Select<SearchOption, false, GroupBase<SearchOption>>
      autoFocus
      options={groupedOptions}
      isClearable
      placeholder="Search spare part..."
      filterOption={filterOption}
      onChange={handleSelect}
      onInputChange={handleInputChange}
      inputValue={inputValue}
      components={{
        Option: CustomOption,
      }}
      styles={selectStyles}
    />

    {/* IMAGE */}
    {formData.image && selectedPart && (
      <div className="my-5 text-center">
        <Link to={`/items/${selectedPart.id}`}>
          <img
            src={formData.image}
            alt={`${formData.brand} ${formData.vehicle_type}`}
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
        </Link>
      </div>
    )}

    {/* FORM */}
    <form
      className="
        grid
        grid-cols-2
        gap-[14px]
        mt-[15px]
        max-[640px]:grid-cols-1
      "
    >
      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="category"
        placeholder="Category"
        value={formData.category}
        onChange={handleChange}
      />

      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="vehicle_type"
        placeholder="Vehicle Type"
        value={formData.vehicle_type}
        onChange={handleChange}
      />

      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="brand"
        placeholder="Brand"
        value={formData.brand}
        onChange={handleChange}
      />

      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="colour"
        placeholder="Colour"
        value={formData.colour}
        onChange={handleChange}
      />

      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="buying_price"
        type="number"
        placeholder="Buying Price"
        value={formData.buying_price}
        onChange={handleChange}
      />

      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="marked_price"
        type="number"
        placeholder="Marked Price"
        value={formData.marked_price}
        onChange={handleChange}
      />

      <input
        className="
          w-full
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
        "
        name="image"
        placeholder="Image URL"
        value={formData.image}
        onChange={handleChange}
      />

      <textarea
        className="
          col-span-2
          min-h-[80px]
          w-full
          resize-y
          rounded-[10px]
          border
          border-gray-300
          px-3
          py-[10px]
          text-[14px]
          transition
          focus:border-[#004080]
          focus:outline-none
          focus:ring-2
          focus:ring-[#004080]/20
          max-[640px]:col-span-1
        "
        name="description"
        placeholder="Description"
        value={formData.description}
        onChange={handleChange}
      />

      <div
        className="
          col-span-2
          mt-[10px]
          flex
          justify-center
          gap-[10px]
        "
      >
        <button
          id="create"
          onClick={handleCreate}
          className="
            flex-1
            rounded-[10px]
            bg-[#004080]
            py-[10px]
            font-medium
            text-white
            transition
            hover:bg-[#004080]/70
          "
        >
          Create
        </button>

        <button
          id="edit"
          onClick={handleUpdate}
          className="
            flex-1
            rounded-[10px]
            bg-[#004080]
            py-[10px]
            font-medium
            text-white
            transition
            hover:bg-[#004080]/70
          "
        >
          Update
        </button>

        <button
          type="button"
          id="delete"
          onClick={handleDelete}
          className="
            flex-1
            rounded-[10px]
            bg-red-600
            py-[10px]
            font-medium
            text-white
            transition
            hover:bg-red-700
          "
        >
          Delete
        </button>
      </div>
    </form>
  </div>
 );
};

export default ItemsManagement;