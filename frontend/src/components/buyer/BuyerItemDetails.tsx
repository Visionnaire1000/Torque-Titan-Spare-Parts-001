import { type CSSProperties, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { RefreshCw, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import config from "../../config";

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

  user_reaction: boolean | null;

  display_name: string;
  user_display_name?: string;
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

interface ReviewReactionResponse {
  review: {
    total_likes: number;
    total_dislikes: number;
  };
}

interface ReviewActionOptions<T = unknown> {
  method: "POST" | "PATCH" | "DELETE";

  endpoint: string;

  body?: Record<string, unknown>;

  successMessage?: string;

  updateFn?: (data: T) => void;
}

/* -------------------------------- ERROR STATE -------------------------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps) => (
  <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
    <h2 className="text-3xl font-bold text-red-600">
      Something went wrong
    </h2>

    <p className="max-w-md text-gray-600">
      Unable to load spare parts. Please check your
      connection and try again.
    </p>

    <button
      onClick={onRetry}
      className="flex items-center gap-2 rounded-md bg-[rgb(0,64,128)] px-5 py-2 text-white transition-colors hover:bg-[rgb(17,49,82)]"
    >
      <RefreshCw size={18} />

      Retry
    </button>
  </div>
);

/* -------------------------------- STAR RATING -------------------------------- */
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

  const handleClick = (star: number) => {
    if (readonly || !onChange) return;

    setCurrentValue(star);
    onChange(star);
  };

  const handleMouseEnter = (
    star: number
  ) => {
    if (readonly) return;

    setHoverValue(star);
  };

  const handleMouseLeave = () => {
    if (readonly) return;

    setHoverValue(0);
  };

  const displayValue =
    hoverValue || currentValue;

  const roundedValue =
    Math.round(displayValue * 2) / 2;

  return (
    <div className="my-2 flex gap-[2px]">
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
              className="absolute left-0 top-0 overflow-hidden"
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

/* -------------------------------- SKELETON -------------------------------- */
const Skeleton = ({
  width,
  height,
  borderRadius = 4,
  style,
}: SkeletonProps) => (
  <div
    className="relative overflow-hidden bg-gray-200 shimmer"
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
  />
);

/* -------------------------- ITEM DETAILS SKELETON -------------------------- */
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
    {/* ---------------- Item ---------------- */}
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
          {[...Array(5)].map((_, i) => (
            <Skeleton
              key={i}
              width="22px"
              height="22px"
              borderRadius={999}
            />
          ))}
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

    {/* ---------------- Add Review ---------------- */}
    <div className="mb-8 border-y border-[#eee] p-4">
      <Skeleton
        width="30%"
        height="24px"
      />

      <div className="my-2 flex gap-[5px]">
        {[...Array(5)].map((_, i) => (
          <Skeleton
            key={i}
            width="22px"
            height="22px"
            borderRadius={999}
          />
        ))}
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

    {/* ---------------- Reviews ---------------- */}
    <div>
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
          <Skeleton
            width="120px"
            height="16px"
          />

          <Skeleton
            width="80px"
            height="14px"
            style={{
              marginTop: 4,
            }}
          />

          <div className="my-1 flex gap-[5px]">
            {[...Array(5)].map((_, j) => (
              <Skeleton
                key={j}
                width="20px"
                height="20px"
                borderRadius={999}
              />
            ))}
          </div>

          <Skeleton
            width="90%"
            height="14px"
            style={{
              marginTop: 4,
            }}
          />

          <div className="mt-1 flex gap-[5px]">
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
      ))}
    </div>
  </div>
);

