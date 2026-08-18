import { useEffect, useState, type MouseEvent, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useCart } from "../../../../contexts/CartContext";
import config from "../../../../config";
import "../../../../styles/buyer/categories/rims.css";

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
      overflow-hidden
      bg-[#f6f7f8]
      rounded-xl
      p-3
    "
  >
    <div
      className="
        w-full
        h-[140px]
        rounded-lg
        bg-[#e0e0e0]
        mb-2.5
      "
    />
    <div
      className="
        h-3
        rounded-md
        bg-[#e0e0e0]
        my-2
        w-[80%]
      "
    />
    <div
      className="
        h-3
        rounded-md
        bg-[#e0e0e0]
        my-2
        w-[60%]
      "
    />
    <div
      className="
        h-3
        rounded-md
        bg-[#e0e0e0]
        my-2
        w-[40%]
      "
    />
    <div
      className="
        h-8
        rounded-lg
        bg-[#e0e0e0]
        mt-2.5
        w-full
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
      text-center
      py-10
      px-5
    "
  >
    <h2
      className="
        text-2xl
        mb-2.5
      "
    >
      Something went wrong
    </h2>

    <p
      className="
        text-[#666]
        mb-5
      "
    >
      Unable to load spare parts. Please check your connection and try again.
    </p>
    <button
      className="
        inline-flex
        items-center
        gap-2
        py-2.5
        px-5
        bg-[#111]
        text-white
        rounded-md
        cursor-pointer
        transition
        hover:opacity-85
        mb-[30px]
      "
      onClick={() => void onRetry()}
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
const SUVRims = (): ReactElement => {
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
      vehicle_type: "suv",
      ...(brand && { brand }),
      ...(colour && { colour }),
      ...(price && { price }),
      page: currentPage.toString(),
      per_page: "16",
    });

    try {

      const response = await fetch(
        `${config.API_BASE_URL}/spareparts/?${params.toString()}`
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

    let start = Math.max(
      currentPage - 2,
      1
    );

    let end = Math.min(
      start + maxVisible - 1,
      totalPages
    );

    start = Math.max(
      end - maxVisible + 1,
      1
    );

    for (
      let i = start;
      i <= end;
      i++
    ) {

      pages.push(i);

    }

    return pages;

  };

  const visiblePages = getVisiblePages();

  /* ---------------- Render ---------------- */
  return (
    <div
      className="
        min-h-screen
        p-5
        pb-[70px]
        mt-[70px]
        bg-[#f9f9f9]
        font-[Arial,sans-serif]
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
              Medium (25k–35k)
            </option>
            <option value="high">
              High (&gt; 35k)
            </option>
          </select>
        </div>
      )}

   {/* -------- Error State -------- */}
   {error ? (
     <ErrorState
       onRetry={fetchRims}
      />
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
              Array.from({
                length: 8
              }).map((_, index) => (
                <SkeletonCard
                  key={index}
                />

              ))
            ) : items.length ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className="
                    bg-white
                    rounded-xl
                    p-3
                    shadow-[0_4px_10px_rgba(0,0,0,0.1)]
                    transition-all
                    duration-200
                    flex
                    flex-col
                    items-center
                    cursor-pointer
                    h-full
                    hover:-translate-y-1
                    hover:shadow-[0_8px_16px_rgba(0,0,0,0.15)]
                  "
                >
                  <Link
                    to={`/items/${item.id}`}
                    className="
                      w-full
                      flex
                      flex-col
                      items-center
                    "
                  >
                    <img
                      src={item.image}
                      alt={item.brand}
                      className="
                        w-full
                        h-[150px]
                        object-contain
                        mb-2.5
                        rounded-lg
                        max-[480px]:w-[60%]
                        max-[480px]:h-auto
                        max-[480px]:object-cover
                      "
                    />
                    <h4
                      className="
                        text-center
                        my-[5px]
                        mb-2.5
                        text-base
                        text-[#333]
                      "
                    >
                      {item.brand} {item.category} for{" "}
                      {item.vehicle_type}
                    </h4>
                    <p
                      className="
                        font-bold
                        text-red-600
                        text-lg
                        mb-2.5
                      "
                    >
                      KES{" "}
                      {item.buying_price?.toLocaleString("en-US")}
                      {item.discount_percentage > 0 && (
                        <span
                          className="
                            text-[#d9534f]
                            font-normal
                            ml-1
                          "
                        >
                          (-{item.discount_percentage.toFixed(0)}%)
                        </span>
                      )}
                    </p>
                    <button
                      className="
                        bg-[rgb(0,64,128)]
                        text-white
                        border-none
                        py-2
                        px-3
                        rounded-md
                        cursor-pointer
                        font-bold
                        transition-colors
                        hover:bg-[rgb(4,37,71)]
                      "
                      onClick={(event) =>
                        handleAddToCart(
                          item,
                          event
                        )
                      }
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
                  text-center
                  text-[#7f0d0d]
                  text-base
                  mb-[80px]
                "
              >
                No SUV rims found.
              </p>
            )}
          </div>
                    {/* -------- Pagination -------- */}


          {loading ? (

            <div
              className="
                flex
                justify-center
                items-center
                gap-2
                mt-4
              "
            >

              {[1, 2, 3, 4].map((item) => (

                <div
                  key={item}
                  className="
                    w-10
                    h-8
                    rounded-md
                    bg-[#e0e0e0]
                  "
                />

              ))}

            </div>



          ) : totalPages > 1 && (

            <div
              className="
                flex
                justify-center
                items-center
                gap-1.5
                my-[30px]
                flex-wrap
              "
            >


              <button
                disabled={
                  currentPage === 1
                }
                className="
                  py-1.5
                  px-3
                  border
                  border-[#ddd]
                  bg-white
                  rounded
                  text-sm
                  cursor-pointer
                  hover:bg-[#f0f0f0]
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(
                      page - 1,
                      1
                    )
                  )
                }
              >
                Prev
              </button>





              {visiblePages[0] > 1 && (

                <span
                  className="
                    px-1.5
                    text-base
                    select-none
                  "
                >
                  …
                </span>

              )}






              {visiblePages.map((page) => (

                <button
                  key={page}
                  className={`
                    py-1.5
                    px-3
                    border
                    rounded
                    text-sm
                    cursor-pointer
                    ${
                      page === currentPage
                        ? `
                          bg-[#004080]
                          text-white
                          border-[#004080]
                          font-semibold
                        `
                        : `
                          border-[#ddd]
                          bg-white
                          hover:bg-[#f0f0f0]
                        `
                    }
                  `}
                  onClick={() =>
                    setCurrentPage(page)
                  }
                >
                  {page}
                </button>

              ))}





              {visiblePages[
                visiblePages.length - 1
              ] < totalPages && (

                <span
                  className="
                    px-1.5
                    text-base
                    select-none
                  "
                >
                  …
                </span>

              )}






              <button
                disabled={
                  currentPage === totalPages
                }
                className="
                  py-1.5
                  px-3
                  border
                  border-[#ddd]
                  bg-white
                  rounded
                  text-sm
                  cursor-pointer
                  hover:bg-[#f0f0f0]
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                "
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(
                      page + 1,
                      totalPages
                    )
                  )
                }
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

export default SUVRims;