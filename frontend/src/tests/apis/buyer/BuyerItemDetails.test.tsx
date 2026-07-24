import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import BuyerItemDetails from "../../../components/buyer/BuyerItemDetails";
import config from "../../../config";

/* ---------------- MOCKS ---------------- */

vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://test-api",
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const addItemMock = vi.fn();

vi.mock("../../../contexts/CartContext", () => ({
  useCart: () => ({
    addItem: addItemMock,
  }),
}));

const authFetchMock = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1 },
    authFetch: authFetchMock,
  }),
}));

/* ---------------- DATA ---------------- */

interface MockItem {
  id: number;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  discount_percentage: number;
  description: string;
  image: string;
  average_rating: number;
}

interface MockReview {
  id: number;
  user_id: number;
  rating: number;
  comment: string;
  total_likes: number;
  total_dislikes: number;
  likes: unknown[];
  created_at: string;
  user_display_name: string;
}

const mockItem: MockItem = {
  id: 1,
  brand: "Toyota",
  category: "Brake Pad",
  vehicle_type: "Car",
  buying_price: 5000,
  discount_percentage: 10,
  description: "High quality brake pad",
  image: "img.jpg",
  average_rating: 4,
};

const mockReviews: MockReview[] = [
  {
    id: 10,
    user_id: 2,
    rating: 4,
    comment: "Good product",
    total_likes: 2,
    total_dislikes: 1,
    likes: [],
    created_at: new Date().toISOString(),
    user_display_name: "John",
  },
];

/* ---------------- HELPERS ---------------- */

const renderComponent = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={["/item/1"]}>
      <Routes>
        <Route
          path="/item/:id"
          element={<BuyerItemDetails />}
        />
      </Routes>
    </MemoryRouter>
  );

/* ---------------- SETUP ---------------- */

beforeEach(() => {
  vi.clearAllMocks();

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (
        input: RequestInfo | URL
      ): Promise<Response> => {
        const url = input.toString();

        if (
          url.includes(
            `${config.API_BASE_URL}/spareparts/`
          )
        ) {
          return {
            ok: true,
            json: async () => mockItem,
          } as Response;
        }

        if (
          url.includes(
            `${config.API_BASE_URL}/reviews/`
          )
        ) {
          return {
            ok: true,
            json: async () => mockReviews,
          } as Response;
        }

        return {
          ok: false,
          json: async () => ({}),
        } as Response;
      }
    )
  );


  authFetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      review: {
        total_likes: 3,
        total_dislikes: 0,
      },
    }),
  });
});

/* ---------------- TESTS ---------------- */

describe("BuyerItemDetails", () => {
  it("renders item details", async () => {
    renderComponent();

    expect(
      await screen.findByText(
        /Toyota Brake Pad/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/KES 5,000/i)
    ).toBeInTheDocument();
  });


  it("renders reviews", async () => {
    renderComponent();

    expect(
      await screen.findByText(
        /Good product/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/John/i)
    ).toBeInTheDocument();
  });


  it("adds item to cart", async () => {
    renderComponent();


    const button =
      await screen.findByRole(
        "button",
        {
          name: /add to cart/i,
        }
      );


    fireEvent.click(button);


    expect(
      addItemMock
    ).toHaveBeenCalledWith(
      mockItem
    );
  });


  it("submits review", async () => {
    renderComponent();


    const textarea =
      await screen.findByPlaceholderText(
        /write a comment/i
      );


    fireEvent.change(
      textarea,
      {
        target: {
          value: "Nice product",
        },
      }
    );


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name: /submit review/i,
        }
      )
    );


    await waitFor(() => {
      expect(
        authFetchMock
      ).toHaveBeenCalled();
    });
  });


  it("handles fetch error and retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
          } as Response)
      )
    );


    renderComponent();


    expect(
      await screen.findByText(
        /Something went wrong/i
      )
    ).toBeInTheDocument();


    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (
          input: RequestInfo | URL
        ): Promise<Response> => {
          const url =
            input.toString();


          if (
            url.includes(
              "/spareparts/"
            )
          ) {
            return {
              ok: true,
              json: async () =>
                mockItem,
            } as Response;
          }


          return {
            ok: true,
            json: async () =>
              mockReviews,
          } as Response;
        }
      )
    );


    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name: /retry/i,
        }
      )
    );


    expect(
      await screen.findByText(
        /Toyota Brake Pad/i
      )
    ).toBeInTheDocument();
  });


  it("reacts to a review with a like", async () => {
    renderComponent();


    await screen.findByText(
      /Good product/i
    );


    const likeButton =
      screen
        .getAllByRole(
          "button"
        )
        .find(
          (button) =>
            button.textContent?.includes(
              "2"
            )
        );


    expect(
      likeButton
    ).toBeDefined();


    fireEvent.click(
      likeButton!
    );


    await waitFor(() => {
      expect(
        authFetchMock
      ).toHaveBeenCalled();
    });
  });
});