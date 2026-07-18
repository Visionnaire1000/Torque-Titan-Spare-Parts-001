import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Login from "../../../components/shared/auth/Login";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();

let locationMock: { state: { from?: string } } = {
  state: {},
};

let authState = {
  login: vi.fn(),
  isLoading: false,
  user: null as any,
  isAuthenticated: false,
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationMock,
  };
});

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

const renderComponent = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();

  authState = {
    login: vi.fn(),
    isLoading: false,
    user: null,
    isAuthenticated: false,
  };

  locationMock = {
    state: {},
  };
});

describe("Login", () => {
  it("renders login form", () => {
    renderComponent();

    expect(
      screen.getByText(/sign in to your account/i)
    ).toBeInTheDocument();
  });

  it("updates input values", () => {
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: {
        value: "test@gmail.com",
      },
    });

    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: {
        value: "Password@1",
      },
    });

    expect(
      screen.getByDisplayValue("test@gmail.com")
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue("Password@1")
    ).toBeInTheDocument();
  });

  it("calls login when submitted", async () => {
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: {
        value: "test@gmail.com",
      },
    });

    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: {
        value: "Password@1",
      },
    });

    fireEvent.submit(
      screen.getByRole("button", {
        name: /login/i,
      }).closest("form")!
    );

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith(
        "test@gmail.com",
        "Password@1"
      );
    });
  });

  it("redirects authenticated user to home", async () => {
    authState = {
      ...authState,
      isAuthenticated: true,
      user: {
        email: "test@gmail.com",
      },
    };

    renderComponent();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/", {
        replace: true,
      });
    });
  });

  it("redirects to previous page", async () => {
    locationMock = {
      state: {
        from: "/checkout",
      },
    };

    authState = {
      ...authState,
      isAuthenticated: true,
      user: {
        email: "test@gmail.com",
      },
    };

    renderComponent();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith(
        "/checkout",
        {
          replace: true,
        }
      );
    });
  });
});