import { type CSSProperties, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, RefreshCw, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import config from "../../config";



/* ----------------------------- INTERFACES ------------------------- */
interface ErrorStateProps {
  onRetry: () => void;
}

interface StarRatingProps {
  value?: number;
  onChange?: (value: number) => void;
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
  user_reaction: boolean | null;
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

interface ReviewActionOptions {
  method: "POST" | "PATCH" | "DELETE";
  endpoint: string;
  body?: Record<string, unknown>;
  successMessage?: string;
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


/* ----------------------------- ERROR STATE ------------------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps) => (
  <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
    <h2 className="text-3xl font-bold text-red-600">
      Something went wrong
    </h2>

    <p className="max-w-md text-gray-600">
      Unable to load spare parts. Please check your connection and try again.
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
        py-2
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

/* ----------------------------- STAR RATING ------------------------- */
const StarRating = ({
  value = 0,
  onChange,
  size = 24,
  readonly = false,
}: StarRatingProps) => {
  const [hoverValue, setHoverValue] =
    useState<number>(0);

  const [currentValue, setCurrentValue] =
    useState<number>(value);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleClick = (
    star: number
  ): void => {
    if (readonly || !onChange) {
      return;
    }

    setCurrentValue(star);
    onChange(star);
  };

  const handleMouseEnter = (
    star: number
  ): void => {
    if (readonly) {
      return;
    }

    setHoverValue(star);
  };

  const handleMouseLeave = (): void => {
    if (readonly) {
      return;
    }

    setHoverValue(0);
  };

  const displayValue =
    hoverValue || currentValue;

  const roundedValue =
    Math.round(displayValue * 2) / 2;

  return (
    <div className="my-2 flex gap-[2px]">
      {[1, 2, 3, 4, 5].map(
        (star) => {
          let fillPercent = 0;

          if (roundedValue >= star) {
            fillPercent = 100;
          } else if (
            roundedValue + 0.5 ===
            star
          ) {
            fillPercent = 50;
          }

          return (
            <div
              key={star}
              className={
                readonly
                  ? "relative"
                  : "relative cursor-pointer"
              }
              style={{
                width: size,
                height: size,
              }}
              onClick={() =>
                handleClick(star)
              }
              onMouseEnter={() =>
                handleMouseEnter(star)
              }
              onMouseLeave={
                handleMouseLeave
              }
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
        }
      )}
    </div>
  );
};

/* ----------------------------- PROFILE CIRCLE ------------------------- */
const getProfileInitials = (
  displayName: string
): string => {
  const name =
    displayName.trim();

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
    getProfileInitials(
      displayName
    );

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
    getProfileInitials(
      displayName
    );

  const color =
    getProfileColor(
      displayName
    );

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

/* ----------------------------- SKELETON ------------------------- */
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

const ItemDetailsSkeleton = () => (
  <div
    className="
      mx-auto
      mt-[70px]
      mb-[60px]
      max-w-[900px]
      rounded-[10px]
      bg-[#fefefe]
      p-4
      font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif]
      text-[#333]
      shadow-[0_4px_15px_rgba(0,0,0,0.05)]
      max-[480px]:mt-[90px]
      max-[480px]:mb-[30px]
    "
  >
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
      <Skeleton
        width="200px"
        height="200px"
        borderRadius={8}
      />

      <div className="flex flex-1 flex-col justify-between">
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
                borderRadius={999}
              />
            )
          )}
        </div>

        <Skeleton
          width="120px"
          height="34px"
          borderRadius={6}
          style={{
            marginTop: 12,
          }}
        />
      </div>
    </div>

    <div className="mb-8 border-y border-[#eee] p-4">
      <Skeleton
        width="30%"
        height="24px"
      />

      <div className="my-2 flex gap-[5px]">
        {[...Array(5)].map(
          (_, i) => (
            <Skeleton
              key={i}
              width="22px"
              height="22px"
              borderRadius={999}
            />
          )
        )}
      </div>

      <Skeleton
        width="100%"
        height="60px"
        borderRadius={6}
      />

      <Skeleton
        width="120px"
        height="34px"
        borderRadius={6}
        style={{
          marginTop: 8,
        }}
      />
    </div>

    <div>
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

/* ----------------------------- COMPONENT ------------------------- */
const BuyerItemDetails = () => {
  const { id } =
    useParams<{ id: string }>();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const { addItem } =
    useCart();

  const {
    user,
    isLoading: authLoading,
    authFetch,
  } = useAuth();

  const currentUserId:
    string | null =
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

  const [rating, setRating] =
    useState<number>(0);

  const [comment, setComment] =
    useState<string>("");

  const [
    editingReviewId,
    setEditingReviewId,
  ] = useState<string | null>(
    null
  );

  const [editRating, setEditRating] =
    useState<number>(0);

  const [
    editComment,
    setEditComment,
  ] = useState<string>("");

  /* ----------------------------- FETCH ------------------------- */
  const fetchItemAndReviews =
    async (
      showLoading = true
    ): Promise<void> => {
      if (!id) {
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      setError(false);

      try {
        const [
          itemRes,
          reviewsRes,
        ] = await Promise.all([
          fetch(
            `${config.API_BASE_URL}/spareparts/${id}/`
          ),
          authFetch(
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

        const itemData: SparePart =
          await itemRes.json();

        const reviewData: Review[] =
          await reviewsRes.json();

        const normalizedReviews:
          Review[] =
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
                review.rating !==
                null
                  ? Number(
                      review.rating
                    )
                  : null,
              total_likes: Number(
                review.total_likes ??
                  0
              ),
              total_dislikes:
                Number(
                  review.total_dislikes ??
                    0
                ),
              user_reaction:
                review.user_reaction ===
                true
                  ? true
                  : review.user_reaction ===
                      false
                    ? false
                    : null,
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
        if (showLoading) {
          setLoading(false);
        }
      }
    };

  /* ----------------------------- INITIAL LOAD ------------------------- */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    void fetchItemAndReviews(
      true
    );
  }, [
    authLoading,
    id,
    currentUserId,
  ]);

  /* ----------------------------- SCROLL TO TOP ------------------------- */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [id]);

  const averageRating =
    Number(
      item?.average_rating ?? 0
    );

  /* ----------------------------- USER REVIEW ------------------------- */
  const userReview =
    currentUserId !== null
      ? reviews.find(
          (review) =>
            String(
              review.user_id
            ) === currentUserId
        ) ?? null
      : null;

  /* ----------------------------- COMMENT REVIEWS ------------------------- */
  const commentReviews =
    reviews.filter(
      (review) =>
        Boolean(
          review.comment?.trim()
        )
    );

  const orderedCommentReviews =
    userReview?.comment?.trim()
      ? [
          userReview,
          ...commentReviews.filter(
            (review) =>
              String(
                review.id
              ) !==
              String(
                userReview.id
              )
          ),
        ]
      : commentReviews;

  /* ----------------------------- REVIEW ACTION ------------------------- */
  const handleReviewAction =
    async ({
      method,
      endpoint,
      body,
      successMessage,
    }: ReviewActionOptions): Promise<boolean> => {
      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}${endpoint}`,
            {
              method,
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: body
                ? JSON.stringify(
                    body
                  )
                : undefined,
            }
          );

        if (!res.ok) {
          const errData =
            await res
              .json()
              .catch(
                () => ({})
              );

          throw new Error(
            errData.error ??
              errData.detail ??
              errData.message ??
              "Action failed"
          );
        }

        if (successMessage) {
          toast.success(
            successMessage
          );
        }

        await fetchItemAndReviews(
          false
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Action failed"
        );

        return false;
      }
    };

  /* ----------------------------- REACT TO REVIEW ------------------------- */
  const reactToReview =
    async (
      review: Review,
      isLike: boolean
    ): Promise<void> => {
      if (
        currentUserId === null
      ) {
        toast.info(
          "Please log in to react to comments."
        );

        return;
      }

      if (
        String(
          review.user_id
        ) === currentUserId
      ) {
        toast.info(
          "You cannot react to your own comment."
        );

        return;
      }

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/reviews/${review.id}/react/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                is_like:
                  isLike,
              }),
            }
          );

        if (!res.ok) {
          const errData =
            await res
              .json()
              .catch(
                () => ({})
              );

          throw new Error(
            errData.error ??
              errData.detail ??
              errData.message ??
              "Reaction failed"
          );
        }

        await fetchItemAndReviews(
          false
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Reaction failed"
        );
      }
    };

  /* ----------------------------- CREATE REVIEW ------------------------- */
  const submitReview =
    (): void => {
      if (userReview) {
        toast.info(
          "You already reviewed this item."
        );

        return;
      }

      const trimmedComment =
        comment.trim();

      if (
        !rating &&
        !trimmedComment
      ) {
        toast.error(
          "Add a rating or comment."
        );

        return;
      }

      void handleReviewAction({
        method: "POST",
        endpoint: `/reviews/${id}/`,
        body: {
          rating:
            rating || null,
          comment:
            trimmedComment ||
            null,
        },
        successMessage:
          "Review added",
      }).then(
        (success) => {
          if (!success) {
            return;
          }

          setRating(0);
          setComment("");
        }
      );
    };

  /* ----------------------------- EDIT ------------------------- */
  const startEdit = (
    review: Review
  ): void => {
    if (
      currentUserId === null ||
      String(
        review.user_id
      ) !== currentUserId
    ) {
      toast.error(
        "You can only edit your own review."
      );

      return;
    }

    setEditingReviewId(
      review.id
    );

    setEditRating(
      review.rating ?? 0
    );

    setEditComment(
      review.comment ?? ""
    );
  };

  const cancelEdit =
    (): void => {
      setEditingReviewId(
        null
      );

      setEditRating(0);
      setEditComment("");
    };

  const saveEdit = (
    review: Review
  ): void => {
    if (
      currentUserId === null ||
      String(
        review.user_id
      ) !== currentUserId
    ) {
      toast.error(
        "You can only edit your own review."
      );

      return;
    }

    const trimmedComment =
      editComment.trim();

    if (
      !editRating &&
      !trimmedComment
    ) {
      toast.error(
        "Add a rating or comment."
      );

      return;
    }

    void handleReviewAction({
      method: "PATCH",
      endpoint: `/reviews/${review.id}/edit/`,
      body: {
        rating:
          editRating || null,
        comment:
          trimmedComment ||
          null,
      },
      successMessage:
        "Review updated",
    }).then(
      (success) => {
        if (success) {
          cancelEdit();
        }
      }
    );
  };

  /* ----------------------------- DELETE ------------------------- */
  const deleteReview = (
    review: Review
  ): void => {
    if (
      currentUserId === null ||
      String(
        review.user_id
      ) !== currentUserId
    ) {
      toast.error(
        "You can only delete your own review."
      );

      return;
    }

    void handleReviewAction({
      method: "DELETE",
      endpoint: `/reviews/${review.id}/delete/`,
      successMessage:
        "Review deleted",
    });
  };

 /* ----------------------------- BACK ------------------------- */
const handleBack =
  (): void => {
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
            "Failed to restore saved listing position:",
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
  if (
    loading ||
    authLoading
  ) {
    return (
      <ItemDetailsSkeleton />
    );
  }

  /* ----------------------------- ERROR ------------------------- */
  if (error) {
    return (
      <ErrorState
        onRetry={() =>
          void fetchItemAndReviews(
            true
          )
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
          mb-3
          mt-4
          inline-flex
          items-center
          justify-start
          rounded-md
          p-2
          text-[rgb(0,64,128)]
          transition-colors
          cursor-pointer
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
              value={averageRating}
              readonly
              size={22}
            />

            <span className="text-sm text-gray-700">
              {averageRating.toFixed(
                1
              )}{" "}
              (
              {
                reviews.filter(
                  (review) =>
                    review.rating !==
                    null
                ).length
              }
              )
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              addItem(item)
            }
            className="
              mt-4
              w-full
              rounded-md
              bg-[rgb(0,64,128)]
              px-5
              py-2.5
              font-medium
              text-white
              transition-colors
              cursor-pointer
              hover:bg-[rgb(17,49,82)]
            "
          >
            Add To Cart
          </button>
        </div>
      </div>

      {!userReview && (
        <div className="mb-8 border-y border-[#eee] p-4">
          <h3 className="mb-2 text-xl font-semibold">
            Add a Review
          </h3>

          <StarRating
            value={rating}
            onChange={setRating}
          />

          <textarea
            placeholder="Write a comment (optional)"
            value={comment}
            onChange={(e) =>
              setComment(
                e.target.value
              )
            }
            className="
              my-2
              min-h-[80px]
              w-full
              resize-y
              rounded-md
              border
              border-gray-300
              p-2
              outline-none
              transition
              focus:border-black
            "
          />

          <button
            type="button"
            onClick={submitReview}
            className="
              rounded-md
              bg-[rgb(0,64,128)]
              px-4
              py-2
              text-white
              transition-colors
              cursor-pointer
              hover:bg-[rgb(2,30,58)]
            "
          >
            Submit Review
          </button>
        </div>
      )}

      {userReview && (
        <div className="mb-8 border-y border-[#eee] p-4">
          {editingReviewId ===
          userReview.id ? (
            <>
              <StarRating
                value={editRating}
                onChange={setEditRating}
              />

              <textarea
                value={editComment}
                onChange={(e) =>
                  setEditComment(
                    e.target.value
                  )
                }
                placeholder="Write a comment (optional)"
                className="
                  mb-3
                  min-h-[80px]
                  w-full
                  resize-y
                  rounded-md
                  border
                  border-gray-300
                  p-3
                  outline-none
                  transition
                  focus:border-black
                "
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    saveEdit(
                      userReview
                    )
                  }
                  className="
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-1.5
                    text-white
                    transition-colors
                    cursor-pointer
                    hover:bg-[rgb(17,49,82)]
                  "
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={
                    cancelEdit
                  }
                  className="
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-1.5
                    text-white
                    transition-colors
                    cursor-pointer
                    hover:bg-[rgb(17,49,82)]
                  "
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3">
                <ProfileCircle
                  displayName={
                    userReview.user_display_name
                  }
                />

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[rgb(0,64,128)]">
                      {
                        userReview.user_display_name
                      }
                    </span>
                  </div>

                  <span className="text-sm text-gray-600">
                    {new Date(
                      userReview.created_at
                    ).toLocaleDateString(
                      "en-GB"
                    )}
                  </span>
                </div>
              </div>

              {userReview.rating !==
                null && (
                <StarRating
                  value={
                    userReview.rating
                  }
                  readonly
                />
              )}

              {userReview.comment?.trim() && (
                <p className="my-3 leading-6">
                  {
                    userReview.comment
                  }
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    startEdit(
                      userReview
                    )
                  }
                  className="
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-1.5
                    text-white
                    transition-colors
                    cursor-pointer
                    hover:bg-[rgb(17,49,82)]
                  "
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    deleteReview(
                      userReview
                    )
                  }
                  className="
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-1.5
                    text-white
                    transition-colors
                    cursor-pointer
                    hover:bg-[rgb(17,49,82)]
                  "
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-4 text-2xl font-semibold">
          Customer Comments (
          {
            orderedCommentReviews.length
          }
          )
        </h3>

        {orderedCommentReviews.length ===
        0 ? (
          <p className="py-4 text-gray-500">
            No customer comments yet.
          </p>
        ) : (
          orderedCommentReviews.map(
            (review) => {
              const displayName =
                review.user_display_name?.trim() ||
                "User";

              const isOwnComment =
                currentUserId !==
                  null &&
                String(
                  review.user_id
                ) ===
                  currentUserId;

              const currentReaction =
                review.user_reaction;

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
                  <div className="mb-2 flex items-center gap-3">
                    <ProfileCircle
                      displayName={
                        displayName
                      }
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block truncate font-bold text-[rgb(0,64,128)]">
                          {
                            displayName
                          }
                        </span>

                        {isOwnComment && (
                          <span className="shrink-0 rounded bg-[#0677f8] px-2 py-[2px] text-[0.8rem] text-white">
                            You
                          </span>
                        )}
                      </div>

                      <span className="text-sm text-gray-600">
                        {new Date(
                          review.created_at
                        ).toLocaleDateString(
                          "en-GB"
                        )}
                      </span>
                    </div>
                  </div>

                  <p className="my-2 leading-6">
                    {review.comment}
                  </p>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={
                        isOwnComment
                      }
                      onClick={() =>
                        void reactToReview(
                          review,
                          true
                        )
                      }
                      className="
                        inline-flex
                        items-center
                        gap-1
                        rounded
                        px-[10px]
                        py-1
                        text-[#333]
                        transition-colors
                        cursor-pointer
                        disabled:cursor-not-allowed
                      "
                      aria-label="Like comment"
                    >
                      <ThumbsUp
                        size={18}
                        strokeWidth={
                          2
                        }
                        fill="none"
                        className={
                          currentReaction ===
                          true
                            ? "text-green-600"
                            : "text-[#333]"
                        }
                      />

                      <span>
                        {
                          review.total_likes
                        }
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        isOwnComment
                      }
                      onClick={() =>
                        void reactToReview(
                          review,
                          false
                        )
                      }
                      className="
                        inline-flex
                        items-center
                        gap-1
                        rounded
                        px-[10px]
                        py-1
                        text-[#333]
                        transition-colors
                        cursor-pointer
                        disabled:cursor-not-allowed
                      "
                      aria-label="Dislike comment"
                    >
                      <ThumbsDown
                        size={18}
                        strokeWidth={
                          2
                        }
                        fill="none"
                        className={
                          currentReaction ===
                          false
                            ? "text-red-600"
                            : "text-[#333]"
                        }
                      />

                      <span>
                        {
                          review.total_dislikes
                        }
                      </span>
                    </button>
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

export default BuyerItemDetails;