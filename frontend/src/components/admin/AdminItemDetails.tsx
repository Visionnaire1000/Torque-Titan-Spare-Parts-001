import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { RefreshCw, ArrowLeft, Star, ThumbsDown, ThumbsUp, LoaderCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import config from "../../config";

interface ErrorStateProps {
  onRetry: () => void;
}

interface StarRatingProps {
  value?: number;
  size?: number;
  readonly?: boolean;
}

interface SkeletonProps {
  width: string | number;
  height: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
}

interface ReviewLike {
  id: string;
  user_id: string;
  is_like: boolean;
}

interface Review {
  id: string;
  user_id: string;
  rating: number | null;
  comment: string | null;
  comment_language?: string | null;
  translated_comment?: string | null;
  translation_pending?: boolean;
  created_at: string;
  likes?: ReviewLike[];
  total_likes: number;
  total_dislikes: number;
  user_display_name: string;
  user_email: string;
}

interface ReviewTranslation {
  translatedComment: string;
  targetLanguage: string;
  loading: boolean;
  showingOriginal: boolean;
}

interface TranslationResponse {
  original_comment?: string;
  translated_comment?: string | null;
  translation_pending?: boolean;
  target_language?: string;
  error?: string;
  detail?: string;
}

interface SparePart {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  image: string;
  description: string;
  translated_description?: string | null;
  translation_pending?: boolean;
  buying_price: number;
  average_rating: number;
  discount_percentage: number;
}

interface RestoreState {
  from?: string;
  restoreFilters?: {
    brand?: string;
    price?: string;
    currentPage?: number;
  };
  restoreScrollY?: number;
  expandedOrderId?: string | null;
  orderSearch?: string;
}

type SavedItemPosition = RestoreState;

const TRANSLATION_POLL_INTERVAL = 2000;
const MAX_TRANSLATION_ATTEMPTS = 30;

const normalizeLanguage = (language?: string | null): string => {
  return (language || "en")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")[0];
};

const normalizeProductTerm = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

const PRODUCT_TERM_ALIASES: Array<[string, string]> = [
  // Tyres
  ["tyre", "tyre"],
  ["tyres", "tyre"],
  ["tire", "tyre"],
  ["tires", "tyre"],
  ["pneu", "tyre"],
  ["pneus", "tyre"],
  ["neumatico", "tyre"],
  ["neumaticos", "tyre"],
  ["reifen", "tyre"],
  ["pneumatico", "tyre"],
  ["pneumatici", "tyre"],
  ["lastik", "tyre"],
  ["lastikler", "tyre"],
  ["band", "tyre"],
  ["banden", "tyre"],
  ["タイヤ", "tyre"],
  ["타이어", "tyre"],
  ["шина", "tyre"],
  ["шины", "tyre"],
  ["轮胎", "tyre"],
  ["टायर", "tyre"],

  // Rims
  ["rim", "rim"],
  ["rims", "rim"],
  ["jante", "rim"],
  ["jantes", "rim"],
  ["llanta", "rim"],
  ["llantas", "rim"],
  ["aro", "rim"],
  ["aros", "rim"],
  ["roda", "rim"],
  ["rodas", "rim"],
  ["felge", "rim"],
  ["felgen", "rim"],
  ["cerchio", "rim"],
  ["cerchi", "rim"],
  ["jant", "rim"],
  ["jantlar", "rim"],
  ["velg", "rim"],
  ["velgen", "rim"],
  ["ホイール", "rim"],
  ["リム", "rim"],
  ["휠", "rim"],
  ["림", "rim"],
  ["диск", "rim"],
  ["диски", "rim"],
  ["轮毂", "rim"],
  ["轮圈", "rim"],
  ["पहिया", "rim"],
  ["रिम", "rim"],

  // Batteries
  ["battery", "battery"],
  ["batteries", "battery"],
  ["batterie", "battery"],
  ["bateria", "battery"],
  ["baterias", "battery"],
  ["akku", "battery"],
  ["batteria", "battery"],
  ["batterie", "battery"],
  ["aku", "battery"],
  ["accu", "battery"],
  ["バッテリー", "battery"],
  ["배터리", "battery"],
  ["аккумулятор", "battery"],
  ["аккумуляторы", "battery"],
  ["电池", "battery"],
  ["बैटरी", "battery"],

  // Oil filters
  ["filter", "filter"],
  ["filters", "filter"],
  ["oil filter", "filter"],
  ["oil filters", "filter"],
  ["filtre a huile", "filter"],
  ["filtres a huile", "filter"],
  ["filtro de aceite", "filter"],
  ["filtros de aceite", "filter"],
  ["filtro de oleo", "filter"],
  ["filtros de oleo", "filter"],
  ["olfilter", "filter"],
  ["ol filter", "filter"],
  ["filtro olio", "filter"],
  ["filtro dell olio", "filter"],
  ["yag filtresi", "filter"],
  ["oliefilter", "filter"],
  ["オイルフィルター", "filter"],
  ["오일 필터", "filter"],
  ["오일필터", "filter"],
  ["масляный фильтр", "filter"],
  ["масляные фильтры", "filter"],
  ["机油滤清器", "filter"],
  ["机油滤芯", "filter"],
  ["ऑयल फिल्टर", "filter"],
  ["तेल फ़िल्टर", "filter"],

  // Sedan
  ["sedan", "sedan"],
  ["sedans", "sedan"],
  ["saloon", "sedan"],
  ["berline", "sedan"],
  ["berlines", "sedan"],
  ["sedanes", "sedan"],
  ["seda", "sedan"],
  ["limousine", "sedan"],
  ["limousinen", "sedan"],
  ["berlina", "sedan"],
  ["セダン", "sedan"],
  ["세단", "sedan"],
  ["седан", "sedan"],
  ["轿车", "sedan"],
  ["सेडान", "sedan"],

  // SUV
  ["suv", "suv"],
  ["suvs", "suv"],
  ["vehicule utilitaire sport", "suv"],
  ["todoterreno", "suv"],
  ["vehiculo todoterreno", "suv"],
  ["utilitario esportivo", "suv"],
  ["gelandewagen", "suv"],
  ["fuoristrada", "suv"],
  ["スポーツユーティリティビークル", "suv"],
  ["스포츠 유틸리티 차량", "suv"],
  ["внедорожник", "suv"],
  ["внедорожники", "suv"],
  ["arazi araci", "suv"],
  ["terreinwagen", "suv"],
  ["越野车", "suv"],
  ["运动型多用途汽车", "suv"],
  ["एसयूवी", "suv"],

  // Trucks
  ["truck", "truck"],
  ["trucks", "truck"],
  ["lorry", "truck"],
  ["lorries", "truck"],
  ["camion", "truck"],
  ["camions", "truck"],
  ["camion", "truck"],
  ["camiones", "truck"],
  ["caminhao", "truck"],
  ["caminhoes", "truck"],
  ["lastwagen", "truck"],
  ["lkw", "truck"],
  ["トラック", "truck"],
  ["트럭", "truck"],
  ["грузовик", "truck"],
  ["грузовики", "truck"],
  ["kamyon", "truck"],
  ["kamyonlar", "truck"],
  ["vrachtwagen", "truck"],
  ["vrachtwagens", "truck"],
  ["卡车", "truck"],
  ["货车", "truck"],
  ["ट्रक", "truck"],

  // Buses
  ["bus", "bus"],
  ["buses", "bus"],
  ["autobus", "bus"],
  ["autobuses", "bus"],
  ["onibus", "bus"],
  ["bussen", "bus"],
  ["バス", "bus"],
  ["버스", "bus"],
  ["автобус", "bus"],
  ["автобусы", "bus"],
  ["otobus", "bus"],
  ["公交车", "bus"],
  ["公共汽车", "bus"],
  ["बस", "bus"],
];

const PRODUCT_TERM_MAP = new Map<string, string>(
  PRODUCT_TERM_ALIASES.map(([alias, canonical]) => [
    normalizeProductTerm(alias),
    canonical,
  ]),
);

const ErrorState = ({ onRetry }: ErrorStateProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-3xl font-bold text-red-600">
        {t("common.somethingWentWrong")}
      </h2>

      <p className="max-w-md text-gray-600">
        {t("itemDetails.loadError")}
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-md bg-[rgb(0,64,128)] px-5 py-3 font-medium text-white transition-colors hover:bg-[rgb(17,49,82)]"
      >
        <RefreshCw size={18} />
        {t("common.retry")}
      </button>
    </div>
  );
};

