import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import "../../../styles/shared/auth/registration.css";

interface FormData {
  email: string;
  password: string;
  otp: string;
}

const Registration = () => {
  const {
    sendRegistrationOtp,
    verifyRegistrationOtp,
    resendOtp,
    otpSent,
    otpCountdown,
    resendLoading,
  } = useAuth();

  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    otp: "",
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Email regex
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ------------------ Handle input ------------------
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Email validation
    if (name === "email") {
      setEmailError(
        !emailPattern.test(value)
          ? "Enter a valid email address"
          : ""
      );
    }

    // Password validation
    if (name === "password") {
      const pattern =
        /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

      setPasswordError(
        !pattern.test(value)
          ? "Password must be at least 8 characters and include one uppercase letter, one number, and one special character."
          : ""
      );
    }
  };

  // ------------------ Step 1: Send OTP ------------------
  const handleSendOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (passwordError || emailError) return;

    setIsLoading(true);

    const success = await sendRegistrationOtp(
      formData.email,
      formData.password
    );

    setIsLoading(false);

    if (success) {
      setStep(2);
    }
  };

  // ------------------ Step 2: Verify OTP ------------------
  const handleVerifyOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!formData.otp) return;

    setIsLoading(true);

    const success = await verifyRegistrationOtp(
      formData.email,
      formData.otp
    );

    setIsLoading(false);

    if (success) {
      navigate("/login");
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    if (!formData.email) return;

    await resendOtp(formData.email);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Create Account</h2>

        {/* Step 1 */}
        {step === 1 && (
          <form
            className="register-form"
            onSubmit={handleSendOtp}
          >
            <input
              type="email"
              name="email"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
              required
            />

            {emailError && (
              <p className="password-error">
                {emailError}
              </p>
            )}

            <div className="input-wrapper">
              <input
                type={
                  showPassword ? "text" : "password"
                }
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            {passwordError && (
              <p className="password-error">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={
                isLoading ||
                Boolean(passwordError) ||
                Boolean(emailError)
              }
            >
              {isLoading
                ? "Sending OTP..."
                : "Register"}
            </button>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form
            className="register-form"
            onSubmit={handleVerifyOtp}
          >
            <p>
              Enter the OTP sent to{" "}
              <strong>{formData.email}</strong>
            </p>

            <input
              type="text"
              name="otp"
              placeholder="Enter OTP"
              value={formData.otp}
              onChange={handleChange}
              required
            />

            <div className="otp-info">
              {otpSent && otpCountdown > 0 && (
                <span>
                  Resend OTP in {otpCountdown}s
                </span>
              )}

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={
                  otpCountdown > 0 || resendLoading
                }
              >
                {resendLoading
                  ? "Resending..."
                  : otpCountdown > 0
                  ? `Resend in ${otpCountdown}s`
                  : "Resend OTP"}
              </button>
            </div>

            <button
              type="submit"
              disabled={
                isLoading || !formData.otp
              }
            >
              {isLoading
                ? "Verifying..."
                : "Verify OTP"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Registration;