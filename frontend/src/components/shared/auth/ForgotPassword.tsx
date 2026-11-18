import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../contexts/AuthContext";

const ForgotPassword = (): React.JSX.Element => {
  const { t } = useTranslation();

  const [email, setEmail] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");

  const {
    sendForgotPasswordOtp,
    completeForgotPassword,
    otpCountdowns,
    resendOtp,
    resendLoading,
  } = useAuth();

  const navigate = useNavigate();

  const forgotPasswordCountdown = otpCountdowns.forgot_password;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const passwordsMatch =
    newPassword.trim() === confirmPassword.trim();

  const handleNewPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value;

    setNewPassword(value);

    if (!value) {
      setPasswordError("");
      return;
    }

    setPasswordError(
      !passwordPattern.test(value)
        ? t("auth.forgotPassword.passwordRequirements")
        : ""
    );
  };

  const handleEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value;

    setEmail(value);

    setEmailError(
      !emailPattern.test(value)
        ? t("auth.forgotPassword.invalidEmail")
        : ""
    );
  };

  const handleSendOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (
      passwordError ||
      emailError ||
      !passwordPattern.test(newPassword) ||
      !passwordsMatch
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await sendForgotPasswordOtp(
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

    if (
      otp.length !== 6 ||
      !passwordPattern.test(newPassword) ||
      !passwordsMatch
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await completeForgotPassword(
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
    if (
      forgotPasswordCountdown > 0 ||
      resendLoading
    ) {
      return;
    }

    await resendOtp(email, "forgot_password");
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
            ? t("auth.forgotPassword.resetTitle")
            : t("auth.forgotPassword.title")}
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
              {t("auth.forgotPassword.description")}
            </p>

            <form
              onSubmit={handleSendOtp}
              className="flex flex-col gap-4"
            >
              <input
                type="email"
                placeholder={t("auth.forgotPassword.emailPlaceholder")}
                value={email}
                onChange={handleEmailChange}
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
                    mt-[-5px]
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
                  type={showNewPassword ? "text" : "password"}
                  placeholder={t("auth.forgotPassword.newPasswordPlaceholder")}
                  value={newPassword}
                  onChange={handleNewPasswordChange}
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
                    setShowNewPassword((prev) => !prev)
                  }
                  aria-label={
                    showNewPassword
                      ? t("auth.forgotPassword.hideNewPassword")
                      : t("auth.forgotPassword.showNewPassword")
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

              {passwordError && (
                <p
                  className="
                    mt-[-5px]
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

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("auth.forgotPassword.confirmNewPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(
                    e: React.ChangeEvent<HTMLInputElement>
                  ) => setConfirmPassword(e.target.value)}
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
                    setShowConfirmPassword((prev) => !prev)
                  }
                  aria-label={
                    showConfirmPassword
                      ? t("auth.forgotPassword.hideConfirmPassword")
                      : t("auth.forgotPassword.showConfirmPassword")
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
                  <p
                    className="
                      mt-[-5px]
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
                    {t("auth.forgotPassword.passwordsDoNotMatch")}
                  </p>
                )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  Boolean(passwordError) ||
                  Boolean(emailError) ||
                  !newPassword ||
                  !confirmPassword ||
                  !passwordPattern.test(newPassword) ||
                  !passwordsMatch
                }
                className="
                  w-full
                  rounded-md
                  bg-[rgb(0,64,128)]
                  py-3
                  text-base
                  font-bold
                  text-white
                  transition-colors
                  duration-300
                  hover:bg-[rgba(13,54,95,0.831)]
                  cursor-pointer
                  disabled:cursor-not-allowed
                  disabled:bg-[#ccc]
                "
              >
                {isSubmitting
                  ? t("auth.forgotPassword.sendingOtp")
                  : t("auth.forgotPassword.sendOtp")}
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
              {t("auth.forgotPassword.otpDescription")}{" "}
              <span className="font-semibold">
                {email}
              </span>{" "}
              {t("auth.forgotPassword.otpDescriptionEnd")}
            </p>

            <form
              onSubmit={handleResetPassword}
              className="flex flex-col gap-4"
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("auth.forgotPassword.otpPlaceholder")}
                value={otp}
                onChange={(
                  e: React.ChangeEvent<HTMLInputElement>
                ) =>
                  setOtp(e.target.value.replace(/\D/g, ""))
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
                  otp.length !== 6 ||
                  !passwordPattern.test(newPassword) ||
                  !passwordsMatch
                }
                className="
                  w-full
                  rounded-md
                  bg-[rgb(0,64,128)]
                  py-3
                  text-base
                  font-bold
                  text-white
                  transition-colors
                  duration-300
                  hover:bg-[rgba(13,54,95,0.831)]
                  cursor-pointer
                  disabled:cursor-not-allowed
                  disabled:bg-[#ccc]
                "
              >
                {isSubmitting
                  ? t("auth.forgotPassword.resettingPassword")
                  : t("auth.forgotPassword.resetPassword")}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleResendOtp();
                }}
                disabled={
                  resendLoading ||
                  forgotPasswordCountdown > 0
                }
                className="
                  w-full
                  rounded-md
                  border
                  border-[rgb(0,64,128)]
                  bg-[rgb(0,64,128)]
                  py-3
                  text-base
                  font-bold
                  text-white
                  transition-colors
                  duration-300
                  hover:bg-[rgba(0,64,128,0.26)]
                  cursor-pointer
                  disabled:cursor-not-allowed
                  disabled:border-[#ccc]
                  disabled:bg-[#f5f5f5]
                  disabled:text-gray-400
                "
              >
                {forgotPasswordCountdown > 0
                  ? t("auth.forgotPassword.resendOtpIn", {
                      seconds: forgotPasswordCountdown,
                    })
                  : resendLoading
                    ? t("auth.forgotPassword.resendingOtp")
                    : t("auth.forgotPassword.resendOtp")}
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
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
