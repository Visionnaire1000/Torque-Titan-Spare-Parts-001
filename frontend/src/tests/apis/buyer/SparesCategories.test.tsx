import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SedanTyres from "../../../components/buyer/categories/tyres/SedanTyres";
import { MemoryRouter } from "react-router-dom";

interface MockItem {
  id: number;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  image: string;
}

interface MockResponse {
  items: MockItem[];
  pages: number;
}

vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://test-api",
  },
}));

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

const addItemMock = vi.fn();

vi.mock("../../../contexts/CartContext", () => ({
  useCart: () => ({
    addItem: addItemMock,
  }),
}));

const renderComponent = (): void => {
  render(
    <MemoryRouter>
      <SedanTyres />
    </MemoryRouter>
  );
};

const mockData: MockResponse = {
  items: [
    {
      id: 1,
      brand: "Michelin",
      category: "tyre",
      vehicle_type: "sedan",
      buying_price: 20000,
      image: "/test.jpg",
    },
  ],
  pages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();

  fetchMock.mockResolvedValue({
    ok: true,
    json: async (): Promise<MockResponse> => mockData,
  });
});

describe("SedanTyres", () => {
  it("renders fetched tyres", async () => {
    renderComponent();

    expect(
      await screen.findByText(/michelin/i)
    ).toBeInTheDocument();
  });

  it("adds item to cart", async () => {
    renderComponent();

    const button = await screen.findByRole("button", {
      name: /add to cart/i,
    });

    await waitFor(() => {
      fireEvent.click(button);
    });

    expect(addItemMock).toHaveBeenCalledTimes(1);
  });

  it("shows error state when fetch fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    renderComponent();

    expect(
      await screen.findByText(/something went wrong/i)
    ).toBeInTheDocument();
  });
});