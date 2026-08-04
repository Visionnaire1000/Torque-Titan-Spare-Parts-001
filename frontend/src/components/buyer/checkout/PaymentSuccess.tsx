import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../../contexts/CartContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PaymentSuccess = () => {
  const { clearCart } = useCart();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    try {
      // Clears persisted cart immediately
      localStorage.removeItem("titanCart");

      // Clears React state
      clearCart();

      toast.success("Payment Successful.", {
        autoClose: 3000,
      });
    } catch (error) {
      console.error("PaymentSuccess error:", error);
    }
  }, [clearCart]);

  return (
    <div className="mt-[50px] flex min-h-[70vh] items-center justify-center p-5">
      <div
        className="
          w-full
          max-w-[500px]
          rounded-xl
          bg-white
          p-8
          text-center
          shadow-[0_4px_12px_rgba(0,0,0,0.1)]
        "
      >
        <h1 className="mb-3 text-3xl font-bold">
          Payment Successful!
        </h1>

        <p className="mb-6 leading-relaxed text-gray-500">
          Thank you for your purchase. Your order has been received and is being
          processed.
        </p>

        <Link
          to="/"
          className="
            inline-block
            rounded-md
            bg-blue-600
            px-6
            py-3
            font-bold
            text-white
            transition-colors
            hover:bg-blue-700
          "
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccess;