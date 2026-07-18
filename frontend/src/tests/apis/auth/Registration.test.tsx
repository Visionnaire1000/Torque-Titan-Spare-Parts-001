import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Registration from "../../../components/shared/auth/Registration";
import { MemoryRouter } from "react-router-dom";

/* ---------------- MOCKS ---------------- */

// router navigation
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// auth context
const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const resendOtpMock = vi.fn();

vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({
    sendRegistrationOtp: sendOtpMock,
    verifyRegistrationOtp: verifyOtpMock,
    resendOtp: resendOtpMock,
    otpSent: true,
    otpCountdown: 0,
    resendLoading: false,
  }),
}));

/* ---------------- SETUP ---------------- */

beforeEach(() => {
  vi.clearAllMocks();
});

/* ---------------- TESTS ---------------- */

const renderComponent = () =>
  render(
    <MemoryRouter>
      <Registration />
    </MemoryRouter>
  );

describe("Registration Component", () => {
  it("renders step 1 form", () => {
    renderComponent();

    expect(screen.getByText(/Create Account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Email address/i)).toBeInTheDocument();
  });

  it("validates email format", async () => {
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/Email address/i), {
      target: { value: "invalidemail" },
    });

    expect(
      await screen.findByText(/Enter a valid email address/i)
    ).toBeInTheDocument();
  });

  it("validates password rules", async () => {
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/Password/i), {
      target: { value: "123" },
    });

    expect(
      await screen.findByText(/Password must be at least 8 characters/i)
    ).toBeInTheDocument();
  });

  it("sends OTP and moves to step 2", async () => {
    sendOtpMock.mockResolvedValue(true);

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/Email address/i), {
      target: { value: "test@gmail.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/Password/i), {
      target: { value: "Password@1" },
    });

    fireEvent.click(screen.getByText(/Register/i));

    await waitFor(() => {
      expect(sendOtpMock).toHaveBeenCalledWith(
        "test@gmail.com",
        "Password@1"
      );
    });
  });

  it("verifies OTP and navigates to login", async () => {
    sendOtpMock.mockResolvedValue(true);
    verifyOtpMock.mockResolvedValue(true);

    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/Email address/i), {
      target: { value: "test@gmail.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/Password/i), {
      target: { value: "Password@1" },
    });

    fireEvent.click(screen.getByText(/Register/i));

    // simulate OTP step
    await waitFor(() => {
      expect(sendOtpMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText(/Enter OTP/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByText(/Verify OTP/i));

    await waitFor(() => {
      expect(verifyOtpMock).toHaveBeenCalledWith(
        "test@gmail.com",
        "123456"
      );
    });
  });

  it("resends OTP", async () => {
    renderComponent();

    sendOtpMock.mockResolvedValue(true);

    fireEvent.change(screen.getByPlaceholderText(/Email address/i), {
      target: { value: "test@gmail.com" },
    });

    fireEvent.change(screen.getByPlaceholderText(/Password/i), {
      target: { value: "Password@1" },
    });

    fireEvent.click(screen.getByText(/Register/i));

    await waitFor(() => {
      expect(sendOtpMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText(/Resend OTP/i));

    expect(resendOtpMock).toHaveBeenCalledWith("test@gmail.com");
  });
});