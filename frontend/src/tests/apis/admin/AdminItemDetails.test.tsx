import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AdminItemDetails from "../../../components/admin/AdminItemDetails";
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

const authFetchMock = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1 },
    authFetch: authFetchMock,
  }),
}));

/* ---------------- DATA ---------------- */

interface MockItem {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  buying_price: number;
  discount_percentage: number;
  description: string;
  image: string;
}

interface MockReview {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  total_likes: number;
  total_dislikes: number;
  likes: {
    id: string;
    user_id: string;
    is_like: boolean;
  }[];
  created_at: string;
  user_display_name: string;
}

const mockItem: MockItem = {
  id: "1",
  brand: "Toyota",
  category: "Brake Pad",
  vehicle_type: "Car",
  buying_price: 5000,
  discount_percentage: 10,
  description: "High quality brake pad",
  image: "img.jpg",
};

const mockReviews: MockReview[] = [
  {
    id: "10",
    user_id: "2",
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
          element={<AdminItemDetails />}
        />
      </Routes>
    </MemoryRouter>
  );

/* ---------------- SETUP ---------------- */

beforeEach(() => {
  vi.clearAllMocks();

  authFetchMock.mockImplementation(
    async (url: string) => {
      if (
        url.includes(
          `${config.API_BASE_URL}/spareparts/`
        )
      ) {
        return {
          ok: true,
          json: async () => mockItem,
        };
      }

      if (
        url.includes(
          `${config.API_BASE_URL}/admin/reviews/sparepart/`
        )
      ) {
        return {
          ok: true,
          json: async () => mockReviews,
        };
      }

      return {
        ok: false,
        json: async () => ({}),
      };
    }
  );
});

/* ---------------- TESTS ---------------- */

describe("AdminItemDetails", () => {
  it("renders item details", async () => {
    renderComponent();

    expect(
      await screen.findByText(
        /Toyota Brake Pad for Car/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/KES 5,000/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /High quality brake pad/i
      )
    ).toBeInTheDocument();
  });


  it("renders customer reviews", async () => {
    renderComponent();

    expect(
      await screen.findByText(
        /Good product/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(/John/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Customer Reviews/i)
    ).toBeInTheDocument();
  });


  it("shows review like and dislike counts", async () => {
    renderComponent();

    await screen.findByText(
      /Good product/i
    );

    expect(
      screen.getByText("2")
    ).toBeInTheDocument();

    expect(
      screen.getByText("1")
    ).toBeInTheDocument();
  });


  it("handles fetch error and retries successfully", async () => {
    authFetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    renderComponent();

    expect(
      await screen.findByText(
        /Something went wrong/i
      )
    ).toBeInTheDocument();


    authFetchMock.mockImplementation(
      async (url: string) => {
        if (url.includes("/spareparts/")) {
          return {
            ok: true,
            json: async () => mockItem,
          };
        }

        return {
          ok: true,
          json: async () => mockReviews,
        };
      }
    );


    fireEvent.click(
      screen.getByRole("button", {
        name: /retry/i,
      })
    );


    expect(
      await screen.findByText(
        /Toyota Brake Pad for Car/i
      )
    ).toBeInTheDocument();
  });


  it("shows item not found when item is null", async () => {
    authFetchMock.mockImplementation(
      async (url: string) => {
        if (url.includes("/spareparts/")) {
          return {
            ok: true,
            json: async () => null,
          };
        }

        return {
          ok: true,
          json: async () => [],
        };
      }
    );


    renderComponent();


    expect(
      await screen.findByText(
        /Item not found/i
      )
    ).toBeInTheDocument();
  });


  it("shows empty reviews message", async () => {
    authFetchMock.mockImplementation(
      async (url: string) => {
        if (url.includes("/spareparts/")) {
          return {
            ok: true,
            json: async () => mockItem,
          };
        }

        return {
          ok: true,
          json: async () => [],
        };
      }
    );


    renderComponent();


    expect(
      await screen.findByText(
        /No reviews yet/i
      )
    ).toBeInTheDocument();
  });


  it("renders current user's review as 'You'", async () => {
    authFetchMock.mockImplementation(
      async (url: string) => {
        if (url.includes("/spareparts/")) {
          return {
            ok: true,
            json: async () => mockItem,
          };
        }

        return {
          ok: true,
          json: async () => [
            {
              ...mockReviews[0],
              user_id: 1,
            },
          ],
        };
      }
    );


    renderComponent();


    expect(
      await screen.findByText(/You/i)
    ).toBeInTheDocument();
  });


  it("renders discount percentage", async () => {
    renderComponent();

    await screen.findByText(
      /Toyota Brake Pad/i
    );

    expect(
      screen.getByText(/-10%/i)
    ).toBeInTheDocument();
  });


  it("renders review date", async () => {
    renderComponent();

    await screen.findByText(
      /Good product/i
    );

    const date =
      new Date(
        mockReviews[0].created_at
      ).toLocaleDateString("en-GB");


    expect(
      screen.getByText(date)
    ).toBeInTheDocument();
  });
});