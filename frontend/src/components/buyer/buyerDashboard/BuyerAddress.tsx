import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import config from "../../../config";

interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface AddressResponse extends Address {
  id?: string;
  user?: string;
  message?: string;
  error?: string | Record<string, string[]>;
}

const BuyerAddress = (): React.JSX.Element => {
  const { user, authFetch } = useAuth();

  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    postal_code: "",
    country: "",
  });

  const [addressExists, setAddressExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect((): void => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadAddress = async (): Promise<void> => {
      setLoading(true);

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

          setAddressExists(false);
          return;
        }

        const data =
          (await response.json()) as AddressResponse;

        if (!response.ok) {
          toast.error(
            typeof data.error === "string"
              ? data.error
              : data.message || "Failed to load your address"
          );

          return;
        }

        setAddress({
          street: data.street ?? "",
          city: data.city ?? "",
          postal_code: data.postal_code ?? "",
          country: data.country ?? "",
        });

        setAddressExists(true);
      } catch (error) {
        console.error(
          "Failed to load address:",
          error
        );

        toast.error("Failed to load your address");
      } finally {
        setLoading(false);
      }
    };

    void loadAddress();
  }, [user, authFetch]);

  const handleAddressChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = e.target;

    setAddress((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const getErrorMessage = (
    error: string | Record<string, string[]> | undefined
  ): string => {
    if (!error) {
      return "Failed to save address";
    }

    if (typeof error === "string") {
      return error;
    }

    const firstField = Object.keys(error)[0];

    if (!firstField) {
      return "Failed to save address";
    }

    const messages = error[firstField];

    if (Array.isArray(messages) && messages.length > 0) {
      return messages[0];
    }

    return "Invalid address information";
  };

  const handleSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!user) {
      toast.error("User not logged in");
      return;
    }

    const trimmedAddress: Address = {
      street: address.street.trim(),
      city: address.city.trim(),
      postal_code: address.postal_code.trim(),
      country: address.country.trim(),
    };

    if (
      !trimmedAddress.street ||
      !trimmedAddress.city ||
      !trimmedAddress.country
    ) {
      toast.error(
        "Please fill all required address fields"
      );

      return;
    }

    setSaving(true);

    try {
      const method = addressExists ? "PUT" : "POST";

      const response = await authFetch(
        `${config.API_BASE_URL}/address/`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(trimmedAddress),
        }
      );

      const data =
        (await response.json()) as AddressResponse;

      if (!response.ok) {
        toast.error(
          getErrorMessage(data.error) ||
            data.message ||
            "Failed to save address"
        );

        return;
      }

      setAddress({
        street: data.street ?? trimmedAddress.street,
        city: data.city ?? trimmedAddress.city,
        postal_code:
          data.postal_code ??
          trimmedAddress.postal_code,
        country:
          data.country ??
          trimmedAddress.country,
      });

      setAddressExists(true);

      toast.success(
        addressExists
          ? "Address updated successfully!"
          : "Address saved successfully!"
      );
    } catch (error) {
      console.error(
        "Failed to save address:",
        error
      );

      toast.error("Failed to save address");
    } finally {
      setSaving(false);
    }
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
              font-semibold
              mt-[80px]
              mb-6
              text-[1.8rem]
            "
          >
            Shipping Address
          </h2>

          {loading ? (
            <div
              className="animate-pulse"
              aria-label="Loading address"
            >
              <div
                className="
                  w-full
                  h-[50px]
                  mb-4
                  rounded-lg
                  bg-gray-200
                "
              />

              <div
                className="
                  w-full
                  h-[50px]
                  mb-4
                  rounded-lg
                  bg-gray-200
                "
              />

              <div
                className="
                  w-full
                  h-[50px]
                  mb-4
                  rounded-lg
                  bg-gray-200
                "
              />

              <div
                className="
                  w-full
                  h-[50px]
                  mb-4
                  rounded-lg
                  bg-gray-200
                "
              />

              <div
                className="
                  w-full
                  h-[50px]
                  rounded-lg
                  bg-gray-200
                "
              />
            </div>
          ) : (
            <>
              <input
                type="text"
                name="street"
                placeholder="Street"
                value={address.street}
                onChange={handleAddressChange}
                required
                disabled={saving}
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
                  disabled:bg-[#eee]
                  disabled:cursor-not-allowed
                "
              />

              <input
                type="text"
                name="city"
                placeholder="City"
                value={address.city}
                onChange={handleAddressChange}
                required
                disabled={saving}
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
                  disabled:bg-[#eee]
                  disabled:cursor-not-allowed
                "
              />

              <input
                type="text"
                name="postal_code"
                placeholder="Postal Code"
                value={address.postal_code}
                onChange={handleAddressChange}
                disabled={saving}
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
                  disabled:bg-[#eee]
                  disabled:cursor-not-allowed
                "
              />

              <input
                type="text"
                name="country"
                placeholder="Country"
                value={address.country}
                onChange={handleAddressChange}
                required
                disabled={saving}
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
                  disabled:bg-[#eee]
                  disabled:cursor-not-allowed
                "
              />

              <button
                type="submit"
                disabled={saving}
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
                {saving
                  ? "Saving..."
                  : addressExists
                    ? "Update Address"
                    : "Save Address"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default BuyerAddress;