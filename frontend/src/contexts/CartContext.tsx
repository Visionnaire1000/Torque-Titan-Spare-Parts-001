import { createContext, useState, useContext, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";
import config from "../config";


export interface CartItem {
  id: string;
  sparepart_id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
  quantity: number;
}

export interface SparePart {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
}

interface BackendCartItem {
  id: string;
  sparepart: SparePart;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CartResponse {
  items?: BackendCartItem[];
  total_quantity?: number;
  total_price?: number;
  message?: string;
  error?: string;
}

interface CartContextType {
  items: CartItem[];

  addItem: (
    item: SparePart,
    qty?: number
  ) => Promise<void>;

  removeItem: (
    id: string
  ) => Promise<void>;

  updateQuantity: (
    id: string,
    quantity: number
  ) => Promise<void>;

  clearCart: (
    showToast?: boolean
  ) => Promise<boolean>;

  loadCart: () => Promise<void>;

  total: number;

  itemCount: number;

  loading: boolean;
}

interface CartProviderProps {
  children: ReactNode;
}

const CartContext =
  createContext<CartContextType | undefined>(
    undefined
  );

const CartProvider = ({
  children,
}: CartProviderProps): React.JSX.Element => {
  const { user, authFetch } = useAuth();

  const [items, setItems] = useState<CartItem[]>(
    []
  );

  const [loading, setLoading] =
    useState<boolean>(false);

  const mapCartItems = (
    backendItems: BackendCartItem[]
  ): CartItem[] => {
    return backendItems.map((cartItem) => ({
      id: cartItem.id,
      sparepart_id: cartItem.sparepart.id,
      brand: cartItem.sparepart.brand,
      category: cartItem.sparepart.category,
      vehicle_type:
        cartItem.sparepart.vehicle_type,
      buying_price:
        cartItem.unit_price,
      image: cartItem.sparepart.image,
      quantity: cartItem.quantity,
    }));
  };

  const loadCart = useCallback(
    async (): Promise<void> => {
      if (!user) {
        setItems([]);
        return;
      }

      setLoading(true);

      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/cart/`,
          {
            method: "GET",
          }
        );

        let data: CartResponse = {};

        try {
          data =
            (await response.json()) as CartResponse;
        } catch {
          data = {};
        }

        if (!response.ok) {
          toast.error(
            data.message ||
              data.error ||
              "Failed to load cart"
          );

          return;
        }

        setItems(
          Array.isArray(data.items)
            ? mapCartItems(data.items)
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load cart:",
          error
        );

        toast.error("Failed to load cart");
      } finally {
        setLoading(false);
      }
    },
    [user, authFetch]
  );

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const addItem = async (
    item: SparePart,
    qty: number = 1
  ): Promise<void> => {
    if (!user) {
      toast.error(
        "Please log in to add items to your cart"
      );

      return;
    }

    if (
      !Number.isInteger(qty) ||
      qty < 1
    ) {
      toast.error(
        "Quantity must be greater than zero"
      );

      return;
    }

    try {
      const response = await authFetch(
        `${config.API_BASE_URL}/cart/`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            sparepart_id: item.id,
            quantity: qty,
          }),
        }
      );

      let data:
        | BackendCartItem
        | CartResponse = {};

      try {
        data =
          (await response.json()) as
            | BackendCartItem
            | CartResponse;
      } catch {
        data = {};
      }

      if (!response.ok) {
        toast.error(
          "message" in data && data.message
            ? data.message
            : "error" in data && data.error
              ? data.error
              : "Failed to add item to cart"
        );

        return;
      }

      await loadCart();

      toast.success(
        `${item.brand} ${item.category} for ${item.vehicle_type} added to cart`
      );
    } catch (error) {
      console.error(
        "Failed to add item to cart:",
        error
      );

      toast.error(
        "Failed to add item to cart"
      );
    }
  };

  const removeItem = async (
    id: string
  ): Promise<void> => {
    if (!user) {
      return;
    }

    try {
      const response = await authFetch(
        `${config.API_BASE_URL}/cart/${id}/`,
        {
          method: "DELETE",
        }
      );

      let data: CartResponse = {};

      try {
        data =
          (await response.json()) as CartResponse;
      } catch {
        data = {};
      }

      if (!response.ok) {
        toast.error(
          data.message ||
            data.error ||
            "Failed to remove item from cart"
        );

        return;
      }

      setItems((previousItems) =>
        previousItems.filter(
          (item) => item.id !== id
        )
      );

      toast.success(
        "Item removed from cart"
      );
    } catch (error) {
      console.error(
        "Failed to remove cart item:",
        error
      );

      toast.error(
        "Failed to remove item from cart"
      );
    }
  };

  const updateQuantity = async (
    id: string,
    quantity: number
  ): Promise<void> => {
    if (!user) {
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      await removeItem(id);
      return;
    }

    try {
      const response = await authFetch(
        `${config.API_BASE_URL}/cart/${id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            quantity,
          }),
        }
      );

      let data:
        | BackendCartItem
        | CartResponse = {};

      try {
        data =
          (await response.json()) as
            | BackendCartItem
            | CartResponse;
      } catch {
        data = {};
      }

      if (!response.ok) {
        toast.error(
          "message" in data && data.message
            ? data.message
            : "error" in data && data.error
              ? data.error
              : "Failed to update cart quantity"
        );

        return;
      }

      const updatedUnitPrice =
        "unit_price" in data &&
        typeof data.unit_price === "number"
          ? data.unit_price
          : null;

      setItems((previousItems) =>
        previousItems.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity,
                ...(updatedUnitPrice !== null
                  ? {
                      buying_price:
                        updatedUnitPrice,
                    }
                  : {}),
              }
            : item
        )
      );
    } catch (error) {
      console.error(
        "Failed to update cart quantity:",
        error
      );

      toast.error(
        "Failed to update cart quantity"
      );
    }
  };

  const clearCart = async (
    showToast: boolean = true
  ): Promise<boolean> => {
    if (!user) {
      setItems([]);
      return true;
    }

    const cartItems = [...items];

    if (cartItems.length === 0) {
      setItems([]);
      return true;
    }

    try {
      const responses = await Promise.all(
        cartItems.map((item) =>
          authFetch(
            `${config.API_BASE_URL}/cart/${item.id}/`,
            {
              method: "DELETE",
            }
          )
        )
      );

      const failedResponse =
        responses.find(
          (response) => !response.ok
        );

      if (failedResponse) {
        let data: CartResponse = {};

        try {
          data =
            (await failedResponse.json()) as CartResponse;
        } catch {
          data = {};
        }

        await loadCart();

        toast.error(
          data.message ||
            data.error ||
            "Failed to clear cart"
        );

        return false;
      }

      setItems([]);

      if (showToast) {
        toast.success("Cart cleared", {
          autoClose: 1000,
        });
      }

      return true;
    } catch (error) {
      console.error(
        "Failed to clear cart:",
        error
      );

      await loadCart();

      toast.error(
        "Failed to clear cart"
      );

      return false;
    }
  };

  const total: number = items.reduce(
    (sum, item) =>
      sum +
      item.buying_price * item.quantity,
    0
  );

  const itemCount: number = items.reduce(
    (sum, item) =>
      sum + item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        loadCart,
        total,
        itemCount,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export { CartProvider };

export const useCart =
  (): CartContextType => {
    const context =
      useContext(CartContext);

    if (!context) {
      throw new Error(
        "useCart must be used within a CartProvider"
      );
    }

    return context;
  };
