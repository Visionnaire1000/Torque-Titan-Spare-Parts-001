import { useEffect, useState, useRef, type FC, type MouseEvent } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import config from "../../../config";
import { RefreshCw, Star, ThumbsUp, ThumbsDown, BarChart3, ArrowLeft } from "lucide-react";


/* ---------------- Interfaces ---------------- */
interface Review {
  id: string;
  sparepart_id: string;
  sparepart_image?: string;
  user_display_name: string;
  user_email: string;
  rating: number;
  comment: string;
  total_likes: number;
  total_dislikes: number;
  created_at: string;
}

interface ReviewAnalyticsBrand {
  brand: string;
  average_rating: number;
  total_reviews: number;
}

interface ReviewAnalyticsGroup {
  vehicle_type: string;
  category: string;
  brands: ReviewAnalyticsBrand[];
}

interface ErrorStateProps {
  onRetry: () => void;
}

/* ---------------- Skeleton Loader ---------------- */
const SkeletonCard: FC = () => (
  <div
    className="
      relative
      overflow-hidden
      rounded-xl
      border
      border-gray-200
      bg-white
      p-4
      animate-pulse
    "
  >
    <div className="mb-2 h-3 w-2/5 rounded bg-gray-200" />
    <div className="mb-2 h-3 rounded bg-gray-200" />
    <div className="my-3 h-[120px] rounded-lg bg-gray-200" />
    <div className="mb-2 h-3 rounded bg-gray-200" />
    <div className="h-3 w-3/5 rounded bg-gray-200" />
  </div>
);

/* ---------------- Error State ---------------- */
const ErrorState: FC<ErrorStateProps> = ({
  onRetry,
}) => (
  <div
    className="
      flex
      h-[60vh]
      flex-col
      items-center
      justify-center
      px-5
      text-center
    "
  >
    <h2 className="mb-2 text-2xl font-semibold text-gray-900">
      Something went wrong
    </h2>

    <p
      className="
        mb-5
        max-w-[400px]
        text-[15px]
        text-gray-500
      "
    >
      Unable to load reviews. Please check your
      connection and try again.
    </p>

    <button
      onClick={onRetry}
      className="
        inline-flex
        items-center
        gap-2
        rounded-lg
        bg-gray-900
        px-4
        py-2.5
        text-white
        transition
        hover:bg-gray-800
      "
    >
      <RefreshCw size={18} />
      Retry
    </button>
  </div>
);

/* ---------------- Empty State ---------------- */
const EmptyState: FC = () => (
  <div
    className="
      mt-[90px]
      py-10
      text-center
      text-base
      font-medium
      text-red-600
    "
  >
    No reviews yet.
  </div>
);

/* ---------------- Component ---------------- */
const AdminReviews: FC = () => {
  const { authFetch, user } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const restoreState = location.state as {
    restoreScrollY?: number;
  } | null;

  const restoreScrollYRef =
    useRef<number | null>(
      typeof restoreState?.restoreScrollY === "number"
        ? restoreState.restoreScrollY
        : null
    );

  const isRestoringRef =
    useRef<boolean>(
      typeof restoreState?.restoreScrollY === "number"
    );

  const [reviews, setReviews] = useState<Review[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const [showAnalytics, setShowAnalytics] =
    useState<boolean>(false);

  const [analytics, setAnalytics] =
    useState<ReviewAnalyticsGroup[]>([]);

  const [analyticsLoading, setAnalyticsLoading] =
    useState<boolean>(false);

  const [analyticsError, setAnalyticsError] =
    useState<string>("");

  const [
    selectedVehicleType,
    setSelectedVehicleType,
  ] = useState<string | null>(null);

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState<string | null>(null);

  const reviewsRef = useRef<Review[]>([]);

  /* ---------------- Helpers ---------------- */
  const formatDate = (
    dateString: string
  ): string => {
    if (!dateString) return "";

    const date = new Date(dateString);

    return `${String(date.getDate()).padStart(
      2,
      "0"
    )}/${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}/${date.getFullYear()}`;
  };

  const capitalize = (
    value: string
  ): string => {
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) =>
        character.toUpperCase()
      );
  };
   
  
