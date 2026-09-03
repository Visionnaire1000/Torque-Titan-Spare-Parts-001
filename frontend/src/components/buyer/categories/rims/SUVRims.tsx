import { useEffect, useState,useRef, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { useCart } from "../../../../contexts/CartContext";
import config from "../../../../config";
import "../../../../styles/buyer/categories/rims.css";

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
      overflow-hidden
      bg-[#f6f7f8]
      rounded-xl
      p-3
    "
  >
    <div
      className="
        w-full
        h-[140px]
        rounded-lg
        bg-[#e0e0e0]
        mb-2.5
      "
    />
    <div
      className="
        h-3
        rounded-md
        bg-[#e0e0e0]
        my-2
        w-[80%]
      "
    />
    <div
      className="
        h-3
        rounded-md
        bg-[#e0e0e0]
        my-2
        w-[60%]
      "
    />
    <div
      className="
        h-3
        rounded-md
        bg-[#e0e0e0]
        my-2
        w-[40%]
      "
    />
    <div
      className="
        h-8
        rounded-lg
        bg-[#e0e0e0]
        mt-2.5
        w-full
      "
    />

  </div>
);

/* ---------------- Error State ---------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps): ReactElement => (
  <div
    className="
      text-center
      py-10
      px-5
    "
  >
    <h2
      className="
        text-2xl
        mb-2.5
      "
    >
      Something went wrong
    </h2>

    <p
      className="
        text-[#666]
        mb-5
      "
    >
      Unable to load spare parts. Please check your connection and try again.
    </p>
    <button
      className="
        inline-flex
        items-center
        gap-2
        py-2.5
        px-5
        bg-[#111]
        text-white
        rounded-md
        cursor-pointer
        transition
        hover:opacity-85
        mb-[30px]
      "
      onClick={() => void onRetry()}
    >

      <RefreshCw
        size={18}
        className="
          transition-transform
          duration-500
        "
      />

      Retry

    </button>

  </div>
);

/* ---------------- Component ---------------- */
const SUVRims = (): ReactElement => {
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
      vehicle_type: "suv",
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
        throw new Error("Failed");
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
  // Scrolls to the top whenever the pagination page changes
  useEffect(() => {
   window.scrollTo({
     top: 0,
     left: 0,
     behavior: "auto",
   });
  }, [currentPage]);

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

  const visiblePages = getVisiblePages();

  /* ---------------- Render ---------------- */
  return (
    <div
      className="
        min-h-screen
        p-5
        pb-[70px]
        mt-[70px]
        bg-[#f9f9f9]
        font-[Arial,sans-serif]
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
                      ? "Low (< 25k)"
                      : price === "medium"
                        ? "Medium (25k–35k)"
                        : "High (> 35k)"}
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
                    Low (&lt; 25k)
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
                    Medium (25k–35k)
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
                    High (&gt; 35k)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

   {/* -------- Error State -------- */}
   {error ? (
     <ErrorState
       onRetry={fetchRims}
      />
       ) : (
        <>
          {/* -------- Products Grid -------- */}
          <div
            className="
              grid
              grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
              gap-5
              max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
            "
          >
            {loading ? (
              Array.from({
                length: 8
              }).map((_, index) => (
                <SkeletonCard
                  key={index}
                />

              ))
            ) : items.length ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className="
                    bg-white
                    rounded-xl
                    p-3
                    shadow-[0_4px_10px_rgba(0,0,0,0.1)]
                    transition-all
                    duration-200
                    flex
                    flex-col
                    items-center
                    cursor-pointer
                    h-full
                    hover:-translate-y-1
                    hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]
                  "
                >
                  <Link
                    to={`/items/${item.id}`}
                    className="
                      w-full
                      flex
                      flex-col
                      items-center
                    "
                  >
                    <img
                      src={item.image}
                      alt={item.brand}
                      className="
                        w-full
                        h-[150px]
                        object-contain
                        mb-2.5
                        rounded-lg
                        max-[480px]:w-[60%]
                        max-[480px]:h-auto
                        max-[480px]:object-cover
                      "
                    />
                    <h4
                      className="
                        text-center
                        my-[5px]
                        mb-2.5
                        text-base
                        text-[#333]
                      "
                    >
                      {item.brand} {item.category} for{" "}
                      {item.vehicle_type}
                    </h4>
                    <p
                      className="
                        font-bold
                        text-red-600
                        text-lg
                        mb-2.5
                      "
                    >
                      KES{" "}
                      {item.buying_price?.toLocaleString("en-US")}
                      {item.discount_percentage > 0 && (
                        <span
                          className="
                            text-[#d9534f]
                            font-normal
                            ml-1
                          "
                        >
                          (-{item.discount_percentage.toFixed(0)}%)
                        </span>
                      )}
                    </p>
                    <button
                      className="
                        bg-[rgb(0,64,128)]
                        text-white
                        border-none
                        py-2
                        px-3
                        rounded-md
                        cursor-pointer
                        font-bold
                        transition-colors
                        hover:bg-[rgb(4,37,71)]
                      "
                      onClick={(event) =>
                        handleAddToCart(
                          item,
                          event
                        )
                      }
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
                  text-center
                  text-[#7f0d0d]
                  text-base
                  mb-[80px]
                "
              >
                No SUV rims found.
              </p>
            )}
          </div>
                    {/* -------- Pagination -------- */}


          {loading ? (

            <div
              className="
                flex
                justify-center
                items-center
                gap-2
                mt-4
              "
            >

              {[1, 2, 3, 4].map((item) => (

                <div
                  key={item}
                  className="
                    w-10
                    h-8
                    rounded-md
                    bg-[#e0e0e0]
                  "
                />

              ))}

            </div>



          ) : totalPages > 1 && (

            <div
              className="
                flex
                justify-center
                items-center
                gap-1.5
                my-[30px]
                flex-wrap
              "
            >


              <button
                disabled={
                  currentPage === 1
                }
                className="
                  py-1.5
                  px-3
                  border
                  border-[#ddd]
                  bg-white
                  rounded
                  text-sm
                  cursor-pointer
                  hover:bg-[#f0f0f0]
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(
                      page - 1,
                      1
                    )
                  )
                }
              >
                Prev
              </button>





              {visiblePages[0] > 1 && (

                <span
                  className="
                    px-1.5
                    text-base
                    select-none
                  "
                >
                  …
                </span>

              )}






              {visiblePages.map((page) => (

                <button
                  key={page}
                  className={`
                    py-1.5
                    px-3
                    border
                    rounded
                    text-sm
                    cursor-pointer
                    ${
                      page === currentPage
                        ? `
                          bg-[#004080]
                          text-white
                          border-[#004080]
                          font-semibold
                        `
                        : `
                          border-[#ddd]
                          bg-white
                          hover:bg-[#f0f0f0]
                        `
                    }
                  `}
                  onClick={() =>
                    setCurrentPage(page)
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
                    px-1.5
                    text-base
                    select-none
                  "
                >
                  …
                </span>

              )}






              <button
                disabled={
                  currentPage === totalPages
                }
                className="
                  py-1.5
                  px-3
                  border
                  border-[#ddd]
                  bg-white
                  rounded
                  text-sm
                  cursor-pointer
                  hover:bg-[#f0f0f0]
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(
                      page + 1,
                      totalPages
                    )
                  )
                }
              >
                Next
              </button>



            </div>

          )}


        </>

      )}


    </div>

  );
};

export default SUVRims;