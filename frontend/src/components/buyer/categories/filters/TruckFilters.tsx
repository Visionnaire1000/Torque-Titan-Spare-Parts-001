import { useEffect, useState, useRef, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { useCart } from "../../../../contexts/CartContext";
import config from "../../../../config";
import "../../../../styles/buyer/categories/filters.css";

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

/* ---------------- Skeleton ---------------- */
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
      bg-white
      p-3
      shadow-[0_4px_10px_rgba(0,0,0,0.1)]
    "
  >
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="
          absolute
          -left-[150%]
          top-0
          h-full
          w-[150%]
          animate-[shimmer_1.4s_infinite]
          bg-gradient-to-r
          from-transparent
          via-white/60
          to-transparent
        "
      />
    </div>

    <div className="mb-3 h-[140px] w-full rounded-[10px] bg-gray-200" />

    <div className="my-2 h-3 w-4/5 rounded bg-gray-200" />
    <div className="my-2 h-3 w-3/5 rounded bg-gray-200" />
    <div className="my-2 h-3 w-2/5 rounded bg-gray-200" />

    <div className="mt-3 h-8 w-full rounded-lg bg-gray-200" />
  </div>
);

/* ---------------- Error ---------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps): ReactElement => (
  <div className="px-5 py-10 text-center">
    <h2 className="mb-3 text-2xl font-semibold">
      Failed to load SUV filters
    </h2>

    <button
      onClick={() => void onRetry()}
      className="
        inline-flex
        items-center
        gap-2
        rounded-md
        bg-[#111]
        px-5
        py-2.5
        text-white
        transition-opacity
        duration-200
        hover:opacity-85
      "
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
const TruckFilters = (): ReactElement => {
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


  /* ---------------- Filters ---------------- */
  const availableBrands: string[] = [
    "Bosch",
    "K&N",
    "Fram",
    "Mann",
    "AC Delco",
    "Motorcraft",
    "Purolator",
  ];

  const availableColours: string[] = [
    "black",
    "silver",
    "gold",
  ];


  /* ---------------- Fetch ---------------- */
  const fetchFilters =
    async (): Promise<void> => {

      setLoading(true);
      setError(false);

      const params =
        new URLSearchParams({
          category: "oil filter",
          vehicle_type: "truck",
          ...(brand && { brand }),
          ...(colour && { colour }),
          ...(price && { price }),
          page: currentPage.toString(),
          per_page: "16",
        });

      try {
        const response =
          await fetch(
            `${config.API_BASE_URL}/spareparts/?${params.toString()}`
          );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch Truck filters"
          );
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
    void fetchFilters();
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
  const getVisiblePages =
    (): number[] => {

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
      "
    >

  {/* ---------------- Filters ---------------- */}
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

      {/* ---------------- Brand Dropdown ---------------- */}
      <div
        ref={brandDropdownRef}
        className="
          relative
          w-[180px]
          max-[480px]:w-[110px]
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
            border-gray-300
            bg-white
            px-3
            py-2
            text-left
            text-[14px]
            transition-colors
            hover:border-[#0077ff]
            focus:border-[#0077ff]
            focus:outline-none
            max-[480px]:px-2
            max-[480px]:py-2
            max-[480px]:text-xs
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
                max-[480px]:h-4
                max-[480px]:w-4
              "
            />
          ) : (
            <ChevronDown
              size={18}
              className="
                ml-2
                shrink-0
                text-gray-600
                max-[480px]:h-4
                max-[480px]:w-4
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
                max-[480px]:px-2
                max-[480px]:py-2
                max-[480px]:text-xs
                ${
                  brand === ""
                    ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                    : "text-[#333]"
                }
              `}
            >
              All Brands
            </button>

            {availableBrands.map((itemBrand) => (
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
                  max-[480px]:px-2
                  max-[480px]:py-2
                  max-[480px]:text-xs
                  ${
                    brand === itemBrand
                      ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                      : "text-[#333]"
                  }
                `}
              >
                {itemBrand}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- Colour Dropdown ---------------- */}
      <div
        ref={colourDropdownRef}
        className="
          relative
          w-[180px]
          max-[480px]:w-[110px]
        "
      >
        <button
          type="button"
          onClick={() => {
            setColourOpen((open) => !open);
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
            border-gray-300
            bg-white
            px-3
            py-2
            text-left
            text-[14px]
            transition-colors
            hover:border-[#0077ff]
            focus:border-[#0077ff]
            focus:outline-none
            max-[480px]:px-2
            max-[480px]:py-2
            max-[480px]:text-xs
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
                max-[480px]:h-4
                max-[480px]:w-4
              "
            />
          ) : (
            <ChevronDown
              size={18}
              className="
                ml-2
                shrink-0
                text-gray-600
                max-[480px]:h-4
                max-[480px]:w-4
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
                max-[480px]:px-2
                max-[480px]:py-2
                max-[480px]:text-xs
                ${
                  colour === ""
                    ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                    : "text-[#333]"
                }
              `}
            >
              All Colours
            </button>

            {availableColours.map((itemColour) => (
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
                  max-[480px]:px-2
                  max-[480px]:py-2
                  max-[480px]:text-xs
                  ${
                    colour === itemColour
                      ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                      : "text-[#333]"
                  }
                `}
              >
                {itemColour.charAt(0).toUpperCase() +
                  itemColour.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- Price Dropdown ---------------- */}
      <div
        ref={priceDropdownRef}
        className="
          relative
          w-[180px]
          max-[480px]:w-[110px]
        "
      >
        <button
          type="button"
          onClick={() => {
            setPriceOpen((open) => !open);
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
            border-gray-300
            bg-white
            px-3
            py-2
            text-left
            text-[14px]
            transition-colors
            hover:border-[#0077ff]
            focus:border-[#0077ff]
            focus:outline-none
            max-[480px]:px-2
            max-[480px]:py-2
            max-[480px]:text-xs
          "
        >
          <span className="truncate">
            {price === ""
              ? "All Prices"
              : price === "low"
                ? "Low (< 7500k)"
                : price === "medium"
                  ? "Medium (7500k–8500k)"
                  : "High (> 8500k)"}
          </span>

          {priceOpen ? (
            <ChevronUp
              size={18}
              className="
                ml-2
                shrink-0
                text-gray-600
                max-[480px]:h-4
                max-[480px]:w-4
              "
            />
          ) : (
            <ChevronDown
              size={18}
              className="
                ml-2
                shrink-0
                text-gray-600
                max-[480px]:h-4
                max-[480px]:w-4
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
                max-[480px]:px-2
                max-[480px]:py-2
                max-[480px]:text-xs
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
                max-[480px]:px-2
                max-[480px]:py-2
                max-[480px]:text-xs
                ${
                  price === "low"
                    ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                    : "text-[#333]"
                }
              `}
            >
              Low (&lt; 7500k)
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
                max-[480px]:px-2
                max-[480px]:py-2
                max-[480px]:text-xs
                ${
                  price === "medium"
                    ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                    : "text-[#333]"
                }
              `}
            >
              Medium (7500k–8500k)
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
                max-[480px]:px-2
                max-[480px]:py-2
                max-[480px]:text-xs
                ${
                  price === "high"
                    ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                    : "text-[#333]"
                }
              `}
            >
              High (&gt; 8500k)
            </button>
          </div>
        )}
        </div>
       </div>
      </div>
     )}

  {error ? (
    <ErrorState
      onRetry={fetchFilters}
  />
 ) : (
  <>
    <div
      className="
        grid
        grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
        gap-5
        max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
      "
    >
      {loading ? (
        Array.from({ length: 8 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))
      ) : items.length ? (
        items.map((item) => (
          <div
            key={item.id}
            className="
              flex
              h-full
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
                <p className="mb-[10px] text-base font-bold text-[rgb(255,0,0)] sm:text-lg">
                  KES {item.buying_price.toLocaleString()}

                  {item.discount_percentage > 0 && (
                    <span className="ml-[5px] text-xs text-[rgba(228, 26, 19, 0.67)]">
                      (-{item.discount_percentage.toFixed(0)}%)
                    </span>
                  )}
                </p>

                <button
                  onClick={(e) => handleAddToCart(item, e)}
                  className="rounded-md bg-[rgb(0,64,128)] px-4 py-2 
                             text-sm font-bold text-white hover:bg-[rgb(4,37,71)] 
                             transition-colors duration-200"
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
          No Truck filters found.
        </p>
      )}
    </div>

        {/* ---------------- Pagination ---------------- */}
        {loading ? (
          <div
            className="
              mt-4
              flex
              justify-center
              gap-2
            "
          >
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="
                  h-8
                  w-10
                  animate-pulse
                  rounded-md
                  bg-gray-200
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
                  cursor-pointer
                  rounded
                  border
                  border-gray-300
                  bg-white
                  px-3
                  py-1.5
                  text-sm
                  transition-colors
                  hover:bg-gray-100
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
                    px-1.5
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
                  className={
                    page === currentPage
                      ? `
                        rounded
                        border
                        border-[#004080]
                        bg-[#004080]
                        px-3
                        py-1.5
                        text-sm
                        font-semibold
                        text-white
                      `
                      : `
                        rounded
                        border
                        border-gray-300
                        bg-white
                        px-3
                        py-1.5
                        text-sm
                        transition-colors
                        hover:bg-gray-100
                      `
                  }
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
                    px-1.5
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
                  cursor-pointer
                  rounded
                  border
                  border-gray-300
                  bg-white
                  px-3
                  py-1.5
                  text-sm
                  transition-colors
                  hover:bg-gray-100
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

export default TruckFilters;