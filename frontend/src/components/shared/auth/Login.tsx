import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import "../../../styles/shared/auth/login.css";

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
    <div className="login-container">
      <div className="login-card">
        <p className="sign">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-container">
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              required
            />
          </div>

          <div className="input-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              required
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={
              showPassword ? "Hide password" : "Show password"
            }
          >
            {showPassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="register-link">
          <p className="registers">
            Don't have an account?{" "}
            <Link to="/register" className="link">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;