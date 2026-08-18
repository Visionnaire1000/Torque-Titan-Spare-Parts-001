import { useState, useEffect, type ChangeEvent } from "react";
import { useCart, type CartItem } from "../../../contexts/CartContext";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "react-toastify";
import config from "../../../config";
import "react-toastify/dist/ReactToastify.css";

interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface CheckoutResponse {
  checkout_url: string;
  error?: string;
}

const StripeCheckout = () => {
  const { items } = useCart();
  const { authFetch, user } = useAuth();

  const [loading, setLoading] = useState(false);

  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    postal_code: "",
    country: "",
  });

  // Load saved address
  useEffect(() => {
    if (!user) return;

    const savedAddress = localStorage.getItem(`address_${user.id}`);

    if (savedAddress) {
      try {
        setAddress(JSON.parse(savedAddress) as Address);
      } catch (error) {
        console.error("Invalid saved address:", error);
      }
    }
  }, [user]);

  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAddress((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!items || items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!address.street || !address.city || !address.country) {
      toast.error("Please fill all required address fields");
      return;
    }

    setLoading(true);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/create-checkout-session/`,
        {
          method: "POST",
          body: JSON.stringify({
            items: items.map((item: CartItem) => ({
               sparepart_id: item.id,
               quantity: item.quantity,
            })),
            street: address.street,
            city: address.city,
            postal_code: address.postal_code,
            country: address.country,
          }),
        }
      );

      const data: CheckoutResponse = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create checkout session");
        return;
      }

      // Save latest address
      if (user) {
        localStorage.setItem(
          `address_${user.id}`,
          JSON.stringify(address)
        );
      }

      // Redirect to Stripe checkout
      window.location.href = data.checkout_url;

    } catch (error) {
      console.error(error);
      toast.error("Error initiating payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-[20px] w:pt-[6px] pb-10 mt-[40px]">
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

        <button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer rounded-lg bg-[#004080] py-[0.8rem] text-[1.1rem] text-white transition duration-300 hover:bg-[rgb(3,32,59)] disabled:cursor-not-allowed disabled:bg-[#ccc]"
        >
          {loading ? "Redirecting..." : "Pay with Card"}
        </button>
      </form>
    </div>
  );
};

export default StripeCheckout;