import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Flame, RefreshCw } from "lucide-react";

import { useCart } from "../../contexts/CartContext";
import config from "../../config";
import Footer from "../shared/layout/Footer";

// ------------------ Interfaces ------------------

interface SparePart {
  id: string;
  image: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  discount_percentage: number;
}

interface SparePartsResponse {
  items?: SparePart[];
}

// ------------------ Skeleton ------------------

const SkeletonCard = () => (
  <div className="relative flex h-full flex-col gap-[10px] overflow-hidden rounded-xl bg-[#f3f3f3] p-3">
    <div className="absolute inset-0 overflow-hidden rounded-xl">
     <div className="h-full w-[150%] animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
   </div>
    <div className="relative z-10 h-44 rounded-lg bg-gray-300" />

    <div className="relative z-10 h-4 w-2/3 rounded bg-gray-300" />

    <div className="relative z-10 h-4 w-full rounded bg-gray-300" />

    <div className="relative z-10 h-10 rounded-md bg-gray-300" />
  </div>
);

const BuyerHomepage = () => {
  // ------------------ State ------------------

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const [loadedImages, setLoadedImages] = useState<
    Record<string, boolean>
  >({});

  const { addItem } = useCart();

  // ------------------ Fetch Spare Parts ------------------

  const fetchSpareParts = (): void => {
    setLoading(true);
    setError(null);

    fetch(`${config.API_BASE_URL}/spareparts?per_page=100`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Server error");
        }

        return res.json() as Promise<SparePartsResponse>;
      })
      .then((data) => {
        const items = Array.isArray(data.items) ? data.items : [];

        if (!items.length) {
          setSpareParts([]);
          setLoading(false);
          return;
        }

        const sorted = [...items].sort(
          (a, b) =>
            (b.discount_percentage ?? 0) -
            (a.discount_percentage ?? 0)
        );

        const grouped = sorted.reduce<Record<string, SparePart[]>>(
          (acc, item) => {
            const category = item.category || "Other";

            if (!acc[category]) {
              acc[category] = [];
            }

            acc[category].push(item);

            return acc;
          },
          {}
        );

        const top16: SparePart[] = [];

        while (top16.length < 16) {
          let added = false;

          for (const category of Object.keys(grouped)) {
            if (grouped[category]?.length) {
              const next = grouped[category].shift();

              if (next) {
                top16.push(next);
              }

              added = true;

              if (top16.length >= 16) {
                break;
              }
            }
          }

          if (!added) {
            break;
          }
        }

        const carouselItems = top16.slice(0, 8);

        const gridItems = top16
          .slice(8, 16)
          .sort(() => Math.random() - 0.5);

        setSpareParts([
          ...carouselItems,
          ...gridItems,
        ]);

        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);

        setError(
          "Unable to load spare parts. Please check your connection and try again."
        );

        setLoading(false);
      });
  };
    // ------------------ Initial Fetch ------------------

  useEffect(() => {
    fetchSpareParts();
  }, []);

  // ------------------ Carousel ------------------

  useEffect(() => {
    if (spareParts.length < 8) return;

    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % 8);
    }, 4000);

    return () => clearInterval(interval);
  }, [spareParts]);

  // ------------------ Handlers ------------------

  const handleAddToCart = (
    item: SparePart,
    e: MouseEvent<HTMLButtonElement>
  ): void => {
    e.preventDefault();
    e.stopPropagation();

    addItem(item);
  };

  const handleImageLoad = (id: string): void => {
    setLoadedImages((prev) => ({
      ...prev,
      [id]: true,
    }));
  };

  // ------------------ Derived Data ------------------

  const carouselItems = spareParts.slice(0, 8);

  const gridItems = spareParts.slice(8, 16);

  const visibleCarouselItems: SparePart[] =
    carouselItems.length > 0
      ? Array.from({
          length: Math.min(4, carouselItems.length),
        }).map(
          (_, i) =>
            carouselItems[(carouselIndex + i) % carouselItems.length]
        )
      : [];

  // ------------------ Error State ------------------

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <h2 className="mb-4 text-[1.8rem] font-semibold text-red-600">
          Something went wrong
        </h2>

        <p className="text-gray-600">{error}</p>

        <button
          onClick={fetchSpareParts}
          className="mt-3 flex items-center gap-[6px] rounded-lg bg-[#ff4d4f] px-4 py-[10px] 
                     text-white transition-colors duration-200 hover:bg-[#d9363e]"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }
    // ------------------ Render ------------------

  return (
     <div className="pt-24 px-[10px] pb-[70px] 
                     font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] sm:px-[15px] lg:px-5">
       <h2 className="mb-2 mt-2 flex items-center text-[1.2rem]
                      font-semibold text-red-600 sm:text-[1.5rem] lg:text-[1.8rem]">
        <span className="mr-[6px] inline-block animate-fire align-middle">
          <Flame size={24} color="red" />
        </span>

        Hot Deals
      </h2>

      <div className="mb-12 flex gap-1 overflow-x-auto scroll-smooth md:gap-[15px] md:overflow-hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="basis-[47%] flex-none md:flex-1">
              <SkeletonCard />
            </div>
          ))
        ) : visibleCarouselItems.length > 0 ? (
          visibleCarouselItems.map((item) => (
            <Link
              key={item.id}
              to={`/items/${item.id}`}
              className="basis-[50%] flex-none text-inherit no-underline md:basis-[45%] lg:flex-1"
            >
              <div
                className={`flex h-full cursor-pointer flex-col items-center 
                          rounded-xl bg-white p-[10px] shadow-[0_4px_10px_rgba(0,0,0,0.1)] 
                          transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]
                          sm:p-3 ${
                  loadedImages[item.id] ? "" : "animate-pulse"
                }`}
              >
                <img
                  src={item.image}
                  alt={item.brand}
                  onLoad={() => handleImageLoad(item.id)}
                  className="mb-[10px] mt-10 w-[50%] rounded-lg object-cover sm:mt-0 sm:w-1/2 sm:object-contain"
                />

                <h4 className="my-[5px] mb-[10px] self-start text-left text-[0.9rem] 
                               text-[#333] sm:self-auto sm:text-center sm:text-base">
                  {item.brand} {item.category} for {item.vehicle_type}
                </h4>

                <p className="mb-[10px] text-base font-bold text-[rgb(255,0,0)] sm:text-lg">
                  KES {item.buying_price.toLocaleString()}

                  {item.discount_percentage > 0 && (
                    <span className="ml-[5px] text-xs text-[rgba(228, 26, 19, 0.67)]">
                      (-{item.discount_percentage.toFixed(0)}%)
                    </span>
                  )}
                </p>

                <button
                  onClick={(e) => handleAddToCart(item, e)}
                  className="rounded-md bg-[rgb(0,64,128)] px-4 py-2 
                             text-sm font-bold text-white hover:bg-[rgb(4,37,71)] 
                             transition-colors duration-200"
                >
                  Add To Cart
                </button>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-red-600">No deals available</p>
        )}
      </div>
            <h2 className="mb-5 mt-5 text-[1.2rem] font-semibold text-red-600 sm:text-[1.5rem] lg:text-[1.8rem]">
        More Deals
      </h2>

      <div
        className="
          mb-5
          grid
          grid-cols-3
          gap-3

          md:mb-[50px]
          md:grid-cols-2
          md:gap-5

          lg:grid-cols-3

          xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]

          2xl:grid-cols-5
        "
      >
        {loading ? (
          Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))
        ) : gridItems.length > 0 ? (
          gridItems.map((item) => (
            <Link
              key={item.id}
              to={`/items/${item.id}`}
              className="text-inherit no-underline"
            >
              <div
                className={`flex h-full cursor-pointer flex-col items-center 
                            rounded-xl bg-white p-[10px] shadow-[0_4px_10px_rgba(0,0,0,0.1)] 
                            transition-all duration-200 
                            hover:-translate-y-1 hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)] 
                            sm:p-3 ${
                  loadedImages[item.id] ? "" : "animate-pulse"
                }`}
              >
                <img
                  src={item.image}
                  alt={item.brand}
                  onLoad={() => handleImageLoad(item.id)}
                  className="mb-[10px] mt-10 w-[70%] rounded-lg object-cover
                             sm:mt-0 sm:w-1/2 sm:object-contain"
                />

                <h4 className="my-[5px] mb-[10px] self-start text-left 
                               text-[0.9rem] text-[#333] sm:self-auto sm:text-center sm:text-base">
                  {item.brand} {item.category} for {item.vehicle_type}
                </h4>

                <p className="mb-[10px] text-base font-semibold text-[rgb(255,0,0)] sm:text-lg">
                  KES {item.buying_price.toLocaleString()}

                  {item.discount_percentage > 0 && (
                    <span className="ml-[5px] text-xs text-[rgba(228,26,19,0.61)]">
                      (-{item.discount_percentage.toFixed(0)}%)
                    </span>
                  )}
                </p>

                <button
                  onClick={(e) => handleAddToCart(item, e)}
                className="rounded-md bg-[rgb(0,64,128)] px-2 py-2.5 text-sm font-bold 
                           text-white hover:bg-[rgb(4,37,71)] 
                           transition-colors duration-200"
                >
                  Add To Cart
                </button>
              </div>
            </Link>
          ))
        ) : (
          <p className="col-span-full text-center text-red-600">
            No items available
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default BuyerHomepage;