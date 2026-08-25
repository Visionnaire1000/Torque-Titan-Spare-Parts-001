import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminOrders from "../../../components/admin/adminDashboard/AdminOrders";

//---------------- Mock Auth ---------------- 
const mockAuthFetch = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
  }),
}));

// ---------------- Mock Config ---------------- 
vi.mock("../../../config", () => ({
  default: {
    API_BASE_URL: "http://localhost:5000",
  },
}));

describe("AdminOrders", () => {
  it("renders empty orders message", async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        orders: [],
      }),
    });

    render(
      <MemoryRouter>
        <AdminOrders />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No orders yet/i)
      ).toBeInTheDocument();
    });
  });

  it("renders error state when fetch fails", async () => {
    mockAuthFetch.mockRejectedValueOnce(
      new Error("Failed to fetch orders")
    );

    render(
      <MemoryRouter>
        <AdminOrders />
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