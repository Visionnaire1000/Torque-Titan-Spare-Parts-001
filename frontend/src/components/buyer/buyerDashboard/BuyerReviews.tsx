import { useEffect, useState, useRef, type FC, type MouseEvent } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import config from "../../../config";
import { RefreshCw, Star, ThumbsUp, ThumbsDown } from "lucide-react";


/* ---------------- Interfaces ---------------- */
interface Review {
  id: string;
  sparepart_id: string;

  sparepart: {
    id: string;
    brand: string;
    category: string;
    vehicle_type: string;
    image_url: string;
    buying_price: number;
    discount_percentage: number;
  };

  user_display_name: string;
  rating: number;
  comment: string;
  total_likes: number;
  total_dislikes: number;
  created_at: string;
}

interface ErrorStateProps {
  onRetry: () => void;
}


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
    <div className="mb-2 h-10 w-10 rounded-full bg-gray-200" />

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
      type="button"
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
const BuyerReviews: FC = () => {
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

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const reviewsRef =
    useRef<Review[]>([]);

  /* ---------------- Helpers ---------------- */
  const formatDate = (
    dateString: string
  ): string => {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);

    return `${String(
      date.getDate()
    ).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const hasReviewsChanged = (
    newData: Review[]
  ): boolean => {
    const previous =
      reviewsRef.current;

    if (
      previous.length !==
      newData.length
    ) {
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
        `${config.API_BASE_URL}/buyer-reviews/`
      );

      if (!res.ok) {
        throw new Error(
          "Failed to fetch reviews"
        );
      }

      const data: Review[] =
        await res.json();

      if (hasReviewsChanged(data)) {
        setReviews(data);

        reviewsRef.current = data;

        localStorage.setItem(
          "buyer_reviews_cache",
          JSON.stringify(data)
        );

        window.dispatchEvent(
          new Event(
            "buyer_reviews_updated"
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

  /* ---------------- Seen Reviews ---------------- */
  const markReviewsAsSeen = (
    data: Review[]
  ): void => {
    if (!data.length) {
      return;
    }

    const existing: string[] =
      JSON.parse(
        localStorage.getItem(
          "buyer_seen_review_ids"
        ) || "[]"
      );

    const ids = data.map(
      (review) => review.id
    );

    const hasNew = ids.some(
      (id) =>
        !existing.includes(id)
    );

    if (!hasNew) {
      return;
    }

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
    void fetchReviews(true);

    const interval =
      window.setInterval(() => {
        void fetchReviews(false);
      }, 30000);

    return () =>
      window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (reviews.length) {
      markReviewsAsSeen(reviews);
    }
  }, [reviews]);

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
      new Date(
        b.created_at
      ).getTime() -
      new Date(
        a.created_at
      ).getTime()
  );

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
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <SkeletonCard
            key={index}
          />
        ))}
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

  /* ---------------- Empty ---------------- */
  if (!reviews.length) {
    return <EmptyState />;
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
      {/* ---------- Summary ---------- */}
      <div className="text-[15px] font-medium text-gray-700">
        <strong>Total Reviews:</strong>{" "}
        {reviews.length}
      </div>

      {/* ---------- Reviews ---------- */}
      {orderedReviews.map(
        (review) => (
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
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ProfileCircle
                    displayName={
                      review.user_display_name?.trim() ||
                      "User"
                    }
                  />

                  <div className="min-w-0">
                    <span
                      className="
                        block
                        truncate
                        text-[15px]
                        font-semibold
                        text-[#004080]
                      "
                    >
                      {review.user_display_name?.trim() ||
                        "User"}
                    </span>

                    <span className="text-sm text-gray-600">
                      {formatDate(
                        review.created_at
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* ---------- Image ---------- */}
              {review.sparepart?.image_url && (
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
                      review.sparepart
                        .image_url
                    }
                    alt={`${review.sparepart.brand} spare part`}
                    className="
                      max-h-[13%]
                      max-w-[13%]
                      object-contain
                    "
                  />

                  <p
                    className="
                      mt-[10px]
                      mb-2
                      text-[rgb(0,64,128)]
                      text-medium
                      font-bold
                      max-[480px]:mt-1
                      max-[480px]:text-xl
                    "
                  >
                    {
                      review.sparepart
                        .brand
                    }{" "}
                    {
                      review.sparepart
                        .category
                    }{" "}
                    for{" "}
                    {
                      review.sparepart
                        .vehicle_type
                    }
                  </p>

                  <p className="mb-2 text-lg font-semibold text-red-600">
                    KES{" "}
                    {review.sparepart.buying_price.toLocaleString()}

                    {review.sparepart
                      .discount_percentage >
                      0 && (
                      <span className="ml-[5px] text-sm text-[#e41a139b]">
                        (-
                        {review.sparepart.discount_percentage.toFixed(
                          0
                        )}
                        %)
                      </span>
                    )}
                  </p>
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
                }).map((_, index) => (
                  <Star
                    key={index}
                    size={18}
                    className={
                      index <
                      review.rating
                        ? "fill-yellow-400 stroke-yellow-400"
                        : "fill-none stroke-gray-300"
                    }
                  />
                ))}

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
        )
      )}
    </div>
  );
};

export default BuyerReviews;