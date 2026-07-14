import { createContext, useContext, useState, useEffect, useRef,  type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import config from '../config';
import { toast } from 'react-toastify';

//------------------------------Interfaces-------------------------------------------
interface JwtPayload {
  sub: string;
  exp: number;
}

interface User {
  id: string;
  email: string;
  role: "buyer" | "admin" | "super_admin";
  display_name: string;
  token: string;
  refreshToken: string;
}

interface AuthContextType {
  // Auth State
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Auth Actions
  login: (email: string, password: string) => Promise<void>;
  logout: (showToast?: boolean) => void;

  authFetch: (
    url: string,
    options?: RequestInit
  ) => Promise<Response>;

  // Registration OTP
  sendRegistrationOtp: (
    email: string,
    password: string
  ) => Promise<boolean>;

  verifyRegistrationOtp: (
    email: string,
    otp: string
  ) => Promise<boolean>;

  // Resend OTP
  resendOtp: (email: string | null) => Promise<boolean>;

  // Password Change
  sendChangePasswordOtp: (
    currentPassword: string,
    resend?: boolean
  ) => Promise<boolean>;

  completeChangePassword: (
    currentPassword: string,
    newPassword: string,
    otp: string
  ) => Promise<boolean | void>;

  // Account
  deleteAccount: (password: string) => Promise<void>;

  // Loading States
  changePasswordLoading: boolean;
  resendLoading: boolean;
  deleteAccountLoading: boolean;

  // OTP State
  otpSent: boolean;
  otpCountdown: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({children,}: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [changePasswordLoading, setChangePasswordLoading] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  // Refs
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

// ------------------ Load saved user ------------------
useEffect(() => {
  try {
    const stored = localStorage.getItem("titanUser");

    if (stored) {
      const parsed: User = JSON.parse(stored);

      if (
        ["admin", "buyer", "super_admin"].includes(parsed.role)
      ) {
        setUser(parsed);
      } else {
        localStorage.removeItem("titanUser");
      }
    }
  } catch (err) {
    console.error("[AuthProvider] localStorage error:", err);
    localStorage.removeItem("titanUser");
  } finally {
    setIsLoading(false);
  }
}, []);

// ------------------ Token expiry check ------------------
const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);

    return !decoded.exp || decoded.exp < Date.now() / 1000;
  } catch {
    return true;
  }
};


// ------------------ Protected fetch ------------------
const authFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  let tokenToUse: string | null | undefined = user?.token;

  if (user?.token && isTokenExpired(user.token) && user.refreshToken) {
    tokenToUse = await refreshAccessToken(user.refreshToken);

    if (!tokenToUse) {
      throw new Error("Token refresh failed");
    }
  }

 const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
};

  if (tokenToUse) {
    headers.Authorization = `Bearer ${tokenToUse}`;
  }
  
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401 && user?.refreshToken) {
    const newToken = await refreshAccessToken(user.refreshToken);

    if (!newToken) {
      throw new Error("Re-authentication required");
    }

    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      },
    });
  }

  return res;
 };

  // ------------------ Refresh access token ------------------
  // Interface
  interface RefreshResponse {
  access_token: string;
}

 const refreshAccessToken = async (
  refreshToken: string
 ): Promise<string | null> => {
  try {
    const res = await fetch(`${config.API_BASE_URL}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    const data: RefreshResponse = await res.json();

    if (!res.ok || !data.access_token) {
      throw new Error();
    }

    const updatedUser: User = {
      ...user!,
      token: data.access_token,
    };

    localStorage.setItem(
      "titanUser",
      JSON.stringify(updatedUser)
    );

    setUser(updatedUser);

    scheduleTokenRefresh(data.access_token, refreshToken);

    return data.access_token;
  } catch {
    logout(false);
    toast.error("Session expired. Please log in again.");
    return null;
  }
 };

// ------------------ Auto-schedule refresh ------------------
const scheduleTokenRefresh = (
  accessToken: string,
  refreshToken: string
): void => {
  if (refreshTimer.current) {
    clearTimeout(refreshTimer.current);
  }

  try {
    const decoded = jwtDecode<JwtPayload>(accessToken);

    const refreshTime =
      decoded.exp * 1000 -
      Date.now() -
      2 * 60 * 1000;

    if (refreshTime > 0) {
      refreshTimer.current = setTimeout(() => {
        refreshAccessToken(refreshToken);
      }, refreshTime);
    }
  } catch (err) {
    console.error("[AuthProvider] schedule error:", err);
  }
 };

  // ------------------ Login ------------------
  // Interface
  interface LoginResponse {
  access_token: string;
  refresh_token: string;
  role: User["role"];
  display_name: string;
 }
 
 const login = async (
  email: string,
  password: string
 ): Promise<void> => {
   setIsLoading(true);

  try {
    const res = await fetch(`${config.API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResponse = await res.json();

    if (!res.ok) {
      throw new Error("Login failed");
    }

    const decoded = jwtDecode<JwtPayload>(data.access_token);

    const userInfo: User = {
      id: decoded.sub,
      email,
      role: data.role,
      display_name: data.display_name,
      token: data.access_token,
      refreshToken: data.refresh_token,
    };

    localStorage.setItem("titanUser", JSON.stringify(userInfo));
    setUser(userInfo);

    scheduleTokenRefresh(data.access_token, data.refresh_token);

    toast.success("Logged in successfully");
  } catch (err) {
    if (err instanceof Error) {
      toast.error(err.message);
    } else {
      toast.error("Login failed");
    }
  } finally {
    setIsLoading(false);
  }
 };
// ------------------ OTP countdown ------------------
const startOtpCountdown = (seconds: number): void => {
  setOtpCountdown(seconds);
  setOtpSent(true);

  if (otpTimerRef.current) {
    clearInterval(otpTimerRef.current);
  }

  otpTimerRef.current = setInterval(() => {
    setOtpCountdown((prev) => {
      if (prev <= 1) {
        if (otpTimerRef.current) {
          clearInterval(otpTimerRef.current);
        }

        setOtpSent(false);
        return 0;
      }

      return prev - 1;
    });
  }, 1000);
};

// Generic OTP Response
interface OtpResponse {
  message: string;
  wait_seconds: number;
  error?: string;
}

// ------------------ Registration OTP ------------------
const sendRegistrationOtp = async (
  email: string,
  password: string
): Promise<boolean> => {
  try {
    const res = await fetch(`${config.API_BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data: OtpResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to send OTP");
    }

    startOtpCountdown(data.wait_seconds);

    toast.success(data.message);

    return true;
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Failed to send OTP"
    );

    return false;
  }
};

// Verifying OTP Then Marking Account as Verified
const verifyRegistrationOtp = async (
  email: string,
  otp: string
): Promise<boolean> => {
  try {
    const res = await fetch(`${config.API_BASE_URL}/verify-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, otp }),
    });

    const data: OtpResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "OTP verification failed");
    }

    toast.success(data.message);

    return true;
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "OTP verification failed"
    );

    return false;
  }
};

