import { useEffect, useState, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useCart } from "../../../../contexts/CartContext";
import config from "../../../../config";

/* ---------------- Types ---------------- */
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
  items: SparePart[];
  pages: number;
}

interface ErrorStateProps {
  onRetry: () => Promise<void>;
}


/* ---------------- Skeleton Card ---------------- */
const SkeletonCard = (): ReactElement => (
  <div
    className="
      relative
      flex
      h-full
      flex-col
      items-center
      overflow-hidden
      rounded-xl
      bg-[#f6f7f8]
      p-3

      before:absolute
      before:left-[-150%]
      before:top-0
      before:h-full
      before:w-[150%]
      before:animate-[shimmer_1.4s_infinite]
      before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]
      before:content-['']
    "
  >
    <div
      className="
        mb-[10px]
        h-[140px]
        w-full
        rounded-[10px]
        bg-[#e0e0e0]
      "
    />

    <div
      className="
        my-2
        h-3
        w-4/5
        rounded-md
        bg-[#e0e0e0]
      "
    />

    <div
      className="
        my-2
        h-3
        w-3/5
        rounded-md
        bg-[#e0e0e0]
      "
    />

    <div
      className="
        my-2
        h-3
        w-2/5
        rounded-md
        bg-[#e0e0e0]
      "
    />

    <div
      className="
        mt-[10px]
        h-8
        w-full
        rounded-lg
        bg-[#e0e0e0]
      "
    />
  </div>
);

/* ---------------- Error State ---------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps): ReactElement => (
  <div
    className="
      px-5
      py-10
      text-center
    "
  >
    <h2
      className="
        mb-[10px]
        text-2xl
        font-semibold
      "
    >
      Something went wrong
    </h2>

    <p
      className="
        mb-5
        text-[#666]
      "
    >
      Unable to load spare parts. Please check your connection and try again.
    </p>

    <button
      onClick={() => void onRetry()}
      className="
        inline-flex
        items-center
        gap-2
        rounded-md
        bg-[#111]
        px-5
        py-2.5
        text-white
        transition-opacity
        hover:opacity-85
      "
    >
      <RefreshCw
        size={18}
        className="
          transition-transform
          duration-500
        "
      />

      Retry
    </button>
  </div>
);

/* ---------------- Component ---------------- */
const BusRims = (): ReactElement => {
  const [items, setItems] = useState<SparePart[]>([]);

  const [brand, setBrand] = useState<string>("");
  const [colour, setColour] = useState<string>("");
  const [price, setPrice] = useState<string>("");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const { addItem } = useCart();

  const availableBrands: string[] = [
    "Enkei",
    "BBS",
    "OZ Racing",
    "Konig",
    "HRE",
    "Vossen",
    "Advan",
  ];

  const availableColours: string[] = [
    "silver",
    "black",
    "gold",
  ];

  /* ---------------- Fetch Rims ---------------- */
  const fetchRims = async (): Promise<void> => {

    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      category: "rim",
      vehicle_type: "truck",
      ...(brand && { brand }),
      ...(colour && { colour }),
      ...(price && { price }),
      page: currentPage.toString(),
      per_page: "16",
    });

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/spareparts?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed");
      }

      const data: SparePartsResponse =
        await response.json();

      setItems(data.items ?? []);

      setTotalPages(data.pages ?? 1);

    } catch (err) {
      console.error(err);

      setItems([]);

      setError(true);

    } finally {

      setLoading(false);
    }

  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {

    void fetchRims();

  }, [
    brand,
    colour,
    price,
    currentPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);

  }, [
    brand,
    colour,
    price,
  ]);

  /* ---------------- Cart ---------------- */
  const handleAddToCart = (
    item: SparePart,
    event: MouseEvent<HTMLButtonElement>
  ): void => {

    event.preventDefault();

    event.stopPropagation();

    addItem(item);

  };

  /* ---------------- Pagination ---------------- */
  const getVisiblePages = (): number[] => {
    const pages: number[] = [];

    const maxVisible = 5;

    let start = Math.max(currentPage - 2, 1);
    let end = Math.min(start + maxVisible - 1, totalPages);

    start = Math.max(end - maxVisible + 1, 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

 /* ---------------- Render ---------------- */
return (
  <div
    className="
      mt-[70px]
      bg-[#f9f9f9]
      p-5
      pb-[70px]
      font-[Arial,sans-serif]
      max-[480px]:max-w-[480px]
    "
  >
    
      {/* -------- Filters -------- */}
      {!error && (

        <div
          className="
            flex
            flex-wrap
            justify-center
            gap-[15px]
            mb-[25px]
            mt-5
          "
        >
          <select
            value={brand}
            onChange={(e) =>
              setBrand(e.target.value)
            }
            className="
              py-2
              px-3
              text-sm
              rounded-md
              border
              border-[#ccc]
              bg-white
              cursor-pointer
              transition-colors
              hover:border-[#0077ff]
              max-[480px]:py-1
              max-[480px]:px-4
              max-[480px]:text-base
            "
          >
            <option value="">
              All Brands
            </option>
            {availableBrands.map((itemBrand) => (

              <option
                key={itemBrand}
                value={itemBrand}
              >
                {itemBrand}
              </option>

            ))}

          </select>
          <select
            value={colour}
            onChange={(e) =>
              setColour(e.target.value)
            }
            className="
              py-2
              px-3
              text-sm
              rounded-md
              border
              border-[#ccc]
              bg-white
              cursor-pointer
              transition-colors
              hover:border-[#0077ff]
              max-[480px]:py-1
              max-[480px]:px-4
              max-[480px]:text-base
            "
          >
            <option value="">
              All Colours
            </option>
            {availableColours.map((itemColour) => (
              <option
                key={itemColour}
                value={itemColour}
              >
                {
                  itemColour.charAt(0).toUpperCase() +
                  itemColour.slice(1)
                }
              </option>
            ))}
          </select>
          <select
            value={price}
            onChange={(e) =>
              setPrice(e.target.value)
            }
            className="
              py-2
              px-3
              text-sm
              rounded-md
              border
              border-[#ccc]
              bg-white
              cursor-pointer
              transition-colors
              hover:border-[#0077ff]
              max-[480px]:py-1
              max-[480px]:px-4
              max-[480px]:text-base
            "
          >
            <option value="">
              All Prices
            </option>
            <option value="low">
              Low (&lt; 25k)
            </option>
            <option value="medium">
              Medium (25k–30k)
            </option>
            <option value="high">
              High (&gt; 30k)
            </option>
          </select>
        </div>
      )}

    {/* -------- Error State -------- */}
    {error ? (

      <ErrorState onRetry={fetchRims} />
    ) : (
      <>
        {/* -------- Products Grid -------- */}
        <div
          className="
            grid
            grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
            gap-5
            max-[480px]:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]
          "
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))
          ) : items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                className="
                  flex
                  h-full
                  cursor-pointer
                  flex-col
                  items-center
                  rounded-xl
                  bg-white
                  p-3
                  shadow-[0_4px_10px_rgba(0,0,0,0.1)]
                  transition-all
                  duration-200
                  hover:-translate-y-1
                  hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]
                  max-[480px]:shadow-[0_4px_12px_rgba(0,0,0,0.06)]
                "
              >
                <Link
                  to={`/items/${item.id}`}
                  className="
                    flex
                    h-full
                    w-full
                    flex-col
                    items-center
                    no-underline
                    text-inherit
                  "
                >
                  <img
                    src={item.image}
                    alt={item.brand}
                    className="
                      mb-[10px]
                      h-[150px]
                      w-full
                      rounded-lg
                      object-contain
                      max-[480px]:h-auto
                      max-[480px]:w-[60%]
                      max-[480px]:object-cover
                    "
                  />
                  <h4
                    className="
                      my-[5px]
                      mb-[10px]
                      text-center
                      text-base
                      text-[#333]
                    "
                  >
                    {item.brand} {item.category} for{" "}
                    {item.vehicle_type}
                  </h4>

                  <p
                    className="
                      mb-[10px]
                      text-lg
                      font-bold
                      text-[#FF0000]
                    "
                  >
                    KES {item.buying_price.toLocaleString()}

                    {item.discount_percentage > 0 && (
                      <span
                        className="
                          ml-[5px]
                          font-normal
                          text-[#d9534f]
                        "
                      >
                        (-{item.discount_percentage.toFixed(0)}%)
                      </span>
                    )}

                  </p>
                  <button
                    onClick={(event) =>
                      handleAddToCart(item,event)
                    }
                    className="
                      rounded-md
                      bg-[rgb(0,64,128)]
                      px-3
                      py-2
                      font-bold
                      text-white
                      transition-colors
                      hover:bg-[rgb(4,37,71)]
                    "
                  >
                    Add To Cart
                  </button>

                </Link>

              </div>

            ))

          ) : (
            <p
              className="
                col-span-full
                mb-20
                text-center
                text-base
                text-[#7f0d0d]
              "
            >
              No truck rims found.
            </p>
          )}

        </div>
        {/* -------- Pagination -------- */}
        {loading ? (
          <div className="mt-4 flex justify-center gap-2">

            {[1,2,3,4].map((item)=>(
              <div
                key={item}
                className="
                  h-8
                  w-10
                  rounded-md
                  bg-[#e0e0e0]
                "
              />
            ))}

          </div>
        ) : totalPages > 1 && (
          <div
            className="
              my-[30px]
              flex
              flex-wrap
              items-center
              justify-center
              gap-[6px]
            "
          >
            <button
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page)=>
                  Math.max(page - 1,1)
                )
              }
              className="
                rounded
                border
                border-[#ddd]
                bg-white
                px-3
                py-[6px]
                text-sm
                hover:bg-[#f0f0f0]
                disabled:opacity-50
              "
            >
              Prev
            </button>

            {visiblePages[0] > 1 && (
              <span className="px-[6px]">
                …
              </span>
            )}

            {visiblePages.map((page)=>(
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`
                  rounded
                  border
                  px-3
                  py-[6px]
                  text-sm
                  ${
                    page === currentPage
                      ? "border-[rgb(0,64,128)] bg-[rgb(0,64,128)] text-white"
                      : "border-[#ddd] bg-white hover:bg-[#f0f0f0]"
                  }
                `}
              >
                {page}
              </button>
            ))}

            {visiblePages[visiblePages.length - 1] < totalPages && (
              <span className="px-[6px]">
                …
              </span>
            )}

            <button
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page)=>
                  Math.min(page + 1,totalPages)
                )
              }
              className="
                rounded
                border
                border-[#ddd]
                bg-white
                px-3
                py-[6px]
                text-sm
                hover:bg-[#f0f0f0]
                disabled:opacity-50
              "
            >
              Next
            </button>
          </div>
        )}
      </>
    )}
  </div>
 );
};

export default BusRims;