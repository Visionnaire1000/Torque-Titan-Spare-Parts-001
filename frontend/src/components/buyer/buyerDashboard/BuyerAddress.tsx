import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

const BuyerAddress = (): React.JSX.Element => {
  const { user } = useAuth();

  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    postal_code: "",
    country: "",
  });

  // Load saved address from localStorage for this user
  useEffect((): void => {
    if (!user) return;

    const savedAddress = localStorage.getItem(`address_${user.id}`);

    if (savedAddress) {
      try {
        setAddress(JSON.parse(savedAddress) as Address);
      } catch {
        console.error("Invalid saved address");
      }
    }
  }, [user]);

  const handleAddressChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = e.target;

    setAddress((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (
    e: { preventDefault: () => void }
  ): void => {
    e.preventDefault();

    if (!address.street || !address.city || !address.country) {
      toast.error("Please fill all required address fields");
      return;
    }

    if (!user) {
      toast.error("User not logged in");
      return;
    }

    localStorage.setItem(
      `address_${user.id}`,
      JSON.stringify(address)
    );

    toast.success("Address saved successfully!");
  };

  return (
   <div className="w-full flex justify-center px-4">
     <div
      className="
        w-full
        max-w-[500px]
        bg-[#f9f9f9]
        rounded-xl
        shadow-[0_4px_10px_rgba(0,0,0,0.1)]
        p-8
        font-[Arial,sans-serif]
        max-[480px]:max-w-full
      "
    >
      <form onSubmit={handleSubmit}>
        <h2
          className="
            text-center
            text-[rgb(0,64,128)]
            mt-[80px]
            mb-6
            text-[1.8rem]
          "
        >
          Shipping Address
        </h2>

        <input
          type="text"
          name="street"
          placeholder="Street"
          value={address.street}
          onChange={handleAddressChange}
          required
          className="
            w-full
            p-[0.8rem]
            mb-4
            border-[1.5px]
            border-[rgb(0,64,128)]
            rounded-lg
            text-base
            outline-none
            transition-all
            duration-300
            focus:text-black
            focus:border-[rgb(0,64,128)]
            focus:shadow-[0_0_5px_rgb(3,29,56)]
          "
        />

        <input
          type="text"
          name="city"
          placeholder="City"
          value={address.city}
          onChange={handleAddressChange}
          required
          className="
            w-full
            p-[0.8rem]
            mb-4
            border-[1.5px]
            border-[rgb(0,64,128)]
            rounded-lg
            text-base
            outline-none
            transition-all
            duration-300
            focus:text-black
            focus:border-[rgb(0,64,128)]
            focus:shadow-[0_0_5px_rgb(3,29,56)]
          "
        />

        <input
          type="text"
          name="postal_code"
          placeholder="Postal Code"
          value={address.postal_code}
          onChange={handleAddressChange}
          className="
            w-full
            p-[0.8rem]
            mb-4
            border-[1.5px]
            border-[rgb(0,64,128)]
            rounded-lg
            text-base
            outline-none
            transition-all
            duration-300
            focus:text-black
            focus:border-[rgb(0,64,128)]
            focus:shadow-[0_0_5px_rgb(3,29,56)]
          "
        />

        <input
          type="text"
          name="country"
          placeholder="Country"
          value={address.country}
          onChange={handleAddressChange}
          required
          className="
            w-full
            p-[0.8rem]
            mb-4
            border-[1.5px]
            border-[rgb(0,64,128)]
            rounded-lg
            text-base
            outline-none
            transition-all
            duration-300
            focus:text-black
            focus:border-[rgb(0,64,128)]
            focus:shadow-[0_0_5px_rgb(3,29,56)]
          "
        />

        <button
          type="submit"
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
          Save Address
        </button>
      </form>
    </div>
   </div>
  );
};

export default BuyerAddress;