import { useEffect, useState, useRef, type FC } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { Link } from "react-router-dom";
import config from "../../../config";
import { RefreshCw, Star, ThumbsUp, ThumbsDown } from "lucide-react";


/* ---------------- Interfaces ---------------- */
interface Review {
  id: number;
  sparepart_id: number;
  sparepart_image?: string;
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
      <RefreshCw
        size={18}
        className="transition group-hover:rotate-90"
      />
      Retry
    </button>
  </div>
);

/* ---------------- Empty State ---------------- */
const EmptyState: FC = () => (
  <div
    className="
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
const Reviews: FC = () => {
  const { authFetch, user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>(
    []
  );

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

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
    )}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const hasReviewsChanged = (
    newData: Review[]
  ): boolean => {
    const previous = reviewsRef.current;

    if (previous.length !== newData.length)
      return true;

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
        throw new Error("Failed to fetch reviews");
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
          new Event("admin_reviews_updated")
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
    if (!data.length) return;

    const existing: number[] = JSON.parse(
      localStorage.getItem(
        "admin_seen_review_ids"
      ) || "[]"
    );

    const ids = data.map((review) => review.id);

    const hasNew = ids.some(
      (id) => !existing.includes(id)
    );

    if (!hasNew) return;

    localStorage.setItem(
      "admin_seen_review_ids",
      JSON.stringify(ids)
    );

    window.dispatchEvent(
      new Event("admin_reviews_updated")
    );
  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    fetchReviews(true);

    const interval = window.setInterval(() => {
      fetchReviews(false);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (reviews.length) {
      markReviewsAsSeen(reviews);
    }
  }, [reviews]);

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
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (error) {
    return (
      <ErrorState
        onRetry={() => fetchReviews(true)}
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
        <strong>Total Reviews:</strong> {reviews.length}
      </div>

      {/* ---------- Reviews ---------- */}
      {reviews.map((review) => (
        <Link
          key={review.id}
          to={`/items/${review.sparepart_id}`}
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
                items-center
                justify-between
                gap-3
              "
            >
              <strong
                className="
                  text-[15px]
                  font-semibold
                  text-[#004080]
                  break-words
                "
              >
                {review.user_display_name}
              </strong>

              <span
                className="
                  shrink-0
                  text-xs
                  text-gray-500
                "
              >
                {formatDate(review.created_at)}
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
                  src={review.sparepart_image}
                  alt="review"
                  className="
                    max-h-[150px]
                    max-w-[150px]
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
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={14}
                  className={
                    index < review.rating
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
                <ThumbsUp size={15} />
                {review.total_likes}
              </span>

              <span
                className="
                  flex
                  items-center
                  gap-1
                "
              >
                <ThumbsDown size={15} />
                {review.total_dislikes}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default Reviews;