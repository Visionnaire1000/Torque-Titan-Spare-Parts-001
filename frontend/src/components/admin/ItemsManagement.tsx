import { useEffect, useState, useCallback, useMemo, type ChangeEvent } from "react";
import Select, {components, type FilterOptionOption, type GroupBase, type StylesConfig, type OptionProps} from "react-select";
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

interface SparePartFormData {
  category: string;
  vehicle_type: string;
  brand: string;
  colour: string;
  buying_price: number | string;
  marked_price: number | string;
  description: string;
}

const ItemsManagement = () => {
  const { authFetch } = useAuth();

  const [options, setOptions] = useState<SearchOption[]>([]);
  const [historyOptions, setHistoryOptions] = useState<SearchOption[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

  /* ---------------- Form state ---------------- */
  const [formData, setFormData] =
    useState<SparePartFormData>({
      category: "",
      vehicle_type: "",
      brand: "",
      colour: "",
      buying_price: "",
      marked_price: "",
      description: "",
    });

  /* ---------------- Image state ---------------- */
  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string>("");

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

  /* ---------------- Image preview cleanup ---------------- */
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  /* ---------------- Load history ---------------- */
  const reloadHistory = useCallback((): void => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(HISTORY_KEY) || "[]"
      ) as SearchOption[];

      setHistoryOptions(
        Array.isArray(saved) ? saved : []
      );
    } catch {
      setHistoryOptions([]);
    }
  }, []);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  /* ---------------- Fetch spare parts ---------------- */
  const fetchSpareParts = useCallback((): void => {
    authFetch(
      `${config.API_BASE_URL}/spareparts?per_page=1000`
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            "Failed to fetch spare parts"
          );
        }

        return res.json() as Promise<SparePartsResponse>;
      })
      .then((data) => {
        const parts = data.items ?? [];

        const individualOptions: SearchOption[] =
          parts.map((part) => {
            const normalizedPart: SparePart = {
              ...part,
              id: String(part.id),
            };

            const searchableText = [
              normalizedPart.brand,
              normalizedPart.vehicle_type,
              normalizedPart.category,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return {
              label: [
                normalizedPart.brand,
                normalizedPart.vehicle_type,
                normalizedPart.category,
              ]
                .filter(Boolean)
                .join(" "),

              value: normalizedPart.id,

              part: normalizedPart,

              searchableText,
            };
          });

        setOptions(individualOptions);
      })
      .catch((error) => {
        console.error(
          "Failed to fetch spare parts:",
          error
        );

        notifyError("Failed to load spare parts");
      });
  }, [authFetch]);

  useEffect(() => {
    fetchSpareParts();
  }, [fetchSpareParts]);

  /* ---------------- Save to history ---------------- */
  const saveToHistory = useCallback(
    (option: SearchOption): void => {
      setHistoryOptions((prev) => {
        const updated = [
          {
            ...option,
            isHistory: true,
          },
          ...prev.filter(
            (h) => h.value !== option.value
          ),
        ].slice(0, HISTORY_LIMIT);

        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(updated)
        );

        return updated;
      });
    },
    []
  );

  /* ---------------- Remove history item ---------------- */
  const removeHistoryItem = useCallback(
    (value: string): void => {
      setHistoryOptions((prev) => {
        const updated = prev.filter(
          (h) => h.value !== value
        );

        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify(updated)
        );

        return updated;
      });
    },
    []
  );

  /* ---------------- Filtering ---------------- */
  const filterOption = (
    option: FilterOptionOption<SearchOption>,
    inputVal: string
  ): boolean => {
    if (option.data.isHistory && !inputVal) {
      return true;
    }

    if (!inputVal) {
      return false;
    }

    const words = inputVal
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words.every((word) =>
      option.data.searchableText.includes(word)
    );
  };

  /* ---------------- Search input ---------------- */
  const handleInputChange = (
    value: string
  ): void => {
    setInputValue(value);
  };

  /* ---------------- Select spare part ---------------- */
  const handleSelect = (
    option: SearchOption | null
  ): void => {
    if (!option) {
      return;
    }

    saveToHistory(option);

    setSelectedPart(option.part);

    setFormData({
      category: option.part.category || "",
      vehicle_type:
        option.part.vehicle_type || "",
      brand: option.part.brand || "",
      colour: option.part.colour || "",
      buying_price:
        option.part.buying_price ?? "",
      marked_price:
        option.part.marked_price ?? "",
      description:
        option.part.description || "",
    });

    setImageFile(null);

    setImagePreview(option.part.image || "");

    // Clear search input after selecting.
    setInputValue("");
  };

  /* ---------------- Image change ---------------- */
  const handleImageChange = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    /* Validate file type */
    if (!file.type.startsWith("image/")) {
      notifyError(
        "Please select a valid image file"
      );

      e.target.value = "";
      return;
    }

    /* Validate file size */
    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      notifyError(
        "Image must be 5 MB or smaller"
      );

      e.target.value = "";
      return;
    }

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);

    const previewUrl =
      URL.createObjectURL(file);

    setImagePreview(previewUrl);
  };

  /* ---------------- Custom Option ---------------- */
  const CustomOption = (
    props: OptionProps<
      SearchOption,
      false,
      GroupBase<SearchOption>
    >
  ) => {
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
              type="button"
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-md
                text-gray-300
                transition
                hover:bg-white/10
                hover:text-white
              "
              onMouseDown={(
                e: React.MouseEvent<HTMLButtonElement>
              ) => {
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

    if (
      historyOptions.length > 0 &&
      !inputValue
    ) {
      groups.push({
        label: "Recent Searches",
        options: historyOptions.map((item) => ({
          ...item,
          isHistory: true,
        })),
      });
    }

    if (inputValue) {
      groups.push({
        label: "All Results",
        options,
      });
    }

    return groups;
  }, [
    historyOptions,
    inputValue,
    options,
  ]);

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

  /* ---------------- Create ---------------- */
  const handleCreate = async (
    e: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e.preventDefault();

    try {
   
      const multipartData = new FormData();

      multipartData.append(
        "category",
        formData.category
      );

      multipartData.append(
        "vehicle_type",
        formData.vehicle_type
      );

      multipartData.append(
        "brand",
        formData.brand
      );

      multipartData.append(
        "colour",
        formData.colour
      );

      multipartData.append(
        "buying_price",
        String(formData.buying_price)
      );

      multipartData.append(
        "marked_price",
        String(formData.marked_price)
      );

      multipartData.append(
        "description",
        formData.description
      );

      if (imageFile) {
        multipartData.append(
          "image",
          imageFile
        );
      }

      const res = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts/`,
        {
          method: "POST",
          body: multipartData,
        }
      );

      const data = await res.json();

      if (res.ok && data.message) {
        notifySuccess(data.message);

        setSelectedPart(null);

        setFormData({
          category: "",
          vehicle_type: "",
          brand: "",
          colour: "",
          buying_price: "",
          marked_price: "",
          description: "",
        });

        setImageFile(null);
        setImagePreview("");

        setInputValue("");

        fetchSpareParts();
        reloadHistory();
      } else {
        notifyError(
          data.error ||
            data.detail ||
            "Error creating spare part"
        );
      }
    } catch (error) {
      console.error(
        "Error creating spare part:",
        error
      );

      notifyError(
        "Error creating spare part"
      );
    }
  };

  /* ---------------- Update ---------------- */
  const handleUpdate = async (
    e: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!selectedPart) {
      notifyError(
        "Select a spare part first"
      );
      return;
    }

    try {
      const multipartData = new FormData();

      multipartData.append(
        "category",
        formData.category
      );

      multipartData.append(
        "vehicle_type",
        formData.vehicle_type
      );

      multipartData.append(
        "brand",
        formData.brand
      );

      multipartData.append(
        "colour",
        formData.colour
      );

      multipartData.append(
        "buying_price",
        String(formData.buying_price)
      );

      multipartData.append(
        "marked_price",
        String(formData.marked_price)
      );

      multipartData.append(
        "description",
        formData.description
      );

      if (imageFile) {
        multipartData.append(
          "image",
          imageFile
        );
      }

      const res = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts/${selectedPart.id}/`,
        {
          method: "PUT",
          body: multipartData,
        }
      );

      const data = await res.json();

      if (res.ok && data.message) {
        notifySuccess(data.message);

        if (data.sparepart) {
          const updatedPart: SparePart = {
            ...data.sparepart,
            id: String(data.sparepart.id),
          };

          setSelectedPart(updatedPart);

          setImagePreview(
            updatedPart.image || ""
          );

          setImageFile(null);

          setFormData({
            category:
              updatedPart.category || "",
            vehicle_type:
              updatedPart.vehicle_type || "",
            brand:
              updatedPart.brand || "",
            colour:
              updatedPart.colour || "",
            buying_price:
              updatedPart.buying_price ?? "",
            marked_price:
              updatedPart.marked_price ?? "",
            description:
              updatedPart.description || "",
          });

          setHistoryOptions((prev) => {
            const updated = prev.map((h) =>
              h.value === selectedPart.id
                ? {
                    ...h,
                    part: updatedPart,
                    label: [
                      updatedPart.brand,
                      updatedPart.vehicle_type,
                      updatedPart.category,
                    ]
                      .filter(Boolean)
                      .join(" "),
                    searchableText: [
                      updatedPart.brand,
                      updatedPart.vehicle_type,
                      updatedPart.category,
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase(),
                  }
                : h
            );

            localStorage.setItem(
              HISTORY_KEY,
              JSON.stringify(updated)
            );

            return updated;
          });
        }

        fetchSpareParts();
      } else {
        notifyError(
          data.error ||
            data.detail ||
            "Error updating spare part"
        );
      }
    } catch (error) {
      console.error(
        "Error updating spare part:",
        error
      );

      notifyError(
        "Error updating spare part"
      );
    }
  };

  /* ---------------- Delete ---------------- */
  const handleDelete = async (): Promise<void> => {
    if (!selectedPart) {
      notifyError(
        "Select a spare part first"
      );
      return;
    }

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/spareparts/${selectedPart.id}/`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json();

      if (res.ok && data.message) {
        notifySuccess(data.message);

        setHistoryOptions((prev) => {
          const updated = prev.filter(
            (h) =>
              h.value !== selectedPart.id
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
          description: "",
        });

        setImageFile(null);
        setImagePreview("");

        setInputValue("");

        fetchSpareParts();
      } else {
        notifyError(
          data.error ||
            data.detail ||
            "Error deleting spare part"
        );
      }
    } catch (error) {
      console.error(
        "Error deleting spare part:",
        error
      );

      notifyError(
        "Error deleting spare part"
      );
    }
  };

  /* ---------------- Select styles ---------------- */
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
      backgroundColor: state.isFocused
        ? "rgb(0,64,128)"
        : "#1b1b1b",
      color: state.isFocused
        ? "#fff"
        : "#ddd",
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

      <Select<
        SearchOption,
        false,
        GroupBase<SearchOption>
      >
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
        noOptionsMessage={() =>
          "No spare parts found"
        }
      />

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="my-5 text-center">
          {selectedPart ? (
            <Link
              to={`/items/${selectedPart.id}`}
            >
              <img
                src={imagePreview}
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
          ) : (
            <img
              src={imagePreview}
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
          )}
        </div>
      )}

      {/* FORM */}
      <form
        className="
          mt-[15px]
          grid
          grid-cols-2
          gap-[14px]
          max-[640px]:grid-cols-1
        "
      >
        {/* CATEGORY */}
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

        {/* VEHICLE TYPE */}
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

        {/* BRAND */}
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

        {/* COLOUR */}
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

        {/* BUYING PRICE */}
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

        {/* MARKED PRICE */}
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

        {/* IMAGE FILE */}
        <div className="w-full">
          <label
            htmlFor="image"
            className="
              mb-2
              block
              text-[14px]
              font-medium
              text-gray-700
            "
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

        {/* DESCRIPTION */}
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

        {/* BUTTONS */}
        <div
          className="
            col-span-2
            mt-[10px]
            flex
            justify-center
            gap-[10px]
          "
        >
          {/* CREATE */}
          <button
            type="button"
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

          {/* UPDATE */}

          <button
            type="button"
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

          {/* DELETE */}
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