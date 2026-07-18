import { render, screen, fireEvent, cleanup,  waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import Cart from "../../../components/buyer/Cart";

/* ---------------- Router ---------------- */

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

/* ---------------- Toast ---------------- */

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    dismiss: vi.fn(),
    info: vi.fn(),
  },
}));

/* ---------------- Types ---------------- */

interface MockCartItem {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
  quantity: number;
}

/* ---------------- Cart Context ---------------- */

const removeItemMock = vi.fn();
const updateQuantityMock = vi.fn();
const clearCartMock = vi.fn();

let cartState = {
  items: [] as MockCartItem[],
  removeItem: removeItemMock,
  updateQuantity: updateQuantityMock,
  clearCart: clearCartMock,
  total: 0,
  itemCount: 0,
};

vi.mock("../../../contexts/CartContext", () => ({
  useCart: () => cartState,
}));

/* ---------------- Auth Context ---------------- */

let authState = {
  isAuthenticated: false,
};

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

/* ---------------- Sample Item ---------------- */

const cartItem: MockCartItem = {
  id: "1",
  brand: "Toyota",
  category: "Engine",
  vehicle_type: "Car",
  buying_price: 1000,
  image: "test.jpg",
  quantity: 2,
};

/* ---------------- Helpers ---------------- */

const renderComponent = () =>
  render(
    <MemoryRouter>
      <Cart />
    </MemoryRouter>
  );

const loadCart = () => {
  cartState = {
    ...cartState,
    items: [cartItem],
    total: 2000,
    itemCount: 2,
  };
};

/* ---------------- Setup ---------------- */

beforeEach(() => {
  vi.resetAllMocks();

  cartState = {
    items: [],
    removeItem: removeItemMock,
    updateQuantity: updateQuantityMock,
    clearCart: clearCartMock,
    total: 0,
    itemCount: 0,
  };

  authState = {
    isAuthenticated: false,
  };
});

afterEach(() => {
  cleanup();
});

describe("Cart Component", () => {
      it("renders empty cart message", () => {
    renderComponent();

    expect(
      screen.getByText(/your cart is empty/i)
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /proceed to checkout/i,
      })
    ).not.toBeInTheDocument();
  });

  it("renders a cart item", () => {
    loadCart();

    renderComponent();

    expect(
      screen.getByText(/Toyota Engine for Car/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/KES 1,000/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText("2")
    ).toBeInTheDocument();
  });

  it("renders subtotal and total", () => {
    loadCart();

    renderComponent();

    const totals = screen.getAllByText(/KES 2,000/i);

    expect(totals.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the item image", () => {
    loadCart();

    renderComponent();

    const image = screen.getByRole("img");

    expect(image).toHaveAttribute(
      "src",
      "test.jpg"
    );

    expect(image).toHaveAttribute(
      "alt",
      "Toyota"
    );
  });

  it("renders the table headers", () => {
    loadCart();

    renderComponent();

    expect(
      screen.getByText(/item/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/price/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/quantity/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/subtotal/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/actions/i)
    ).toBeInTheDocument();
  });
    it("increments quantity", () => {
    loadCart();

    renderComponent();

    const buttons = screen.getAllByRole("button");

    // First quantity controls are "-" then "+"
    fireEvent.click(buttons[1]);

    expect(updateQuantityMock).toHaveBeenCalledWith(
      "1",
      3
    );
  });

  it("decrements quantity", () => {
    loadCart();

    renderComponent();

    const buttons = screen.getAllByRole("button");

    fireEvent.click(buttons[0]);

    expect(updateQuantityMock).toHaveBeenCalledWith(
      "1",
      1
    );
  });

  it("removes an item", () => {
    loadCart();

    renderComponent();

    fireEvent.click(
      screen.getByLabelText(/remove item/i)
    );

    expect(removeItemMock).toHaveBeenCalledWith("1");
  });

  it("shows confirmation toast when clearing cart", () => {
    loadCart();

    renderComponent();

    fireEvent.click(
      screen.getByRole("button", {
        name: /clear cart/i,
      })
    );

    expect(toast.warn).toHaveBeenCalledTimes(1);

    expect(clearCartMock).not.toHaveBeenCalled();
  });

  it("renders clear cart button", () => {
    loadCart();

    renderComponent();

    expect(
      screen.getByRole("button", {
        name: /clear cart/i,
      })
    ).toBeInTheDocument();
  });

  it("renders checkout button", () => {
    loadCart();

    renderComponent();

    expect(
      screen.getByRole("button", {
        name: /proceed to checkout/i,
      })
    ).toBeInTheDocument();
  });

    it("navigates to checkout when authenticated", async () => {
    loadCart();

    authState = {
      isAuthenticated: true,
    };

    renderComponent();

    fireEvent.click(
      screen.getByRole("button", {
        name: /proceed to checkout/i,
      })
    );

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        "/checkout"
      );
    });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    loadCart();

    authState = {
      isAuthenticated: false,
    };

    renderComponent();

    fireEvent.click(
      screen.getByRole("button", {
        name: /proceed to checkout/i,
      })
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Please login to proceed with checkout"
      );

      expect(navigateMock).toHaveBeenCalledWith(
        "/login",
        {
          state: {
            from: "/cart",
          },
        }
      );
    });
  });

  it("does not show checkout button when cart is empty", () => {
    renderComponent();

    expect(
      screen.queryByRole("button", {
        name: /proceed to checkout/i,
      })
    ).not.toBeInTheDocument();
  });
});