const StarRating = ({
  value = 0,
  size = 22,
}: StarRatingProps) => {
  const roundedValue = Math.round(value * 2) / 2;

  return (
    <div className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map((star) => {
        let fillPercent = 0;

        if (roundedValue >= star) {
          fillPercent = 100;
        } else if (roundedValue + 0.5 === star) {
          fillPercent = 50;
        }

        return (
          <div
            key={star}
            className="relative"
            style={{ width: size, height: size }}
          >
            <Star size={size} fill="#ddd" stroke="#ddd" />

            <div
              className="absolute left-0 top-0 overflow-hidden"
              style={{ width: `${fillPercent}%` }}
            >
              <Star size={size} fill="#FFD700" stroke="#FFD700" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const getProfileInitials = (displayName: string): string => {
  const name = displayName.trim();

  if (!name) return "U";

  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
};

const getProfileColor = (displayName: string): string => {
  const initial = getProfileInitials(displayName).charAt(0);

  const colors: Record<string, string> = {
    A: "bg-red-500",
    B: "bg-orange-500",
    C: "bg-amber-500",
    D: "bg-yellow-500",
    E: "bg-lime-500",
    F: "bg-green-500",
    G: "bg-emerald-500",
    H: "bg-teal-500",
    I: "bg-cyan-500",
    J: "bg-sky-500",
    K: "bg-blue-500",
    L: "bg-indigo-500",
    M: "bg-violet-500",
    N: "bg-purple-500",
    O: "bg-fuchsia-500",
    P: "bg-pink-500",
    Q: "bg-rose-500",
    R: "bg-red-600",
    S: "bg-orange-600",
    T: "bg-yellow-600",
    U: "bg-green-600",
    V: "bg-teal-600",
    W: "bg-cyan-600",
    X: "bg-blue-600",
    Y: "bg-indigo-600",
    Z: "bg-purple-600",
  };

  return colors[initial] ?? "bg-gray-500";
};

const ProfileCircle = ({
  displayName,
}: {
  displayName: string;
}) => (
  <div
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${getProfileColor(displayName)}`}
    aria-label={`${displayName} profile`}
  >
    {getProfileInitials(displayName)}
  </div>
);

const Skeleton = ({
  width,
  height,
  borderRadius = 4,
  style,
}: SkeletonProps) => (
  <div
    className="skeleton shimmer"
    style={{ width, height, borderRadius, ...style }}
  />
);

const ItemDetailsSkeleton = () => (
  <div className="mx-auto mb-[60px] mt-[70px] max-w-[900px] rounded-[10px] bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)] max-[480px]:mb-[30px] max-[480px]:mt-[90px]">
    <div className="mb-8 flex flex-wrap gap-8">
      <Skeleton width="200px" height="200px" borderRadius={8} />

      <div className="flex flex-1 flex-col">
        <Skeleton width="60%" height="28px" />
        <Skeleton width="40%" height="24px" style={{ marginTop: 8 }} />
        <Skeleton width="90%" height="16px" style={{ marginTop: 8 }} />

        <div className="mt-2 flex gap-[5px]">
          {[...Array(5)].map((_, i) => (
            <Skeleton
              key={i}
              width="22px"
              height="22px"
              borderRadius={50}
            />
          ))}
        </div>
      </div>
    </div>

    {[...Array(3)].map((_, i) => (
      <div
        key={i}
        className="mb-3 rounded-md border border-gray-300 bg-[#fafafa] p-3"
      >
        <div className="flex items-center gap-3">
          <Skeleton width="40px" height="40px" borderRadius={50} />

          <div className="flex-1">
            <Skeleton width="140px" height="16px" />
            <Skeleton width="180px" height="14px" style={{ marginTop: 4 }} />
            <Skeleton width="80px" height="13px" style={{ marginTop: 4 }} />
          </div>
        </div>

        <Skeleton width="90%" height="14px" style={{ marginTop: 12 }} />

        <div className="mt-3 flex gap-3">
          <Skeleton width="55px" height="28px" borderRadius={4} />
          <Skeleton width="55px" height="28px" borderRadius={4} />
        </div>
      </div>
    ))}
  </div>
);

const EmptyReviews = () => {
  const { t } = useTranslation();

  return (
    <p className="text-gray-500">
      {t("itemDetails.noComments")}
    </p>
  );
};

const AdminItemDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, authFetch } = useAuth();

  const activeLanguage = normalizeLanguage(
    i18n.resolvedLanguage || i18n.language || "en",
  );

  const currentUserId =
    user?.id != null ? String(user.id) : null;

  const [item, setItem] = useState<SparePart | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const [reviewTranslations, setReviewTranslations] = useState<
    Record<string, ReviewTranslation>
  >({});

  const requestIdRef = useRef(0);
  const translationRequestIds = useRef<Record<string, number>>({});
  const translationPollCountRef = useRef(0);

  const translateProductTerm = useCallback(
    (value?: string | null): string => {
      if (!value?.trim()) return "";

      const normalized = normalizeProductTerm(value);
      const key = PRODUCT_TERM_MAP.get(normalized) ?? normalized;
      const translationKey = `productCategories.${key}`;
      const translated = t(translationKey);

      return translated === translationKey ? value : translated;
    },
    [t],
  );

  const fetchItemAndReviews = useCallback(
    async (showLoading = true): Promise<void> => {
      if (!id) {
        setLoading(false);
        setItem(null);
        setReviews([]);
        return;
      }

      const requestId = ++requestIdRef.current;

      if (showLoading) {
        setLoading(true);
        translationPollCountRef.current = 0;
        setReviewTranslations({});
        translationRequestIds.current = {};
      }

      setError(false);

      try {
        const query = new URLSearchParams({
          lang: activeLanguage,
        });

        const [itemRes, reviewsRes] = await Promise.all([
          authFetch(
            `${config.API_BASE_URL}/spareparts/${id}/?${query.toString()}`,
          ),
          authFetch(
            `${config.API_BASE_URL}/admin/reviews/sparepart/${id}/?${query.toString()}`,
          ),
        ]);

        if (!itemRes.ok) {
          throw new Error(t("itemDetails.loadError"));
        }

        const itemData: SparePart = await itemRes.json();

        const reviewData: Review[] = reviewsRes.ok
          ? await reviewsRes.json()
          : [];

        if (requestId !== requestIdRef.current) return;

        const normalizedItem: SparePart = {
          ...itemData,
          id: String(itemData.id),
          buying_price: Number(itemData.buying_price ?? 0),
          average_rating: Number(itemData.average_rating ?? 0),
          discount_percentage: Number(
            itemData.discount_percentage ?? 0,
          ),
          description: itemData.description ?? "",
          translated_description:
            itemData.translated_description?.trim() || "",
          translation_pending: Boolean(itemData.translation_pending),
        };

        const normalizedReviews: Review[] = reviewData.map((review) => ({
          ...review,
          id: String(review.id),
          user_id: String(review.user_id),
          rating:
            review.rating === null ? null : Number(review.rating),
          total_likes: Number(review.total_likes ?? 0),
          total_dislikes: Number(review.total_dislikes ?? 0),
          user_display_name:
            review.user_display_name?.trim() || t("itemDetails.user"),
          user_email: review.user_email?.trim() || "",
          comment: review.comment?.trim() || "",
          comment_language: review.comment_language || "en",
        }));

        setItem(normalizedItem);
        setReviews(normalizedReviews);

        const reviewIds = new Set(
          normalizedReviews.map((review) => String(review.id)),
        );

        setReviewTranslations((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(([reviewId]) =>
              reviewIds.has(reviewId),
            ),
          ),
        );
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;

        console.error(err);
        setError(true);

        toast.error(
          err instanceof Error
            ? err.message
            : t("itemDetails.loadError"),
        );
      } finally {
        if (requestId === requestIdRef.current && showLoading) {
          setLoading(false);
        }
      }
    },
    [id, activeLanguage, authFetch, t],
  );

  useEffect(() => {
    void fetchItemAndReviews(true);

    return () => {
      requestIdRef.current += 1;

      Object.keys(translationRequestIds.current).forEach(
        (reviewId) => {
          translationRequestIds.current[reviewId] += 1;
        },
      );
    };
  }, [fetchItemAndReviews]);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [id]);

  useEffect(() => {
    if (loading || error || !id) return;

    if (!item?.translation_pending) {
      translationPollCountRef.current = 0;
      return;
    }

    if (
      translationPollCountRef.current >= MAX_TRANSLATION_ATTEMPTS
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      translationPollCountRef.current += 1;
      void fetchItemAndReviews(false);
    }, TRANSLATION_POLL_INTERVAL);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    loading,
    error,
    id,
    item?.translation_pending,
    fetchItemAndReviews,
  ]);

  const translateReview = async (review: Review): Promise<void> => {
    const reviewId = String(review.id);
    const originalComment = review.comment?.trim();

    if (!originalComment) return;

    const targetLanguage = activeLanguage;
    const sourceLanguage = normalizeLanguage(review.comment_language);

    if (sourceLanguage === targetLanguage) {
      toast.info(t("itemDetails.sameLanguage"));
      return;
    }

    const existingTranslation = reviewTranslations[reviewId];

    if (
      existingTranslation?.translatedComment &&
      existingTranslation.targetLanguage === targetLanguage
    ) {
      setReviewTranslations((previous) => ({
        ...previous,
        [reviewId]: {
          ...previous[reviewId],
          showingOriginal: !previous[reviewId].showingOriginal,
        },
      }));

      return;
    }

    const requestId =
      (translationRequestIds.current[reviewId] ?? 0) + 1;

    translationRequestIds.current[reviewId] = requestId;

    setReviewTranslations((previous) => ({
      ...previous,
      [reviewId]: {
        translatedComment: "",
        targetLanguage,
        loading: true,
        showingOriginal: false,
      },
    }));

    try {
      const requestTranslation =
        async (): Promise<TranslationResponse> => {
          const response = await authFetch(
            `${config.API_BASE_URL}/reviews/${reviewId}/translate/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                target_language: targetLanguage,
              }),
            },
          );

          const data: TranslationResponse = await response
            .json()
            .catch(() => ({}));

          if (!response.ok && response.status !== 202) {
            throw new Error(
              data.error ||
                data.detail ||
                t("itemDetails.translationFailed"),
            );
          }

          return data;
        };

      let data = await requestTranslation();

      for (
        let attempt = 0;
        data.translation_pending && attempt < MAX_TRANSLATION_ATTEMPTS;
        attempt++
      ) {
        if (
          translationRequestIds.current[reviewId] !== requestId
        ) {
          return;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, TRANSLATION_POLL_INTERVAL);
        });

        if (
          translationRequestIds.current[reviewId] !== requestId
        ) {
          return;
        }

        data = await requestTranslation();
      }

      if (
        translationRequestIds.current[reviewId] !== requestId
      ) {
        return;
      }

      const translatedComment = data.translated_comment?.trim();

      if (data.translation_pending || !translatedComment) {
        throw new Error(t("itemDetails.translationTimeout"));
      }

      setReviewTranslations((previous) => ({
        ...previous,
        [reviewId]: {
          translatedComment,
          targetLanguage: normalizeLanguage(
            data.target_language || targetLanguage,
          ),
          loading: false,
          showingOriginal: false,
        },
      }));
    } catch (err: unknown) {
      if (
        translationRequestIds.current[reviewId] !== requestId
      ) {
        return;
      }

      setReviewTranslations((previous) => {
        const updated = { ...previous };
        delete updated[reviewId];
        return updated;
      });

      toast.error(
        err instanceof Error
          ? err.message
          : t("itemDetails.translationFailed"),
      );
    }
  };

  const handleBack = (): void => {
    const state = location.state as RestoreState | null;

    if (state?.from) {
      navigate(state.from, {
        state: {
          restoreFilters: state.restoreFilters,
          restoreScrollY: state.restoreScrollY,
          expandedOrderId: state.expandedOrderId,
          orderSearch: state.orderSearch,
        },
      });
      return;
    }

    if (id) {
      const savedPosition = sessionStorage.getItem(
        `titan_item_restore_${id}`,
      );

      if (savedPosition) {
        try {
          const parsed = JSON.parse(
            savedPosition,
          ) as SavedItemPosition;

          if (parsed.from) {
            navigate(parsed.from, {
              state: {
                restoreFilters: parsed.restoreFilters,
                restoreScrollY: parsed.restoreScrollY,
                expandedOrderId: parsed.expandedOrderId,
                orderSearch: parsed.orderSearch,
              },
            });
            return;
          }
        } catch (err) {
          console.error(
            "Failed to restore saved item position:",
            err,
          );
        }
      }
    }

    if (location.key !== "default") {
      navigate(-1);
      return;
    }

    navigate("/spareparts");
  };

  if (loading) {
    return <ItemDetailsSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        onRetry={() => void fetchItemAndReviews(true)}
      />
    );
  }

  if (!item) {
    return (
      <div className="mx-auto mb-[60px] mt-[70px] max-w-[900px] rounded-[10px] bg-[#fefefe] p-4 text-center text-[#333] shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
        {t("itemDetails.itemNotFound")}
      </div>
    );
  }

  const averageRating = Number(item.average_rating ?? 0);

  const ratingCount = reviews.filter(
    (review) => review.rating !== null,
  ).length;

  const commentReviews = reviews.filter((review) =>
    Boolean(review.comment?.trim()),
  );

  const description =
    item.translated_description?.trim() ||
    item.description ||
    "";

  return (
    <div className="mx-auto mb-[60px] mt-[70px] max-w-[900px] rounded-[10px] bg-[#fefefe] p-4 text-[#333] shadow-[0_4px_15px_rgba(0,0,0,0.05)] max-[480px]:mb-[30px] max-[480px]:mt-[90px]">
      <button
        type="button"
        onClick={handleBack}
        aria-label={t("itemDetails.goBack")}
        className="mb-4 inline-flex items-center justify-start rounded-md p-2 text-[rgb(0,64,128)] transition-colors hover:bg-[#eaf2f8]"
      >
        <ArrowLeft size={30} />
      </button>

      <div className="mb-8 flex flex-wrap gap-8 max-[480px]:mb-[50px] max-[480px]:mt-[10px]">
        <img
          src={item.image}
          alt={`${item.brand} ${translateProductTerm(item.category)}`}
          className="mt-10 h-[30%] w-[30%] rounded-lg object-cover max-[480px]:mt-[10px] max-[480px]:w-[40%]"
        />

        <div className="flex flex-1 flex-col justify-between max-[480px]:mt-[10px]">
          <h2 className="mb-2 mt-20 text-3xl font-bold text-[rgb(0,64,128)] max-[480px]:mt-1 max-[480px]:text-xl">
            {item.brand} {translateProductTerm(item.category)}{" "}
            {t("common.productFor")}{" "}
            {translateProductTerm(item.vehicle_type)}
          </h2>

          <p className="mb-2 text-lg font-semibold text-red-600">
            KES {Number(item.buying_price).toLocaleString()}
            {item.discount_percentage > 0 && (
              <span className="ml-[5px] text-sm text-[#e41a139b]">
                (-{item.discount_percentage.toFixed(0)}%)
              </span>
            )}
          </p>

          <p className="font-normal text-black">
            {description}

            {item.translation_pending && (
              <span className="ml-2 text-xs text-gray-500">
                {t("itemDetails.translating")}
              </span>
            )}
          </p>

          <div className="mt-2 flex items-center gap-[5px]">
            <StarRating value={averageRating} readonly size={22} />

            <span className="text-sm text-gray-700">
              {averageRating.toFixed(1)} ({ratingCount})
            </span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="mb-4 text-2xl font-semibold">
          {t("itemDetails.commentsCount", {
            count: commentReviews.length,
          })}
        </h3>

        {commentReviews.length === 0 ? (
          <EmptyReviews />
        ) : (
          commentReviews.map((review) => {
            const displayName =
              review.user_display_name?.trim() ||
              t("itemDetails.user");

            const isOwnReview =
              currentUserId !== null &&
              String(review.user_id) === currentUserId;

            const reviewId = String(review.id);
            const translation = reviewTranslations[reviewId];

            const hasTranslation =
              Boolean(translation?.translatedComment) &&
              translation?.targetLanguage === activeLanguage;

            const showingOriginal =
              !hasTranslation || Boolean(translation?.showingOriginal);

            const comment = showingOriginal
              ? review.comment || ""
              : translation?.translatedComment ||
                review.comment ||
                "";

            const sourceLanguage = normalizeLanguage(
              review.comment_language,
            );

            const canTranslate =
              sourceLanguage !== activeLanguage;

            const buttonLabel = translation?.loading
              ? t("itemDetails.translating")
              : hasTranslation && !showingOriginal
                ? t("itemDetails.seeOriginal")
                : hasTranslation && showingOriginal
                  ? t("itemDetails.showTranslation")
                  : t("itemDetails.translate");

            return (
              <div
                key={review.id}
                className="mb-3 rounded-xl border border-gray-200 bg-[#fafafa] p-4 transition-colors hover:border-gray-300"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileCircle displayName={displayName} />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[rgb(0,64,128)]">
                          {isOwnReview
                            ? t("itemDetails.you")
                            : displayName}
                        </span>

                        {isOwnReview && (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            {t("itemDetails.you")}
                          </span>
                        )}
                      </div>

                      <span className="block break-all text-sm text-gray-600">
                        {review.user_email}
                      </span>

                      <span className="block text-xs text-gray-500">
                        {review.created_at
                          ? new Date(
                              review.created_at,
                            ).toLocaleDateString(activeLanguage)
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-3 ml-[52px] max-[480px]:ml-0">
                  <p className="whitespace-pre-wrap break-words leading-7 text-gray-800">
                    {comment}
                  </p>

                  {canTranslate && (
                    <button
                      type="button"
                      disabled={translation?.loading}
                      onClick={() => void translateReview(review)}
                      className={`
                        mt-3 inline-flex min-h-[34px] cursor-pointer
                        items-center gap-2 rounded-full border px-3.5
                        py-1.5 text-xs font-semibold transition-all duration-200
                        focus-visible:outline-none focus-visible:ring-2
                        focus-visible:ring-[rgb(0,64,128)]
                        focus-visible:ring-offset-2
                        disabled:cursor-wait disabled:opacity-70
                        ${
                          translation?.loading
                            ? "border-gray-200 bg-gray-100 text-gray-500"
                            : hasTranslation && !showingOriginal
                              ? "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-100"
                              : "border-blue-200 bg-blue-50 text-[rgb(0,64,128)] hover:border-blue-400 hover:bg-blue-100"
                        }
                      `}
                    >
                      {translation?.loading ? (
                        <>
                          <LoaderCircle
                            size={14}
                            className="animate-spin"
                          />
                          <span>{buttonLabel}</span>
                        </>
                      ) : (
                        <span>{buttonLabel}</span>
                      )}
                    </button>
                  )}
                </div>

                <div className="ml-[52px] flex flex-wrap gap-2 max-[480px]:ml-0">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">
                    <ThumbsUp size={15} />
                    {review.total_likes}
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">
                    <ThumbsDown size={15} />
                    {review.total_dislikes}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminItemDetails;