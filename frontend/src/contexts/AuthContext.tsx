import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import config from "../config";
import { toast } from "react-toastify";

// ------------------------------ Interfaces -------------------------------------------
interface JwtPayload {
  user_id: string;
  email: string;
  role: User["role"];
  display_name: string;
  auth_provider: User["auth_provider"];
  exp: number;
}

interface User {
  id: string;
  email: string;
  role: "buyer" | "admin" | "super_admin";
  display_name: string;
  auth_provider: "local" | "google";
  token: string;
}

interface LoginResponse {
  access_token: string;
}

interface LoginError {
  error: string;
}

interface RefreshResponse {
  access_token: string;
}

interface OtpResponse {
  message: string;
  wait_seconds: number;
  error?: string;
}

interface AuthContextType {
  // Auth State
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Auth Actions
  login: (
    email: string,
    password: string
  ) => Promise<void>;

  loginWithGoogle: (
    credential: string
  ) => Promise<void>;

  logout: (
    showToast?: boolean
  ) => void;

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

  resendOtp: (
    email: string | null
  ) => Promise<boolean>;

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

  // Account Deletion
  sendDeleteAccountOtp: () => Promise<boolean>;

  completeDeleteAccount: (
    otp: string
  ) => Promise<boolean>;

  // Loading States
  changePasswordLoading: boolean;
  resendLoading: boolean;
  deleteAccountLoading: boolean;

  // OTP State
  otpSent: boolean;
  otpCountdown: number;
}

const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);

// ------------------------------ Provider Props -------------------------------------------
interface AuthProviderProps {
  children: ReactNode;
}

