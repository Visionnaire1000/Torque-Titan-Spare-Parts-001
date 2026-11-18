import { useEffect, useState, useRef, useCallback, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

type TranslateFunction = (
  key: string,
  options?: Record<string, unknown>
) => string;

type ProductValueType = "category" | "vehicle";

const CATEGORY_ALIAS_GROUPS: Record<string, string[]> = {
  tyre: [
    "tyre", "tyres", "tire", "tires",
    "pneu", "pneus",
    "neumatico", "neumaticos",
    "pneumatico", "pneumaticos",
    "reifen",
    "pneumatici",
    "タイヤ",
    "타이어",
    "шина", "шины",
    "lastik", "lastikler",
    "band", "banden",
    "轮胎", "车胎",
    "टायर",
  ],

  rim: [
    "rim", "rims",
    "jante", "jantes",
    "llanta", "llantas",
    "aro", "aros",
    "felge", "felgen",
    "cerchio", "cerchi",
    "ホイール", "リム",
    "휠", "림",
    "диск", "диски",
    "jant", "jantlar",
    "velg", "velgen",
    "轮毂", "轮圈",
    "रिम",
  ],

  battery: [
    "battery", "batteries",
    "batterie", "batteries",
    "bateria", "baterias",
    "batteria", "batterie",
    "batterien",
    "バッテリー",
    "배터리",
    "аккумулятор", "аккумуляторы",
    "pil", "piller",
    "accu", "accus",
    "电池", "汽车电池",
    "बैटरी",
  ],

  filter: [
    "filter", "filters",
    "filtre", "filtres",
    "oil filter", "oil filters",
    "filtre a huile", "filtres a huile",
    "filtre huile", "filtres huile",
    "filtro", "filtros",
    "filtro de aceite", "filtros de aceite",
    "filtro de oleo", "filtros de oleo",
    "olfilter", "olfiltere",
    "filtro olio", "filtri olio",
    "フィルター", "オイルフィルター",
    "필터", "오일 필터",
    "фильтр", "фильтры",
    "масляный фильтр", "масляные фильтры",
    "filtreler", "yağ filtresi",
    "filteren", "oliefilter",
    "滤清器", "过滤器", "机油滤清器",
    "फ़िल्टर", "तेल फ़िल्टर",
  ],
};

const VEHICLE_ALIAS_GROUPS: Record<string, string[]> = {
  sedan: [
    "sedan", "sedans",
    "berline", "berlines",
    "sedanes",
    "sedã", "sedãs",
    "limousine",
    "berlina", "berline",
    "セダン",
    "세단",
    "седан", "седаны",
    "sedanlar",
    "轿车", "房车",
    "सेडान",
  ],

  suv: [
    "suv", "suvs",
    "sport utility vehicle",
    "sport utility vehicles",
    "véhicule utilitaire sport",
    "todoterreno", "todoterrenos",
    "utilitário esportivo",
    "geländewagen",
    "fuoristrada",
    "スポーツ用多目的車",
    "에스유브이",
    "внедорожник", "внедорожники",
    "arazi aracı",
    "terreinwagen",
    "运动型多用途车",
    "एसयूवी",
  ],

  truck: [
    "truck", "trucks",
    "camion", "camions",
    "camion", "camiones",
    "caminhao", "caminhoes",
    "lastwagen", "lkw",
    "camioncini",
    "トラック",
    "트럭",
    "грузовик", "грузовики",
    "kamyon", "kamyonlar",
    "vrachtwagen", "vrachtwagens",
    "卡车", "货车",
    "ट्रक",
  ],

  bus: [
    "bus", "buses",
    "autobus",
    "autobús", "autobuses",
    "ônibus", "onibus",
    "busse",
    "バス",
    "버스",
    "автобус", "автобусы",
    "otobüs", "otobüsler",
    "bussen",
    "公交车", "巴士",
    "बस",
  ],
};

const CATEGORY_KEYS: Record<string, string> = {
  tyre: "productCategories.tyre",
  rim: "productCategories.rim",
  battery: "productCategories.battery",
  filter: "productCategories.filter",
};

const VEHICLE_KEYS: Record<string, string> = {
  sedan: "productCategories.sedan",
  suv: "productCategories.suv",
  truck: "productCategories.truck",
  bus: "productCategories.bus",
};

const normalizeBasicText = (value: string): string =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const createAliasMap = (
  groups: Record<string, string[]>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(groups).flatMap(([canonical, aliases]) =>
      aliases.map((alias) => [
        normalizeBasicText(alias),
        canonical,
      ])
    )
  );

const CATEGORY_ALIASES = createAliasMap(CATEGORY_ALIAS_GROUPS);
const VEHICLE_ALIASES = createAliasMap(VEHICLE_ALIAS_GROUPS);

const getCanonicalCategory = (value: string): string => {
  const normalized = normalizeBasicText(value);

  return CATEGORY_ALIASES[normalized] ?? normalized;
};

const getCanonicalVehicle = (value: string): string => {
  const normalized = normalizeBasicText(value);

  return VEHICLE_ALIASES[normalized] ?? normalized;
};

const getCategoryAliases = (value: string): string[] => {
  const canonical = getCanonicalCategory(value);

  return Object.entries(CATEGORY_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
};

const getVehicleAliases = (value: string): string[] => {
  const canonical = getCanonicalVehicle(value);

  return Object.entries(VEHICLE_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
};

const translateProductValue = (
  value: string,
  type: ProductValueType,
  t: TranslateFunction
): string => {
  const canonical =
    type === "category"
      ? getCanonicalCategory(value)
      : getCanonicalVehicle(value);

  const key =
    type === "category"
      ? CATEGORY_KEYS[canonical]
      : VEHICLE_KEYS[canonical];

  return key
    ? t(key, { defaultValue: value })
    : value;
};

const normalizeSearchText = (value: string): string =>
  normalizeBasicText(value);

const matchesSearch = (
  query: string,
  searchableValues: string[]
): boolean => {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return true;

  const queryWords = normalizedQuery
    .split(/\s+/)
    .filter(Boolean);

  const searchableWords = normalizeSearchText(
    searchableValues.join(" ")
  )
    .split(/\s+/)
    .filter(Boolean);

  return queryWords.every((queryWord) =>
    searchableWords.some(
      (searchWord) =>
        searchWord.startsWith(queryWord) ||
        searchWord.includes(queryWord)
    )
  );
};

const SkeletonCard = () => (
  <div className="mr-[30px] flex flex-col rounded-xl bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] max-[480px]:mr-0">
    <div className="mb-[10px] h-40 w-full animate-shimmer rounded-[10px]" />
    <div className="h-[14px] w-4/5 animate-shimmer rounded-md" />
  </div>
);

const SearchResults = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const restoreState = location.state as {
    restoreScrollY?: number;
  } | null;

  const restoreScrollYRef = useRef<number | null>(
    typeof restoreState?.restoreScrollY === "number"
      ? restoreState.restoreScrollY
      : null
  );

  const [items, setItems] = useState<ApiSparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<
    Record<string, boolean>
  >({});

  const params = new URLSearchParams(location.search);

  const keyword = params.get("query");
  const brand = params.get("brand");
  const vehicle = params.get("vehicle");
  const category = params.get("category");

  const handleImageLoad = (id: string) => {
    setLoadedImages((previous) => ({
      ...previous,
      [id]: true,
    }));
  };

  const handleAddToCart = (
    item: ApiSparePart,
    event: MouseEvent<HTMLButtonElement>
  ) => {
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
    const controller = new AbortController();

    setLoading(true);
    setLoadedImages({});

    fetch(`${config.API_BASE_URL}/spareparts/?per_page=1000`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load spare parts");
        }

        return response.json();
      })
      .then((data: SparePartsResponse) => {
        let results = data.items ?? [];

        if (keyword) {
          results = results.filter((item) => {
            const categoryAliases = getCategoryAliases(
              item.category
            );

            const vehicleAliases = getVehicleAliases(
              item.vehicle_type
            );

            const translatedCategory = translateProductValue(
              item.category,
              "category",
              t
            );

            const translatedVehicle = translateProductValue(
              item.vehicle_type,
              "vehicle",
              t
            );

            return matchesSearch(keyword, [
              item.name,
              item.brand,
              item.category,
              item.vehicle_type,
              ...categoryAliases,
              ...vehicleAliases,
              translatedCategory,
              translatedVehicle,
            ]);
          });
        }

        if (brand && vehicle && category) {
          const normalizedBrand = normalizeSearchText(brand);
          const normalizedVehicle = getCanonicalVehicle(vehicle);
          const normalizedCategory = getCanonicalCategory(category);

          results = results.filter(
            (item) =>
              normalizeSearchText(item.brand) === normalizedBrand &&
              getCanonicalVehicle(item.vehicle_type) === normalizedVehicle &&
              getCanonicalCategory(item.category) === normalizedCategory
          );
        }

        if (!controller.signal.aborted) {
          setItems(results);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [keyword, brand, vehicle, category, t]);

  useEffect(() => {
    if (loading || restoreScrollYRef.current === null) {
      return;
    }

    const scrollY = restoreScrollYRef.current;
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

          restoreScrollYRef.current = null;
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

      const handlePendingImage = (): void => {
        remaining -= 1;

        if (remaining <= 0) {
          if (fallbackTimer !== undefined) {
            window.clearTimeout(fallbackTimer);
          }

          restoreScroll();
        }
      };

      pendingImages.forEach((image) => {
        image.addEventListener("load", handlePendingImage, {
          once: true,
        });

        image.addEventListener("error", handlePendingImage, {
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
          image.removeEventListener("load", handlePendingImage);
          image.removeEventListener("error", handlePendingImage);
        });
      };
    }

    return () => {
      cancelled = true;

      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [loading]);

  const getProductHeading = useCallback(
    (item: ApiSparePart): string => {
      const translatedCategory = translateProductValue(
        item.category,
        "category",
        t
      );

      const translatedVehicle = translateProductValue(
        item.vehicle_type,
        "vehicle",
        t
      );

      return [
        item.brand,
        translatedCategory,
        t("common.productFor", {
          defaultValue: "for",
        }),
        translatedVehicle,
      ]
        .filter(Boolean)
        .join(" ");
    },
    [t]
  );

  const translatedBrand = brand ?? "";

  const translatedVehicle = vehicle
    ? translateProductValue(vehicle, "vehicle", t)
    : "";

  const translatedCategory = category
    ? translateProductValue(category, "category", t)
    : "";

  return (
    <div className="mx-auto mt-[100px] max-w-[1200px] p-8 text-[#222]">
      <div className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={handleBackToSearch}
          className="mr-5 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[rgb(0,64,128)] transition hover:bg-gray-100 hover:text-[#004080]"
          aria-label={t("searchResults.backToSearch", {
            defaultValue: "Back to search",
          })}
        >
          <ArrowLeft size={30} />
        </button>

        <h2 className="min-w-0 text-[1.6rem] font-semibold">
          {keyword &&
            t("searchResults.resultsFor", {
              keyword,
              defaultValue: `Results for "${keyword}"`,
            })}

          {brand &&
            vehicle &&
            category &&
            t("searchResults.categoryHeading", {
              brand: translatedBrand,
              vehicle: translatedVehicle,
              category: translatedCategory,
              defaultValue: `Category: ${translatedBrand} ${translatedVehicle} ${translatedCategory}`,
            })}
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[30px] max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] max-[480px]:gap-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-12 text-center text-base text-[#888]">
          {t("searchResults.noItemsFound", {
            defaultValue: "No items found",
          })}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[30px] max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] max-[480px]:gap-5">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/items/${item.id}`}
              onClick={(event) => handleItemClick(event, item.id)}
              className="text-inherit no-underline"
            >
              <div
                className={`mr-[30px] flex flex-col rounded-xl bg-white p-3 text-[#222] shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)] max-[480px]:mr-0 ${
                  loadedImages[item.id] ? "" : "pointer-events-none"
                }`}
              >
                <img
                  className="mb-[10px] h-auto w-[70%] rounded-[10px] object-cover"
                  src={item.image || item.image_url}
                  alt={t("searchResults.productImageAlt", {
                    brand: item.brand,
                    defaultValue: `${item.brand} product image`,
                  })}
                  onLoad={() => handleImageLoad(item.id)}
                  onError={() => handleImageLoad(item.id)}
                />

                <h4 className="my-[5px] text-center text-[0.95rem] font-semibold">
                  {getProductHeading(item)}
                </h4>

                <p className="mb-[6px] font-semibold text-[rgb(255,0,0)]">
                  KES {Number(item.buying_price).toLocaleString()}
                  {item.discount_percentage > 0 && (
                    <span className="ml-[5px] text-sm text-[#e41a139b]">
                      (
                      {t("searchResults.discount", {
                        percentage: item.discount_percentage.toFixed(0),
                        defaultValue: `-${item.discount_percentage.toFixed(0)}%`,
                      })}
                      )
                    </span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={(event) => handleAddToCart(item, event)}
                  className="mt-auto cursor-pointer rounded-md bg-[rgb(0,64,128)] px-3 py-2 font-semibold text-white transition-colors duration-200 hover:bg-[rgb(4,37,71)]"
                >
                  {t("common.addToCart", {
                    defaultValue: "Add To Cart",
                  })}
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
