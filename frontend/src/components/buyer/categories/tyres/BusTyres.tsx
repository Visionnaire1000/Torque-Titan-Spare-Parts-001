import { useEffect, useState, useRef, type MouseEvent, type ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RefreshCw, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";
import { useCart } from "../../../../contexts/CartContext";
import config from "../../../../config";


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

interface RestoreState {
  from?: string;
  restoreFilters?: {
    brand?: string;
    price?: string;
    currentPage?: number;
  };
  restoreScrollY?: number;
}

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
      onClick={() => void onRetry()}
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
    >
      <RefreshCw
        size={18}
        className="transition-transform duration-300"
      />
      Retry
    </button>
  </div>
);

const BusTyres = (): ReactElement => {
  const location = useLocation();
  const navigate = useNavigate();

  const restoreState =
    location.state as RestoreState | null;

  const hasRestoreState =
    Boolean(restoreState?.restoreFilters);

  const [items, setItems] =
    useState<SparePart[]>([]);

  const [brand, setBrand] =
    useState<string>(
      restoreState?.restoreFilters?.brand ?? ""
    );

  const [price, setPrice] =
    useState<string>(
      restoreState?.restoreFilters?.price ?? ""
    );

  const [brandOpen, setBrandOpen] =
    useState<boolean>(false);

  const [priceOpen, setPriceOpen] =
    useState<boolean>(false);

  const brandDropdownRef =
    useRef<HTMLDivElement>(null);

  const priceDropdownRef =
    useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] =
    useState<number>(
      restoreState?.restoreFilters?.currentPage ?? 1
    );

  const [totalPages, setTotalPages] =
    useState<number>(1);

  const [loading, setLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<boolean>(false);

  const { addItem } = useCart();

  const availableBrands: string[] = [
    "Bridgestone",
    "Michelin",
    "Goodyear",
    "Continental",
    "Pirelli",
    "Yokohama",
    "Dunlop",
  ];

  const isRestoringRef =
    useRef<boolean>(hasRestoreState);

  const restoreScrollYRef =
    useRef<number | null>(
      typeof restoreState?.restoreScrollY === "number"
        ? restoreState.restoreScrollY
        : null
    );

  const initialRestoreRef =
    useRef<boolean>(hasRestoreState);

  /* ---------------- Fetch Tyres ---------------- */
  const fetchTyres = async (): Promise<void> => {
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      category: "tyre",
      vehicle_type: "bus",
      ...(brand && { brand }),
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

  /* ---------------- Fetch ---------------- */
  useEffect(() => {
    void fetchTyres();
  }, [brand, price, currentPage]);

  /* ---------------- Restore Previous Listing ---------------- */
  useEffect(() => {
    if (!hasRestoreState) {
      return;
    }

    setBrand(
      restoreState?.restoreFilters?.brand ?? ""
    );

    setPrice(
      restoreState?.restoreFilters?.price ?? ""
    );

    setCurrentPage(
      restoreState?.restoreFilters?.currentPage ?? 1
    );

    setBrandOpen(false);
    setPriceOpen(false);

    restoreScrollYRef.current =
      typeof restoreState?.restoreScrollY === "number"
        ? restoreState.restoreScrollY
        : 0;
  }, []);

  /* ---------------- Restore Scroll After Loading ---------------- */
  useEffect(() => {
    if (
      loading ||
      restoreScrollYRef.current === null
    ) {
      return;
    }

    const scrollY =
      restoreScrollYRef.current;

    isRestoringRef.current = true;

    let cancelled = false;

    const restoreScroll = (): void => {
      if (cancelled) {
        return;
      }

      window.scrollTo({
        top: scrollY,
        left: 0,
        behavior: "auto",
      });

      requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        window.scrollTo({
          top: scrollY,
          left: 0,
          behavior: "auto",
        });

        requestAnimationFrame(() => {
          if (cancelled) {
            return;
          }

          window.scrollTo({
            top: scrollY,
            left: 0,
            behavior: "auto",
          });

          requestAnimationFrame(() => {
            if (cancelled) {
              return;
            }

            window.scrollTo({
              top: scrollY,
              left: 0,
              behavior: "auto",
            });

            isRestoringRef.current = false;
            restoreScrollYRef.current = null;
          });
        });
      });
    };

    const images = Array.from(document.images);

    const pendingImages =
      images.filter(
        (image) => !image.complete
      );

    if (pendingImages.length === 0) {
      restoreScroll();
    } else {
      let remaining =
        pendingImages.length;

      const handleImageLoad = (): void => {
        remaining -= 1;

        if (remaining <= 0) {
          restoreScroll();
        }
      };

      pendingImages.forEach((image) => {
        image.addEventListener(
          "load",
          handleImageLoad,
          { once: true }
        );

        image.addEventListener(
          "error",
          handleImageLoad,
          { once: true }
        );
      });

      const fallbackTimer =
        window.setTimeout(() => {
          restoreScroll();
        }, 1500);

      return () => {
        cancelled = true;

        window.clearTimeout(
          fallbackTimer
        );

        pendingImages.forEach((image) => {
          image.removeEventListener(
            "load",
            handleImageLoad
          );

          image.removeEventListener(
            "error",
            handleImageLoad
          );
        });
      };
    }

    return () => {
      cancelled = true;
    };
  }, [loading, currentPage]);

  /* ---------------- Scroll On Normal Page Change ---------------- */
  useEffect(() => {
    if (
      isRestoringRef.current ||
      restoreScrollYRef.current !== null
    ) {
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [currentPage]);

  /* ---------------- Reset Page On Filter Change ---------------- */
  useEffect(() => {
    if (initialRestoreRef.current) {
      initialRestoreRef.current = false;
      return;
    }

    setCurrentPage(1);
  }, [brand, price]);

  /* ---------------- Back To Available Parts ---------------- */
  const handleBackToAvailableParts =
    (): void => {
      setBrand("");
      setPrice("");
      setCurrentPage(1);
      setBrandOpen(false);
      setPriceOpen(false);
    };

  /* ---------------- Item Navigation ---------------- */
  const handleItemClick = (
    event: MouseEvent<HTMLAnchorElement>,
    itemId: string
  ): void => {
    event.preventDefault();

    navigate(`/items/${itemId}`, {
      state: {
        from: location.pathname,
        restoreFilters: {
          brand,
          price,
          currentPage,
        },
        restoreScrollY: window.scrollY,
      },
    });
  };

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
       <Link
        to="/"
        aria-label="Back to home"
        className="
         inline-flex
         items-center
         justify-center
         rounded-md
         p-2
         text-[rgb(0,64,128)]
         text-lg
         font-bold
         transition-colors
         cursor-pointer
         hover:bg-[#eaf2f8]
      "
    >
        Home
      </Link>
      {!error && (
        <>
          {(brand !== "" ||
            price !== "") && (
            <div className="mb-4">
              <button
                type="button"
                onClick={
                  handleBackToAvailableParts
                }
                aria-label="Back to available parts"
                className="
                  mt-4
                  inline-flex
                  items-center
                  justify-center
                  rounded-md
                  p-2
                  text-[rgb(0,64,128)]
                  transition-colors
                  cursor-pointer
                  hover:bg-[#eaf2f8]
                "
              >
                <ArrowLeft size={30} />
              </button>
            </div>
          )}

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
                    setBrandOpen(
                      (open) => !open
                    );
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
                    cursor-pointer
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
                      className="ml-2 shrink-0 text-gray-600"
                    />
                  ) : (
                    <ChevronDown
                      size={18}
                      className="ml-2 shrink-0 text-gray-600"
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
                            setBrand(
                              itemBrand
                            );
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
                            cursor-pointer
                            hover:bg-[#f0f6ff]
                            max-[480px]:text-base
                            ${
                              brand ===
                              itemBrand
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
                    cursor-pointer
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
                          ? "Medium (25k–30k)"
                          : "High (> 30k)"}
                  </span>

                  {priceOpen ? (
                    <ChevronUp
                      size={18}
                      className="ml-2 shrink-0 text-gray-600"
                    />
                  ) : (
                    <ChevronDown
                      size={18}
                      className="ml-2 shrink-0 text-gray-600"
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
                        cursor-pointer
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
                        cursor-pointer
                        hover:bg-[#f0f6ff]
                        max-[480px]:text-base
                        ${
                          price === "medium"
                            ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                            : "text-[#333]"
                        }
                      `}
                    >
                      Medium (25k–30k)
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
                        cursor-pointer
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
        </>
      )}

      {error ? (
        <ErrorState onRetry={fetchTyres} />
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
                    onClick={(event) =>
                      handleItemClick(
                        event,
                        item.id
                      )
                    }
                    className="
                      flex
                      h-full
                      w-full
                      flex-col
                      items-center
                      no-underline
                      text-inherit
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
                      {item.brand}{" "}
                      {item.category} for{" "}
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

                      {item.discount_percentage >
                        0 && (
                        <span
                          className="
                            ml-[5px]
                            font-normal
                            text-[#d9534f]
                          "
                        >
                          (-{item.discount_percentage.toFixed(0)}%)
                        </span>
                      )}
                    </p>

                    <button
                      onClick={(event) =>
                        handleAddToCart(
                          item,
                          event
                        )
                      }
                      className="
                        rounded-md
                        bg-[rgb(0,64,128)]
                        px-3
                        py-2
                        font-bold
                        text-white
                        transition-colors
                        cursor-pointer
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
                No Bus tyres found.
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="h-8 w-10 rounded-md bg-[#e0e0e0]"
                  />
                )
              )}
            </div>
          ) : (
            totalPages > 1 && (
              <div className="my-[30px] flex flex-wrap items-center justify-center gap-[6px]">
                <button
                  disabled={
                    currentPage === 1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          page - 1,
                          1
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
                    cursor-pointer
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Prev
                </button>

                {visiblePages[0] > 1 && (
                  <span className="select-none px-[6px] text-base">
                    …
                  </span>
                )}

                {visiblePages.map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() =>
                        setCurrentPage(
                          page
                        )
                      }
                      className={`rounded border px-3 py-[6px] text-sm transition-colors ${
                        page ===
                        currentPage
                          ? "border-[rgb(0,64,128)] bg-[rgb(0,64,128)] font-semibold text-white"
                          : "border-[#ddd] bg-white hover:bg-[#f0f0f0]"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                {visiblePages[
                  visiblePages.length - 1
                ] < totalPages && (
                  <span className="select-none px-[6px] text-base">
                    …
                  </span>
                )}

                <button
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
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
                    cursor-pointer
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

export default BusTyres;