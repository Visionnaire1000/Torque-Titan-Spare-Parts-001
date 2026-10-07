import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, X } from "lucide-react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const Cart = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    loading,
  } = useCart();

  const { isAuthenticated } = useAuth();

  const navigate = useNavigate();

  const [showClearCartDialog, setShowClearCartDialog] =
    useState<boolean>(false);

  const handleCheckout = (): void => {
    if (!isAuthenticated) {
      toast.error("Please login to proceed with checkout");

      navigate("/login", {
        state: { from: "/cart" },
      });

      return;
    }

    navigate("/checkout");
  };

  const handleClearCart = async (): Promise<void> => {
    setShowClearCartDialog(false);

    try {
      await clearCart();
    } catch {
      toast.error("Failed to clear cart");
    }
  };

  const handleCloseClearCartDialog = (): void => {
    setShowClearCartDialog(false);
  };

  if (loading) {
    return (
      <div
        className="
          mx-auto
          mt-[80px]
          mb-[60px]
          w-full
          px-4
          py-12
          max-[480px]:max-w-[480px]
          max-[480px]:p-[2px]
          lg:mt-[50px]
        "
      >
        <h1
          className="
            text-[rgb(0,64,128)]
            text-3xl
            font-bold
            max-[480px]:mt-5
            max-[480px]:ml-1
          "
        >
          Your Cart
        </h1>

        <div
          className="
            mt-6
            rounded-lg
            bg-white
            p-8
            text-center
            shadow-[0_4px_6px_rgba(0,0,0,0.1)]
          "
        >
          <ShoppingCart
            size={48}
            className="mx-auto animate-pulse text-[rgb(0,64,128)]"
          />

          <h2
            className="
              mt-5
              mb-2
              text-2xl
              font-semibold
              text-[rgb(0,64,128)]
            "
          >
            Loading your cart...
          </h2>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="
          mx-auto
          mt-[80px]
          mb-[60px]
          w-full
          max-[480px]:max-w-[480px]
          max-[480px]:p-[2px]
          px-4
          py-12
          lg:mt-[50px]
        "
      >
        <h1
          className="
            text-[rgb(0,64,128)]
            text-3xl
            font-bold
            max-[480px]:mt-5
            max-[480px]:ml-1
          "
        >
          Your Cart
        </h1>

        <div
          className="
            mt-6
            rounded-lg
            bg-white
            p-8
            text-center
            shadow-[0_4px_6px_rgba(0,0,0,0.1)]
          "
        >
          <ShoppingCart
            size={48}
            className="mx-auto text-[rgb(0,64,128)]"
          />

          <h2
            className="
              mt-5
              mb-2
              text-2xl
              font-semibold
              text-[rgb(255,0,0)]
            "
          >
            Your cart is empty
          </h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="
          mx-auto
          mt-[80px]
          mb-[60px]
          w-full
          px-4
          py-12
          max-[480px]:max-w-[480px]
          max-[480px]:p-[2px]
          lg:mt-[50px]
        "
      >
        <div
          className="
            flex
            flex-col
            gap-[2px]
            max-[480px]:mr-1
            lg:flex-row
            lg:gap-8
          "
        >
          <div className="flex-[2]">
            <div
              className="
                overflow-x-auto
                rounded-lg
                bg-white
                shadow-[0_4px_6px_rgba(0,0,0,0.05)]
              "
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-[#e0e0e0] p-4 text-left text-sm font-semibold uppercase text-[#555]">
                      Item
                    </th>

                    <th className="border-b border-[#e0e0e0] p-4 text-left text-sm font-semibold uppercase text-[#555]">
                      Price
                    </th>

                    <th className="border-b border-[#e0e0e0] p-4 text-left text-sm font-semibold uppercase text-[#555]">
                      Quantity
                    </th>

                    <th className="border-b border-[#e0e0e0] p-4 text-left text-sm font-semibold uppercase text-[#555]">
                      Subtotal
                    </th>

                    <th className="border-b border-[#e0e0e0] p-4 text-left text-sm font-semibold uppercase text-[#555]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[#e0e0e0]"
                    >
                      <td className="p-4 text-left">
                        <div className="flex flex-col items-start gap-3">
                          <Link
                            to={`/items/${item.sparepart_id}`}
                            className="block"
                          >
                            <img
                              src={item.image}
                              alt={item.brand}
                              className="
                                mx-auto
                                ml-2
                                h-auto
                                w-20
                                rounded
                                object-cover
                                shadow-[0_1px_4px_rgba(0,0,0,0.2)]
                                sm:w-24
                              "
                            />
                          </Link>

                          <p
                            className="
                              text-center
                              text-md
                              font-bold
                              text-black
                            "
                          >
                            {item.brand} {item.category} for{" "}
                            {item.vehicle_type}
                          </p>
                        </div>
                      </td>

                      <td
                        className="
                          p-4
                          text-left
                          text-base
                          font-semibold
                          text-[rgb(255,0,0)]
                        "
                      >
                        KES {item.buying_price.toLocaleString()}
                      </td>

                      <td className="p-4 text-left">
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity - 1
                              )
                            }
                            aria-label={`Decrease quantity of ${item.brand}`}
                            className="
                              flex
                              h-8
                              w-8
                              items-center
                              justify-center
                              rounded-md
                              border
                              border-[rgb(0,64,128)]
                              bg-[rgb(0,64,128)]
                              text-white
                              transition-all
                              duration-200
                              cursor-pointer
                              hover:border-[rgb(11,98,184)]
                              hover:bg-[rgb(9,39,69)]
                            "
                          >
                            <MinusCircle
                              size={18}
                              strokeWidth={2}
                            />
                          </button>

                          <span
                            className="
                              inline-block
                              w-8
                              text-center
                            "
                          >
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity + 1
                              )
                            }
                            aria-label={`Increase quantity of ${item.brand}`}
                            className="
                              flex
                              h-8
                              w-8
                              items-center
                              justify-center
                              rounded-md
                              border
                              border-[rgb(0,64,128)]
                              bg-[rgb(0,64,128)]
                              text-white
                              transition-all
                              duration-200
                              cursor-pointer
                              hover:border-[rgb(11,98,184)]
                              hover:bg-[rgb(9,39,69)]
                            "
                          >
                            <PlusCircle
                              size={18}
                              strokeWidth={2}
                            />
                          </button>
                        </div>
                      </td>

                      <td
                        className="
                          p-4
                          text-left
                          text-base
                          font-semibold
                          text-[rgb(255,0,0)]
                        "
                      >
                        KES{" "}
                        {(
                          item.buying_price * item.quantity
                        ).toLocaleString()}
                      </td>

                      <td className="p-4 text-left">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.brand} from cart`}
                          className="
                            ml-[25px]
                            border-none
                            bg-transparent
                            text-[#e53e3e]
                            transition-colors
                            duration-200
                            cursor-pointer
                            hover:text-[#c53030]
                          "
                        >
                          <Trash2 size={22} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                className="
                  rounded-lg
                  bg-[rgb(200,0,0)]
                  px-[15px]
                  py-[10px]
                  text-white
                  transition-colors
                  duration-200
                  cursor-pointer
                  hover:bg-[rgb(160,0,0)]
                "
                onClick={() => setShowClearCartDialog(true)}
              >
                Clear Cart
              </button>
            </div>
          </div>

          <div
            className="
              flex-1
              rounded-xl
              bg-white
              p-6
              shadow-[0_4px_6px_rgba(0,0,0,0.1)]
            "
          >
            <div className="mb-6 max-[480px]:mb-[10px]">
              <div
                className="
                  flex
                  justify-between
                  border-b
                  border-[#e0e0e0]
                  py-3
                "
              ></div>

              <div
                className="
                  flex
                  justify-between
                  py-3
                  text-lg
                  font-semibold
                "
              >
                <span>Total</span>

                <span
                  className="
                    mt-[2px]
                    text-lg
                    text-[rgb(255,0,0)]
                  "
                >
                  KES {total.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              className="
                rounded-lg
                bg-[rgb(0,64,128)]
                px-[15px]
                py-[10px]
                text-base
                text-white
                transition-colors
                cursor-pointer
                duration-200
                hover:bg-[rgb(3,34,65)]
              "
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>

      {showClearCartDialog && (
        <div
          className="
            fixed
            inset-0
            z-[9999]
            flex
            items-center
            justify-center
            bg-black/50
            px-4
            backdrop-blur-[1px]
          "
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseClearCartDialog();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-cart-title"
            aria-describedby="clear-cart-description"
            className="
              relative
              w-full
              max-w-[330px]
              rounded-xl
              bg-white
              p-5
              shadow-[0_15px_40px_rgba(0,0,0,0.25)]
            "
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={handleCloseClearCartDialog}
              aria-label="Close clear cart dialog"
              className="
                absolute
                right-3
                top-3
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-full
                text-gray-400
                transition-all
                duration-200
                hover:bg-gray-100
                hover:text-gray-700
                focus:outline-none
                cursor-pointer
              "
            >
              <X size={17} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div
                className="
                  mb-3
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  bg-red-100
                  text-red-600
                "
              >
                <Trash2
                  size={22}
                  strokeWidth={2}
                />
              </div>

              <h2
                id="clear-cart-title"
                className="
                  text-lg
                  font-bold
                  text-gray-900
                "
              >
                Clear your cart?
              </h2>

              <p
                id="clear-cart-description"
                className="
                  mt-2
                  max-w-[270px]
                  text-sm
                  leading-5
                  text-gray-600
                "
              >
                Remove all{" "}
                {items.length === 1
                  ? "the item"
                  : `${items.length} items`}{" "}
                from your cart?
              </p>

              <div
                className="
                  mt-5
                  flex
                  w-full
                  gap-2.5
                "
              >
                <button
                  type="button"
                  onClick={handleCloseClearCartDialog}
                  className="
                    flex-1
                    rounded-lg
                    border
                    border-gray-300
                    bg-white
                    px-3
                    py-2
                    text-sm
                    font-semibold
                    text-gray-700
                    transition-all
                    duration-200
                    hover:bg-gray-50
                    focus:outline-none
                    focus:ring-2
                    focus:ring-gray-300
                    cursor-pointer
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleClearCart}
                  className="
                    flex-1
                    rounded-lg
                    bg-red-600
                    px-3
                    py-2
                    text-sm
                    font-semibold
                    text-white
                    transition-all
                    duration-200
                    hover:bg-red-700
                    focus:outline-none
                    focus:ring-2
                    focus:ring-red-500
                    focus:ring-offset-1
                    cursor-pointer
                  "
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Cart;