// ------------------ Resend OTP ------------------
const resendOtp = async (
  email: string | null = null
): Promise<boolean> => {
  if (otpCountdown > 0 || resendLoading) {
    toast.info(`Please wait ${otpCountdown}s before resending OTP`);
    return false;
  }

  setResendLoading(true);

  try {
    let res: Response;

    if (email) {
      res = await fetch(`${config.API_BASE_URL}/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
    } else {
      res = await authFetch(`${config.API_BASE_URL}/resend-otp`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }

    const data: OtpResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to resend OTP");
    }

    startOtpCountdown(data.wait_seconds || 60);

    toast.success(data.message);

    return true;
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Failed to resend OTP"
    );

    return false;
  } finally {
    setResendLoading(false);
  }
};

// ------------------ Password Change OTP ------------------
const sendChangePasswordOtp = async (
  currentPassword: string,
  resend: boolean = false
): Promise<boolean> => {
  if (!user?.email) {
    toast.error("User not found");
    return false;
  }

  try {
    const res = await authFetch(`${config.API_BASE_URL}/change-password`, {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        resend,
      }),
    });

    const data: OtpResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Failed to send OTP");
    }

    startOtpCountdown(data.wait_seconds || 300);

    toast.success(data.message);

    return true;
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Failed to send OTP"
    );

    return false;
  }
};

// ------------------ Complete Password Change ------------------
const completeChangePassword = async (
  currentPassword: string,
  newPassword: string,
  otp: string
): Promise<boolean> => {
  if (!user?.email) {
    toast.error("User not found");
    return false;
  }

  setChangePasswordLoading(true);

  try {
    const res = await authFetch(`${config.API_BASE_URL}/change-password`, {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        otp,
      }),
    });

    const data: OtpResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Password change failed");
    }

    toast.success(data.message);

    logout(false);

    return true;
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Password change failed"
    );

    return false;
  } finally {
    setChangePasswordLoading(false);
  }
};

// ------------------ Delete account ------------------
const deleteAccount = async (
  password: string
): Promise<void> => {
  setDeleteAccountLoading(true);

  try {
    const res = await authFetch(`${config.API_BASE_URL}/delete-account`, {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Account deletion failed");
    }

    toast.success("Account deleted");

    logout(false);
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Account deletion failed"
    );
  } finally {
    setDeleteAccountLoading(false);
  }
};
 
// ------------------ Logout ------------------
const logout = (showToast: boolean = true): void => {
  localStorage.removeItem("titanUser");

  setUser(null);

  if (refreshTimer.current) {
    clearTimeout(refreshTimer.current);
  }

  if (showToast) {
    toast.success("Logged out successfully");
  }
};

// ------------------ Start refresh on login ------------------
 useEffect(() => {
  if (user?.token && user.refreshToken) {
    scheduleTokenRefresh(user.token, user.refreshToken);
  }

  return () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }
  };
 }, [user]);

  return (
  <AuthContext.Provider
  value={{
    // auth state
    user,
    isLoading,
    isAuthenticated: !!user,

    // auth actions
    login,
    logout,
    authFetch,

    // registration OTP
    sendRegistrationOtp,
    verifyRegistrationOtp,

    //resend OTP
    resendOtp,

    // password change OTP
    sendChangePasswordOtp,
    completeChangePassword,

    // account management
    deleteAccount,

    // loading states
    changePasswordLoading,
    deleteAccountLoading,
    resendLoading, 

    // OTP UI state
    otpSent,
    otpCountdown,
  }}
>
  {children}
</AuthContext.Provider>

  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return ctx;
};