// ------------------------------ Auth Provider -------------------------------------------
export const AuthProvider = ({
  children,
}: AuthProviderProps) => {

  // ------------------------------ Auth State -------------------------------------------
  const [user, setUser] =
    useState<User | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  // ------------------------------ Loading States -------------------------------------------
  const [
    changePasswordLoading,
    setChangePasswordLoading,
  ] = useState<boolean>(false);

  const [
    resendLoading,
    setResendLoading,
  ] = useState<boolean>(false);

  const [
    deleteAccountLoading,
    setDeleteAccountLoading,
  ] = useState<boolean>(false);

  // ------------------------------ OTP State -------------------------------------------
  const [otpSent, setOtpSent] =
    useState<boolean>(false);

  const [otpCountdown, setOtpCountdown] =
    useState<number>(0);

  // ------------------------------ Refs -------------------------------------------
  const refreshTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const otpTimerRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);

  const refreshPromiseRef = useRef<
    Promise<string | null> | null
  >(null);

  // ------------------------------ Token Expiry -------------------------------------------
  const isTokenExpired = (
    token: string
  ): boolean => {
    try {
      const decoded =
        jwtDecode<JwtPayload>(token);

      return (
        !decoded.exp ||
        decoded.exp <= Date.now() / 1000
      );
    } catch {
      return true;
    }
  };


  // ------------------------------ Build User From Token -------------------------------------------
 const buildUserFromToken = (
  accessToken: string
  ): User => {
  const decoded =
    jwtDecode<JwtPayload>(accessToken);

  // Only require claims essential for authentication.
  if (
    !decoded.user_id ||
    !decoded.role ||
    !decoded.exp
  ) {
    throw new Error(
      "Invalid authentication token"
    );
  }

  return {
    id: String(decoded.user_id),
    email: decoded.email ?? "",
    role: decoded.role,
    display_name:
      decoded.display_name ?? "",
    auth_provider:
      decoded.auth_provider ?? "local",
    token: accessToken,
  };
 };

  // ------------------------------ Schedule Refresh -------------------------------------------
  const scheduleTokenRefresh = (
    accessToken: string
  ): void => {
    if (refreshTimer.current) {
      clearTimeout(
        refreshTimer.current
      );

      refreshTimer.current = null;
    }

    try {
      const decoded =
        jwtDecode<JwtPayload>(
          accessToken
        );

      const refreshTime =
        decoded.exp * 1000 -
        Date.now() -
        2 * 60 * 1000;

      if (refreshTime > 0) {
        refreshTimer.current =
          setTimeout(() => {
            void refreshAccessToken();
          }, refreshTime);
      } else {
        void refreshAccessToken();
      }
    } catch (err) {
      console.error(
        "[AuthProvider] Schedule error:",
        err
      );
    }
  };

  // ------------------------------ Refresh Access Token -------------------------------------------
  const refreshAccessToken =
    async (): Promise<string | null> => {
      if (
        refreshPromiseRef.current
      ) {
        return refreshPromiseRef.current;
      }

      refreshPromiseRef.current =
        (async (): Promise<
          string | null
        > => {
          try {
            const res = await fetch(
              `${config.API_BASE_URL}/token/refresh/`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type":
                    "application/json",
                },
              }
            );

            if (!res.ok) {
              return null;
            }

            const data: RefreshResponse =
              await res.json();

            if (!data.access_token) {
              return null;
            }

            const refreshedUser =
              buildUserFromToken(
                data.access_token
              );

            setUser(refreshedUser);

            scheduleTokenRefresh(
              data.access_token
            );

            return data.access_token;
          } catch (err) {
            console.error(
              "[AuthProvider] Token refresh failed:",
              err
            );

            return null;
          } finally {
            refreshPromiseRef.current =
              null;
          }
        })();

      return refreshPromiseRef.current;
    };

  // ------------------------------ Login -------------------------------------------
  const login = async (
    email: string,
    password: string
  ): Promise<void> => {
    setIsLoading(true);

    try {
      const res = await fetch(
        `${config.API_BASE_URL}/login/`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const errorData =
          data as LoginError;

        throw new Error(
          errorData.error ??
            "Login failed"
        );
      }

      const loginData =
        data as LoginResponse;

      if (!loginData.access_token) {
        throw new Error(
          "Access token missing"
        );
      }

      const userInfo =
        buildUserFromToken(
          loginData.access_token
        );

      setUser(userInfo);

      scheduleTokenRefresh(
        loginData.access_token
      );

      toast.success(
        "Logged in successfully"
      );
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error(
          "Login failed"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------ Google Login -------------------------------------------
  const loginWithGoogle = async (
    credential: string
  ): Promise<void> => {
    if (!credential) {
      toast.error(
        "Google credential is missing"
      );

      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(
        `${config.API_BASE_URL}/auth/google/`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            credential,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Google login failed"
        );
      }

      const accessToken =
        data.access_token;

      if (!accessToken) {
        throw new Error(
          "Access token missing"
        );
      }

      const googleUser =
        buildUserFromToken(
          accessToken
        );

      setUser(googleUser);

      scheduleTokenRefresh(
        accessToken
      );

      toast.success(
        "Logged in with Google successfully"
      );
    } catch (err) {
      console.error(
        "[AuthProvider] Google login failed:",
        err
      );

      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error(
          "Google login failed"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------ Logout -------------------------------------------
  const logout = (
    showToast: boolean = true
  ): void => {
    fetch(
      `${config.API_BASE_URL}/logout/`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type":
            "application/json",
        },
      }
    ).catch((err) => {
      console.error(
        "[AuthProvider] Logout request failed:",
        err
      );
    });

    setUser(null);

    if (refreshTimer.current) {
      clearTimeout(
        refreshTimer.current
      );

      refreshTimer.current = null;
    }

    if (otpTimerRef.current) {
      clearInterval(
        otpTimerRef.current
      );

      otpTimerRef.current = null;
    }

    setOtpCountdown(0);
    setOtpSent(false);

    refreshPromiseRef.current =
      null;

    if (showToast) {
      toast.success(
        "Logged out successfully"
      );
    }
  };

  // ------------------------------ Restore Session -------------------------------------------
  useEffect(() => {
    const restoreSession =
      async (): Promise<void> => {
        try {
          const accessToken =
            await refreshAccessToken();

          if (!accessToken) {
            setUser(null);
          }
        } catch (err) {
          console.error(
            "[AuthProvider] Session restore error:",
            err
          );

          setUser(null);
        } finally {
          setIsLoading(false);
        }
      };

    void restoreSession();
  }, []);
  

  // ------------------------------ Protected Fetch -------------------------------------------
  const authFetch = async (
   url: string,
   options: RequestInit = {}
   ): Promise<Response> => {
  let tokenToUse: string | null = user?.token ?? null;

  if (!tokenToUse) {
    tokenToUse = await refreshAccessToken();

    if (!tokenToUse) {
      throw new Error("Re-authentication required");
    }
  } else if (isTokenExpired(tokenToUse)) {
    tokenToUse = await refreshAccessToken();

    if (!tokenToUse) {
      throw new Error("Re-authentication required");
    }
  }

  const isFormData = options.body instanceof FormData;

  const headers = new Headers(options.headers);

  // Only sets JSON Content-Type for non-FormData requests(caters for image uploads)
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Authorization", `Bearer ${tokenToUse}`);

  let res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();

    if (!newToken) {
      throw new Error("Re-authentication required");
    }

    const retryHeaders = new Headers(headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);

    res = await fetch(url, {
      ...options,
      headers: retryHeaders,
      credentials: "include",
    });
  }

  return res;
 };

  // ------------------------------ OTP Countdown -------------------------------------------
  const startOtpCountdown = (
    seconds: number
  ): void => {
    setOtpCountdown(seconds);
    setOtpSent(true);

    if (otpTimerRef.current) {
      clearInterval(
        otpTimerRef.current
      );
    }

    otpTimerRef.current =
      setInterval(() => {
        setOtpCountdown(
          (prev) => {
            if (prev <= 1) {
              if (
                otpTimerRef.current
              ) {
                clearInterval(
                  otpTimerRef.current
                );

                otpTimerRef.current =
                  null;
              }

              setOtpSent(false);

              return 0;
            }

            return prev - 1;
          }
        );
      }, 1000);
  };

  // ------------------------------ Registration OTP -------------------------------------------
  const sendRegistrationOtp =
    async (
      email: string,
      password: string
    ): Promise<boolean> => {
      try {
        const res =
          await fetch(
            `${config.API_BASE_URL}/register/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                email,
                password,
              }),
            }
          );

        const data: OtpResponse =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "Failed to send OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60
        );

        toast.success(
          data.message
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send OTP"
        );

        return false;
      }
    };

  // ------------------------------ Verify Registration OTP -------------------------------------------
  const verifyRegistrationOtp =
    async (
      email: string,
      otp: string
    ): Promise<boolean> => {
      try {
        const res =
          await fetch(
            `${config.API_BASE_URL}/verify-account/`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                email,
                otp,
              }),
            }
          );

        const data: OtpResponse =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "OTP verification failed"
          );
        }

        toast.success(
          data.message
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "OTP verification failed"
        );

        return false;
      }
    };

  // ------------------------------ Resend OTP -------------------------------------------
  const resendOtp = async (
    email: string | null = null
  ): Promise<boolean> => {
    if (
      otpCountdown > 0 ||
      resendLoading
    ) {
      toast.info(
        `Please wait ${otpCountdown}s before resending OTP`
      );

      return false;
    }

    setResendLoading(true);

    try {
      let res: Response;

      if (email) {
        res = await fetch(
          `${config.API_BASE_URL}/resend-otp/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
            }),
          }
        );
      } else {
        res = await authFetch(
          `${config.API_BASE_URL}/resend-otp/`,
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );
      }

      const data: OtpResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ??
            "Failed to resend OTP"
        );
      }

      startOtpCountdown(
        data.wait_seconds || 60
      );

      toast.success(
        data.message
      );

      return true;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to resend OTP"
      );

      return false;
    } finally {
      setResendLoading(false);
    }
  };

  // ------------------------------ Password Change OTP -------------------------------------------
  const sendChangePasswordOtp =
    async (
      currentPassword: string,
      _resend: boolean = false
    ): Promise<boolean> => {
      if (!user?.email) {
        toast.error(
          "User not found"
        );

        return false;
      }

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/change-password/`,
            {
              method: "POST",
              body: JSON.stringify({
                current_password:
                  currentPassword,
              }),
            }
          );

        const data: OtpResponse =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "Failed to send OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60
        );

        toast.success(
          data.message
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send OTP"
        );

        return false;
      }
    };

  // ------------------------------ Complete Password Change -------------------------------------------
  const completeChangePassword =
    async (
      currentPassword: string,
      newPassword: string,
      otp: string
    ): Promise<boolean> => {
      if (!user?.email) {
        toast.error(
          "User not found"
        );

        return false;
      }

      setChangePasswordLoading(
        true
      );

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/change-password/`,
            {
              method: "POST",
              body: JSON.stringify({
                current_password:
                  currentPassword,
                new_password:
                  newPassword,
                otp,
              }),
            }
          );

        const data: OtpResponse =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "Password change failed"
          );
        }

        toast.success(
          data.message
        );

        logout(false);

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Password change failed"
        );

        return false;
      } finally {
        setChangePasswordLoading(
          false
        );
      }
    };

  // ------------------------------ Delete Account OTP -------------------------------------------
  const sendDeleteAccountOtp =
    async (): Promise<boolean> => {
      if (!user?.email) {
        toast.error(
          "User not found"
        );

        return false;
      }

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/delete-account/`,
            {
              method: "POST",
              body: JSON.stringify({}),
            }
          );

        const data: OtpResponse =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "Failed to send OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60
        );

        toast.success(
          data.message
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send OTP"
        );

        return false;
      }
    };

  // ------------------------------ Complete Delete Account -------------------------------------------
  const completeDeleteAccount =
    async (
      otp: string
    ): Promise<boolean> => {
      if (!user?.email) {
        toast.error(
          "User not found"
        );

        return false;
      }

      if (!otp) {
        toast.error(
          "OTP is required"
        );

        return false;
      }

      setDeleteAccountLoading(
        true
      );

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/delete-account/`,
            {
              method: "DELETE",
              body: JSON.stringify({
                otp,
              }),
            }
          );

        const data =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "Account deletion failed"
          );
        }

        toast.success(
          data.message ??
            "Account deleted"
        );

        logout(false);

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Account deletion failed"
        );

        return false;
      } finally {
        setDeleteAccountLoading(
          false
        );
      }
    };

  // ------------------------------ Cleanup -------------------------------------------
  useEffect(() => {
    return () => {
      if (otpTimerRef.current) {
        clearInterval(
          otpTimerRef.current
        );

        otpTimerRef.current = null;
      }

      if (refreshTimer.current) {
        clearTimeout(
          refreshTimer.current
        );

        refreshTimer.current = null;
      }
    };
  }, []);

  // ------------------------------ Provider -------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        // Auth state
        user,
        isLoading,
        isAuthenticated: !!user,

        // Auth actions
        login,
        loginWithGoogle,
        logout,
        authFetch,

        // Registration
        sendRegistrationOtp,
        verifyRegistrationOtp,

        // Resend OTP
        resendOtp,

        // Password change
        sendChangePasswordOtp,
        completeChangePassword,

        // Account deletion
        sendDeleteAccountOtp,
        completeDeleteAccount,

        // Loading states
        changePasswordLoading,
        resendLoading,
        deleteAccountLoading,

        // OTP state
        otpSent,
        otpCountdown,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ------------------------------ Hook -------------------------------------------
export const useAuth =
  (): AuthContextType => {
    const ctx =
      useContext(AuthContext);

    if (!ctx) {
      throw new Error(
        "useAuth must be used inside AuthProvider"
      );
    }

    return ctx;
  };