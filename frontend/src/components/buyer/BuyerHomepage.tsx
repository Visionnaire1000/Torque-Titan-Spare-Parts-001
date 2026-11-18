import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Flame, RefreshCw } from "lucide-react";

import { useCart } from "../../contexts/CartContext";
import config from "../../config";
import Footer from "../shared/layout/Footer";


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
  items?: SparePart[];
}

interface RestoreState {
  restoreScrollY?: number;
}

const SkeletonCard = () => (
  <div className="relative flex h-full flex-col gap-[10px] overflow-hidden rounded-xl bg-[#f3f3f3] p-3">
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      <div className="h-full w-[150%] animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
    <div className="relative z-10 h-44 rounded-lg bg-gray-300" />
    <div className="relative z-10 h-4 w-2/3 rounded bg-gray-300" />
    <div className="relative z-10 h-4 w-full rounded bg-gray-300" />
    <div className="relative z-10 h-10 rounded-md bg-gray-300" />
  </div>
);

const BuyerHomepage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const restoreState = location.state as RestoreState | null;
  const hasRestoreState =
    typeof restoreState?.restoreScrollY === "number";

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const isRestoringRef = useRef(hasRestoreState);
  const restoreScrollYRef = useRef<number | null>(
    typeof restoreState?.restoreScrollY === "number"
      ? restoreState.restoreScrollY
      : null
  );

  const carouselItems = spareParts.slice(0, 8);
  const gridItems = spareParts.slice(8, 16);

  const visibleCarouselItems: SparePart[] =
    carouselItems.length > 0
      ? Array.from({
          length: Math.min(4, carouselItems.length),
        }).map(
          (_, index) =>
            carouselItems[
              (carouselIndex + index) % carouselItems.length
            ]
        )
      : [];

