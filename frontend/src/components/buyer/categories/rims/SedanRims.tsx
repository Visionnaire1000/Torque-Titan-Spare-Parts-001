import { useEffect, useState, useRef, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { useCart } from "../../../../contexts/CartContext";
import config from "../../../../config";

/* ---------------- Types ---------------- */
interface SparePart {
  id: string;
  image: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  discount_percentage: number;
}

interface SparePartsResponse {
  items: SparePart[];
  pages: number;
}

interface ErrorStateProps {
  onRetry: () => Promise<void>;
}

/* ---------------- Skeleton Card ---------------- */
const SkeletonCard = (): ReactElement => (
  <div
    className="
      relative
      flex
      h-full
      flex-col
      items-center
      overflow-hidden
      rounded-xl
      bg-[#f6f7f8]
      p-3
    "
  >
    <div className="mb-[10px] h-[140px] w-full rounded-[10px] bg-[#e0e0e0]" />
    <div className="my-2 h-3 w-[80%] rounded-md bg-[#e0e0e0]" />
    <div className="my-2 h-3 w-[60%] rounded-md bg-[#e0e0e0]" />
    <div className="my-2 h-3 w-[40%] rounded-md bg-[#e0e0e0]" />
    <div className="mt-[10px] h-8 w-full rounded-lg bg-[#e0e0e0]" />
  </div>
);

/* ---------------- Error UI ---------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps): ReactElement => (
  <div className="px-5 py-10 text-center">
    <h2 className="mb-[10px] text-2xl font-semibold">
      Something went wrong
    </h2>

    <p className="mb-5 text-[#666]">
      Unable to load spare parts. Please check your connection and try again.
    </p>

    <button
      className="
        mb-[30px]
        inline-flex
        items-center
        gap-2
        rounded-md
        bg-[#111]
        px-5
        py-[10px]
        text-white
        transition-opacity
        hover:opacity-85
      "
      onClick={() => void onRetry()}
    >
      <RefreshCw
        size={18}
        className="transition-transform duration-300"
      />
      Retry
    </button>
  </div>
);

/* ---------------- Component ---------------- */
const SedanRims = (): ReactElement => {
  const [items, setItems] = useState<SparePart[]>([]);

  const [brand, setBrand] = useState<string>("");
  const [colour, setColour] = useState<string>("");
  const [price, setPrice] = useState<string>("");

  /* ---------------- Dropdown State ---------------- */
  const [brandOpen, setBrandOpen] = useState<boolean>(false);
  const [colourOpen, setColourOpen] = useState<boolean>(false);
  const [priceOpen, setPriceOpen] = useState<boolean>(false);

  /* ---------------- Dropdown Refs ---------------- */
  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const colourDropdownRef = useRef<HTMLDivElement>(null);
  const priceDropdownRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  const [error, setError] = useState<boolean>(false);
  const { addItem } = useCart();

  const availableBrands: string[] = [
    "Enkei",
    "BBS",
    "OZ Racing",
    "Konig",
    "HRE",
    "Vossen",
    "Advan",
  ];

  const availableColours: string[] = [
    "silver",
    "black",
    "gold",
  ];

  /* ---------------- Fetch Rims ---------------- */
  const fetchRims = async (): Promise<void> => {
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      category: "rim",
      vehicle_type: "sedan",
      ...(brand && { brand }),
      ...(colour && { colour }),
      ...(price && { price }),
      page: currentPage.toString(),
      per_page: "16",
    });

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/spareparts/?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch rims");
      }

      const data: SparePartsResponse =
        await response.json();

      setItems(data.items ?? []);
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      console.error(err);

      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    void fetchRims();
  }, [
    brand,
    colour,
    price,
    currentPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    brand,
    colour,
    price,
  ]);

  /* ---------------- Cart ---------------- */
  const handleAddToCart = (
    item: SparePart,
    event: MouseEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    addItem(item);
  };


  /* ---------------- Filters Dropdown ---------------- */
  useEffect(() => {
    const handleClickOutside = (
      event: globalThis.MouseEvent
    ): void => {
      if (
        brandDropdownRef.current &&
        !brandDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setBrandOpen(false);
      }

      if (
        colourDropdownRef.current &&
        !colourDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setColourOpen(false);
      }

      if (
        priceDropdownRef.current &&
        !priceDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setPriceOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  
  /* ---------------- Pagination ---------------- */
  const getVisiblePages = (): number[] => {
    const pages: number[] = [];

    const maxVisible = 5;

    let start = Math.max(
      currentPage - 2,
      1
    );

    let end = Math.min(
      start + maxVisible - 1,
      totalPages
    );

    start = Math.max(
      end - maxVisible + 1,
      1
    );

    for (
      let i = start;
      i <= end;
      i++
    ) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages =
    getVisiblePages();

  /* ---------------- Render ---------------- */
  return (
    <div
      className="
        mt-[70px]
        bg-[#f9f9f9]
        p-5
        pb-[70px]
        font-[Arial,sans-serif]
        max-[480px]:max-w-[480px]
        max-[480px]:pb-5
      "
    >

      {/* Filters */}
      {!error && (
        <div
          className="
            mt-5
            mb-[25px]
            flex
            w-full
            justify-center
          "
        >
          <div
            className="
              flex
              flex-wrap
              items-center
              justify-center
              gap-4
              max-[480px]:mt-3
              max-[480px]:gap-2
              max-[480px]:items-center
            "
          >

            {/* Brand Dropdown */}
            <div
              ref={brandDropdownRef}
              className="
                relative
                w-[180px]
                max-[480px]:w-[160px]
              "
            >
              <button
                type="button"
                onClick={() => {
                  setBrandOpen((open) => !open);
                  setColourOpen(false);
                  setPriceOpen(false);
                }}
                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-md
                  border
                  border-[#ccc]
                  bg-white
                  px-3
                  py-2
                  text-left
                  text-[14px]
                  transition-colors
                  hover:border-[#0077ff]
                  focus:border-[#0077ff]
                  focus:outline-none
                  max-[480px]:px-4
                  max-[480px]:py-1
                  max-[480px]:text-base
                "
              >
                <span className="truncate">
                  {brand || "All Brands"}
                </span>

                {brandOpen ? (
                  <ChevronUp
                    size={18}
                    className="
                      ml-2
                      shrink-0
                      text-gray-600
                    "
                  />
                ) : (
                  <ChevronDown
                    size={18}
                    className="
                      ml-2
                      shrink-0
                      text-gray-600
                    "
                  />
                )}
              </button>

              {brandOpen && (
                <div
                  className="
                    absolute
                    left-0
                    z-50
                    mt-1
                    w-full
                    overflow-hidden
                    rounded-md
                    border
                    border-[#ddd]
                    bg-white
                    shadow-lg
                  "
                >
                  <button
                    type="button"
                    onClick={() => {
                      setBrand("");
                      setBrandOpen(false);
                    }}
                    className={`
                      block
                      w-full
                      px-3
                      py-2
                      text-left
                      text-[14px]
                      transition-colors
                      hover:bg-[#f0f6ff]
                      max-[480px]:text-base
                      ${
                        brand === ""
                          ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                          : "text-[#333]"
                      }
                    `}
                  >
                    All Brands
                  </button>

                  {availableBrands.map(
                    (itemBrand) => (
                      <button
                        key={itemBrand}
                        type="button"
                        onClick={() => {
                          setBrand(itemBrand);
                          setBrandOpen(false);
                        }}
                        className={`
                          block
                          w-full
                          px-3
                          py-2
                          text-left
                          text-[14px]
                          transition-colors
                          hover:bg-[#f0f6ff]
                          max-[480px]:text-base
                          ${
                            brand === itemBrand
                              ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                              : "text-[#333]"
                          }
                        `}
                      >
                        {itemBrand}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Colour Dropdown */}
            <div
              ref={colourDropdownRef}
              className="
                relative
                w-[180px]
                max-[480px]:w-[160px]
              "
            >
              <button
                type="button"
                onClick={() => {
                  setColourOpen(
                    (open) => !open
                  );
                  setBrandOpen(false);
                  setPriceOpen(false);
                }}
                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-md
                  border
                  border-[#ccc]
                  bg-white
                  px-3
                  py-2
                  text-left
                  text-[14px]
                  transition-colors
                  hover:border-[#0077ff]
                  focus:border-[#0077ff]
                  focus:outline-none
                  max-[480px]:px-4
                  max-[480px]:py-1
                  max-[480px]:text-base
                "
              >
                <span className="truncate">
                  {colour === ""
                    ? "All Colours"
                    : colour.charAt(0).toUpperCase() +
                      colour.slice(1)}
                </span>

                {colourOpen ? (
                  <ChevronUp
                    size={18}
                    className="
                      ml-2
                      shrink-0
                      text-gray-600
                    "
                  />
                ) : (
                  <ChevronDown
                    size={18}
                    className="
                      ml-2
                      shrink-0
                      text-gray-600
                    "
                  />
                )}
              </button>

              {colourOpen && (
                <div
                  className="
                    absolute
                    left-0
                    z-50
                    mt-1
                    w-full
                    overflow-hidden
                    rounded-md
                    border
                    border-[#ddd]
                    bg-white
                    shadow-lg
                  "
                >
                  <button
                    type="button"
                    onClick={() => {
                      setColour("");
                      setColourOpen(false);
                    }}
                    className={`
                      block
                      w-full
                      px-3
                      py-2
                      text-left
                      text-[14px]
                      transition-colors
                      hover:bg-[#f0f6ff]
                      max-[480px]:text-base
                      ${
                        colour === ""
                          ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                          : "text-[#333]"
                      }
                    `}
                  >
                    All Colours
                  </button>

                  {availableColours.map(
                    (itemColour) => (
                      <button
                        key={itemColour}
                        type="button"
                        onClick={() => {
                          setColour(itemColour);
                          setColourOpen(false);
                        }}
                        className={`
                          block
                          w-full
                          px-3
                          py-2
                          text-left
                          text-[14px]
                          transition-colors
                          hover:bg-[#f0f6ff]
                          max-[480px]:text-base
                          ${
                            colour === itemColour
                              ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                              : "text-[#333]"
                          }
                        `}
                      >
                        {itemColour
                          .charAt(0)
                          .toUpperCase() +
                          itemColour.slice(1)}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Price Dropdown */}
            <div
              ref={priceDropdownRef}
              className="
                relative
                w-[180px]
                max-[480px]:w-[160px]
              "
            >
              <button
                type="button"
                onClick={() => {
                  setPriceOpen(
                    (open) => !open
                  );
                  setBrandOpen(false);
                  setColourOpen(false);
                }}
                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-md
                  border
                  border-[#ccc]
                  bg-white
                  px-3
                  py-2
                  text-left
                  text-[14px]
                  transition-colors
                  hover:border-[#0077ff]
                  focus:border-[#0077ff]
                  focus:outline-none
                  max-[480px]:px-4
                  max-[480px]:py-1
                  max-[480px]:text-base
                "
              >
                <span className="truncate">
                  {price === ""
                    ? "All Prices"
                    : price === "low"
                      ? "Low (< 20k)"
                      : price === "medium"
                        ? "Medium (20k–30k)"
                        : "High (> 30k)"}
                </span>

                {priceOpen ? (
                  <ChevronUp
                    size={18}
                    className="
                      ml-2
                      shrink-0
                      text-gray-600
                    "
                  />
                ) : (
                  <ChevronDown
                    size={18}
                    className="
                      ml-2
                      shrink-0
                      text-gray-600
                    "
                  />
                )}
              </button>

              {priceOpen && (
                <div
                  className="
                    absolute
                    left-0
                    z-50
                    mt-1
                    w-full
                    overflow-hidden
                    rounded-md
                    border
                    border-[#ddd]
                    bg-white
                    shadow-lg
                  "
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPrice("");
                      setPriceOpen(false);
                    }}
                    className={`
                      block
                      w-full
                      px-3
                      py-2
                      text-left
                      text-[14px]
                      transition-colors
                      hover:bg-[#f0f6ff]
                      max-[480px]:text-base
                      ${
                        price === ""
                          ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                          : "text-[#333]"
                      }
                    `}
                  >
                    All Prices
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrice("low");
                      setPriceOpen(false);
                    }}
                    className={`
                      block
                      w-full
                      px-3
                      py-2
                      text-left
                      text-[14px]
                      transition-colors
                      hover:bg-[#f0f6ff]
                      max-[480px]:text-base
                      ${
                        price === "low"
                          ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                          : "text-[#333]"
                      }
                    `}
                  >
                    Low (&lt; 20k)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrice("medium");
                      setPriceOpen(false);
                    }}
                    className={`
                      block
                      w-full
                      px-3
                      py-2
                      text-left
                      text-[14px]
                      transition-colors
                      hover:bg-[#f0f6ff]
                      max-[480px]:text-base
                      ${
                        price === "medium"
                          ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                          : "text-[#333]"
                      }
                    `}
                  >
                    Medium (20k–30k)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrice("high");
                      setPriceOpen(false);
                    }}
                    className={`
                      block
                      w-full
                      px-3
                      py-2
                      text-left
                      text-[14px]
                      transition-colors
                      hover:bg-[#f0f6ff]
                      max-[480px]:text-base
                      ${
                        price === "high"
                          ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                          : "text-[#333]"
                      }
                    `}
                  >
                    High (&gt; 30k)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error ? (
        <ErrorState onRetry={fetchRims} />
      ) : (
        <>
          {/* Products Grid */}
          <div
            className="
              grid
              grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
              gap-5
              max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
            "
          >
            {loading ? (
              Array.from({ length: 8 }).map(
                (_, index) => (
                  <SkeletonCard key={index} />
                )
              )
            ) : items.length > 0 ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className="
                    flex
                    h-full
                    cursor-pointer
                    flex-col
                    items-center
                    rounded-xl
                    bg-white
                    p-3
                    shadow-[0_4px_10px_rgba(0,0,0,0.1)]
                    transition-all
                    duration-200
                    hover:-translate-y-1
                    hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]
                    max-[480px]:shadow-[0_4px_12px_rgba(0,0,0,0.06)]
                    max-[480px]:hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)]
                  "
                >
                  <Link
                    to={`/items/${item.id}`}
                    className="
                      flex
                      h-full
                      w-full
                      flex-col
                      items-center
                      text-inherit
                      no-underline
                    "
                  >
                    <img
                      src={item.image}
                      alt={item.brand}
                      className="
                        mb-[10px]
                        h-[150px]
                        w-full
                        rounded-lg
                        object-contain
                        max-[480px]:h-auto
                        max-[480px]:w-[60%]
                        max-[480px]:object-cover
                      "
                    />

                    <h4
                      className="
                        my-[5px]
                        mb-[10px]
                        text-center
                        text-base
                        text-[#333]
                      "
                    >
                      {item.brand} {item.category} for{" "}
                      {item.vehicle_type}
                    </h4>

                    <p
                      className="
                        mb-[10px]
                        text-lg
                        font-bold
                        text-[rgb(255,0,0)]
                      "
                    >
                      KES{" "}
                      {item.buying_price.toLocaleString()}

                      {item.discount_percentage > 0 && (
                        <span
                          className="
                            ml-[5px]
                            font-normal
                            text-[#d9534f]
                          "
                        >
                          (-
                          {item.discount_percentage.toFixed(
                            0
                          )}
                          %)
                        </span>
                      )}
                    </p>

                    <button
                      onClick={(event) =>
                        handleAddToCart(item, event)
                      }
                      className="
                        rounded-md
                        bg-[rgb(0,64,128)]
                        px-3
                        py-2
                        font-bold
                        text-white
                        transition-colors
                        hover:bg-[rgb(4,37,71)]
                      "
                    >
                      Add To Cart
                    </button>
                  </Link>
                </div>
              ))
            ) : (
              <p
                className="
                  col-span-full
                  mb-20
                  text-center
                  text-base
                  text-[#7f0d0d]
                "
              >
                No Sedan rims found.
              </p>
            )}
          </div>

          {/* Pagination */}
          {loading ? (
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="
                    h-8
                    w-10
                    rounded-md
                    bg-[#e0e0e0]
                  "
                />
              ))}
            </div>
          ) : (
            totalPages > 1 && (
              <div
                className="
                  my-[30px]
                  flex
                  flex-wrap
                  items-center
                  justify-center
                  gap-[6px]
                "
              >
                <button
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.max(page - 1, 1)
                    )
                  }
                  className="
                    rounded
                    border
                    border-[#ddd]
                    bg-white
                    px-3
                    py-[6px]
                    text-sm
                    transition-colors
                    hover:bg-[#f0f0f0]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Prev
                </button>

                {visiblePages[0] > 1 && (
                  <span
                    className="
                      select-none
                      px-[6px]
                      text-base
                    "
                  >
                    …
                  </span>
                )}

                {visiblePages.map((page) => (
                  <button
                    key={page}
                    onClick={() =>
                      setCurrentPage(page)
                    }
                    className={`
                      rounded
                      border
                      px-3
                      py-[6px]
                      text-sm
                      transition-colors
                      ${
                        page === currentPage
                          ? "border-[rgb(0,64,128)] bg-[rgb(0,64,128)] font-semibold text-white"
                          : "border-[#ddd] bg-white hover:bg-[#f0f0f0]"
                      }
                    `}
                  >
                    {page}
                  </button>
                ))}

                {visiblePages[
                  visiblePages.length - 1
                ] < totalPages && (
                  <span
                    className="
                      select-none
                      px-[6px]
                      text-base
                    "
                  >
                    …
                  </span>
                )}

                <button
                  disabled={
                    currentPage === totalPages
                  }
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(
                        page + 1,
                        totalPages
                      )
                    )
                  }
                  className="
                    rounded
                    border
                    border-[#ddd]
                    bg-white
                    px-3
                    py-[6px]
                    text-sm
                    transition-colors
                    hover:bg-[#f0f0f0]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Next
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
};

export default SedanRims;