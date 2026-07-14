import { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import { toast } from 'react-toastify';

// ---------------Interfaces-------------
// Cart Items Interface
export interface CartItem {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
  quantity: number;
}
// (since the data is from backend)
export interface SparePart {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
}

// Context Interface
interface CartContextType {
  items: CartItem[];

  addItem: (item: SparePart, qty?: number) => void;

  removeItem: (id: string) => void;

  updateQuantity: (
    id: string,
    quantity: number
  ) => void;

  clearCart: () => void;

  total: number;

  itemCount: number;
}

// CartProvider interface
interface CartProviderProps {
  children: ReactNode;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({children,}: CartProviderProps) => {
   const [items, setItems] = useState<CartItem[]>(() => {
     try {
      const storedCart = localStorage.getItem("titanCart");

     return storedCart
      ? (JSON.parse(storedCart) as CartItem[])
      : [];
  } catch (err) {
    console.error("Error parsing cart from localStorage", err);
    return [];
  }
 });

  // Persist cart whenever items change
  useEffect(() => {
    localStorage.setItem('titanCart', JSON.stringify(items));
  }, [items]);

  // Add item to cart with automatic normalization
   const addItem = (
    item: SparePart,
    qty: number = 1
  ): void => {
    const normalizedItem: CartItem = {
      id: item.id,
      brand: item.brand,
      category: item.category,
      vehicle_type: item.vehicle_type,
      buying_price: item.buying_price,
      image: item.image,
      quantity: qty,
    };

    setItems((prevItems) => {
      const existingItem = prevItems.find(
        (i) => i.id === normalizedItem.id
      );

      if (existingItem) {
        return prevItems.map((i) =>
          i.id === normalizedItem.id
            ? {
                ...i,
                quantity: i.quantity + qty,
              }
            : i
        );
      }

      return [...prevItems, normalizedItem];
    });

    toast.success(
      `${normalizedItem.brand} ${normalizedItem.category} for ${normalizedItem.vehicle_type} added to cart`
    );
  };

  // Remove an item completely
   const removeItem = (id: string): void => {
    setItems((prevItems) =>
      prevItems.filter((i) => i.id !== id)
    );

    toast.success("Item removed from cart");
  };

  const updateQuantity = (
    id: string,
    quantity: number
  ): void => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((i) =>
        i.id === id
          ? {
              ...i,
              quantity,
            }
          : i
      )
    );
  };

  const clearCart = (): void => {
    setItems([]);

    toast.success("Cart cleared", {
      autoClose: 1000,
    });
  };

    const total: number = items.reduce(
    (sum, i) => sum + i.buying_price * i.quantity,
    0
  );

  const itemCount: number = items.reduce(
    (sum, i) => sum + i.quantity,
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
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used within a CartProvider"
    );
  }

  return context;
};
