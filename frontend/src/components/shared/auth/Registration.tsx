import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

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
  <div
    className="
      mx-auto
      mt-[110px]
      mb-12
      max-w-[500px]
      rounded-xl
      bg-white
      p-8
      shadow-[0_4px_12px_rgba(0,0,0,0)]
    "
  >
    <div
      className="
        rounded-xl
        bg-white
        p-10
        shadow-[0_4px_12px_rgba(0,0,0,0.1)]
      "
    >
      <h2
        className="
          -mt-[10px]
          mb-6
          flex
          items-start
          justify-center
          text-[1.8rem]
          font-semibold
          text-[rgb(0,64,128)]
        "
      >
        Create Account
      </h2>

      {/* Step 1 */}
      {step === 1 && (
        <form
          onSubmit={handleSendOtp}
          className="flex flex-col gap-[10px]"
        >
          <input
            type="email"
            name="email"
            placeholder="Email address"
            value={formData.email}
            onChange={handleChange}
            required
            className="
              rounded-md
              border
              border-[#ccc]
              px-[0.8rem]
              py-[0.6rem]
              text-base
              transition-colors
              duration-300
              focus:border-[rgb(0,64,128)]
              focus:outline-none
            "
          />

          {emailError && (
            <p
              className="
                mt-[5px]
                block
                rounded-[5px]
                border
                border-[#f5c2c7]
                bg-[#f8d7da]
                px-[10px]
                py-[5px]
                text-[0.9rem]
                font-medium
                text-[#d9534f]
              "
            >
              {emailError}
            </p>
          )}

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="
                w-full
                rounded-md
                border
                border-[#ccc]
                px-[0.8rem]
                py-[0.6rem]
                pr-12
                text-base
                transition-colors
                duration-300
                focus:border-[rgb(0,64,128)]
                focus:outline-none
              "
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                text-gray-500
                transition-colors
                hover:text-[rgb(0,64,128)]
              "
            >
              {showPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          </div>

          {passwordError && (
            <p
              className="
                mt-[5px]
                block
                rounded-[5px]
                border
                border-[#f5c2c7]
                bg-[#f8d7da]
                px-[10px]
                py-[5px]
                text-[0.9rem]
                font-medium
                text-[#d9534f]
              "
            >
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
            className="
              rounded-md
              bg-[rgb(0,64,128)]
              py-3
              text-base
              font-bold
              text-white
              transition-colors
              duration-300
              hover:bg-[rgba(13,54,95,0.831)]
              disabled:cursor-not-allowed
              disabled:bg-[#ccc]
            "
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
          onSubmit={handleVerifyOtp}
          className="flex flex-col gap-[10px]"
        >
          <p className="text-center">
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
            className="
              rounded-md
              border
              border-[#ccc]
              px-[0.8rem]
              py-[0.6rem]
              text-base
              transition-colors
              duration-300
              focus:border-[rgb(0,64,128)]
              focus:outline-none
            "
          />

          <div
            className="
              flex
              flex-col
              gap-2
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            {otpSent && otpCountdown > 0 && (
              <span className="text-sm text-gray-600">
                Resend OTP in {otpCountdown}s
              </span>
            )}

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={
                otpCountdown > 0 ||
                resendLoading
              }
              className="
                font-semibold
                text-[rgb(0,64,128)]
                transition-colors
                hover:text-[rgba(13,54,95,0.831)]
                disabled:cursor-not-allowed
                disabled:text-gray-400
              "
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
            className="
              rounded-md
              bg-[rgb(0,64,128)]
              py-3
              text-base
              font-bold
              text-white
              transition-colors
              duration-300
              hover:bg-[rgba(13,54,95,0.831)]
              disabled:cursor-not-allowed
              disabled:bg-[#ccc]
            "
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