const BuyerItemDetails = () => {
  const { id } = useParams<{ id: string }>();

  const { addItem } = useCart();
  const { user, authFetch } = useAuth();

  const currentUserId = user?.id;

  /* ---------------- State ---------------- */
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
  ] = useState<string | null>(null);

  const [editRating, setEditRating] =
    useState<number>(0);

  const [
    editComment,
    setEditComment,
  ] = useState<string>("");

  /* ---------------- Fetch Item + Reviews ---------------- */
  const fetchItemAndReviews =
    async (): Promise<void> => {
      if (!id) return;

      setLoading(true);
      setError(false);

      try {
        const [
          itemRes,
          reviewsRes,
        ] = await Promise.all([
          fetch(
            `${config.API_BASE_URL}/spareparts/${id}`
          ),
          fetch(
            `${config.API_BASE_URL}/reviews/${id}`
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

        const reviewsWithReaction: Review[] =
          reviewData.map((review) => {
            const userReaction =
              review.likes?.find(
                (like) =>
                  like.user_id ===
                  currentUserId
              );

            return {
              ...review,

              user_reaction:
                userReaction ===
                undefined
                  ? null
                  : userReaction.is_like,

              display_name:
                review.user_display_name ??
                "User",
            };
          });

        setItem(itemData);

        setReviews(
          reviewsWithReaction
        );
      } catch (err) {
        console.error(err);

        setError(true);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchItemAndReviews();
  }, [id]);

  /* ---------------- Derived Values ---------------- */
  const averageRating = Number(
    item?.average_rating ?? 0
  );

  const userReview =
    reviews.find(
      (review) =>
        review.user_id === currentUserId
    ) ?? null;

    /* ---------------- Review Actions ---------------- */

const handleReviewAction = async <T,>({
  method,
  endpoint,
  body,
  successMessage,
  updateFn,
}: ReviewActionOptions<T>): Promise<void> => {
  try {
    const res = await authFetch(
      `${config.API_BASE_URL}${endpoint}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body
          ? JSON.stringify(body)
          : undefined,
      }
    );

    if (!res.ok) {
      const errData: {
        message?: string;
      } = await res
        .json()
        .catch(() => ({}));

      throw new Error(
        errData.message ??
          "Action failed"
      );
    }

    const data: T | null =
      method === "DELETE"
        ? null
        : ((await res.json()) as T);

    if (
      updateFn &&
      data !== null
    ) {
      updateFn(data);
    }

    if (successMessage) {
      toast.success(successMessage);
    }

    fetchItemAndReviews();
  } catch (err) {
    toast.error(
      err instanceof Error
        ? err.message
        : "Action failed"
    );
  }
};

/* ---------------- Submit Review ---------------- */

const submitReview = (): void => {
  if (userReview) {
    toast.info(
      "You already reviewed this item. You can edit or delete your review."
    );
    return;
  }

  if (
    !rating &&
    !comment.trim()
  ) {
    toast.error(
      "Add a rating or comment"
    );
    return;
  }

  handleReviewAction<Review>({
    method: "POST",

    endpoint: `/reviews/${id}`,

    body: {
      rating:
        rating || undefined,

      comment:
        comment.trim() ||
        undefined,
    },

    successMessage:
      "Review added",

    updateFn: (
      newReview
    ) =>
      setReviews((prev) => [
        newReview,
        ...prev,
      ]),
  });

  setRating(0);
  setComment("");
};

/* ---------------- Edit Review ---------------- */

const startEdit = (
  review: Review
): void => {
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

const cancelEdit = (): void => {
  setEditingReviewId(null);

  setEditRating(0);

  setEditComment("");
};

const saveEdit = (
  reviewId: string
): void => {
  if (
    !editRating &&
    !editComment.trim()
  ) {
    toast.error(
      "Add a rating or comment"
    );
    return;
  }

  handleReviewAction<Review>({
    method: "PATCH",

    endpoint: `/reviews/edit/${reviewId}`,

    body: {
      rating:
        editRating ||
        undefined,

      comment:
        editComment.trim() ||
        undefined,
    },

    successMessage:
      "Review updated",

    updateFn: (
      updatedReview
    ) =>
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? updatedReview
            : review
        )
      ),
  });

  cancelEdit();
};

/* ---------------- Delete Review ---------------- */
const deleteReview = (
  reviewId: string
): void => {
  handleReviewAction<void>({
    method: "DELETE",

    endpoint: `/reviews/edit/${reviewId}`,

    successMessage:
      "Review deleted",

    updateFn: () =>
      setReviews((prev) =>
        prev.filter(
          (review) =>
            review.id !== reviewId
        )
      ),
  });
};

/* ---------------- Review Reactions ---------------- */
const reactToReview = async (
  reviewId: string,
  isLike: boolean,
  reviewUserId: string
): Promise<void> => {
  if (
    reviewUserId ===
    currentUserId
  ) {
    toast.info(
      "Cannot react to your own review"
    );
    return;
  }

  setReviews((prev) =>
    prev.map((review) => {
      if (
        review.id !== reviewId
      ) {
        return review;
      }

      let newUserReaction:
        | boolean
        | null =
        review.user_reaction;

      let newLikes =
        review.total_likes;

      let newDislikes =
        review.total_dislikes;

      if (
        review.user_reaction ===
        isLike
      ) {
        newUserReaction =
          null;

        if (isLike) {
          newLikes = Math.max(
            0,
            review.total_likes - 1
          );
        } else {
          newDislikes =
            Math.max(
              0,
              review.total_dislikes - 1
            );
        }
      } else {
        newUserReaction =
          isLike;

        if (isLike) {
          newLikes =
            review.total_likes + 1;

          if (
            review.user_reaction ===
            false
          ) {
            newDislikes =
              Math.max(
                0,
                review.total_dislikes - 1
              );
          }
        } else {
          newDislikes =
            review.total_dislikes + 1;

          if (
            review.user_reaction ===
            true
          ) {
            newLikes = Math.max(
              0,
              review.total_likes - 1
            );
          }
        }
      }

      return {
        ...review,

        user_reaction:
          newUserReaction,

        total_likes:
          newLikes,

        total_dislikes:
          newDislikes,
      };
    })
  );

  try {
    const res =
      await authFetch(
        `${config.API_BASE_URL}/reviews/${reviewId}/react`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            is_like: isLike,
          }),
        }
      );

    if (!res.ok) {
      throw new Error(
        "Failed to react"
      );
    }

    const data: ReviewReactionResponse =
      await res.json();

    setReviews((prev) =>
      prev.map((review) =>
        review.id === reviewId
          ? {
              ...review,

              total_likes:
                data.review
                  .total_likes,

              total_dislikes:
                data.review
                  .total_dislikes,
            }
          : review
      )
    );
  } catch (err) {
    toast.error(
      err instanceof Error
        ? err.message
        : "Action failed"
    );

    fetchItemAndReviews();
  }
};

/* -------------------------------- Render -------------------------------- */
if (loading) {
  return <ItemDetailsSkeleton />;
}

if (error) {
  return (
    <ErrorState
      onRetry={fetchItemAndReviews}
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

const sortedReviews: Review[] = [...reviews].sort(
  (a, b) =>
    a.user_id === currentUserId
      ? -1
      : b.user_id === currentUserId
      ? 1
      : 0
);

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
          {item.brand} {item.category} for{" "}
          {item.vehicle_type}
        </h2>

        <p className="mb-2 text-lg font-semibold text-red-600">
          KES {item.buying_price.toLocaleString()}

          {item.discount_percentage > 0 && (
            <span className="ml-[5px] text-sm text-[#e41a139b]">
              (-{item.discount_percentage.toFixed(0)}%)
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
            {averageRating.toFixed(1)} (
            {
              reviews.filter(
                (review: Review) =>
                  review.rating != null
              ).length
            }
            )
          </span>
        </div>

        <button
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
            hover:bg-[rgb(17,49,82)]
          "
        >
          Add To Cart
        </button>
      </div>
    </div>

    {!userReview ? (
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
          onChange={(
            e: React.ChangeEvent<HTMLTextAreaElement>
          ) =>
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
          onClick={submitReview}
          className="
            rounded-md
            bg-[rgb(0,64,128)]
            px-4
            py-2
            text-white
            transition-colors
            hover:bg-[rgb(2,30,58)]
          "
        >
          Submit Review
        </button>
      </div>
    ) : (
      <p className="mb-8 text-gray-500">
        You already reviewed this item.
        You can edit or delete your
        review below.
      </p>
    )}

    <div>
      <h3 className="mb-4 text-2xl font-semibold">
        Customer Reviews (
        {
          reviews.filter(
            (review: Review) =>
              review.comment?.trim()
          ).length
        }
        )
      </h3>

      {sortedReviews.map((review: Review) => (
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
          {editingReviewId === review.id ? (
            <>
              <StarRating
                value={editRating}
                onChange={setEditRating}
              />

              <textarea
                value={editComment}
                onChange={(
                  e: React.ChangeEvent<HTMLTextAreaElement>
                ) =>
                  setEditComment(
                    e.target.value
                  )
                }
                className="
                  mb-3
                  h-[70px]
                  w-full
                  resize-y
                  rounded-md
                  border
                  border-gray-300
                  p-3
                  text-sm
                  outline-none
                  transition
                  focus:border-black
                "
              />

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    saveEdit(review.id)
                  }
                  className="
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-1.5
                    text-white
                    transition-colors
                    hover:bg-[rgb(17,49,82)]
                  "
                >
                  Save
                </button>

                <button
                  onClick={cancelEdit}
                  className="
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-1.5
                    text-white
                    transition-colors
                    hover:bg-[rgb(17,49,82)]
                  "
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="ml-3 font-bold text-[rgb(0,64,128)]">
                  {review.user_id ===
                  currentUserId ? (
                    <span className="ml-1 rounded bg-[#0677f8] px-2 py-[2px] text-[0.8rem] text-white">
                      You
                    </span>
                  ) : (
                    review.display_name
                  )}
                </span>

                <span className="text-sm text-gray-600">
                  {new Date(
                    review.created_at
                  ).toLocaleDateString(
                    "en-GB"
                  )}
                </span>
              </div>

              <StarRating
                value={review.rating ?? 0}
                readonly
                size={20}
              />

              {review.comment && (
                <p className="my-2 leading-6">
                  {review.comment}
                </p>
              )}

              {review.user_id ===
              currentUserId ? (
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      startEdit(review)
                    }
                    className="
                      rounded-md
                      bg-[rgb(0,64,128)]
                      px-3
                      py-1.5
                      text-white
                      transition-colors
                      hover:bg-[rgb(17,49,82)]
                    "
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      deleteReview(
                        review.id
                      )
                    }
                    className="
                      rounded-md
                      bg-[rgb(0,64,128)]
                      px-3
                      py-1.5
                      text-white
                      transition-colors
                      hover:bg-[rgb(17,49,82)]
                    "
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      reactToReview(
                        review.id,
                        true,
                        review.user_id
                      )
                    }
                    className={`inline-flex items-center gap-1 rounded bg-[#e0e0e0] px-[10px] py-1 transition-colors hover:bg-[#d5d5d5] ${
                      review.user_reaction ===
                      true
                        ? "text-[#0f9d58]"
                        : "text-[#333]"
                    }`}
                  >
                    <ThumbsUp size={16} />
                    {review.total_likes}
                  </button>

                  <button
                    onClick={() =>
                      reactToReview(
                        review.id,
                        false,
                        review.user_id
                      )
                    }
                    className={`inline-flex items-center gap-1 rounded bg-[#e0e0e0] px-[10px] py-1 transition-colors hover:bg-[#d5d5d5] ${
                      review.user_reaction ===
                      false
                        ? "text-[#d93025]"
                        : "text-[#333]"
                    }`}
                  >
                    <ThumbsDown size={16} />
                    {review.total_dislikes}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  </div>
);
};

export default BuyerItemDetails;