/* ----------------------------- PROFILE CIRCLE ------------------------- */
const getProfileInitials = (
  displayName: string
): string => {
  const name = displayName.trim();

  if (!name) {
    return "U";
  }

  const parts = name
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .charAt(0)
      .toUpperCase();
  }

  const firstInitial =
    parts[0].charAt(0).toUpperCase();

  const lastInitial =
    parts[parts.length - 1]
      .charAt(0)
      .toUpperCase();

  return `${firstInitial}${lastInitial}`;
};

const getProfileColor = (
  displayName: string
): string => {
  const initials =
    getProfileInitials(displayName);

  const initial = initials.charAt(0);

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

  return (
    colors[initial] ??
    "bg-gray-500"
  );
};

const ProfileCircle = ({
  displayName,
}: {
  displayName: string;
}) => {
  const initials =
    getProfileInitials(displayName);

  const color =
    getProfileColor(displayName);

  return (
    <div
      className={`
        flex
        h-10
        w-10
        shrink-0
        items-center
        justify-center
        rounded-full
        text-sm
        font-bold
        text-white
        ${color}
      `}
      aria-label={`${displayName} profile`}
    >
      {initials}
    </div>
  );
 };

  const hasReviewsChanged = (
    newData: Review[]
  ): boolean => {
    const previous = reviewsRef.current;

    if (previous.length !== newData.length) {
      return true;
    }

    const previousMap = new Map(
      previous.map((review) => [
        review.id,
        review.created_at,
      ])
    );

    for (const review of newData) {
      if (
        !previousMap.has(review.id) ||
        previousMap.get(review.id) !==
          review.created_at
      ) {
        return true;
      }
    }

    return false;
  };

  /* ---------------- Fetch Reviews ---------------- */
  const fetchReviews = async (
    isInitial: boolean = false
  ): Promise<void> => {
    if (!user) {
      if (isInitial) {
        setLoading(false);
      }

      return;
    }

    if (isInitial) {
      setLoading(true);
    }

    setError("");

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/reviews/`
      );

      if (!res.ok) {
        throw new Error(
          "Failed to fetch reviews"
        );
      }

      const data: Review[] = await res.json();

      if (hasReviewsChanged(data)) {
        setReviews(data);

        reviewsRef.current = data;

        localStorage.setItem(
          "admin_reviews_cache",
          JSON.stringify(data)
        );

        window.dispatchEvent(
          new Event(
            "admin_reviews_updated"
          )
        );
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to fetch reviews";

      setError(message);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  /* ---------------- Fetch Analytics ---------------- */
  const fetchAnalytics = async (): Promise<void> => {
    if (!user) return;

    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/reviews-analytics/`
      );

      if (!res.ok) {
        throw new Error(
          "Failed to fetch review analytics"
        );
      }

      const data: ReviewAnalyticsGroup[] =
        await res.json();

      setAnalytics(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to fetch review analytics";

      setAnalyticsError(message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  /* ---------------- Seen Reviews ---------------- */
  const markReviewsAsSeen = (
    data: Review[]
  ): void => {
    if (!data.length) return;

    const existing: string[] = JSON.parse(
      localStorage.getItem(
        "admin_seen_review_ids"
      ) || "[]"
    );

    const ids = data.map(
      (review) => review.id
    );

    const hasNew = ids.some(
      (id) => !existing.includes(id)
    );

    if (!hasNew) return;

    localStorage.setItem(
      "admin_seen_review_ids",
      JSON.stringify(ids)
    );

    window.dispatchEvent(
      new Event(
        "admin_reviews_updated"
      )
    );
  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    fetchReviews(true);

    const interval = window.setInterval(() => {
      fetchReviews(false);
    }, 30000);

    return () =>
      window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (reviews.length) {
      markReviewsAsSeen(reviews);
    }
  }, [reviews]);

  useEffect(() => {
    if (showAnalytics) {
      fetchAnalytics();
    }
  }, [showAnalytics]);

  useEffect(() => {
    if (!showAnalytics) {
      setSelectedVehicleType(null);
      setSelectedCategory(null);
    }
  }, [showAnalytics]);

  /* ---------------- Restore Scroll Position ---------------- */
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

    const images = Array.from(
      document.images
    );

    const pendingImages = images.filter(
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
  }, [loading]);

  /* ---------------- Review Navigation ---------------- */
  const handleReviewClick = (
    event: MouseEvent<HTMLAnchorElement>,
    sparepartId: string
  ): void => {
    event.preventDefault();

    navigate(`/items/${sparepartId}`, {
      state: {
        from: location.pathname,
        restoreScrollY: window.scrollY,
      },
    });
  };

  /* ---------------- Newest To Oldest ---------------- */
  const orderedReviews = [
    ...reviews,
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );

  /* ---------------- Rating Width ---------------- */
  const getRatingWidth = (
    rating: number
  ): number => {
    return Math.min(
      Math.max((rating / 5) * 100, 0),
      100
    );
  };

  const vehicleTypes = Array.from(
    new Set(
      analytics.map(
        (group) => group.vehicle_type
      )
    )
  );

  const vehicleCategories =
    selectedVehicleType
      ? analytics.filter(
          (group) =>
            group.vehicle_type ===
            selectedVehicleType
        )
      : [];

  const selectedAnalyticsGroup =
    selectedVehicleType &&
    selectedCategory
      ? analytics.find(
          (group) =>
            group.vehicle_type ===
              selectedVehicleType &&
            group.category ===
              selectedCategory
        )
      : null;

  /* ---------------- Analytics Navigation ---------------- */
  const handleVehicleTypeSelect = (
    vehicleType: string
  ): void => {
    setSelectedVehicleType(vehicleType);
    setSelectedCategory(null);
  };

  const handleCategorySelect = (
    category: string
  ): void => {
    setSelectedCategory(category);
  };

  const handleAnalyticsBack = (): void => {
    if (selectedCategory) {
      setSelectedCategory(null);
      return;
    }

    if (selectedVehicleType) {
      setSelectedVehicleType(null);
    }
  };

  /* ---------------- Loading ---------------- */
  if (loading) {
    return (
      <div
        className="
          mx-auto
          mt-20
          flex
          max-w-[900px]
          flex-col
          gap-4
          rounded-2xl
          bg-white
          p-5
          shadow-[0_10px_30px_rgba(0,0,0,0.08)]
          max-[640px]:mt-16
          max-[640px]:p-4
        "
      >
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <SkeletonCard
              key={index}
            />
          )
        )}
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (error) {
    return (
      <ErrorState
        onRetry={() =>
          fetchReviews(true)
        }
      />
    );
  }

  return (
    <div
      className="
        mx-auto
        mt-20
        mb-10
        flex
        max-w-[900px]
        flex-col
        gap-4
        rounded-2xl
        bg-white
        p-6
        shadow-[0_10px_30px_rgba(0,0,0,0.08)]
        max-[768px]:mx-4
        max-[768px]:mt-16
        max-[768px]:p-5
        max-[480px]:mt-[100px]
        max-[480px]:p-4
      "
    >
      {/* ---------- Top Controls ---------- */}
      <div
        className="
          flex
          items-center
          justify-between
          gap-3
          border-b
          border-gray-200
          pb-4
          max-[480px]:flex-col
          max-[480px]:items-stretch
        "
      >
        <div className="flex items-center gap-3">
          {showAnalytics &&
            (selectedVehicleType ||
              selectedCategory) && (
              <button
                type="button"
                onClick={handleAnalyticsBack}
                aria-label="Go back"
                className="
                  inline-flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-gray-200
                  text-gray-600
                  transition
                  hover:bg-gray-50
                  hover:text-[#004080]
                "
              >
                <ArrowLeft size={18} />
              </button>
            )}

          <h1
            className="
              text-xl
              font-bold
              text-[#004080]
            "
          >
            {showAnalytics
              ? "Review Analytics"
              : "Reviews"}
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowAnalytics(
              (previous) => !previous
            )
          }
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-[#004080]
            px-4
            py-2.5
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-[#003366]
            max-[480px]:w-full
          "
        >
          <BarChart3 size={18} />

          {showAnalytics
            ? "View Reviews"
            : "Reviews Analytics"}
        </button>
      </div>

      {/* Analytics View */}
      {showAnalytics ? (
        <>
          {analyticsLoading ? (
            <div
              className="
                flex
                min-h-[300px]
                items-center
                justify-center
                text-gray-500
              "
            >
              Loading review analytics...
            </div>
          ) : analyticsError ? (
            <div
              className="
                flex
                min-h-[300px]
                flex-col
                items-center
                justify-center
                text-center
              "
            >
              <p
                className="
                  mb-4
                  text-[15px]
                  text-red-600
                "
              >
                {analyticsError}
              </p>

              <button
                type="button"
                onClick={fetchAnalytics}
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-gray-900
                  px-4
                  py-2.5
                  text-white
                  transition
                  hover:bg-gray-800
                "
              >
                <RefreshCw size={18} />
                Retry
              </button>
            </div>
          ) : !analytics.length ? (
            <div
              className="
                py-16
                text-center
                text-base
                font-medium
                text-gray-500
              "
            >
              No Rating analytics available.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {!selectedVehicleType && (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Vehicle Types
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Select a vehicle type to view
                      its rated spare-part categories.
                    </p>
                  </div>

                  <div
                    className="
                      grid
                      grid-cols-2
                      gap-4
                      max-[480px]:grid-cols-1
                    "
                  >
                    {vehicleTypes.map(
                      (vehicleType) => {
                        const categoryCount =
                          analytics.filter(
                            (group) =>
                              group.vehicle_type ===
                              vehicleType
                          ).length;

                        return (
                          <button
                            key={vehicleType}
                            type="button"
                            onClick={() =>
                              handleVehicleTypeSelect(
                                vehicleType
                              )
                            }
                            className="
                              rounded-xl
                              border
                              border-gray-200
                              bg-white
                              p-5
                              text-left
                              transition-all
                              duration-200
                              hover:-translate-y-[1px]
                              hover:border-[#004080]
                              hover:shadow-md
                            "
                          >
                            <h3
                              className="
                                text-lg
                                font-bold
                                capitalize
                                text-[#004080]
                              "
                            >
                              {capitalize(
                                vehicleType
                              )}
                            </h3>

                            <p className="mt-2 text-sm text-gray-500">
                              {categoryCount}{" "}
                              {categoryCount === 1
                                ? "rated category"
                                : "rated categories"}
                            </p>
                          </button>
                        );
                      }
                    )}
                  </div>
                </>
              )}

              {/* CATEGORIES */}
              {selectedVehicleType &&
                !selectedCategory && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {capitalize(
                          selectedVehicleType
                        )}
                      </p>

                      <h2
                        className="
                          mt-1
                          text-lg
                          font-bold
                          text-gray-900
                        "
                      >
                        Rated Categories
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Select a category to compare
                        its rated brands.
                      </p>
                    </div>

                    <div
                      className="
                        grid
                        grid-cols-2
                        gap-4
                        max-[480px]:grid-cols-1
                      "
                    >
                      {vehicleCategories.map(
                        (group) => (
                          <button
                            key={`${group.vehicle_type}-${group.category}`}
                            type="button"
                            onClick={() =>
                              handleCategorySelect(
                                group.category
                              )
                            }
                            className="
                              rounded-xl
                              border
                              border-gray-200
                              bg-white
                              p-5
                              text-left
                              transition-all
                              duration-200
                              hover:-translate-y-[1px]
                              hover:border-[#004080]
                              hover:shadow-md
                            "
                          >
                            <h3
                              className="
                                text-lg
                                font-bold
                                capitalize
                                text-[#004080]
                              "
                            >
                              {capitalize(
                                group.category
                              )}
                            </h3>

                            <p className="mt-2 text-sm text-gray-500">
                              {group.brands.length}{" "}
                              {group.brands.length ===
                              1
                                ? "rated brand"
                                : "rated brands"}
                            </p>
                          </button>
                        )
                      )}
                    </div>
                  </>
                )}

              {/* BRAND COMPARISON */}
              {selectedVehicleType &&
                selectedCategory &&
                selectedAnalyticsGroup && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {capitalize(
                          selectedVehicleType
                        )}
                      </p>

                      <h2
                        className="
                          mt-1
                          text-lg
                          font-bold
                          capitalize
                          text-gray-900
                        "
                      >
                        {capitalize(
                          selectedCategory
                        )}{" "}
                        Ratings
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        Brand rating comparison for{" "}
                        {capitalize(
                          selectedVehicleType
                        )}{" "}
                        {capitalize(
                          selectedCategory
                        )}
                        .
                      </p>
                    </div>

                    <div
                      className="
                        rounded-xl
                        border
                        border-gray-200
                        bg-white
                        p-5
                      "
                    >
                      <div className="mb-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3
                            className="
                              text-base
                              font-bold
                              text-[#004080]
                            "
                          >
                            Brand Comparison
                          </h3>

                          <span
                            className="
                              shrink-0
                              text-sm
                              text-gray-500
                            "
                          >
                            {
                              selectedAnalyticsGroup
                                .brands.length
                            }{" "}
                            {selectedAnalyticsGroup
                              .brands.length === 1
                              ? "brand"
                              : "brands"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-6">
                        {selectedAnalyticsGroup.brands.map(
                          (brand) => (
                            <div
                              key={brand.brand}
                              className="
                                flex
                                flex-col
                                gap-2
                              "
                            >
                              <div
                                className="
                                  flex
                                  items-center
                                  justify-between
                                  gap-3
                                "
                              >
                                <span
                                  className="
                                    min-w-0
                                    break-words
                                    text-[15px]
                                    font-semibold
                                    text-gray-800
                                  "
                                >
                                  {brand.brand}
                                </span>

                                <div
                                  className="
                                    flex
                                    shrink-0
                                    items-center
                                    gap-3
                                    text-sm
                                  "
                                >
                                  <span
                                    className="
                                      flex
                                      items-center
                                      gap-1
                                      font-semibold
                                      text-gray-700
                                    "
                                  >
                                    <Star
                                      size={16}
                                      className="
                                        fill-yellow-400
                                        stroke-yellow-400
                                      "
                                    />

                                    {Number(
                                      brand.average_rating
                                    ).toFixed(1)}
                                  </span>

                                  <span className="text-gray-500">
                                    (
                                    {
                                      brand.total_reviews
                                    }{" "}
                                    {brand.total_reviews ===
                                    1
                                      ? "review"
                                      : "reviews"}
                                    )
                                  </span>
                                </div>
                              </div>

                              <div
                                className="
                                  h-3
                                  w-full
                                  overflow-hidden
                                  rounded-full
                                  bg-gray-100
                                "
                              >
                                <div
                                  className="
                                    h-full
                                    rounded-full
                                    bg-[#004080]
                                    transition-all
                                    duration-500
                                  "
                                  style={{
                                    width: `${getRatingWidth(
                                      Number(
                                        brand.average_rating
                                      )
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}

              {/* SAFETY FALLBACK */}
              {selectedVehicleType &&
                selectedCategory &&
                !selectedAnalyticsGroup && (
                  <div
                    className="
                      py-16
                      text-center
                      text-base
                      font-medium
                      text-gray-500
                    "
                  >
                    No ratings available for this
                    combination.
                  </div>
                )}
            </div>
          )}
        </>
      ) : (
        /* REVIEWS VIEW */
        <>
          {/* ---------- Summary ---------- */}
          <div className="text-[15px] font-medium text-gray-700">
            <strong>Total Reviews:</strong>{" "}
            {reviews.length}
          </div>

          {/* ---------- Empty Reviews ---------- */}
          {reviews.length === 0 ? (
            <EmptyState />
          ) : (
            /* ---------- Reviews ---------- */
            orderedReviews.map((review) => (
              <Link
                key={review.id}
                to={`/items/${review.sparepart_id}`}
                onClick={(event) =>
                  handleReviewClick(
                    event,
                    review.sparepart_id
                  )
                }
                className="text-inherit no-underline"
              >
                <div
                  className="
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    p-4
                    transition-all
                    duration-200
                    hover:-translate-y-[1px]
                    hover:shadow-md
                  "
                >
                  {/* ---------- Header ---------- */}
                  <div
                    className="
                      mb-2
                      flex
                      items-start
                      justify-between
                      gap-3
                    "
                  >
                    <div
                      className="
                        flex
                        min-w-0
                        items-center
                        gap-3
                      "
                    >
                      <ProfileCircle
                        displayName={
                        review.user_display_name?.trim() ||
                         "User"
                        }
                      />
                      <div className="min-w-0">
                        <strong
                          className="
                            block
                            break-words
                            text-[15px]
                            font-semibold
                            text-[#004080]
                          "
                        >
                          {review.user_display_name}{" "}
                          <span className="font-normal text-gray-500">
                            ({review.user_email})
                          </span>
                        </strong>
                      </div>
                    </div>

                    <span
                      className="
                        shrink-0
                        text-xs
                        text-gray-500
                      "
                    >
                      {formatDate(
                        review.created_at
                      )}
                    </span>
                  </div>

                  {/* ---------- Image ---------- */}
                  {review.sparepart_image && (
                    <div
                      className="
                        my-3
                        overflow-hidden
                        rounded-lg
                        bg-gray-50
                      "
                    >
                      <img
                        src={
                          review.sparepart_image
                        }
                        alt="review"
                        className="
                          max-h-[13%]
                          max-w-[13%]
                          object-contain
                        "
                      />
                    </div>
                  )}

                  {/* ---------- Rating ---------- */}
                  <div
                    className="
                      mb-2
                      flex
                      items-center
                      gap-1
                    "
                  >
                    {Array.from({
                      length: 5,
                    }).map(
                      (_, index) => (
                        <Star
                          key={index}
                          size={18}
                          className={
                            index < review.rating
                              ? "fill-yellow-400 stroke-yellow-400"
                              : "fill-none stroke-gray-300"
                          }
                        />
                      )
                    )}

                    <span
                      className="
                        ml-1
                        text-sm
                        text-gray-500
                      "
                    >
                      ({review.rating})
                    </span>
                  </div>

                  {/* ---------- Comment ---------- */}
                  {review.comment && (
                    <p
                      className="
                        mb-3
                        text-[15px]
                        leading-6
                        text-gray-700
                      "
                    >
                      {review.comment}
                    </p>
                  )}

                  {/* ---------- Reactions ---------- */}
                  <div
                    className="
                      flex
                      gap-6
                      text-sm
                      text-gray-500
                    "
                  >
                    <span
                      className="
                        flex
                        items-center
                        gap-1
                      "
                    >
                      <ThumbsUp size={18} />
                      {review.total_likes}
                    </span>

                    <span
                      className="
                        flex
                        items-center
                        gap-1
                      "
                    >
                      <ThumbsDown size={18} />
                      {review.total_dislikes}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default AdminReviews;