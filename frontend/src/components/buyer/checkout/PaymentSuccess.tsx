import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useCart } from "../../../contexts/CartContext";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import config from "../../../config";

const PaymentSuccess = () => {
  const { authFetch } = useAuth();
  const { loadCart } = useCart();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const hasRun = useRef(false);

  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }

    hasRun.current = true;

    const paypalOrderId = searchParams.get("token");
    const paymentMethod = searchParams.get("method");

    const handlePayment = async () => {
      if (paypalOrderId) {
        setProcessing(true);

        try {
          const response = await authFetch(
            `${config.API_BASE_URL}/checkout/paypal-capture/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paypal_order_id: paypalOrderId,
              }),
            }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              data.error ||
                t("paymentSuccess.errors.paypalPaymentFailed")
            );
          }

          await loadCart();

          setPaymentSuccess(true);
        } catch (error) {
          console.error("PayPal capture error:", error);

          toast.error(
            error instanceof Error
              ? error.message
              : t("paymentSuccess.errors.paypalCompletionFailed")
          );
        } finally {
          setProcessing(false);
        }

        return;
      }

      if (paymentMethod === "paystack") {
        setProcessing(true);

        try {
          await loadCart();

          setPaymentSuccess(true);
        } catch (error) {
          console.error("Paystack payment success error:", error);

          toast.error(
            t("paymentSuccess.errors.mobilePaymentCompletionFailed")
          );
        } finally {
          setProcessing(false);
        }

        return;
      }

      try {
        setProcessing(true);

        await loadCart();

        setPaymentSuccess(true);
      } catch (error) {
        console.error("Stripe payment success error:", error);

        toast.error(
          t("paymentSuccess.errors.paymentCompletionFailed")
        );
      } finally {
        setProcessing(false);
      }
    };

    void handlePayment();
  }, [authFetch, loadCart, searchParams, t]);

  if (processing) {
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
            {t("paymentSuccess.completingPayment")}
          </h1>

          <p className="leading-relaxed text-gray-500">
            {t("paymentSuccess.confirmingPayment")}
          </p>
        </div>
      </div>
    );
  }

  if (!paymentSuccess) {
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
            {t("paymentSuccess.paymentFailedTitle")}
          </h1>

          <p className="mb-6 leading-relaxed text-gray-500">
            {t("paymentSuccess.paymentFailedDescription")}
          </p>

          <Link
            to="/checkout"
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
            {t("paymentSuccess.returnToCheckout")}
          </Link>
        </div>
      </div>
    );
  }

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
          {t("paymentSuccess.paymentSuccessfulTitle")}
        </h1>

        <p className="mb-6 leading-relaxed text-gray-500">
          {t("paymentSuccess.paymentSuccessfulDescription")}
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
          {t("paymentSuccess.continueShopping")}
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccess;