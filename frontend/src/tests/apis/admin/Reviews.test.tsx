import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Reviews from "../../../components/admin/adminDashboard/Reviews";

/* ---------------- Mock Auth ---------------- */
const mockAuthFetch = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "admin@test.com" },
    authFetch: mockAuthFetch,
  }),
}));

/* ---------------- Mock Config ---------------- */
vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://localhost:5000",
  },
}));

describe("Reviews", () => {
  it("renders fetched reviews", async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          sparepart_id: 1,
          user_display_name: "John",
          rating: 5,
          comment: "Excellent product",
          total_likes: 3,
          total_dislikes: 0,
          created_at: "2026-08-01T10:00:00",
        },
      ],
    });

    render(
      <MemoryRouter>
        <Reviews />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("John")).toBeInTheDocument();
    });

    expect(screen.getByText("Excellent product")).toBeInTheDocument();
    expect(screen.getByText(/Total Reviews:/i)).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(
      <MemoryRouter>
        <Reviews />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No reviews yet/i)
      ).toBeInTheDocument();
    });
  });

  it("renders error state", async () => {
    mockAuthFetch.mockRejectedValueOnce(
      new Error("Failed to fetch reviews")
    );

    render(
      <MemoryRouter>
        <Reviews />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /Retry/i })
    ).toBeInTheDocument();
  });
});