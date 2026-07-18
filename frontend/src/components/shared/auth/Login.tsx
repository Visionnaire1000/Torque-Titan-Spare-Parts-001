import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

interface LocationState {
  from?: string;
}

const Login = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const { login, isLoading, user, isAuthenticated } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Path user attempted before login
  const from =
    (location.state as LocationState | null)?.from ?? "/";

  const handleSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    await login(email, password);
  };

  // Redirect after login based on role
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    else {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

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
        Sign in to your account
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <input
            type="email"
            placeholder="email"
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
            type={
              showPassword ? "text" : "password"
            }
            placeholder="password"
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
                ? "Hide password"
                : "Show password"
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

        <button
          type="submit"
          disabled={isLoading}
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
            ? "Logging in..."
            : "Login"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p
          className="
            mb-[10px]
            text-base
            font-semibold
            text-[rgb(0,64,128)]
          "
        >
          Don't have an account?{" "}
          <Link
            to="/register"
            className="
              text-[rgb(0,64,128)]
              no-underline
              hover:underline
            "
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  </div>
 );
};

export default Login;