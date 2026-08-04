import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BuyerOrders from "../../../components/buyer/buyerDashboard/BuyerOrders";
import { useAuth } from "../../../contexts/AuthContext";

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://localhost:5000",
  },
}));

const mockAuthFetch = vi.fn();

const mockedUseAuth = vi.mocked(useAuth);

const pendingOrders = [
  {
    id: 1,
    status: "pending",
    total_items: 2,
    total_price: 2500,
    address: "Nairobi",
    created_at: "2025-07-01T12:00:00",
    order_items: [
      {
        id: 11,
        quantity: 2,
        price: 1250,
        subtotal: 2500,
        sparepart: {
          id: 101,
          brand: "Toyota",
          category: "Brake Pad",
          vehicle_type: "SUV",
          image_url: "/toyota.jpg",
        },
      },
    ],
  },
];

function renderComponent() {
  return render(
    <MemoryRouter>
      <BuyerOrders />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedUseAuth.mockReturnValue({
    authFetch: mockAuthFetch,
  } as any);

  Storage.prototype.getItem = vi.fn(() => null);
  Storage.prototype.setItem = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BuyerOrders", () => {
  it("renders empty state when there are no orders", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: [],
      }),
    });

    renderComponent();

    expect(
      await screen.findByText(/No orders yet/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /Browse Products/i,
      })
    ).toBeInTheDocument();
  });

  it("renders fetched pending order", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: pendingOrders,
      }),
    });

    renderComponent();

    expect(
      await screen.findByText("Order #1")
    ).toBeInTheDocument();

    expect(
      screen.getByText("pending")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Total Items:/)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Shipping Address:/)
    ).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    mockAuthFetch.mockRejectedValue(
      new Error("Failed to fetch orders")
    );

    renderComponent();

    expect(
      await screen.findByText(/Something went wrong/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Retry/i,
      })
    ).toBeInTheDocument();
  });

    it("retries fetching orders", async () => {
    mockAuthFetch
      .mockRejectedValueOnce(
        new Error("Failed to fetch orders")
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: pendingOrders,
        }),
      });

    renderComponent();

    const retryButton = await screen.findByRole("button", {
      name: /Retry/i,
    });

    fireEvent.click(retryButton);

    expect(
      await screen.findByText("Order #1")
    ).toBeInTheDocument();

    expect(mockAuthFetch).toHaveBeenCalledTimes(2);
  });

  it("renders all tabs", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        orders: pendingOrders,
      }),
    });

    renderComponent();

    await screen.findByText("Order #1");

    expect(
      screen.getByRole("button", {
        name: /Pending/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Shipped/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Delivered/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Cancelled/i,
      })
    ).toBeInTheDocument();
  });
});