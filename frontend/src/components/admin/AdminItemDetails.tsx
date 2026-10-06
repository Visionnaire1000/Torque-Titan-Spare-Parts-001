import { type CSSProperties, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { RefreshCw, ArrowLeft, Star, ThumbsDown, ThumbsUp } from "lucide-react";
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
  created_at: string;
  likes?: ReviewLike[];
  total_likes: number;
  total_dislikes: number;
  user_display_name: string;
  user_email: string;
}

interface SparePart {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  image: string;
  description: string;
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
}

interface SavedItemPosition {
  from?: string;
  restoreFilters?: {
    brand?: string;
    price?: string;
    currentPage?: number;
  };
  restoreScrollY?: number;
  expandedOrderId?: string | null;
}

/* -------------------------------- ERROR -------------------------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
    <h2 className="text-3xl font-bold text-red-600">
      Something went wrong
    </h2>

    <p className="max-w-md text-gray-600">
      Unable to load item details.
      Please check your connection
      and try again.
    </p>

    <button
      type="button"
      onClick={onRetry}
      className="
        flex
        items-center
        gap-2
        rounded-md
        bg-[rgb(0,64,128)]
        px-5
        py-3
        font-medium
        text-white
        transition-colors
        hover:bg-[rgb(17,49,82)]
      "
    >
      <RefreshCw size={18} />
      Retry
    </button>
  </div>
);

/* -------------------------------- STARS -------------------------------- */
const StarRating = ({
  value = 0,
  size = 22,
}: StarRatingProps) => {
  const roundedValue =
    Math.round(value * 2) / 2;

  return (
    <div className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map((star) => {
        let fillPercent = 0;

        if (roundedValue >= star) {
          fillPercent = 100;
        } else if (
          roundedValue + 0.5 === star
        ) {
          fillPercent = 50;
        }

        return (
          <div
            key={star}
            className="relative"
            style={{
              width: size,
              height: size,
            }}
          >
            <Star
              size={size}
              fill="#ddd"
              stroke="#ddd"
            />

            <div
              className="
                absolute
                left-0
                top-0
                overflow-hidden
              "
              style={{
                width: `${fillPercent}%`,
              }}
            >
              <Star
                size={size}
                fill="#FFD700"
                stroke="#FFD700"
              />
            </div>
          </div>
        );
      })}
    </div>
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
    parts[0]
      .charAt(0)
      .toUpperCase();

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

  const initial =
    initials.charAt(0);

  const colors: Record<
    string,
    string
  > = {
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

/* -------------------------------- SKELETON -------------------------------- */
const Skeleton = ({
  width,
  height,
  borderRadius = 4,
  style,
}: SkeletonProps) => (
  <div
    className="skeleton shimmer"
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
  />
);

const ItemDetailsSkeleton = () => (
  <div
    className="
      mx-auto
      mt-[70px]
      mb-[60px]
      max-w-[900px]
      rounded-[10px]
      bg-white
      p-4
      shadow-[0_4px_15px_rgba(0,0,0,0.05)]
      max-[480px]:mt-[90px]
      max-[480px]:mb-[30px]
    "
  >
    <div className="mb-8 flex flex-wrap gap-8">
      <Skeleton
        width="200px"
        height="200px"
        borderRadius={8}
      />

      <div className="flex flex-1 flex-col">
        <Skeleton
          width="60%"
          height="28px"
        />

        <Skeleton
          width="40%"
          height="24px"
          style={{
            marginTop: 8,
          }}
        />

        <Skeleton
          width="90%"
          height="16px"
          style={{
            marginTop: 8,
          }}
        />

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
        className="
          mb-3
          rounded-md
          border
          border-gray-300
          bg-[#fafafa]
          p-3
        "
      >
        <div className="flex items-center gap-3">
          <Skeleton
            width="40px"
            height="40px"
            borderRadius={50}
          />

          <div className="flex-1">
            <Skeleton
              width="140px"
              height="16px"
            />

            <Skeleton
              width="180px"
              height="14px"
              style={{
                marginTop: 4,
              }}
            />

            <Skeleton
              width="80px"
              height="13px"
              style={{
                marginTop: 4,
              }}
            />
          </div>
        </div>

        <Skeleton
          width="90%"
          height="14px"
          style={{
            marginTop: 12,
          }}
        />

        <div className="mt-3 flex gap-3">
          <Skeleton
            width="55px"
            height="28px"
            borderRadius={4}
          />

          <Skeleton
            width="55px"
            height="28px"
            borderRadius={4}
          />
        </div>
      </div>
    ))}
  </div>
);

