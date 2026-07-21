import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart, type SparePart } from "../../../contexts/CartContext";
import config from "../../../config";

interface ApiSparePart extends SparePart {
  name: string;
  image_url?: string;
  discount_percentage: number;
}

interface SparePartsResponse {
  items: ApiSparePart[];
}

const SkeletonCard = () => (
  <div className="mr-[30px] flex flex-col rounded-xl bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.06)] max-[480px]:mr-0">
    <div className="mb-[10px] h-40 w-full animate-shimmer rounded-[10px]" />
    <div className="h-[14px] w-4/5 animate-shimmer rounded-md" />
  </div>
);

const SearchResults = () => {
  const location = useLocation();

  const [items, setItems] = useState<ApiSparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] =
    useState<Record<string, boolean>>({});

  const { addItem } = useCart();

  const params = new URLSearchParams(location.search);

  const keyword = params.get("query");
  const brand = params.get("brand");
  const vehicle = params.get("vehicle");
  const category = params.get("category");

  const handleImageLoad = (id: string) => {
    setLoadedImages((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  const handleAddToCart = (
    item: ApiSparePart,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(item);
  };

  useEffect(() => {
    setLoading(true);

    fetch(`${config.API_BASE_URL}/spareparts?per_page=1000`)
      .then((res) => res.json())
      .then((data: SparePartsResponse) => {
        let results = data.items ?? [];

        if (keyword) {
          const words = keyword.toLowerCase().split(/\s+/);

          results = results.filter((item) => {
            const text =
              `${item.name} ${item.brand} ${item.category} ${item.vehicle_type}`.toLowerCase();

            return words.every((word) => text.includes(word));
          });
        }

        if (brand && vehicle && category) {
          results = results.filter(
            (item) =>
              item.brand.toLowerCase() === brand.toLowerCase() &&
              item.vehicle_type.toLowerCase() === vehicle.toLowerCase() &&
              item.category.toLowerCase() === category.toLowerCase()
          );
        }

        setItems(results);
        setLoading(false);
      });
  }, [keyword, brand, vehicle, category]);

    return (
    <div className="mx-auto mt-[70px] max-w-[1200px] p-8 text-[#222]">
      <h2 className="mb-6 text-[1.6rem] font-semibold">
        {keyword && `Results for "${keyword}"`}
        {brand &&
          vehicle &&
          category &&
          ` Category: ${brand} ${vehicle} ${category}`}
      </h2>

      {loading ? (
        <div
          className="
            grid
            grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
            gap-[30px]
            max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
            max-[480px]:gap-5
          "
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-12 text-center text-base text-[#888]">
          No items found
        </p>
      ) : (
        <div
          className="
            grid
            grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
            gap-[30px]
            max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
            max-[480px]:gap-5
          "
        >
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/items/${item.id}`}
              className="text-inherit no-underline"
            >
              <div
                className={`
                  flex flex-col
                  rounded-xl
                  bg-white
                  p-3
                  text-[#222]
                  shadow-[0_4px_12px_rgba(0,0,0,0.06)]
                  transition-all
                  duration-200
                  hover:-translate-y-1
                  hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]
                  mr-[30px]
                  max-[480px]:mr-0
                  ${
                    loadedImages[item.id]
                      ? ""
                      : "pointer-events-none"
                  }
                `}
              >
                <img
                  className="mb-[10px] h-auto w-[70%] rounded-[10px] object-cover"
                  src={item.image || item.image_url}
                  alt={item.brand}
                  onLoad={() => handleImageLoad(item.id)}
                />

                <h4 className="my-[5px] text-[0.95rem] font-semibold">
                  {item.brand} {item.category} for {item.vehicle_type}
                </h4>

                <p className="mb-[6px] font-semibold text-[rgb(255,0,0)]">
                  KES {item.buying_price.toLocaleString()}

                  {item.discount_percentage > 0 && (
                    <span className="ml-[5px] text-sm text-[#e41a139b]">
                      (-{item.discount_percentage.toFixed(0)}%)
                    </span>
                  )}
                </p>

                <button
                  onClick={(e) => handleAddToCart(item, e)}
                  className="
                    mt-auto
                    cursor-pointer
                    rounded-md
                    bg-[rgb(0,64,128)]
                    px-3
                    py-2
                    font-semibold
                    text-white
                    transition-colors
                    duration-200
                    hover:bg-[rgb(0,90,180)]
                  "
                >
                  Add To Cart
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchResults;