import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { RefreshCw, ArrowLeft, Star, ThumbsDown, ThumbsUp, LoaderCircle } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
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

interface Review {
  id: string;
  user_id: string;
  rating: number | null;
  comment: string | null;
  translated_comment?: string | null;
  comment_language?: string;
  translation_pending?: boolean;
  created_at: string;
  total_likes: number;
  total_dislikes: number;
  user_display_name: string;
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
  restoreFilters?: Record<string, string | number>;
  restoreScrollY?: number;
}

interface ReviewTranslationState {
  translatedComment: string | null;
  targetLanguage: string;
  loading: boolean;
  showingOriginal: boolean;
}

interface ReviewTranslationResponse {
  translated_comment?: string | null;
  translation_pending?: boolean;
  target_language?: string;
  error?: string;
  detail?: string;
}

type SavedItemPosition = RestoreState;

const TRANSLATION_POLL_INTERVAL = 2000;
const MAX_TRANSLATION_POLLS = 30;

const SUPPORTED_COMMENT_LANGUAGES = [
  "en",
  "fr",
  "zh",
  "hi",
  "es",
  "pt",
  "de",
  "it",
  "ja",
  "ko",
  "ru",
  "tr",
  "nl",
] as const;

type SupportedCommentLanguage =
  (typeof SUPPORTED_COMMENT_LANGUAGES)[number];

const normalizeLanguage = (language?: string | null): string =>
  (language || "en")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")[0];

const normalizeCommentLanguage = (
  language?: string | null,
): SupportedCommentLanguage => {
  const normalized = normalizeLanguage(language);

  return SUPPORTED_COMMENT_LANGUAGES.includes(
    normalized as SupportedCommentLanguage,
  )
    ? (normalized as SupportedCommentLanguage)
    : "en";
};

const isSupportedLanguage = (
  language?: string | null,
): boolean => {
  if (!language) return false;

  return SUPPORTED_COMMENT_LANGUAGES.includes(
    normalizeLanguage(language) as SupportedCommentLanguage,
  );
};

/* -------------------------------- Error -------------------------------- */

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

/* -------------------------------- Stars -------------------------------- */