const translateCategory = (value: string): string => {
  const normalized = value.trim().toLowerCase();

  const categoryAliases: Record<string, string> = {
    tyre: "tyre",
    tyres: "tyre",
    rim: "rim",
    rims: "rim",
    battery: "battery",
    batteries: "battery",
    filter: "filter",
    filters: "filter",
    "oil filter": "filter",
    "oil filters": "filter",
    sedan: "sedan",
    saloon: "sedan",
    suv: "suv",
    truck: "truck",
    lorry: "truck",
    bus: "bus",
  };

  const key = categoryAliases[normalized] ?? normalized;
  const translationKey = `productCategories.${key}`;
  const translated = t(translationKey);

  return translated === translationKey ? value : translated;
};

  const getProductLabel = (item: SparePart): string => {
    const category = translateCategory(item.category);
    const vehicleType = translateCategory(item.vehicle_type);
    const translatedFor = t("common.productFor");

    return `${item.brand} ${category} ${translatedFor} ${vehicleType}`;
  };

  const fetchSpareParts = (): void => {
    setLoading(true);
    setError(null);

    fetch(
      `${config.API_BASE_URL}/spareparts/?per_page=16&top_discounts=true`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Server error");
        }

        return response.json() as Promise<SparePartsResponse>;
      })
      .then((data) => {
        const items = Array.isArray(data.items) ? data.items : [];

        setSpareParts(items.slice(0, 16));
        setCarouselIndex(0);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setError(t("buyerHomepage.loadSparePartsError"));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSpareParts();
  }, []);

  useEffect(() => {
    if (loading || restoreScrollYRef.current === null) {
      return;
    }

    const scrollY = restoreScrollYRef.current;
    isRestoringRef.current = true;

    let cancelled = false;
    let fallbackTimer: number | undefined;

    const restoreScroll = (): void => {
      if (cancelled) return;

      window.scrollTo({
        top: scrollY,
        left: 0,
        behavior: "auto",
      });

      requestAnimationFrame(() => {
        if (cancelled) return;

        window.scrollTo({
          top: scrollY,
          left: 0,
          behavior: "auto",
        });

        requestAnimationFrame(() => {
          if (cancelled) return;

          window.scrollTo({
            top: scrollY,
            left: 0,
            behavior: "auto",
          });

          requestAnimationFrame(() => {
            if (cancelled) return;

            window.scrollTo({
              top: scrollY,
              left: 0,
              behavior: "auto",
            });

            isRestoringRef.current = false;
            restoreScrollYRef.current = null;

            window.history.replaceState(
              {},
              document.title,
              window.location.href
            );
          });
        });
      });
    };

    const pendingImages = Array.from(document.images).filter(
      (image) => !image.complete
    );

    if (pendingImages.length === 0) {
      restoreScroll();
    } else {
      let remaining = pendingImages.length;

      const handleImageLoad = (): void => {
        remaining -= 1;

        if (remaining <= 0) {
          if (fallbackTimer !== undefined) {
            window.clearTimeout(fallbackTimer);
          }
          restoreScroll();
        }
      };

      pendingImages.forEach((image) => {
        image.addEventListener("load", handleImageLoad, {
          once: true,
        });
        image.addEventListener("error", handleImageLoad, {
          once: true,
        });
      });

      fallbackTimer = window.setTimeout(restoreScroll, 1500);

      return () => {
        cancelled = true;

        if (fallbackTimer !== undefined) {
          window.clearTimeout(fallbackTimer);
        }

        pendingImages.forEach((image) => {
          image.removeEventListener("load", handleImageLoad);
          image.removeEventListener("error", handleImageLoad);
        });
      };
    }

    return () => {
      cancelled = true;
    };
  }, [loading]);

  useEffect(() => {
    if (carouselItems.length < 8) {
      return;
    }

    const interval = window.setInterval(() => {
      setCarouselIndex((previous) => (previous + 4) % 8);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [carouselItems.length]);

  const handlePreviousCarousel = (): void => {
    if (carouselItems.length === 0) return;

    setCarouselIndex(
      (previous) =>
        (previous - 4 + carouselItems.length) %
        carouselItems.length
    );
  };

  const handleAddToCart = (
    item: SparePart,
    event: MouseEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    addItem(item);
  };

  const handleItemClick = (
    event: MouseEvent<HTMLAnchorElement>,
    itemId: string
  ): void => {
    event.preventDefault();

    navigate(`/items/${itemId}`, {
      state: {
        from: location.pathname,
        restoreScrollY: window.scrollY,
      },
    });
  };

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="mb-4 text-[1.8rem] font-semibold text-red-600">
          {t("common.somethingWentWrong")}
        </h2>

        <p className="text-gray-600">{error}</p>

        <button
          type="button"
          onClick={fetchSpareParts}
          className="mt-3 flex items-center gap-[6px] rounded-lg bg-[#ff4d4f] px-4 py-[10px] text-white transition-colors duration-200 hover:bg-[#d9363e]"
        >
          <RefreshCw size={16} />
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="px-[10px] pb-[70px] pt-24 font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] sm:px-[15px] max-[480px]:mt-[50px] lg:px-5 max-[770px]:mt-[50px]">
        <h2 className="mb-2 mt-2 flex items-center text-[1.2rem] font-semibold text-red-600 sm:text-[1.5rem] lg:text-[1.8rem]">
          <span className="mr-[6px] inline-block animate-fire align-middle">
            <Flame size={24} color="red" />
          </span>
          {t("buyerHomepage.hotDeals")}
        </h2>

        <div className="relative mb-12">
          {!loading && carouselItems.length > 4 && (
            <button
              type="button"
              onClick={handlePreviousCarousel}
              aria-label={t("buyerHomepage.previousDeals")}
              className="absolute left-0 top-1/2 z-20 ml-[-10px] flex h-9 w-9 -translate-y-1/2 items-center
                         justify-center rounded-full bg-white shadow-md transition-all duration-200 cursor-pointer 
                         hover:scale-105 hover:bg-gray-100 md:h-10 md:w-10"
            >
              <ArrowLeft size={19} strokeWidth={2} />
            </button>
          )}

          <div className="flex gap-1 overflow-x-auto scroll-smooth px-10 md:gap-[15px] md:overflow-hidden">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="basis-[47%] flex-none md:flex-1"
                >
                  <SkeletonCard />
                </div>
              ))
            ) : visibleCarouselItems.length > 0 ? (
              visibleCarouselItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/items/${item.id}`}
                  onClick={(event) =>
                    handleItemClick(event, item.id)
                  }
                  className="basis-[50%] flex-none text-inherit no-underline md:basis-[45%] lg:flex-1"
                >
                  <div className="flex h-full cursor-pointer flex-col items-center rounded-xl bg-white p-[10px] shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] sm:p-3">
                    <img
                      src={item.image}
                      alt={getProductLabel(item)}
                      className="mb-[10px] mt-10 w-[80%] rounded-lg object-cover sm:mt-0 sm:w-1/2 sm:object-contain"
                    />

                    <h4 className="my-[5px] mb-[10px] self-start text-left text-[0.9rem] text-[#333] sm:self-auto sm:text-center sm:text-base">
                      {getProductLabel(item)}
                    </h4>

                    <p className="mb-[10px] text-base font-bold text-[rgb(255,0,0)] sm:text-lg">
                      KES {item.buying_price.toLocaleString()}
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
                      className="cursor-pointer rounded-md bg-[rgb(0,64,128)] px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-[rgb(4,37,71)]"
                    >
                      {t("common.addToCart")}
                    </button>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-red-600">
                {t("buyerHomepage.noDealsAvailable")}
              </p>
            )}
          </div>
        </div>

        <h2 className="mb-5 mt-5 text-[1.2rem] font-semibold text-red-600 sm:text-[1.5rem] lg:text-[1.8rem]">
          {t("buyerHomepage.moreDeals")}
        </h2>

        <div className="mb-5 grid grid-cols-3 gap-3 md:mb-[50px] md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] 2xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))
          ) : gridItems.length > 0 ? (
            gridItems.map((item) => (
              <Link
                key={item.id}
                to={`/items/${item.id}`}
                onClick={(event) =>
                  handleItemClick(event, item.id)
                }
                className="text-inherit no-underline"
              >
                <div className="flex h-full cursor-pointer flex-col items-center rounded-xl bg-white p-[10px] shadow-[0_4px_10px_rgba(0,0,0,0.1)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] sm:p-3">
                  <img
                    src={item.image}
                    alt={getProductLabel(item)}
                    className="mb-[10px] mt-10 w-[80%] rounded-lg object-cover sm:mt-0 sm:w-1/2 sm:object-contain"
                  />

                  <h4 className="my-[5px] mb-[10px] self-start text-left text-[0.9rem] text-[#333] sm:self-auto sm:text-center sm:text-base">
                    {getProductLabel(item)}
                  </h4>

                  <p className="mb-2 text-lg font-semibold text-red-600">
                    KES {item.buying_price.toLocaleString()}
                    {item.discount_percentage > 0 && (
                      <span className="ml-[5px] text-sm text-[#e41a139b]">
                        (-{item.discount_percentage.toFixed(0)}%)
                      </span>
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={(event) =>
                      handleAddToCart(item, event)
                    }
                    className="cursor-pointer rounded-md bg-[rgb(0,64,128)] px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-[rgb(4,37,71)]"
                  >
                    {t("common.addToCart")}
                  </button>
                </div>
              </Link>
            ))
          ) : (
            <p className="col-span-full text-center text-red-600">
              {t("buyerHomepage.noItemsAvailable")}
            </p>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
};

export default BuyerHomepage;
