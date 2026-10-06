import { type CSSProperties, useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { RefreshCw, ArrowLeft, Star, ThumbsDown, ThumbsUp } from "lucide-react";
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
  buying_price: number;
  average_rating: number;
  discount_percentage: number;
}

interface RestoreState {
  from?: string;
  restoreFilters?: Record<
    string,
    string | number
  >;
  restoreScrollY?: number;
}

interface SavedItemPosition {
  from?: string;
  restoreFilters?: Record<
    string,
    string | number
  >;
  restoreScrollY?: number;
}

/* -------------------------------- Error -------------------------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
    <h2 className="text-3xl font-bold text-red-600">
      Something went wrong
    </h2>

    <p className="max-w-md text-gray-600">
      Unable to load spare parts.
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

/* -------------------------------- Stars -------------------------------- */
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
                top-0
                left-0
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


/* -------------------------------- Skeleton -------------------------------- */
const Skeleton = ({
  width,
  height,
  borderRadius = 4,
  style,
}: SkeletonProps) => (
  <div
    className="
      relative
      overflow-hidden
      bg-gray-200
      shimmer
    "
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
  />
);

/* -------------------------------- Loading -------------------------------- */
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
          {[...Array(5)].map(
            (_, i) => (
              <Skeleton
                key={i}
                width="22px"
                height="22px"
                borderRadius={50}
              />
            )
          )}
        </div>
      </div>
    </div>

    <div className="mb-4">
      {[...Array(3)].map(
        (_, i) => (
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
                borderRadius={999}
              />

              <div className="flex flex-1 flex-col gap-2">
                <Skeleton
                  width="120px"
                  height="16px"
                />

                <Skeleton
                  width="80px"
                  height="14px"
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

            <div className="mt-3 flex gap-[5px]">
              <Skeleton
                width="60px"
                height="30px"
                borderRadius={6}
              />

              <Skeleton
                width="60px"
                height="30px"
                borderRadius={6}
              />
            </div>
          </div>
        )
      )}
    </div>
  </div>
);

/* -------------------------------- Component -------------------------------- */
const LoggedOutItemDetails = () => {
  const { id } =
    useParams<{
      id: string;
    }>();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  /* ---------------- Back Navigation ---------------- */
  const handleBack = (): void => {
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
                },
              }
            );

            return;
          }
        } catch (error) {
          console.error(
            "Failed to restore saved listing position:",
            error
          );
        }
      }
    }

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
          },
        }
      );

      return;
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

  /* ---------------- State ---------------- */
  const [item, setItem] =
    useState<SparePart | null>(
      null
    );

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  /* ---------------- Fetch ---------------- */
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
          fetch(
            `${config.API_BASE_URL}/spareparts/${id}/`
          ),

          fetch(
            `${config.API_BASE_URL}/reviews/${id}/`
          ),
        ]);

        if (
          !itemRes.ok ||
          !reviewsRes.ok
        ) {
          throw new Error(
            "Failed to fetch data"
          );
        }

        const itemData:
          SparePart =
          await itemRes.json();

        const reviewData:
          Review[] =
          await reviewsRes.json();

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
            })
          );

        setItem(itemData);

        setReviews(
          normalizedReviews
        );
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchItemAndReviews();
  }, [id]);

  /* ---------------- Scroll To Top ---------------- */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [id]);

  /* ---------------- Derived ---------------- */
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

  /* -------------------------------- Render -------------------------------- */
  if (loading) {
    return (
      <ItemDetailsSkeleton />
    );
  }

  if (error) {
    return (
      <ErrorState
        onRetry={
          fetchItemAndReviews
        }
      />
    );
  }

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
          mb-3
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
              text-[rgb(0,64,128)]
              text-3xl
              font-bold
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
              value={
                averageRating
              }
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

      <div className="mt-8">
        <h3 className="mb-4 text-2xl font-semibold">
          Customer Comments (
          {
            commentReviews.length
          }
          )
        </h3>

        {commentReviews.length ===
        0 ? (
          <p className="text-gray-500">
            No customer comments yet.
          </p>
        ) : (
          commentReviews.map(
            (review) => {
              const displayName =
                review.user_display_name?.trim() ||
                "User";

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
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProfileCircle
                        displayName={
                          displayName
                        }
                      />

                      <div className="min-w-0">
                        <span className="block truncate font-bold text-[rgb(0,64,128)]">
                          {
                            displayName
                          }
                        </span>

                        <span className="text-sm text-gray-600">
                          {new Date(
                            review.created_at
                          ).toLocaleDateString(
                            "en-GB"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="my-2 leading-6 text-gray-800">
                    {
                      review.comment
                    }
                  </p>

                  <div className="mt-3 flex gap-3">
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
                      <ThumbsUp
                        size={16}
                      />

                      {
                        review.total_likes
                      }
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
                      <ThumbsDown
                        size={16}
                      />

                      {
                        review.total_dislikes
                      }
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

export default LoggedOutItemDetails;