const StarRating = ({ value = 0, size = 22 }: StarRatingProps) => {
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

/* ----------------------------- Profile Circle ------------------------- */

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

const ProfileCircle = ({ displayName }: { displayName: string }) => (
  <div
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${getProfileColor(displayName)}`}
    aria-label={`${displayName} profile`}
  >
    {getProfileInitials(displayName)}
  </div>
);

/* -------------------------------- Skeleton -------------------------------- */

const Skeleton = ({
  width,
  height,
  borderRadius = 4,
  style,
}: SkeletonProps) => (
  <div
    className="relative overflow-hidden bg-gray-200 shimmer"
    style={{ width, height, borderRadius, ...style }}
  />
);

const ItemDetailsSkeleton = () => (
  <div className="mx-auto mt-[70px] mb-[60px] max-w-[900px] rounded-[10px] bg-white p-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)] max-[480px]:mt-[90px] max-[480px]:mb-[30px]">
    <div className="mb-8 flex flex-wrap gap-8">
      <Skeleton width="200px" height="200px" borderRadius={8} />

      <div className="flex flex-1 flex-col">
        <Skeleton width="60%" height="28px" />
        <Skeleton width="40%" height="24px" style={{ marginTop: 8 }} />
        <Skeleton width="90%" height="16px" style={{ marginTop: 8 }} />

        <div className="mt-2 flex gap-[5px]">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} width="22px" height="22px" borderRadius={50} />
          ))}
        </div>
      </div>
    </div>

    <div className="mb-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="mb-3 rounded-md border border-gray-300 bg-[#fafafa] p-3">
          <div className="flex items-center gap-3">
            <Skeleton width="40px" height="40px" borderRadius={999} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton width="120px" height="16px" />
              <Skeleton width="80px" height="14px" />
            </div>
          </div>

          <Skeleton width="90%" height="14px" style={{ marginTop: 12 }} />

          <div className="mt-3 flex gap-[5px]">
            <Skeleton width="60px" height="30px" borderRadius={6} />
            <Skeleton width="60px" height="30px" borderRadius={6} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* -------------------------------- Component -------------------------------- */

const LoggedOutItemDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const activeLanguage = normalizeLanguage(
    i18n.resolvedLanguage || i18n.language || "en",
  );

  const [item, setItem] = useState<SparePart | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [reviewTranslations, setReviewTranslations] = useState<
    Record<string, ReviewTranslationState>
  >({});

  const requestIdRef = useRef(0);
  const translationPollCountRef = useRef(0);
  const reviewTranslationRequestsRef = useRef<Record<string, number>>({});

  const translateProductTerm = useCallback(
    (value?: string | null): string => {
      if (!value?.trim()) return "";

      const normalized = value.trim().toLowerCase().replace(/[-_]+/g, " ");

      const aliases: Record<string, string> = {
        tyres: "tyre",
        tires: "tyre",
        tire: "tyre",
        rims: "rim",
        batteries: "battery",
        filters: "filter",
        "oil filter": "filter",
        "oil filters": "filter",
        saloon: "sedan",
        lorry: "truck",
      };

      const key = aliases[normalized] ?? normalized;
      const translationKey = `productCategories.${key}`;
      const translated = t(translationKey);

      return translated === translationKey ? value : translated;
    },
    [t],
  );

  const handleBack = (): void => {
    if (id) {
      const savedPosition = sessionStorage.getItem(
        `titan_item_restore_${id}`,
      );

      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition) as SavedItemPosition;

          if (parsed.from) {
            navigate(parsed.from, {
              state: {
                restoreFilters: parsed.restoreFilters,
                restoreScrollY: parsed.restoreScrollY,
              },
            });
            return;
          }
        } catch (err) {
          console.error("Failed to restore saved listing position:", err);
        }
      }
    }

    const state = location.state as RestoreState | null;

    if (state?.from) {
      navigate(state.from, {
        state: {
          restoreFilters: state.restoreFilters,
          restoreScrollY: state.restoreScrollY,
        },
      });
      return;
    }

    if (location.key !== "default") {
      navigate(-1);
      return;
    }

    navigate("/spareparts");
  };

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
      }

      setError(false);

      try {
        const query = new URLSearchParams({
          lang: activeLanguage,
        });

        const [itemRes, reviewsRes] = await Promise.all([
          fetch(`${config.API_BASE_URL}/spareparts/${id}/?${query.toString()}`),
          fetch(`${config.API_BASE_URL}/reviews/${id}/?${query.toString()}`),
        ]);

        if (!itemRes.ok || !reviewsRes.ok) {
          throw new Error(t("itemDetails.loadError"));
        }

        const itemData: SparePart = await itemRes.json();
        const reviewData: Review[] = await reviewsRes.json();

        if (requestId !== requestIdRef.current) return;

        const normalizedItem: SparePart = {
          ...itemData,
          id: String(itemData.id),
          buying_price: Number(itemData.buying_price ?? 0),
          average_rating: Number(itemData.average_rating ?? 0),
          discount_percentage: Number(itemData.discount_percentage ?? 0),
          description: itemData.description ?? "",
          translated_description: itemData.translated_description?.trim() || "",
          translation_pending: Boolean(itemData.translation_pending),
        };

        const normalizedReviews: Review[] = reviewData.map((review) => ({
          ...review,
          id: String(review.id),
          user_id: String(review.user_id),
          rating: review.rating === null ? null : Number(review.rating),
          total_likes: Number(review.total_likes ?? 0),
          total_dislikes: Number(review.total_dislikes ?? 0),
          user_display_name:
            review.user_display_name?.trim() || t("itemDetails.user"),
          comment: review.comment?.trim() || "",
          translated_comment: review.translated_comment?.trim() || "",
          translation_pending: Boolean(review.translation_pending),
        }));

        setItem(normalizedItem);
        setReviews(normalizedReviews);

        const reviewIds = new Set(normalizedReviews.map((review) => review.id));

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
      } finally {
        if (requestId === requestIdRef.current && showLoading) {
          setLoading(false);
        }
      }
    },
    [id, activeLanguage, t],
  );

  useEffect(() => {
    void fetchItemAndReviews(true);

    return () => {
      requestIdRef.current += 1;

      Object.keys(reviewTranslationRequestsRef.current).forEach((reviewId) => {
        reviewTranslationRequestsRef.current[reviewId] += 1;
      });
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

    const translationPending =
      Boolean(item?.translation_pending) ||
      reviews.some((review) => review.translation_pending);

    if (!translationPending) {
      translationPollCountRef.current = 0;
      return;
    }

    if (translationPollCountRef.current >= MAX_TRANSLATION_POLLS) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      translationPollCountRef.current += 1;
      void fetchItemAndReviews(false);
    }, TRANSLATION_POLL_INTERVAL);

    return () => window.clearTimeout(timeoutId);
  }, [
    loading,
    error,
    id,
    item?.translation_pending,
    reviews,
    fetchItemAndReviews,
  ]);

  const translateReview = async (review: Review): Promise<void> => {
    const reviewId = String(review.id);
    const originalComment = review.comment?.trim();

    if (!originalComment) return;

    const targetLanguage = activeLanguage;
    const sourceLanguage = normalizeCommentLanguage(
      review.comment_language,
    );

    const existingTranslation = reviewTranslations[reviewId];
    const apiTranslation = review.translated_comment?.trim();

    const cachedTranslation =
      existingTranslation?.targetLanguage === targetLanguage
        ? existingTranslation.translatedComment
        : apiTranslation || null;

    if (cachedTranslation) {
      setReviewTranslations((previous) => {
        const current = previous[reviewId];

        return {
          ...previous,
          [reviewId]: {
            translatedComment: cachedTranslation,
            targetLanguage,
            loading: false,
            showingOriginal:
              current?.targetLanguage === targetLanguage
                ? !current.showingOriginal
                : true,
          },
        };
      });

      return;
    }

    if (
      isSupportedLanguage(review.comment_language) &&
      sourceLanguage === targetLanguage
    ) {
      toast.info(t("itemDetails.sameLanguage"));
      return;
    }

    const requestId =
      (reviewTranslationRequestsRef.current[reviewId] ?? 0) + 1;

    reviewTranslationRequestsRef.current[reviewId] = requestId;

    setReviewTranslations((previous) => ({
      ...previous,
      [reviewId]: {
        translatedComment: null,
        targetLanguage,
        loading: true,
        showingOriginal: false,
      },
    }));

    try {
      for (let attempt = 0; attempt < MAX_TRANSLATION_POLLS; attempt++) {
        if (reviewTranslationRequestsRef.current[reviewId] !== requestId) {
          return;
        }

        const response = await fetch(
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

        const data: ReviewTranslationResponse = await response
          .json()
          .catch(() => ({}));

        if (!response.ok && response.status !== 202) {
          throw new Error(
            data.error ??
              data.detail ??
              t("itemDetails.translationFailed"),
          );
        }

        if (data.translated_comment?.trim() && !data.translation_pending) {
          if (reviewTranslationRequestsRef.current[reviewId] !== requestId) {
            return;
          }

          setReviewTranslations((previous) => ({
            ...previous,
            [reviewId]: {
              translatedComment: data.translated_comment!,
              targetLanguage,
              loading: false,
              showingOriginal: false,
            },
          }));

          return;
        }

        if (attempt < MAX_TRANSLATION_POLLS - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, TRANSLATION_POLL_INTERVAL),
          );
        }
      }

      throw new Error(t("itemDetails.translationTimeout"));
    } catch (err) {
      if (reviewTranslationRequestsRef.current[reviewId] !== requestId) {
        return;
      }

      setReviewTranslations((previous) => ({
        ...previous,
        [reviewId]: {
          translatedComment: null,
          targetLanguage,
          loading: false,
          showingOriginal: false,
        },
      }));

      toast.error(
        err instanceof Error
          ? err.message
          : t("itemDetails.translationFailed"),
      );
    }
  };

  const renderReviewComment = (review: Review) => {
    const reviewId = String(review.id);
    const originalComment = review.comment ?? "";
    const translation = reviewTranslations[reviewId];

    const hasLocalTranslation =
      Boolean(translation?.translatedComment) &&
      translation?.targetLanguage === activeLanguage;

    const apiTranslation = review.translated_comment?.trim() || "";
    const hasApiTranslation = Boolean(apiTranslation);
    const hasTranslation = hasLocalTranslation || hasApiTranslation;

    const translatedComment = hasLocalTranslation
      ? translation!.translatedComment!
      : apiTranslation;

    const showingOriginal = hasLocalTranslation
      ? translation!.showingOriginal
      : false;

    const displayedComment =
      showingOriginal || !hasTranslation
        ? originalComment
        : translatedComment;

    const buttonLabel = translation?.loading
      ? t("itemDetails.translating")
      : hasTranslation && !showingOriginal
        ? t("itemDetails.seeOriginal")
        : hasTranslation && showingOriginal
          ? t("itemDetails.showTranslation")
          : t("itemDetails.translate");

    const sourceLanguage = normalizeCommentLanguage(
      review.comment_language,
    );

    const canTranslate =
      !isSupportedLanguage(review.comment_language) ||
      sourceLanguage !== activeLanguage;

    return (
      <div className="my-3">
        <p className="whitespace-pre-wrap break-words leading-7 text-gray-800">
          {displayedComment}
        </p>

        {canTranslate && (
          <button
            type="button"
            disabled={translation?.loading}
            onClick={() => void translateReview(review)}
            className={`
              mt-3 inline-flex min-h-[34px] cursor-pointer items-center gap-2
              rounded-full border px-3.5 py-1.5 text-xs font-semibold
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-[rgb(0,64,128)] focus-visible:ring-offset-2
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
                <LoaderCircle size={14} className="animate-spin" />
                <span>{buttonLabel}</span>
              </>
            ) : (
              <span>{buttonLabel}</span>
            )}
          </button>
        )}

        {review.translation_pending && !hasTranslation && (
          <span className="mt-2 block text-xs text-gray-500">
            {t("itemDetails.translating")}
          </span>
        )}
      </div>
    );
  };

  const averageRating = Number(item?.average_rating ?? 0);

  const ratingCount = reviews.filter(
    (review) => review.rating !== null,
  ).length;

  const commentReviews = reviews.filter((review) =>
    Boolean(review.comment?.trim()),
  );

  const displayedDescription =
    item?.translated_description?.trim() ||
    item?.description ||
    "";

  if (loading) {
    return <ItemDetailsSkeleton />;
  }

  if (error) {
    return (
      <ErrorState onRetry={() => void fetchItemAndReviews(true)} />
    );
  }

  if (!item) {
    return (
      <div className="mx-auto mt-[70px] mb-[60px] max-w-[900px] rounded-[10px] bg-[#fefefe] p-4 text-center text-[#333] shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
        {t("itemDetails.itemNotFound")}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-[90px] mb-[60px] max-w-[900px] rounded-[10px] bg-[#fefefe] p-4 text-[#333] shadow-[0_4px_15px_rgba(0,0,0,0.05)] max-[480px]:mt-[90px] max-[480px]:mb-[30px]">
      <button
        type="button"
        onClick={handleBack}
        aria-label={t("itemDetails.goBack")}
        className="mb-3 mt-4 inline-flex cursor-pointer items-center justify-start rounded-md p-2 text-[rgb(0,64,128)] transition-colors hover:bg-[#eaf2f8]"
      >
        <ArrowLeft size={30} />
      </button>

      <div className="mb-8 flex flex-wrap gap-8 max-[480px]:mt-[10px] max-[480px]:mb-[50px]">
        <img
          src={item.image}
          alt={`${item.brand} ${translateProductTerm(item.category)}`}
          className="mt-5 h-[30%] w-[30%] rounded-lg object-cover max-[480px]:mt-[10px] max-[480px]:w-[40%]"
        />

        <div className="flex flex-1 flex-col justify-between max-[480px]:mt-[10px]">
          <h2 className="mt-20 mb-2 text-3xl font-bold text-[rgb(0,64,128)] max-[480px]:mt-1 max-[480px]:text-xl">
            {item.brand} {translateProductTerm(item.category)}{" "}
            {t("common.productFor")}{" "}
            {translateProductTerm(item.vehicle_type)}
          </h2>

          <p className="mb-2 text-lg font-semibold text-red-600">
            KES {item.buying_price.toLocaleString()}

            {item.discount_percentage > 0 && (
              <span className="ml-[5px] text-sm text-[#e41a139b]">
                (-{item.discount_percentage.toFixed(0)}%)
              </span>
            )}
          </p>

          <div>
            <p className="whitespace-pre-wrap break-words font-normal text-black">
              {displayedDescription}
            </p>

            {item.translation_pending && (
              <span className="mt-1 block text-xs text-gray-500">
                {t("itemDetails.translating")}
              </span>
            )}
          </div>

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
          <p className="py-4 text-gray-500">
            {t("itemDetails.noComments")}
          </p>
        ) : (
          commentReviews.map((review) => {
            const displayName =
              review.user_display_name?.trim() ||
              t("itemDetails.user");

            return (
              <div
                key={review.id}
                className="mb-3 rounded-md border border-gray-300 bg-[#fafafa] p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileCircle displayName={displayName} />

                    <div className="min-w-0">
                      <span className="block truncate font-bold text-[rgb(0,64,128)]">
                        {displayName}
                      </span>

                      <span className="text-sm text-gray-600">
                        {review.created_at
                          ? new Date(review.created_at).toLocaleDateString(
                              activeLanguage,
                            )
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {renderReviewComment(review)}

                <div className="mt-3 flex gap-3">
                  <div className="inline-flex items-center gap-1 rounded bg-[#e0e0e0] px-[10px] py-1 text-[#333]">
                    <ThumbsUp size={16} />
                    {review.total_likes}
                  </div>

                  <div className="inline-flex items-center gap-1 rounded bg-[#e0e0e0] px-[10px] py-1 text-[#333]">
                    <ThumbsDown size={16} />
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

export default LoggedOutItemDetails;
