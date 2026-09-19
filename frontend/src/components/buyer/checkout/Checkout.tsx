import { useState, useEffect, type ChangeEvent, type SyntheticEvent } from "react";
import { CreditCard, Smartphone } from "lucide-react";
import { useCart, type CartItem } from "../../../contexts/CartContext";
import { useAuth } from "../../../contexts/AuthContext";
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
  reference?: string;
  order_id?: string;
  status?: string;
  display_text?: string;
  error?: string;
  message?: string;
  paid?: boolean;
  expired?: boolean;
  payment_status?: string;
}

type PaymentMethod = "stripe" | "paystack";
type MobileMoneyMethod = "mpesa" | "airtel";

const PAYSTACK_POLL_INTERVAL = 3000;
const PAYSTACK_MAX_ATTEMPTS = 60;

const Checkout = () => {
  const { items, clearCart } = useCart();
  const { authFetch, user } = useAuth();

  const [loading, setLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("stripe");

  const [mobileMoneyMethod, setMobileMoneyMethod] =
    useState<MobileMoneyMethod>("mpesa");

  const [phone, setPhone] = useState("");

  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    postal_code: "",
    country: "",
  });

  useEffect(() => {
    if (!user) return;

    const savedAddress = localStorage.getItem(
      `address_${user.id}`
    );

    if (!savedAddress) return;

    try {
      const parsedAddress = JSON.parse(
        savedAddress
      ) as Address;

      setAddress({
        street: parsedAddress.street ?? "",
        city: parsedAddress.city ?? "",
        postal_code:
          parsedAddress.postal_code ?? "",
        country: parsedAddress.country ?? "",
      });
    } catch (error) {
      console.error(
        "Invalid saved address:",
        error
      );

      localStorage.removeItem(
        `address_${user.id}`
      );
    }
  }, [user]);

  const handleAddressChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setAddress((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhoneChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setPhone(e.target.value);
  };

  const wait = () =>
    new Promise<void>((resolve) => {
      setTimeout(
        resolve,
        PAYSTACK_POLL_INTERVAL
      );
    });

  const verifyPaystackPayment = async (
    reference: string
  ): Promise<boolean> => {
    for (
      let attempt = 0;
      attempt < PAYSTACK_MAX_ATTEMPTS;
      attempt++
    ) {
      try {
        const res = await authFetch(
          `${config.API_BASE_URL}/checkout/verify-paystack-payment/${reference}/`,
          {
            method: "GET",
          }
        );

        const data: CheckoutResponse =
          await res.json();

        if (!res.ok) {
          console.error(
            "Paystack verification failed:",
            data
          );

          await wait();

          continue;
        }

        if (data.paid === true) {
          clearCart(false);

          toast.success(
            "Payment completed successfully."
          );

          return true;
        }

        if (data.expired === true) {
          toast.error(
            data.message ||
              "The payment request expired. Your cart has been kept."
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
      "Payment could not be confirmed. Your cart has been kept."
    );

    return false;
  };

  const handleSubmit = async (
    e: SyntheticEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    if (!items || items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (
      !address.street ||
      !address.city ||
      !address.country
    ) {
      toast.error(
        "Please fill all required address fields"
      );

      return;
    }

    if (
      paymentMethod === "paystack" &&
      !phone.trim()
    ) {
      toast.error(
        "Please enter the phone number for your mobile money payment"
      );

      return;
    }

    setLoading(true);

    try {
      const endpoint =
        paymentMethod === "stripe"
          ? "/checkout/create-stripe-session/"
          : "/checkout/create-paystack-session/";

      const requestBody: Record<string, unknown> = {
        items: items.map(
          (item: CartItem) => ({
            sparepart_id: item.id,
            quantity: item.quantity,
          })
        ),
        street: address.street,
        city: address.city,
        postal_code: address.postal_code,
        country: address.country,
      };

      if (paymentMethod === "paystack") {
        requestBody.payment_method =
          mobileMoneyMethod;

        requestBody.phone =
          phone.trim();
      }

      const res = await authFetch(
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
        await res.json();

      if (!res.ok) {
        toast.error(
          data.error ||
            data.message ||
            `Failed to create ${paymentMethod} checkout session`
        );

        return;
      }

      if (user) {
        localStorage.setItem(
          `address_${user.id}`,
          JSON.stringify(address)
        );
      }

      if (paymentMethod === "stripe") {
        if (!data.checkout_url) {
          toast.error(
            "No Stripe payment URL was returned by the server"
          );

          return;
        }

        window.location.href =
          data.checkout_url;

        return;
      }

      if (
        data.status === "failed" ||
        data.status === "timeout" ||
        data.status === "abandoned"
      ) {
        toast.error(
          data.display_text ||
            data.message ||
            "Paystack payment failed. Your cart has been kept."
        );

        return;
      }

      if (!data.reference) {
        toast.error(
          data.message ||
            "No Paystack payment reference was returned. Your cart has been kept."
        );

        return;
      }

      await verifyPaystackPayment(
        data.reference
      );
    } catch (error) {
      console.error(
        `${paymentMethod} checkout error:`,
        error
      );

      toast.error(
        `Error initiating ${
          paymentMethod === "stripe"
            ? "Stripe"
            : "Paystack"
        } payment`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-[40px] w-full px-4 pb-10 pt-[20px]">
      <form
        onSubmit={handleSubmit}
        className="mx-auto my-8 max-w-[500px] rounded-xl bg-[#f9f9f9] p-8 font-sans shadow-[0_4px_10px_rgba(0,0,0,0.1)]"
      >
        <h2 className="mb-6 text-center text-[1.8rem] font-bold text-[#004080]">
          Shipping Address
        </h2>

        <input
          type="text"
          name="street"
          placeholder="Street"
          value={address.street}
          onChange={handleAddressChange}
          required
          className="mb-4 w-full rounded-lg border-[1.5px] border-[#004080] px-3 py-[0.8rem] text-base text-black outline-none transition duration-300 focus:shadow-[0_0_0_2px_rgb(3,29,56)]"
        />

        <input
          type="text"
          name="city"
          placeholder="City"
          value={address.city}
          onChange={handleAddressChange}
          required
          className="mb-4 w-full rounded-lg border-[1.5px] border-[#004080] px-3 py-[0.8rem] text-base text-black outline-none transition duration-300 focus:shadow-[0_0_0_2px_rgb(3,29,56)]"
        />

        <input
          type="text"
          name="postal_code"
          placeholder="Postal Code"
          value={address.postal_code}
          onChange={handleAddressChange}
          className="mb-4 w-full rounded-lg border-[1.5px] border-[#004080] px-3 py-[0.8rem] text-base text-black outline-none transition duration-300 focus:shadow-[0_0_0_2px_rgb(3,29,56)]"
        />

        <input
          type="text"
          name="country"
          placeholder="Country"
          value={address.country}
          onChange={handleAddressChange}
          required
          className="mb-6 w-full rounded-lg border-[1.5px] border-[#004080] px-3 py-[0.8rem] text-base text-black outline-none transition duration-300 focus:shadow-[0_0_0_2px_rgb(3,29,56)]"
        />

        <div className="mb-6">
          <h3 className="mb-3 text-base font-semibold text-[#004080]">
            Payment Method
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                setPaymentMethod("stripe")
              }
              disabled={loading}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-semibold transition ${
                paymentMethod === "stripe"
                  ? "border-[#004080] bg-[#004080] text-white"
                  : "cursor-pointer border-gray-300 bg-white text-[#004080] hover:border-[#004080]"
              }`}
            >
              <CreditCard
                size={21}
                strokeWidth={2.2}
              />

              <span>Card</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPaymentMethod("paystack")
              }
              disabled={loading}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-semibold transition ${
                paymentMethod === "paystack"
                  ? "border-[#004080] bg-[#004080] text-white"
                  : "cursor-pointer border-gray-300 bg-white text-[#004080] hover:border-[#004080]"
              }`}
            >
              <Smartphone
                size={21}
                strokeWidth={2.2}
              />

              <span>Mobile Money</span>
            </button>
          </div>
        </div>

        {paymentMethod === "paystack" && (
          <div className="mb-6">
            <h3 className="mb-3 text-base font-semibold text-[#004080]">
              Select your Mobile Money Provider
            </h3>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileMoneyMethod("mpesa")
                }
                disabled={loading}
                className={`flex items-center justify-center gap-3 rounded-lg border-2 px-4 py-3 font-semibold transition ${
                  mobileMoneyMethod === "mpesa"
                    ? "border-[#004080]"
                    : "cursor-pointer border-gray-300 bg-white hover:border-[#004080]"
                }`}
              >
                <img
                  src="https://i.imgur.com/0MGAvJ4.jpeg"
                  alt="M-PESA"
                  className="h-13 w-auto max-w-[100%] object-contain"
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  setMobileMoneyMethod("airtel")
                }
                disabled={loading}
                className={`flex items-center justify-center gap-3 rounded-lg border-2 px-4 py-3 font-semibold transition ${
                  mobileMoneyMethod === "airtel"
                    ? "border-[#004080]"
                    : "cursor-pointer border-gray-300 bg-white hover:border-[#004080]"
                }`}
              >
                <img
                  src="https://i.imgur.com/NXJScUg.png"
                  alt="Airtel Money"
                  className="h-13 w-auto max-w-[100%] object-contain"
                />
              </button>
               <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-gray-700">
                <span className="font-semibold text-amber-700">Note:</span>{" "}
                   The maximum mobile money transaction limit is{" "}
                <span className="font-bold">KES 250,000</span>.
                </p>
            </div>

            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              value={phone}
              onChange={handlePhoneChange}
              required
              className="w-full rounded-lg border-[1.5px] border-[#004080] px-3 py-[0.8rem] text-base text-black outline-none transition duration-300 focus:shadow-[0_0_0_2px_rgb(3,29,56)]"
            />

            <p className="mt-2 text-sm text-gray-600">
              Enter the Kenyan mobile number
              that will receive the payment
              request.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer rounded-lg bg-[#004080] py-[0.8rem] text-[1.1rem] text-white transition duration-300 hover:bg-[rgb(3,32,59)] disabled:cursor-not-allowed disabled:bg-[#ccc]"
        >
          {loading
            ? "Processing..."
            : paymentMethod === "stripe"
              ? "Pay with Card"
              : `Pay with ${
                  mobileMoneyMethod === "mpesa"
                    ? "M-PESA"
                    : "Airtel Money"
                }`}
        </button>
      </form>
    </div>
  );
};

export default Checkout;
