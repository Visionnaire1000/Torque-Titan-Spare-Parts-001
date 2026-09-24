import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

const ForgotPassword = (): React.JSX.Element => {
  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [newPassword, setNewPassword] =
    useState<string>("");
  const [confirmPassword, setConfirmPassword] =
    useState<string>("");

  const [showNewPassword, setShowNewPassword] =
    useState<boolean>(false);
  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState<boolean>(false);

  const [otpStep, setOtpStep] =
    useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] =
    useState<boolean>(false);

  const {
    sendForgotPasswordOtp,
    completeForgotPassword,
    otpCountdowns,
    resendOtp,
  } = useAuth();

  const navigate = useNavigate();

  const forgotPasswordCountdown =
    otpCountdowns.forgot_password;

  const passwordsMatch =
    newPassword.trim() ===
    confirmPassword.trim();

  const handleSendOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!passwordsMatch) {
      return;
    }

    setIsSubmitting(true);

    try {
      const success =
        await sendForgotPasswordOtp(
          email,
          newPassword
        );

      if (success) {
        setOtpStep(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (otp.length !== 6) {
      return;
    }

    setIsSubmitting(true);

    try {
      const success =
        await completeForgotPassword(
          email,
          otp,
          newPassword
        );

      if (success) {
        navigate("/login", {
          replace: true,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    if (forgotPasswordCountdown > 0) {
      return;
    }

    await resendOtp(
      email,
      "forgot_password"
    );
  };

  return (
    <div
      className="
        mx-auto
        mt-[140px]
        mb-[50px]
        w-full
        max-w-[420px]
        rounded-xl
        bg-white
        p-8
        shadow-[0_4px_12px_rgba(0,0,0,0.1)]
      "
    >
      <div>
        <p
          className="
            mb-2
            text-center
            text-base
            font-bold
            text-[rgb(0,64,128)]
          "
        >
          {otpStep
            ? "Reset your password"
            : "Forgot password?"}
        </p>

        {!otpStep ? (
          <>
            <p
              className="
                mb-6
                text-center
                text-sm
                text-gray-600
              "
            >
              Enter your email and create a new
              password. We'll send you an OTP to
              confirm the password reset.
            </p>

            <form
              onSubmit={handleSendOtp}
              className="flex flex-col gap-4"
            >
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) =>
                  setEmail(e.target.value)
                }
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

              <div className="relative">
                <input
                  type={
                    showNewPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="new password"
                  value={newPassword}
                  onChange={(
                    e: React.ChangeEvent<HTMLInputElement>
                  ) =>
                    setNewPassword(
                      e.target.value
                    )
                  }
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
                    setShowNewPassword(
                      (prev) => !prev
                    )
                  }
                  aria-label={
                    showNewPassword
                      ? "Hide new password"
                      : "Show new password"
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
                  {showNewPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="confirm new password"
                  value={confirmPassword}
                  onChange={(
                    e: React.ChangeEvent<HTMLInputElement>
                  ) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
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
                    setShowConfirmPassword(
                      (prev) => !prev
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
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
                  {showConfirmPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>

              {newPassword &&
                confirmPassword &&
                !passwordsMatch && (
                  <p className="text-sm text-red-600">
                    Passwords do not match.
                  </p>
                )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !passwordsMatch
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
                {isSubmitting
                  ? "Sending OTP..."
                  : "Send OTP"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p
              className="
                mb-6
                text-center
                text-sm
                text-gray-600
              "
            >
              Enter the OTP sent to{" "}
              <span className="font-semibold">
                {email}
              </span>{" "}
              to reset your password.
            </p>

            <form
              onSubmit={handleResetPassword}
              className="flex flex-col gap-4"
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="OTP"
                value={otp}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) =>
                  setOtp(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                required
                className="
                  rounded-md
                  border
                  border-[#ccc]
                  px-[0.8rem]
                  py-[0.6rem]
                  text-base
                  tracking-[0.2em]
                  transition-colors
                  duration-300
                  focus:border-[rgb(0,64,128)]
                  focus:outline-none
                "
              />

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  otp.length !== 6
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
                {isSubmitting
                  ? "Resetting password..."
                  : "Reset password"}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleResendOtp();
                }}
                disabled={
                  forgotPasswordCountdown > 0
                }
                className="
                  text-sm
                  font-semibold
                  text-[rgb(0,64,128)]
                  hover:underline
                  disabled:cursor-not-allowed
                  disabled:text-gray-400
                "
              >
                {forgotPasswordCountdown > 0
                  ? `Resend OTP in ${forgotPasswordCountdown}s`
                  : "Resend OTP"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="
              text-sm
              font-semibold
              text-[rgb(0,64,128)]
              no-underline
              hover:underline
            "
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;