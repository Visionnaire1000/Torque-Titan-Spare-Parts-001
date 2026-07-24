import { type CSSProperties, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw, Star, ThumbsDown, ThumbsUp } from "lucide-react";
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

  user_display_name?: string;
  display_name: string;
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

        if (roundedValue >= star)
          fillPercent = 100;
        else if (
          roundedValue + 0.5 === star
        )
          fillPercent = 50;

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
              className="absolute top-0 left-0 overflow-hidden"
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

/* -------------------------------- Skeleton -------------------------------- */
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
        className="mb-3 rounded-md border border-gray-300 bg-[#fafafa] p-3"
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
              borderRadius={50}
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
      </div>
    ))}
  </div>
);

const LoggedOutItemDetails = () => {
  const { id } = useParams<{
    id: string;
  }>();

  /* ---------------- State ---------------- */
  const [item, setItem] =
    useState<SparePart | null>(null);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  /* ---------------- Fetch ---------------- */
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

       const normalizedReviews =
          reviewData.map((review) => ({
           ...review,
         display_name:
         review.user_display_name ??
         review.display_name ??
         "User",
       }));

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
    fetchItemAndReviews();
  }, [id]);

  /* ---------------- Derived ---------------- */
  const averageRating = Number(
    item?.average_rating ?? 0
  );

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
      </div>
    </div>

      {/* ---------------- Reviews ---------------- */}
    <div className="mt-8">
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

      {reviews.length === 0 ? (
        <p className="text-gray-500">
          No reviews yet.
        </p>
      ) : (
        reviews.map((review: Review) => (
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
            <div className="mb-2 flex items-center justify-between">
              <span className="ml-3 font-bold text-[rgb(0,64,128)]">
                {review.display_name}
              </span>

              <span className="text-sm text-gray-600">
                {new Date(
                  review.created_at
                ).toLocaleDateString("en-GB")}
              </span>
            </div>

            <div className="mb-2">
              <StarRating
                value={review.rating ?? 0}
                readonly
                size={20}
              />
            </div>

            {review.comment && (
              <p className="my-2 leading-6 text-gray-800">
                {review.comment}
              </p>
            )}

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
        ))
      )}
    </div>
  </div>
);
};

export default LoggedOutItemDetails;