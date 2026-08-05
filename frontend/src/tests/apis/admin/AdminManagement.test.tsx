import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminManagement from "../../../components/admin/adminDashboard/AdminManagement";
import { useAuth } from "../../../contexts/AuthContext";

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  ToastContainer: () => <div data-testid="toast-container" />,
}));

describe("AdminManagement", () => {
  const authFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        admins: [
          {
            id: 1,
            email: "admin@test.com",
          },
        ],
      }),
    });

    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: {
        role: "super_admin",
      },
      authFetch,
    });
  });

  it("renders heading", () => {
    render(
      <MemoryRouter>
        <AdminManagement />
      </MemoryRouter>
    );

    expect(
      screen.getByText("Admin Management")
    ).toBeInTheDocument();
  });

  it("shows access denied for non super admin", () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: {
        role: "admin",
      },
      authFetch,
    });

    render(
      <MemoryRouter>
        <AdminManagement />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/access denied/i)
    ).toBeInTheDocument();
  });

  it("validates invalid email", () => {
    render(
      <MemoryRouter>
        <AdminManagement />
      </MemoryRouter>
    );

    fireEvent.change(
      screen.getByPlaceholderText("Email"),
      {
        target: {
          value: "wrong-email",
        },
      }
    );

    expect(
      screen.getByText(/enter a valid email/i)
    ).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    render(
      <MemoryRouter>
        <AdminManagement />
      </MemoryRouter>
    );

    const password =
      screen.getByPlaceholderText("Password");

    expect(password).toHaveAttribute(
      "type",
      "password"
    );

    const toggle = screen.getAllByRole("button")[0];

    fireEvent.click(toggle);

    expect(password).toHaveAttribute(
      "type",
      "text"
    );
  });

  it("renders fetched admins", async () => {
    render(
      <MemoryRouter>
        <AdminManagement />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("admin@test.com")
    ).toBeInTheDocument();
  });
});