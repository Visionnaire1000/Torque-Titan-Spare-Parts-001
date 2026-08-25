import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ItemsManagement from "../../../components/admin/ItemsManagement";

// --------------- Mock Auth ---------------- 
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

describe("ItemsManagement", () => {
  it("renders the management form", async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: async () => ({
        items: [],
      }),
    });

    render(
      <MemoryRouter>
        <ItemsManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Manage Spare Parts/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText(/Category/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Vehicle Type/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Brand/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Colour/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Buying Price/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Marked Price/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Image URL/i)
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/Description/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Create/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Update/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /Delete/i })
    ).toBeInTheDocument();
  });
});