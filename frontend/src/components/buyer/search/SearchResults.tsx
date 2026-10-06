import { useEffect, useState, useRef, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCart, type SparePart } from "../../../contexts/CartContext";
import config from "../../../config";


interface ApiSparePart extends SparePart {
  name: string;
  image_url?: string;
  discount_percentage: number;
}

interface SparePartsResponse {
  items: ApiSparePart[];
}

const SkeletonCard = () => (
  <div className="mr-[30px] flex flex-col rounded-xl bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] max-[480px]:mr-0">
    <div className="mb-[10px] h-40 w-full animate-shimmer rounded-[10px]" />
    <div className="h-[14px] w-4/5 animate-shimmer rounded-md" />
  </div>
);

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

const SearchResults = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const restoreState = location.state as {
    restoreScrollY?: number;
  } | null;

  const restoreScrollYRef = useRef<number | null>(
    typeof restoreState?.restoreScrollY === "number"
      ? restoreState.restoreScrollY
      : null
  );

  const isRestoringRef = useRef<boolean>(
    typeof restoreState?.restoreScrollY === "number"
  );

  const [items, setItems] = useState<ApiSparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] =
    useState<Record<string, boolean>>({});

  const { addItem } = useCart();

  const params = new URLSearchParams(location.search);

  const keyword = params.get("query");
  const brand = params.get("brand");
  const vehicle = params.get("vehicle");
  const category = params.get("category");

  const handleImageLoad = (id: string) => {
    setLoadedImages((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  const handleAddToCart = (
    item: ApiSparePart,
    e: MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(item);
  };

  const handleItemClick = (
    event: MouseEvent<HTMLAnchorElement>,
    itemId: string
  ): void => {
    event.preventDefault();

    navigate(`/items/${itemId}`, {
      state: {
        from: `${location.pathname}${location.search}`,
        restoreScrollY: window.scrollY,
      },
    });
  };

  const handleBackToSearch = (): void => {
    navigate("/search", {
      state: {
        searchQuery: keyword ?? "",
      },
    });
  };

  useEffect(() => {
    setLoading(true);

    fetch(`${config.API_BASE_URL}/spareparts/?per_page=1000`)
      .then((res) => res.json())
      .then((data: SparePartsResponse) => {
        let results = data.items ?? [];

        if (keyword) {
          const words = normalizeSearchText(keyword).split(/\s+/);

          results = results.filter((item) => {
            const text = normalizeSearchText(
              `${item.name} ${item.brand} ${item.category} ${item.vehicle_type}`
            );

            return words.every((word) =>
              text.includes(word)
            );
          });
        }

        if (brand && vehicle && category) {
          const normalizedBrand =
            normalizeSearchText(brand);

          const normalizedVehicle =
            normalizeSearchText(vehicle);

          const normalizedCategory =
            normalizeSearchText(category);

          results = results.filter(
            (item) =>
              normalizeSearchText(item.brand) ===
                normalizedBrand &&
              normalizeSearchText(item.vehicle_type) ===
                normalizedVehicle &&
              normalizeSearchText(item.category) ===
                normalizedCategory
          );
        }

        setItems(results);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, [keyword, brand, vehicle, category]);

  useEffect(() => {
    if (
      loading ||
      restoreScrollYRef.current === null
    ) {
      return;
    }

    const scrollY = restoreScrollYRef.current;

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

    const pendingImages = images.filter(
      (image) => !image.complete
    );

    if (pendingImages.length === 0) {
      restoreScroll();
    } else {
      let remaining = pendingImages.length;

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

      const fallbackTimer = window.setTimeout(() => {
        restoreScroll();
      }, 1500);

      return () => {
        cancelled = true;

        window.clearTimeout(fallbackTimer);

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
  }, [loading]);

  return (
    <div className="mx-auto mt-[70px] max-w-[1200px] p-8 text-[#222]">
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={handleBackToSearch}
          className="
            flex
            h-9
            w-9
            mr-5
            shrink-0
            items-center
            justify-center
            rounded-full
            text-[rgb(0,64,128)]
            transition
            hover:bg-gray-100
            hover:text-[#004080]
          "
          aria-label="Back to search"
        >
          <ArrowLeft size={30} />
        </button>

        <h2 className="min-w-0 text-[1.6rem] font-semibold">
          {keyword && `Results for "${keyword}"`}

          {brand &&
            vehicle &&
            category &&
            ` Category: ${brand} ${vehicle} ${category}`}
        </h2>
      </div>

      {loading ? (
        <div
          className="
            grid
            grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
            gap-[30px]
            max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
            max-[480px]:gap-5
          "
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-12 text-center text-base text-[#888]">
          No items found
        </p>
      ) : (
        <div
          className="
            grid
            grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
            gap-[30px]
            max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
            max-[480px]:gap-5
          "
        >
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/items/${item.id}`}
              onClick={(event) =>
                handleItemClick(
                  event,
                  item.id
                )
              }
              className="text-inherit no-underline"
            >
              <div
                className={`
                  flex flex-col
                  rounded-xl
                  bg-white
                  p-3
                  text-[#222]
                  shadow-[0_4px_12px_rgba(0,0,0,0.06)]
                  transition-all
                  duration-200
                  hover:-translate-y-1
                  hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]
                  mr-[30px]
                  max-[480px]:mr-0
                  ${
                    loadedImages[item.id]
                      ? ""
                      : "pointer-events-none"
                  }
                `}
              >
                <img
                  className="mb-[10px] h-auto w-[70%] rounded-[10px] object-cover"
                  src={item.image || item.image_url}
                  alt={item.brand}
                  onLoad={() =>
                    handleImageLoad(item.id)
                  }
                />

                <h4 className="my-[5px] text-center text-[0.95rem] font-semibold">
                  {item.brand} {item.category} for{" "}
                  {item.vehicle_type}
                </h4>

                <p className="mb-[6px] font-semibold text-[rgb(255,0,0)]">
                  KES{" "}
                  {item.buying_price.toLocaleString()}

                  {item.discount_percentage > 0 && (
                    <span className="ml-[5px] text-sm text-[#e41a139b]">
                      (-
                      {item.discount_percentage.toFixed(0)}
                      %)
                    </span>
                  )}
                </p>

                <button
                  onClick={(e) =>
                    handleAddToCart(item, e)
                  }
                  className="
                    mt-auto
                    cursor-pointer
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-2
                    font-semibold
                    text-white
                    transition-colors
                    duration-200
                    hover:bg-[rgb(0,90,180)]
                  "
                >
                  Add To Cart
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
