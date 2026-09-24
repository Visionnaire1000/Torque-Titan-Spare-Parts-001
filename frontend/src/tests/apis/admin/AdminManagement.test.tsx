import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminManagement from "../../../components/admin/auth/AdminManagement";
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

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AdminManagement />
      </MemoryRouter>
    );

  beforeEach(() => {
    vi.clearAllMocks();

    authFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        admins: [
          {
            id: 1,
            email: "admin@test.com",
          },
        ],
      }),
    });

    (
      useAuth as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      user: {
        role: "super_admin",
      },
      authFetch,
    });
  });

  it("renders heading", () => {
    renderComponent();

    expect(
      screen.getByText("Admin Management")
    ).toBeInTheDocument();
  });

  it("shows access denied for non super admin", () => {
    (
      useAuth as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      user: {
        role: "admin",
      },
      authFetch,
    });

    renderComponent();

    expect(
      screen.getByText(/access denied/i)
    ).toBeInTheDocument();

    expect(authFetch).not.toHaveBeenCalled();
  });

  it("validates invalid email", () => {
    renderComponent();

    const emailInput =
      screen.getByPlaceholderText("Email");

    fireEvent.change(emailInput, {
      target: {
        value: "wrong-email",
      },
    });

    expect(
      screen.getByText(/enter a valid email/i)
    ).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    renderComponent();

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
});