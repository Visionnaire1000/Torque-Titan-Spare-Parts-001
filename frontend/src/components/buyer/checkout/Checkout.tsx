import { useState, useEffect, type SyntheticEvent } from "react";
import { CreditCard, Smartphone } from "lucide-react";
import { useCart, type CartItem } from "../../../contexts/CartContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import config from "../../../config";


interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface CheckoutResponse {
  checkout_url?: string;
  approval_url?: string;
  reference?: string;
  order_id?: string;
  id?: string;
  status?: string;
  display_text?: string;
  error?: string;
  message?: string;
  paid?: boolean;
  expired?: boolean;
  payment_status?: string;
}

type PaymentMethod = "stripe" | "paystack" | "paypal";
type MobileMoneyMethod = "mpesa" | "airtel";

const PAYSTACK_POLL_INTERVAL = 3000;
const PAYSTACK_MAX_ATTEMPTS = 60;

const Checkout = (): React.JSX.Element => {
  const { items } = useCart();
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(true);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("stripe");

  const [mobileMoneyMethod, setMobileMoneyMethod] =
    useState<MobileMoneyMethod>("mpesa");

  const [mobileMoneyPhone, setMobileMoneyPhone] =
    useState("");

  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    postal_code: "",
    country: "",
  });

  useEffect(() => {
    if (!user) {
      setAddressLoading(false);
      return;
    }

    const loadAddress = async (): Promise<void> => {
      setAddressLoading(true);

      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/address/`,
          {
            method: "GET",
          }
        );

        if (response.status === 404) {
          setAddress({
            street: "",
            city: "",
            postal_code: "",
            country: "",
          });

          return;
        }

        const data = (await response.json()) as Address & {
          message?: string;
          error?: string;
        };

        if (!response.ok) {
          toast.error(
            data.message ||
              data.error ||
              t("checkout.errors.loadAddress")
          );

          return;
        }

        setAddress({
          street: data.street ?? "",
          city: data.city ?? "",
          postal_code: data.postal_code ?? "",
          country: data.country ?? "",
        });
      } catch (error) {
        console.error("Failed to load address:", error);

        toast.error(t("checkout.errors.loadAddress"));
      } finally {
        setAddressLoading(false);
      }
    };

    void loadAddress();
  }, [user, authFetch, t]);

  const wait = (): Promise<void> =>
    new Promise<void>((resolve) =>
      setTimeout(resolve, PAYSTACK_POLL_INTERVAL)
    );

  const verifyPaystackPayment = async (
    reference: string
  ): Promise<boolean> => {
    for (
      let attempt = 0;
      attempt < PAYSTACK_MAX_ATTEMPTS;
      attempt++
    ) {
      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/checkout/verify-paystack-session/${reference}/`,
          {
            method: "GET",
          }
        );

        const data: CheckoutResponse =
          await response.json();

        if (!response.ok) {
          console.error(
            "Paystack verification failed:",
            data
          );

          await wait();
          continue;
        }

        if (data.paid === true) {
          return true;
        }

        if (data.expired === true) {
          toast.error(
            data.message ||
              t("checkout.errors.paymentExpired")
          );

          return false;
        }

        await wait();
      } catch (error) {
        console.error(
          "Paystack verification error:",
          error
        );

        await wait();
      }
    }

    toast.error(
      t("checkout.errors.paymentUnconfirmed")
    );

    return false;
  };

  const handleSubmit = async (
    e: SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (loading) {
      return;
    }

    if (!items || items.length === 0) {
      toast.error(t("checkout.errors.emptyCart"));
      return;
    }

    if (
      !address.street.trim() ||
      !address.city.trim() ||
      !address.country.trim()
    ) {
      toast.error(
        t("checkout.errors.missingAddress")
      );

      return;
    }

    if (
      paymentMethod === "paystack" &&
      !mobileMoneyPhone.trim()
    ) {
      toast.error(
        t("checkout.errors.missingPhone")
      );

      return;
    }

    setLoading(true);

    try {
      let endpoint = "";

      if (paymentMethod === "stripe") {
        endpoint = "/checkout/create-stripe-session/";
      } else if (paymentMethod === "paystack") {
        endpoint = "/checkout/create-paystack-session/";
      } else {
        endpoint = "/checkout/create-paypal-session/";
      }

      const requestBody: Record<string, unknown> = {
        items: items.map((item: CartItem) => ({
          sparepart_id: item.sparepart_id,
          quantity: item.quantity,
        })),
        language:
          i18n.resolvedLanguage ||
          i18n.language ||
          "en",
      };

      if (paymentMethod === "paystack") {
        requestBody.payment_method = mobileMoneyMethod;
        requestBody.phone_number = mobileMoneyPhone.trim();
      }

      const response = await authFetch(
        `${config.API_BASE_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data: CheckoutResponse =
        await response.json();

      if (!response.ok) {
        toast.error(
          data.message ||
            data.error ||
            t("checkout.errors.startPayment")
        );

        return;
      }

      if (paymentMethod === "stripe") {
        if (!data.checkout_url) {
          toast.error(
            t("checkout.errors.stripeUrl")
          );

          return;
        }

        window.location.href = data.checkout_url;
        return;
      }

      if (paymentMethod === "paypal") {
        if (!data.approval_url) {
          toast.error(
            t("checkout.errors.paypalUrl")
          );

          return;
        }

        if (data.id) {
          localStorage.setItem(
            "paypal_order_id",
            data.id
          );
        }

        if (data.order_id) {
          localStorage.setItem(
            "paypal_local_order_id",
            data.order_id
          );
        }

        window.location.href = data.approval_url;
        return;
      }

      if (
        data.status === "failed" ||
        data.status === "timeout" ||
        data.status === "abandoned"
      ) {
        toast.error(
          data.message ||
            t("checkout.errors.mobileMoneyFailed")
        );

        return;
      }

      if (!data.reference) {
        toast.error(
          t("checkout.errors.paystackReference")
        );

        return;
      }

      const verified = await verifyPaystackPayment(
        data.reference
      );

      if (verified) {
        navigate("/payment-success?method=paystack");
      }
    } catch (error) {
      console.error("Checkout error:", error);

      toast.error(
        t("checkout.errors.processingPayment")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center px-4 py-8">
      <div className="w-full max-w-[700px]">
        <form
          onSubmit={handleSubmit}
          className="
            w-full
            bg-[#f9f9f9]
            rounded-xl
            shadow-[0_4px_10px_rgba(0,0,0,0.1)]
            p-8
            mt-[80px]
            font-[Arial,sans-serif]
            max-[480px]:p-4
          "
        >
          <h2
            className="
              text-center
              text-[rgb(0,64,128)]
              font-semibold
              mb-6
              text-[1.8rem]
              max-[480px]:text-[1.5rem]
            "
          >
            {t("checkout.title")}
          </h2>

          <h3
            className="
              text-[rgb(0,64,128)]
              font-semibold
              text-[1.2rem]
              mb-4
            "
          >
            {t("checkout.shippingAddress.title")}
          </h3>

          {addressLoading ? (
            <p className="text-center text-gray-600 mb-6">
              {t("checkout.shippingAddress.loading")}
            </p>
          ) : (
            <div
              className="
                mb-6
                p-4
                rounded-lg
                bg-white
                border
                border-gray-300
                text-gray-700
              "
            >
              {address.street ||
              address.city ||
              address.postal_code ||
              address.country ? (
                <div className="space-y-2">
                  <p>
                    <span className="font-semibold">
                      {t("checkout.shippingAddress.street")}
                    </span>{" "}
                    {address.street || "—"}
                  </p>

                  <p>
                    <span className="font-semibold">
                      {t("checkout.shippingAddress.city")}
                    </span>{" "}
                    {address.city || "—"}
                  </p>

                  <p>
                    <span className="font-semibold">
                      {t("checkout.shippingAddress.postalCode")}
                    </span>{" "}
                    {address.postal_code || "—"}
                  </p>

                  <p>
                    <span className="font-semibold">
                      {t("checkout.shippingAddress.country")}
                    </span>{" "}
                    {address.country || "—"}
                  </p>
                </div>
              ) : (
                <p className="text-red-600">
                  {t("checkout.shippingAddress.notFound")}
                </p>
              )}
            </div>
          )}

          <div
            className="
              mb-6
              p-4
              rounded-lg
              bg-white
              border
              border-gray-300
              text-gray-700
              text-sm
            "
          >
            <p>
              {t("checkout.profileNotice")}
            </p>
          </div>

          <h3
            className="
              text-[rgb(0,64,128)]
              font-semibold
              text-[1.2rem]
              mb-4
            "
          >
            {t("checkout.paymentMethod.title")}
          </h3>

          <div
            className="
              grid
              grid-cols-3
              gap-3
              w-full
              max-w-[540px]
              mb-6
              max-[480px]:grid-cols-1
            "
          >
            <button
              type="button"
              onClick={() => setPaymentMethod("stripe")}
              className={`
                flex
                items-center
                justify-center
                gap-2
                h-[52px]
                px-4
                rounded-lg
                border
                transition-all
                duration-200
                cursor-pointer
                ${
                  paymentMethod === "stripe"
                    ? "bg-[rgb(0,64,128)] text-white border-[rgb(0,64,128)]"
                    : "bg-white text-[rgb(0,64,128)] border-gray-300 hover:border-[rgb(0,64,128)]"
                }
              `}
            >
              <CreditCard size={22} />
              <span>{t("checkout.paymentMethod.card")}</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("paystack")}
              className={`
                flex
                items-center
                justify-center
                gap-2
                h-[52px]
                px-4
                rounded-lg
                border
                transition-all
                duration-200
                cursor-pointer
                ${
                  paymentMethod === "paystack"
                    ? "bg-[rgb(0,64,128)] text-white border-[rgb(0,64,128)]"
                    : "bg-white text-[rgb(0,64,128)] border-gray-300 hover:border-[rgb(0,64,128)]"
                }
              `}
            >
              <Smartphone size={22} />
              <span>
                {t("checkout.paymentMethod.mobileMoney")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("paypal")}
              className={`
                flex
                items-center
                justify-center
                h-[52px]
                px-4
                rounded-lg
                border
                transition-all
                duration-200
                cursor-pointer
                ${
                  paymentMethod === "paypal"
                    ? "border-[rgb(0,64,128)]"
                    : "bg-white border-gray-300 hover:border-[rgb(0,64,128)]"
                }
              `}
            >
              <img
                src="https://i.imgur.com/nPULbde.png"
                alt="PayPal"
                className="h-[80%] w-[90%] object-contain"
              />
            </button>
          </div>

          {paymentMethod === "paystack" && (
            <div className="mb-6">
              <div
                className="
                  grid
                  grid-cols-2
                  gap-3
                  max-w-[360px]
                  mb-4
                  max-[480px]:max-w-full
                "
              >
                <button
                  type="button"
                  onClick={() => setMobileMoneyMethod("mpesa")}
                  className={`
                    flex
                    items-center
                    justify-center
                    h-[58px]
                    px-4
                    rounded-lg
                    border
                    transition-all
                    duration-200
                    cursor-pointer
                    ${
                      mobileMoneyMethod === "mpesa"
                        ? "border-[rgb(0,64,128)]"
                        : "bg-white border-gray-300 hover:border-[rgb(0,64,128)]"
                    }
                  `}
                >
                  <img
                    src="https://i.imgur.com/ZJrVqS3.jpeg"
                    alt="M-PESA"
                    className="
                      h-[90%]
                      max-w-[90%]
                      object-contain
                      rounded
                    "
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setMobileMoneyMethod("airtel")}
                  className={`
                    flex
                    items-center
                    justify-center
                    h-[58px]
                    px-4
                    rounded-lg
                    border
                    transition-all
                    duration-200
                    cursor-pointer
                    ${
                      mobileMoneyMethod === "airtel"
                        ? "border-[rgb(0,64,128)]"
                        : "bg-white border-gray-300 hover:border-[rgb(0,64,128)]"
                    }
                  `}
                >
                  <img
                    src="https://i.imgur.com/NXJScUg.png"
                    alt="Airtel Money"
                    className="
                      h-[90%]
                      max-w-[90%]
                      object-contain
                    "
                  />
                </button>
              </div>

              <div
                className="
                  mb-4
                  max-w-[360px]
                  max-[480px]:max-w-full
                "
              >
                <label
                  htmlFor="mobile-money-phone"
                  className="
                    block
                    mb-2
                    text-sm
                    font-semibold
                    text-gray-700
                  "
                >
                  {mobileMoneyMethod === "mpesa"
                    ? t("checkout.mobileMoney.mpesaPhone")
                    : t("checkout.mobileMoney.airtelPhone")}
                </label>

                <input
                  id="mobile-money-phone"
                  type="tel"
                  value={mobileMoneyPhone}
                  onChange={(e) =>
                    setMobileMoneyPhone(e.target.value)
                  }
                  placeholder={t("checkout.mobileMoney.phonePlaceholder")}
                  autoComplete="tel"
                  className="
                    w-full
                    h-[46px]
                    px-3
                    rounded-lg
                    bg-white
                    border
                    border-gray-300
                    text-gray-700
                    outline-none
                    transition-colors
                    duration-200
                    focus:border-[rgb(0,64,128)]
                    focus:ring-1
                    focus:ring-[rgb(0,64,128)]
                  "
                />
              </div>

              <div
                className="
                  p-4
                  rounded-lg
                  bg-white
                  border
                  border-gray-300
                  text-gray-700
                  text-sm
                "
              >
                <p className="mb-2">
                  {t("checkout.mobileMoney.instructions")}
                </p>

                <p className="font-semibold text-red-600">
                  {t("checkout.mobileMoney.limit")}
                </p>
              </div>
            </div>
          )}

          {paymentMethod === "paypal" && (
            <div
              className="
                mb-6
                p-4
                rounded-lg
                bg-white
                border
                border-gray-300
                text-gray-700
                text-sm
              "
            >
              {t("checkout.paypalNotice")}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              addressLoading ||
              !items ||
              items.length === 0 ||
              !address.street.trim() ||
              !address.city.trim() ||
              !address.country.trim() ||
              (paymentMethod === "paystack" &&
                !mobileMoneyPhone.trim())
            }
            className="
              w-full
              p-[0.8rem]
              rounded-lg
              text-[1.1rem]
              text-white
              bg-[rgb(0,64,128)]
              transition-colors
              duration-300
              cursor-pointer
              hover:bg-[rgb(3,32,59)]
              disabled:bg-[#ccc]
              disabled:cursor-not-allowed
            "
          >
            {loading
              ? t("checkout.buttons.processing")
              : t("checkout.buttons.proceedToPayment")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Checkout;