import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../contexts/AuthContext";

interface LocationState {
  from?: string;
}

const Login = () => {
  const { t } = useTranslation();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const {
    login,
    user,
    isAuthenticated,
    GoogleOauth,
    isLoading,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] =
    useState<boolean>(false);

  const from =
    (location.state as LocationState | null)?.from ?? "/";

  const handleSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    await login(email, password);
  };

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    navigate(from, { replace: true });
  }, [isAuthenticated, user, navigate, from]);

  const handleGoogleSuccess = async (
    credential: string | undefined
  ): Promise<void> => {
    try {
      if (!credential) {
        throw new Error("Google credential missing");
      }

      await GoogleOauth(credential);
    } catch (error) {
      console.error(error);
    }
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
            mb-[10px]
            text-center
            text-base
            font-bold
            text-[rgb(0,64,128)]
          "
        >
          {t("auth.login.title")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <input
              type="email"
              placeholder={t("auth.login.emailPlaceholder")}
              value={email}
              onChange={(
                e: React.ChangeEvent<HTMLInputElement>
              ) => setEmail(e.target.value)}
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
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.login.passwordPlaceholder")}
              value={password}
              onChange={(
                e: React.ChangeEvent<HTMLInputElement>
              ) => setPassword(e.target.value)}
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

          <div className="-mt-2 text-right">
            <Link
              to="/forgot-password"
              className="
                text-sm
                font-semibold
                text-[rgb(0,64,128)]
                no-underline
                hover:underline
              "
            >
              {t("auth.login.forgotPassword")}
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="
              rounded-md
              bg-[rgb(0,64,128)]
              py-3
              mb-[20px]
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
              ? t("auth.login.loggingIn")
              : t("auth.login.submit")}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-300" />
          <span className="text-sm text-gray-500">
            {t("auth.common.or")}
          </span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        <div className="group relative w-full">
          <button
            type="button"
            className="
              flex
              w-full
              items-center
              justify-center
              gap-3
              rounded-md
              border
              border-[#ccc]
              bg-white
              py-3
              text-base
              font-semibold
              text-gray-700
              transition-colors
              duration-300
              group-hover:bg-blue-50
              group-hover:border-blue-200
              cursor-pointer
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 37.98 46.98 31.88 46.98 24.55z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.12.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>

            {t("auth.common.continueWithGoogle")}
          </button>

          <div className="absolute inset-0 z-10 opacity-0">
            <GoogleLogin
              text="continue_with"
              type="standard"
              theme="outline"
              size="large"
              shape="rectangular"
              width="100%"
              onSuccess={async (credentialResponse) => {
                await handleGoogleSuccess(
                  credentialResponse.credential
                );
              }}
              onError={() => {
                console.error("Google login failed");
              }}
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p
            className="
              mb-[10px]
              text-base
              font-semibold
              text-[rgb(0,64,128)]
            "
          >
            {t("auth.login.noAccount")}{" "}
            <Link
              to="/register"
              className="
                text-[rgb(0,64,128)]
                no-underline
                hover:underline
              "
            >
              {t("auth.login.registerHere")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
