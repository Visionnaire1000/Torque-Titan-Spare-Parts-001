import { useEffect, useState, useRef, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
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

interface TruckFiltersNavigationState {
  brand: string;
  colour: string;
  price: string;
  currentPage: number;
  scrollY: number;
}

const TRUCK_FILTERS_NAVIGATION_KEY = "truckFiltersNavigationState";

const getSavedNavigationState = (): TruckFiltersNavigationState | null => {
  try {
    const saved = sessionStorage.getItem(TRUCK_FILTERS_NAVIGATION_KEY);

    if (!saved) {
      return null;
    }

    return JSON.parse(saved) as TruckFiltersNavigationState;
  } catch {
    return null;
  }
};

const SkeletonCard = (): ReactElement => (
  <div className="relative flex h-full flex-col items-center overflow-hidden rounded-xl bg-white p-3 shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -left-[150%] top-0 h-full w-[150%] animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>

    <div className="mb-3 h-[140px] w-full rounded-[10px] bg-gray-200" />
    <div className="my-2 h-3 w-4/5 rounded bg-gray-200" />
    <div className="my-2 h-3 w-3/5 rounded bg-gray-200" />
    <div className="my-2 h-3 w-2/5 rounded bg-gray-200" />
    <div className="mt-3 h-8 w-full rounded-lg bg-gray-200" />
  </div>
);

const ErrorState = ({ onRetry }: ErrorStateProps): ReactElement => (
  <div className="px-5 py-10 text-center">
    <h2 className="mb-3 text-2xl font-semibold">
      Failed to load Truck filters
    </h2>

    <button
      type="button"
      onClick={() => void onRetry()}
      className="inline-flex items-center gap-2 rounded-md bg-[#111] px-5 py-2.5 text-white transition-opacity duration-200 hover:opacity-85"
    >
      <RefreshCw size={18} className="transition-transform duration-300" />
      Retry
    </button>
  </div>
);

const TruckFilters = (): ReactElement => {
  const [savedNavigationState] = useState<TruckFiltersNavigationState | null>(
    () => getSavedNavigationState()
  );

  const [items, setItems] = useState<SparePart[]>([]);

  const [brand, setBrand] = useState<string>(
    savedNavigationState?.brand ?? ""
  );

  const [colour, setColour] = useState<string>(
    savedNavigationState?.colour ?? ""
  );

  const [price, setPrice] = useState<string>(
    savedNavigationState?.price ?? ""
  );

  const [brandOpen, setBrandOpen] = useState<boolean>(false);
  const [colourOpen, setColourOpen] = useState<boolean>(false);
  const [priceOpen, setPriceOpen] = useState<boolean>(false);

  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const colourDropdownRef = useRef<HTMLDivElement>(null);
  const priceDropdownRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState<number>(
    savedNavigationState?.currentPage ?? 1
  );

  const [totalPages, setTotalPages] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const restoreScrollRef = useRef<boolean>(
    savedNavigationState !== null
  );

  const restoreScrollYRef = useRef<number>(
    savedNavigationState?.scrollY ?? 0
  );

  const skipInitialFilterResetRef = useRef<boolean>(true);

  const { addItem } = useCart();

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

  const saveNavigationState = (): void => {
    try {
      const navigationState: TruckFiltersNavigationState = {
        brand,
        colour,
        price,
        currentPage,
        scrollY: window.scrollY,
      };

      sessionStorage.setItem(
        TRUCK_FILTERS_NAVIGATION_KEY,
        JSON.stringify(navigationState)
      );
    } catch {
      // Ignore sessionStorage errors.
    }
  };

  const clearNavigationState = (): void => {
    try {
      sessionStorage.removeItem(TRUCK_FILTERS_NAVIGATION_KEY);
    } catch {
      // Ignore sessionStorage errors.
    }
  };

  const restoreScrollPosition = (): void => {
    if (!restoreScrollRef.current) {
      return;
    }

    const scrollY = restoreScrollYRef.current;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollY,
          left: 0,
          behavior: "auto",
        });

        restoreScrollRef.current = false;
        clearNavigationState();
      });
    });
  };

  const fetchFilters = async (): Promise<void> => {
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      category: "oil filter",
      vehicle_type: "truck",
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
        throw new Error("Failed to fetch Truck filters");
      }

      const data: SparePartsResponse = await response.json();

      setItems(data.items ?? []);
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      console.error(err);
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);

      if (restoreScrollRef.current) {
        restoreScrollPosition();
      }
    }
  };

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [currentPage]);

  useEffect(() => {
    void fetchFilters();
  }, [brand, colour, price, currentPage]);

  useEffect(() => {
    if (skipInitialFilterResetRef.current) {
      skipInitialFilterResetRef.current = false;
      return;
    }

    setCurrentPage(1);
  }, [brand, colour, price]);

  const handleBackToAvailableParts = (): void => {
    setBrand("");
    setColour("");
    setPrice("");
    setCurrentPage(1);

    setBrandOpen(false);
    setColourOpen(false);
    setPriceOpen(false);

    clearNavigationState();
  };

  const handleItemNavigation = (): void => {
    saveNavigationState();
  };

  const handleAddToCart = (
    item: SparePart,
    event: MouseEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    addItem(item);
  };

  useEffect(() => {
    const handleClickOutside = (
      event: globalThis.MouseEvent
    ): void => {
      if (
        brandDropdownRef.current &&
        !brandDropdownRef.current.contains(event.target as Node)
      ) {
        setBrandOpen(false);
      }

      if (
        colourDropdownRef.current &&
        !colourDropdownRef.current.contains(event.target as Node)
      ) {
        setColourOpen(false);
      }

      if (
        priceDropdownRef.current &&
        !priceDropdownRef.current.contains(event.target as Node)
      ) {
        setPriceOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getVisiblePages = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(currentPage - 2, 1);
    let end = Math.min(
      start + maxVisible - 1,
      totalPages
    );

    start = Math.max(
      end - maxVisible + 1,
      1
    );

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="mt-[70px] bg-[#f9f9f9] p-5 pb-[70px] font-[Arial,sans-serif] max-[480px]:max-w-[480px]">
      {!error &&
        (brand !== "" ||
          colour !== "" ||
          price !== "") && (
          <div className="mb-[10px] flex w-full justify-start">
            <button
              type="button"
              onClick={handleBackToAvailableParts}
              aria-label="Back to available parts"
              className="inline-flex items-center justify-center rounded-md p-2 text-[rgb(0,64,128)] transition-colors hover:bg-[#eaf2f8]"
            >
              <ArrowLeft size={30} />
            </button>
          </div>
        )}

      {!error && (
        <div className="mt-5 mb-[25px] flex w-full justify-center">
          <div className="flex flex-wrap items-center justify-center gap-4 max-[480px]:mt-3 max-[480px]:gap-2 max-[480px]:items-center">
            <div
              ref={brandDropdownRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setBrandOpen((open) => !open);
                  setColourOpen(false);
                  setPriceOpen(false);
                }}
                className="flex min-w-[150px] items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-[#333] shadow-sm"
              >
                <span>{brand || "Brand"}</span>
                {brandOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </button>

              {brandOpen && (
                <div className="absolute z-30 mt-1 max-h-60 w-full min-w-[150px] overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setBrand("");
                      setBrandOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    All Brands
                  </button>

                  {availableBrands.map((availableBrand) => (
                    <button
                      type="button"
                      key={availableBrand}
                      onClick={() => {
                        setBrand(availableBrand);
                        setBrandOpen(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      {availableBrand}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              ref={colourDropdownRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setColourOpen((open) => !open);
                  setBrandOpen(false);
                  setPriceOpen(false);
                }}
                className="flex min-w-[150px] items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-[#333] shadow-sm"
              >
                <span>
                  {colour
                    ? colour.charAt(0).toUpperCase() +
                      colour.slice(1)
                    : "Colour"}
                </span>

                {colourOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </button>

              {colourOpen && (
                <div className="absolute z-30 mt-1 max-h-60 w-full min-w-[150px] overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setColour("");
                      setColourOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    All Colours
                  </button>

                  {availableColours.map((availableColour) => (
                    <button
                      type="button"
                      key={availableColour}
                      onClick={() => {
                        setColour(availableColour);
                        setColourOpen(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm capitalize hover:bg-gray-100"
                    >
                      {availableColour}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              ref={priceDropdownRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() => {
                  setPriceOpen((open) => !open);
                  setBrandOpen(false);
                  setColourOpen(false);
                }}
                className="flex min-w-[150px] items-center justify-between gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-[#333] shadow-sm"
              >
                <span>{price || "Price"}</span>

                {priceOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </button>

              {priceOpen && (
                <div className="absolute z-30 mt-1 w-full min-w-[150px] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPrice("");
                      setPriceOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    All Prices
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrice("low");
                      setPriceOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    Low to High
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrice("high");
                      setPriceOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    High to Low
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error ? (
        <ErrorState onRetry={fetchFilters} />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5 max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))
            ) : items.length ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex h-full flex-col items-center rounded-xl bg-white p-3 shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]"
                >
                  <Link
                    to={`/items/${item.id}`}
                    onClick={handleItemNavigation}
                    className="flex h-full w-full flex-col items-center"
                  >
                    <img
                      src={item.image}
                      alt={item.brand}
                      className="mb-[10px] h-[150px] w-full rounded-lg object-contain max-[480px]:h-auto max-[480px]:w-[60%] max-[480px]:object-cover"
                    />

                    <h4 className="my-[5px] mb-[10px] text-center text-base text-[#333]">
                      {item.brand} {item.category} for{" "}
                      {item.vehicle_type}
                    </h4>

                    <p className="mb-[10px] text-base font-bold text-[rgb(255,0,0)] sm:text-lg">
                      KES{" "}
                      {item.buying_price.toLocaleString()}

                      {item.discount_percentage > 0 && (
                        <span className="ml-[5px] text-xs text-[rgba(228,26,19,0.67)]">
                          (-{item.discount_percentage.toFixed(0)}%)
                        </span>
                      )}
                    </p>

                    <button
                      type="button"
                      onClick={(event) =>
                        handleAddToCart(item, event)
                      }
                      className="rounded-md bg-[rgb(0,64,128)] px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-[rgb(4,37,71)]"
                    >
                      Add To Cart
                    </button>
                  </Link>
                </div>
              ))
            ) : (
              <p className="col-span-full mb-20 text-center text-base text-[#7f0d0d]">
                No Truck filters found.
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-4 flex justify-center gap-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-8 w-10 animate-pulse rounded-md bg-gray-200"
                />
              ))}
            </div>
          ) : (
            totalPages > 1 && (
              <div className="my-[30px] flex flex-wrap items-center justify-center gap-[6px]">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.max(page - 1, 1)
                    )
                  }
                  className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>

                {visiblePages[0] > 1 && (
                  <span className="select-none px-1.5 text-base">
                    …
                  </span>
                )}

                {visiblePages.map((page) => (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={
                      page === currentPage
                        ? "rounded border border-[#004080] bg-[#004080] px-3 py-1.5 text-sm font-semibold text-white"
                        : "rounded border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-gray-100"
                    }
                  >
                    {page}
                  </button>
                ))}

                {visiblePages[
                  visiblePages.length - 1
                ] < totalPages && (
                  <span className="select-none px-1.5 text-base">
                    …
                  </span>
                )}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(page + 1, totalPages)
                    )
                  }
                  className="cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
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