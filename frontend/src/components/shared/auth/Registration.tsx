import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../contexts/AuthContext";

interface FormData {
  email: string;
  password: string;
  otp: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: {
          credential: string;
        }) => void;
      }) => void;
      prompt: () => void;
    };
  };
}

const Registration = () => {
  const { t } = useTranslation();

  const {
    sendRegistrationOtp,
    verifyRegistrationOtp,
    resendOtp,
    GoogleOauth,
    user,
    isAuthenticated,
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

  const [showPassword, setShowPassword] =
    useState<boolean>(false);

  const [emailError, setEmailError] =
    useState<boolean>(false);

  const [passwordError, setPasswordError] =
    useState<boolean>(false);

  const [isLoading, setIsLoading] =
    useState<boolean>(false);

  const [googleLoading, setGoogleLoading] =
    useState<boolean>(false);

  const googleInitializedRef = useRef<boolean>(false);

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const handleGoogleSuccess = useCallback(
    async (credential: string | undefined): Promise<void> => {
      try {
        if (!credential) {
          throw new Error("Google credential missing");
        }

        setGoogleLoading(true);

        await GoogleOauth(credential);
      } catch (error) {
        console.error(error);
      } finally {
        setGoogleLoading(false);
      }
    },
    [GoogleOauth]
  );

  const initializeGoogle = useCallback((): boolean => {
    const googleIdentity = (
      window as Window & {
        google?: GoogleIdentityApi;
      }
    ).google;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleIdentity?.accounts.id || !clientId) {
      console.error("Google Identity Services is not available.");
      return false;
    }

    if (!googleInitializedRef.current) {
      googleIdentity.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          void handleGoogleSuccess(response.credential);
        },
      });

      googleInitializedRef.current = true;
    }

    return true;
  }, [handleGoogleSuccess]);

  useEffect(() => {
    initializeGoogle();
  }, [initializeGoogle]);

  const handleGoogleClick = (): void => {
    const googleIdentity = (
      window as Window & {
        google?: GoogleIdentityApi;
      }
    ).google;

    if (!initializeGoogle() || !googleIdentity) {
      return;
    }

    googleIdentity.accounts.id.prompt();
  };

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    navigate("/", { replace: true });
  }, [isAuthenticated, user, navigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "email") {
      setEmailError(
        value.length > 0 && !emailPattern.test(value)
      );
    }

    if (name === "password") {
      setPasswordError(
        value.length > 0 && !passwordPattern.test(value)
      );
    }
  };

  const handleSendOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    const invalidEmail =
      !emailPattern.test(formData.email);

    const invalidPassword =
      !passwordPattern.test(formData.password);

    setEmailError(invalidEmail);
    setPasswordError(invalidPassword);

    if (invalidEmail || invalidPassword) {
      return;
    }

    setIsLoading(true);

    try {
      const success = await sendRegistrationOtp(
        formData.email,
        formData.password
      );

      if (success) {
        setStep(2);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!formData.otp.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      const success = await verifyRegistrationOtp(
        formData.email,
        formData.otp
      );

      if (success) {
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    if (
      !formData.email ||
      otpCountdown > 0 ||
      resendLoading
    ) {
      return;
    }

    await resendOtp(formData.email, "email");
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
          {t("auth.registration.title")}
        </h2>

        {step === 1 && (
          <>
            <form
              onSubmit={handleSendOtp}
              className="flex flex-col gap-[10px]"
            >
              <input
                type="email"
                name="email"
                placeholder={t("auth.registration.emailPlaceholder")}
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
                  {t("auth.errors.invalidEmail")}
                </p>
              )}

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder={t("auth.registration.passwordPlaceholder")}
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
                  aria-label={
                    showPassword
                      ? t("auth.login.hidePassword")
                      : t("auth.login.showPassword")
                  }
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    cursor-pointer
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
                  {t("auth.errors.invalidPassword")}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  isLoading ||
                  emailError ||
                  passwordError
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
                  cursor-pointer
                  disabled:cursor-not-allowed
                  disabled:bg-[#ccc]
                "
              >
                {isLoading
                  ? t("auth.registration.sendingOtp")
                  : t("auth.registration.register")}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-300" />

              <span className="text-sm text-gray-500">
                {t("auth.common.or")}
              </span>

              <div className="h-px flex-1 bg-gray-300" />
            </div>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={googleLoading}
              className="
                flex
                w-full
                items-center
                justify-center
                gap-3
                rounded-md
                border
                border-[#dadce0]
                bg-white
                px-4
                py-3
                text-base
                font-semibold
                text-[#3c4043]
                cursor-pointer
                transition-colors
                duration-200
                hover:bg-blue-50
                hover:border-blue-200
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5h6.5c3.8-3.5 6.1-8.6 6.1-14.7Z"
                />
                <path
                  fill="#34A853"
                  d="M24 44c5.4 0 10-1.8 13.4-4.8l-6.5-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.9v5.2C9.3 39.6 16.1 44 24 44Z"
                />
                <path
                  fill="#FBBC05"
                  d="M12.6 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18l6.7-5.2Z"
                />
                <path
                  fill="#EA4335"
                  d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.4 4 24 4 16.1 4 9.3 8.4 5.9 15l6.7 5.2c1.6-4.8 6.1-8.4 11.4-8.4Z"
                />
              </svg>

              <span>
                {googleLoading
                  ? t("auth.common.googleLoading")
                  : t("auth.common.continueWithGoogle")}
              </span>
            </button>
          </>
        )}

        {step === 2 && (
          <form
            onSubmit={handleVerifyOtp}
            className="flex flex-col gap-[10px]"
          >
            <p className="text-center">
              {t("auth.registration.otpSentTo")}{" "}
              <strong>{formData.email}</strong>
            </p>

            <input
              type="text"
              name="otp"
              placeholder={t("auth.registration.otpPlaceholder")}
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
                items-center
                justify-between
                gap-3
              "
            >
              {otpSent && otpCountdown > 0 ? (
                <span className="text-sm text-gray-600">
                  {t("auth.registration.resendCountdown", {
                    seconds: otpCountdown,
                  })}
                </span>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => {
                  void handleResendOtp();
                }}
                disabled={
                  otpCountdown > 0 ||
                  resendLoading
                }
                className="
                  rounded-md
                  bg-[rgb(0,64,128)]
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-white
                  transition-colors
                  duration-300
                  hover:bg-[rgba(13,54,95,0.831)]
                  cursor-pointer
                  disabled:cursor-not-allowed
                  disabled:bg-[#ccc]
                "
              >
                {resendLoading
                  ? t("auth.registration.resendingOtp")
                  : t("auth.registration.resendOtp")}
              </button>
            </div>

            <button
              type="submit"
              disabled={
                isLoading ||
                !formData.otp.trim()
              }
              className="
                rounded-md
                bg-[rgb(0,64,128)]
                py-3
                text-base
                font-bold
                text-white
                cursor-pointer
                transition-colors
                duration-300
                hover:bg-[rgba(13,54,95,0.831)]
                disabled:cursor-not-allowed
                disabled:bg-[#ccc]
              "
            >
              {isLoading
                ? t("auth.registration.verifying")
                : t("auth.registration.verifyOtp")}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p
            className="
              mb-[10px]
              text-base
              font-semibold
              text-[rgb(0,64,128)]
            "
          >
            {t("auth.registration.alreadyHaveAccount")}{" "}

            <Link
              to="/login"
              className="
                text-[rgb(0,64,128)]
                no-underline
                hover:underline
              "
            >
              {t("auth.registration.login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Registration;