const EmptyReviews = () => (
  <p className="text-gray-500">
    No customer comments yet.
  </p>
);

/* -------------------------------- COMPONENT -------------------------------- */
const AdminItemDetails = () => {
  const { id } =
    useParams<{ id: string }>();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const {
    user,
    authFetch,
  } = useAuth();

  const currentUserId =
    user?.id != null
      ? String(user.id)
      : null;

  const [item, setItem] =
    useState<SparePart | null>(null);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<boolean>(false);

  /* ----------------------------- FETCH ------------------------- */
  const fetchItemAndReviews =
    async (): Promise<void> => {
      if (!id) {
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const [
          itemRes,
          reviewsRes,
        ] = await Promise.all([
          authFetch(
            `${config.API_BASE_URL}/spareparts/${id}/`
          ),

          authFetch(
            `${config.API_BASE_URL}/admin/reviews/sparepart/${id}/`
          ),
        ]);

        if (!itemRes.ok) {
          throw new Error(
            "Item not found"
          );
        }

        const itemData:
          SparePart =
          await itemRes.json();

        const reviewData:
          Review[] =
          reviewsRes.ok
            ? await reviewsRes.json()
            : [];

        const normalizedReviews =
          reviewData.map(
            (review) => ({
              ...review,
              id: String(
                review.id
              ),
              user_id: String(
                review.user_id
              ),
              rating:
                review.rating === null
                  ? null
                  : Number(
                      review.rating
                    ),
              total_likes:
                Number(
                  review.total_likes ??
                    0
                ),
              total_dislikes:
                Number(
                  review.total_dislikes ??
                    0
                ),
              user_display_name:
                review.user_display_name?.trim() ||
                "User",
              user_email:
                review.user_email?.trim() ||
                "",
              comment:
                review.comment?.trim() ||
                "",
            })
          );

        setItem(itemData);
        setReviews(
          normalizedReviews
        );
      } catch (err: unknown) {
        console.error(err);

        setError(true);

        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to load item details"
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchItemAndReviews();
  }, [id]);

  /* ----------------------------- SCROLL TO TOP ------------------------- */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [id]);

  /* ----------------------------- DERIVED ------------------------- */
  const averageRating =
    Number(
      item?.average_rating ?? 0
    );

  const ratingCount =
    reviews.filter(
      (review) =>
        review.rating !== null
    ).length;

  const commentReviews =
    reviews.filter(
      (review) =>
        Boolean(
          review.comment?.trim()
        )
    );

  /* ----------------------------- BACK ------------------------- */
  const handleBack = (): void => {
    const state =
      location.state as
        | RestoreState
        | null;

    if (state?.from) {
      navigate(
        state.from,
        {
          state: {
            restoreFilters:
              state.restoreFilters,
            restoreScrollY:
              state.restoreScrollY,
            expandedOrderId:
              state.expandedOrderId,
          },
        }
      );

      return;
    }

    if (id) {
      const savedPosition =
        sessionStorage.getItem(
          `titan_item_restore_${id}`
        );

      if (savedPosition) {
        try {
          const parsed =
            JSON.parse(
              savedPosition
            ) as SavedItemPosition;

          if (parsed.from) {
            navigate(
              parsed.from,
              {
                state: {
                  restoreFilters:
                    parsed.restoreFilters,
                  restoreScrollY:
                    parsed.restoreScrollY,
                  expandedOrderId:
                    parsed.expandedOrderId,
                },
              }
            );

            return;
          }
        } catch (error) {
          console.error(
            "Failed to restore saved item position:",
            error
          );
        }
      }
    }

    if (
      location.key !==
      "default"
    ) {
      navigate(-1);
      return;
    }

    navigate("/spareparts");
  };

  /* ----------------------------- LOADING ------------------------- */
  if (loading) {
    return (
      <ItemDetailsSkeleton />
    );
  }

  /* ----------------------------- ERROR ------------------------- */
  if (error) {
    return (
      <ErrorState
        onRetry={() =>
          void fetchItemAndReviews()
        }
      />
    );
  }

  /* ----------------------------- NOT FOUND ------------------------- */
  if (!item) {
    return (
      <div
        className="
          mx-auto
          mt-[70px]
          mb-[60px]
          max-w-[900px]
          rounded-[10px]
          bg-[#fefefe]
          p-4
          text-center
          text-[#333]
          shadow-[0_4px_15px_rgba(0,0,0,0.05)]
        "
      >
        Item not found
      </div>
    );
  }

  /* ----------------------------- RENDER ------------------------- */
  return (
    <div
      className="
        mx-auto
        mt-[70px]
        mb-[60px]
        max-w-[900px]
        rounded-[10px]
        bg-[#fefefe]
        p-4
        text-[#333]
        shadow-[0_4px_15px_rgba(0,0,0,0.05)]
        max-[480px]:mt-[90px]
        max-[480px]:mb-[30px]
      "
    >
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="
          mb-4
          inline-flex
          items-center
          justify-start
          rounded-md
          p-2
          text-[rgb(0,64,128)]
          transition-colors
          hover:bg-[#eaf2f8]
        "
      >
        <ArrowLeft size={30} />
      </button>

      <div
        className="
          mb-8
          flex
          flex-wrap
          gap-8
          max-[480px]:mt-[10px]
          max-[480px]:mb-[50px]
        "
      >
        <img
          src={item.image}
          alt={item.brand}
          className="
            mt-10
            h-[30%]
            w-[30%]
            rounded-lg
            object-cover
            max-[480px]:mt-[10px]
            max-[480px]:w-[40%]
          "
        />

        <div
          className="
            flex
            flex-1
            flex-col
            justify-between
            max-[480px]:mt-[10px]
          "
        >
          <h2
            className="
              mt-20
              mb-2
              text-3xl
              font-bold
              text-[rgb(0,64,128)]
              max-[480px]:mt-1
              max-[480px]:text-xl
            "
          >
            {item.brand}{" "}
            {item.category} for{" "}
            {item.vehicle_type}
          </h2>

          <p className="mb-2 text-lg font-semibold text-red-600">
            KES{" "}
            {item.buying_price.toLocaleString()}

            {item.discount_percentage >
              0 && (
              <span className="ml-[5px] text-sm text-[#e41a139b]">
                (-
                {item.discount_percentage.toFixed(
                  0
                )}
                %)
              </span>
            )}
          </p>

          <p className="font-normal text-black">
            {item.description}
          </p>

          <div className="mt-2 flex items-center gap-[5px]">
            <StarRating
              value={averageRating}
              readonly
              size={22}
            />

            <span className="text-sm text-gray-700">
              {averageRating.toFixed(
                1
              )}{" "}
              (
              {ratingCount}
              )
            </span>
          </div>
        </div>
      </div>

      {/* ----------------------------- REVIEWS ------------------------- */}
      <div className="mt-8">
        <h3 className="mb-4 text-2xl font-semibold">
          Customer Comments (
          {commentReviews.length}
          )
        </h3>

        {commentReviews.length ===
        0 ? (
          <EmptyReviews />
        ) : (
          commentReviews.map(
            (review) => {
              const displayName =
                review.user_display_name?.trim() ||
                "User";

              const isOwnReview =
                currentUserId !==
                  null &&
                String(
                  review.user_id
                ) ===
                  currentUserId;

              return (
                <div
                  key={review.id}
                  className="
                    mb-3
                    rounded-md
                    border
                    border-gray-300
                    bg-[#fafafa]
                    p-3
                  "
                >
                  <div
                    className="
                      mb-3
                      flex
                      items-start
                      justify-between
                      gap-3
                    "
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ProfileCircle
                        displayName={
                          displayName
                        }
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[rgb(0,64,128)]">
                            {isOwnReview
                              ? "You"
                              : displayName}
                          </span>

                          {isOwnReview && (
                            <span
                              className="
                                rounded
                                bg-[#0677f8]
                                px-2
                                py-1
                                text-xs
                                text-white
                              "
                            >
                              You
                            </span>
                          )}
                        </div>

                        <span className="block text-sm text-gray-600">
                          {review.user_email}
                        </span>

                        <span className="block text-xs text-gray-500">
                          {review.created_at
                            ? new Date(
                                review.created_at
                              ).toLocaleDateString(
                                "en-GB"
                              )
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mb-3 ml-[52px] leading-6 text-gray-800 max-[480px]:ml-0">
                    {review.comment}
                  </p>

                  <div className="ml-[52px] flex gap-3 max-[480px]:ml-0">
                    <div
                      className="
                        inline-flex
                        items-center
                        gap-1
                        rounded
                        bg-[#e0e0e0]
                        px-[10px]
                        py-1
                        text-[#333]
                      "
                    >
                      <ThumbsUp size={16} />
                      {review.total_likes}
                    </div>

                    <div
                      className="
                        inline-flex
                        items-center
                        gap-1
                        rounded
                        bg-[#e0e0e0]
                        px-[10px]
                        py-1
                        text-[#333]
                      "
                    >
                      <ThumbsDown size={16} />
                      {review.total_dislikes}
                    </div>
                  </div>
                </div>
              );
            }
          )
        )}
      </div>
    </div>
  );
};

export default AdminItemDetails;
