import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import config from "../config";


// ------------------------------ OTP Purpose Types -------------------------------------------
type OtpPurpose =
  | "email"
  | "forgot_password"
  | "change_password"
  | "delete_account";

// ------------------------------ Authenticated User -------------------------------------------
type User = {
  id: string;
  email: string;
  role: string;
  display_name: string;
  auth_provider?: string;
};

// ------------------------------ JWT Token Payload -------------------------------------------
type JwtPayload = {
  user_id: string;
  email: string;
  role: string;
  display_name: string;
  auth_provider?: string;
  exp: number;
};

// ------------------------------ OTP API Response -------------------------------------------
type OtpResponse = {
  message: string;
  wait_seconds?: number;
  error?: string;
};

// ------------------------------ Auth Context API -------------------------------------------
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<boolean>;
  loginWithGoogle: (
    credential: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  authFetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  sendRegistrationOtp: (
    email: string,
    password: string
  ) => Promise<boolean>;
  verifyRegistrationOtp: (
    email: string,
    otp: string
  ) => Promise<boolean>;
  sendForgotPasswordOtp: (
    email: string,
    newPassword: string
  ) => Promise<boolean>;
  completeForgotPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<boolean>;
  resendOtp: (
    email: string | null,
    purpose: OtpPurpose
  ) => Promise<boolean>;
  sendChangePasswordOtp: (
    currentPassword: string,
    newPassword: string
  ) => Promise<boolean>;
  completeChangePassword: (
    otp: string,
    newPassword: string
  ) => Promise<boolean>;
  sendDeleteAccountOtp: () => Promise<boolean>;
  completeDeleteAccount: (
    otp: string
  ) => Promise<boolean>;
  changePasswordLoading: boolean;
  resendLoading: boolean;
  deleteAccountLoading: boolean;
  otpSent: boolean;
  otpCountdown: number;
  otpCountdowns: Record<OtpPurpose, number>;
};

// ------------------------------ Provider Props -------------------------------------------
type AuthProviderProps = {
  children: React.ReactNode;
};

// ------------------------------ Auth Context -------------------------------------------
const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

// ------------------------------ Auth Provider -------------------------------------------
export const AuthProvider = ({
  children,
}: AuthProviderProps) => {
  // ------------------------------ Authentication State -------------------------------------------
  const [user, setUser] =
    useState<User | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  // ------------------------------ Authentication Loading States -------------------------------------------
  const [changePasswordLoading, setChangePasswordLoading] =
    useState<boolean>(false);

  const [resendLoading, setResendLoading] =
    useState<boolean>(false);

  const [deleteAccountLoading, setDeleteAccountLoading] =
    useState<boolean>(false);

  // ------------------------------ OTP Verification State -------------------------------------------
  const [otpSent, setOtpSent] =
    useState<boolean>(false);

  const [otpCountdown, setOtpCountdown] =
    useState<number>(0);

  const [
    otpCountdowns,
    setOtpCountdowns,
  ] = useState<Record<OtpPurpose, number>>({
    email: 0,
    forgot_password: 0,
    change_password: 0,
    delete_account: 0,
  });

  const [
    activeOtpPurpose,
    setActiveOtpPurpose,
  ] = useState<OtpPurpose | null>(null);
  
  // ------------------------------ Refs -------------------------------------------
  const accessTokenRef =
    useRef<string | null>(null);

  const refreshPromiseRef =
    useRef<Promise<string | null> | null>(null);

  const refreshTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const otpTimersRef = useRef<
    Partial<
      Record<
        OtpPurpose,
        ReturnType<typeof setInterval>
      >
    >
  >({});

  // ------------------------------ Token Expiry -------------------------------------------
  const clearRefreshTimer = (): void => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  // ------------------------------ Build User From Token -------------------------------------------
  const buildUserFromToken = (
    token: string
  ): User | null => {
    try {
      const decoded =
        jwtDecode<JwtPayload>(token);

      if (
        !decoded.user_id ||
        !decoded.email ||
        !decoded.role
      ) {
        return null;
      }

      return {
        id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
        display_name:
          decoded.display_name ||
          decoded.email.split("@")[0],
        auth_provider:
          decoded.auth_provider,
      };
    } catch {
      return null;
    }
  };

  // ------------------------------ Schedule Refresh -------------------------------------------
  const scheduleRefresh = useCallback(
    (token: string): void => {
      clearRefreshTimer();

      try {
        const decoded =
          jwtDecode<JwtPayload>(token);

        const expiresAt =
          decoded.exp * 1000;

        const refreshDelay =
          Math.max(
            expiresAt - Date.now() - 60_000,
            5_000
          );

        refreshTimerRef.current =
          setTimeout(() => {
            void refreshAccessToken();
          }, refreshDelay);
      } catch {
        clearRefreshTimer();
      }
    },
    []
  );

  // ------------------------------ Refresh Access Token -------------------------------------------
  const refreshAccessToken =
    useCallback(async (): Promise<string | null> => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      refreshPromiseRef.current =
        (async () => {
          try {
            const response = await fetch(
              `${config.API_BASE_URL}/token/refresh/`,
              {
                method: "POST",
                credentials: "include",
              }
            );

            if (!response.ok) {
              accessTokenRef.current = null;
              setUser(null);
              clearRefreshTimer();
              return null;
            }

            const data =
              (await response.json()) as {
                access?: string;
              };

            if (!data.access) {
              accessTokenRef.current = null;
              setUser(null);
              clearRefreshTimer();
              return null;
            }

            accessTokenRef.current =
              data.access;

            const refreshedUser =
              buildUserFromToken(
                data.access
              );

            if (refreshedUser) {
              setUser(refreshedUser);
            }

            scheduleRefresh(data.access);

            return data.access;
          } catch {
            accessTokenRef.current = null;
            setUser(null);
            clearRefreshTimer();
            return null;
          }
        })();

      try {
        return await refreshPromiseRef.current;
      } finally {
        refreshPromiseRef.current = null;
      }
    }, [scheduleRefresh]);

    
  // ------------------------------ Login -------------------------------------------
  const login = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.API_BASE_URL}/login/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data =
        (await response.json()) as {
          access?: string;
          message?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            data.message ??
            "Login failed"
        );
      }

      if (!data.access) {
        throw new Error(
          "Login response did not contain an access token"
        );
      }

      accessTokenRef.current =
        data.access;

      const loggedInUser =
        buildUserFromToken(data.access);

      if (!loggedInUser) {
        throw new Error(
          "Invalid access token"
        );
      }

      setUser(loggedInUser);
      scheduleRefresh(data.access);

      toast.success(
        data.message ?? "Login successful"
      );

      return true;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Login failed"
      );

      return false;
    }
  };

  // ------------------------------ Google Login -------------------------------------------
  const loginWithGoogle = async (
    credential: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.API_BASE_URL}/auth/google/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            credential,
          }),
        }
      );

      const data =
        (await response.json()) as {
          access?: string;
          message?: string;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            data.message ??
            "Google login failed"
        );
      }

      if (!data.access) {
        throw new Error(
          "Google login response did not contain an access token"
        );
      }

      accessTokenRef.current =
        data.access;

      const loggedInUser =
        buildUserFromToken(data.access);

      if (!loggedInUser) {
        throw new Error(
          "Invalid access token"
        );
      }

      setUser(loggedInUser);
      scheduleRefresh(data.access);

      toast.success(
        data.message ??
          "Google login successful"
      );

      return true;
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Google login failed"
      );

      return false;
    }
  };

  // ------------------------------ Logout -------------------------------------------
  const logout = async (): Promise<void> => {
    try {
      await fetch(
        `${config.API_BASE_URL}/logout/`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch {
    } finally {
      accessTokenRef.current = null;
      setUser(null);
      clearRefreshTimer();
    }
  };

  // ------------------------------ Restore Session -------------------------------------------
  useEffect(() => {
    const restoreSession =
      async (): Promise<void> => {
        try {
          const token =
            await refreshAccessToken();

          if (token) {
            const restoredUser =
              buildUserFromToken(token);

            if (restoredUser) {
              setUser(restoredUser);
            }
          }
        } finally {
          setIsLoading(false);
        }
      };

    void restoreSession();
  }, [refreshAccessToken]);

  // ------------------------------ Protected Fetch -------------------------------------------
  const authFetch = useCallback(
    async (
      input: RequestInfo | URL,
      init: RequestInit = {}
    ): Promise<Response> => {
      let token =
        accessTokenRef.current;

      if (!token) {
        token = await refreshAccessToken();
      }

      const headers = new Headers(
        init.headers
      );

      if (token) {
        headers.set(
          "Authorization",
          `Bearer ${token}`
        );
      }

      if (
        init.body &&
        !(init.body instanceof FormData) &&
        !headers.has("Content-Type")
      ) {
        headers.set(
          "Content-Type",
          "application/json"
        );
      }

      let response = await fetch(input, {
        ...init,
        headers,
        credentials: "include",
      });

      if (response.status !== 401) {
        return response;
      }

      const refreshedToken =
        await refreshAccessToken();

      if (!refreshedToken) {
        return response;
      }

      const retryHeaders = new Headers(
        init.headers
      );

      retryHeaders.set(
        "Authorization",
        `Bearer ${refreshedToken}`
      );

      if (
        init.body &&
        !(init.body instanceof FormData) &&
        !retryHeaders.has("Content-Type")
      ) {
        retryHeaders.set(
          "Content-Type",
          "application/json"
        );
      }

      response = await fetch(input, {
        ...init,
        headers: retryHeaders,
        credentials: "include",
      });

      return response;
    },
    [refreshAccessToken]
  );

  // ------------------------------ OTP Countdown -------------------------------------------
  const startOtpCountdown = (
    seconds: number,
    purpose: OtpPurpose
  ): void => {
    const duration = Math.max(
      0,
      seconds
    );

    const existingTimer =
      otpTimersRef.current[purpose];

    if (existingTimer) {
      clearInterval(existingTimer);
    }

    setActiveOtpPurpose(purpose);
    setOtpSent(true);

    setOtpCountdowns((prev) => ({
      ...prev,
      [purpose]: duration,
    }));

    setOtpCountdown(duration);

    if (duration <= 0) {
      setOtpSent(false);
      return;
    }

    const timer = setInterval(() => {
      setOtpCountdowns((prev) => {
        const current =
          prev[purpose];

        if (current <= 1) {
          clearInterval(timer);

          delete otpTimersRef.current[
            purpose
          ];

          if (
            activeOtpPurpose === purpose
          ) {
            setOtpCountdown(0);
            setOtpSent(false);
          }

          return {
            ...prev,
            [purpose]: 0,
          };
        }

        if (
          activeOtpPurpose === purpose
        ) {
          setOtpCountdown(
            current - 1
          );
        }

        return {
          ...prev,
          [purpose]:
            current - 1,
        };
      });
    }, 1000);

    otpTimersRef.current[purpose] =
      timer;
  };

  // ------------------------------ Registration OTP -------------------------------------------
  const sendRegistrationOtp =
    async (
      email: string,
      password: string
    ): Promise<boolean> => {
      try {
        const response = await fetch(
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

        const data =
          (await response.json()) as OtpResponse;

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Failed to send registration OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60,
          "email"
        );

        toast.success(
          data.message ??
            "OTP sent successfully"
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send registration OTP"
        );

        return false;
      }
    };

  const verifyRegistrationOtp =
    async (
      email: string,
      otp: string
    ): Promise<boolean> => {
      try {
        const response = await fetch(
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

        const data =
          (await response.json()) as {
            access?: string;
            message?: string;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              data.message ??
              "OTP verification failed"
          );
        }

        if (data.access) {
          accessTokenRef.current =
            data.access;

          const verifiedUser =
            buildUserFromToken(
              data.access
            );

          if (verifiedUser) {
            setUser(verifiedUser);
          }

          scheduleRefresh(data.access);
        }

        setOtpCountdowns((prev) => ({
          ...prev,
          email: 0,
        }));

        if (
          otpTimersRef.current.email
        ) {
          clearInterval(
            otpTimersRef.current.email
          );

          delete otpTimersRef.current
            .email;
        }

        if (
          activeOtpPurpose === "email"
        ) {
          setOtpCountdown(0);
          setOtpSent(false);
        }

        toast.success(
          data.message ??
            "Account verified successfully"
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

  // ------------------------------ Forgot Password OTP -------------------------------------------
  const sendForgotPasswordOtp =
    async (
      email: string,
      newPassword: string
    ): Promise<boolean> => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/forgot-password/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
              new_password: newPassword,
            }),
          }
        );

        const data =
          (await response.json()) as OtpResponse;

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Failed to send OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60,
          "forgot_password"
        );

        toast.success(
          data.message ??
            "OTP sent successfully"
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

  // ------------------------------ Complete Forgot Password -------------------------------------------
  const completeForgotPassword =
    async (
      email: string,
      otp: string,
      newPassword: string
    ): Promise<boolean> => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/forgot-password/`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
              otp,
              new_password: newPassword,
            }),
          }
        );

        const data =
          (await response.json()) as {
            message?: string;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              data.message ??
              "Failed to reset password"
          );
        }

        setOtpCountdowns((prev) => ({
          ...prev,
          forgot_password: 0,
        }));

        if (
          otpTimersRef.current
            .forgot_password
        ) {
          clearInterval(
            otpTimersRef.current
              .forgot_password
          );

          delete otpTimersRef.current
            .forgot_password;
        }

        if (
          activeOtpPurpose ===
          "forgot_password"
        ) {
          setOtpCountdown(0);
          setOtpSent(false);
        }

        toast.success(
          data.message ??
            "Password reset successfully"
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to reset password"
        );

        return false;
      }
    };

  // ------------------------------ Resend OTP -------------------------------------------
  const resendOtp = async (
    email: string | null,
    purpose: OtpPurpose
  ): Promise<boolean> => {
    const currentCountdown =
      otpCountdowns[purpose];

    if (currentCountdown > 0) {
      return false;
    }

    if (resendLoading) {
      return false;
    }

    setResendLoading(true);

    try {
      const body: Record<
        string,
        string
      > = {
        purpose,
      };

      if (email) {
        body.email = email;
      }

      let response: Response;

      if (email) {
        response = await fetch(
          `${config.API_BASE_URL}/resend-otp/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(body),
          }
        );
      } else {
        response = await authFetch(
          `${config.API_BASE_URL}/resend-otp/`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        );
      }

      const data =
        (await response.json()) as OtpResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to resend OTP"
        );
      }

      startOtpCountdown(
        data.wait_seconds || 60,
        purpose
      );

      toast.success(
        data.message ??
          "OTP resent successfully"
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
      newPassword: string
    ): Promise<boolean> => {
      setChangePasswordLoading(true);

      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/change-password/`,
          {
            method: "POST",
            body: JSON.stringify({
              current_password:
                currentPassword,
              new_password:
                newPassword,
            }),
          }
        );

        const data =
          (await response.json()) as OtpResponse;

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Failed to send OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60,
          "change_password"
        );

        toast.success(
          data.message ??
            "OTP sent successfully"
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send OTP"
        );

        return false;
      } finally {
        setChangePasswordLoading(
          false
        );
      }
    };

  // ------------------------------ Complete Password Change -------------------------------------------
  const completeChangePassword =
    async (
      otp: string,
      newPassword: string
    ): Promise<boolean> => {
      setChangePasswordLoading(true);

      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/change-password/`,
          {
            method: "PUT",
            body: JSON.stringify({
              otp,
              new_password:
                newPassword,
            }),
          }
        );

        const data =
          (await response.json()) as {
            message?: string;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              data.message ??
              "Failed to change password"
          );
        }

        setOtpCountdowns((prev) => ({
          ...prev,
          change_password: 0,
        }));

        if (
          otpTimersRef.current
            .change_password
        ) {
          clearInterval(
            otpTimersRef.current
              .change_password
          );

          delete otpTimersRef.current
            .change_password;
        }

        if (
          activeOtpPurpose ===
          "change_password"
        ) {
          setOtpCountdown(0);
          setOtpSent(false);
        }

        toast.success(
          data.message ??
            "Password changed successfully"
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to change password"
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
      setDeleteAccountLoading(true);

      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/delete-account/`,
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );

        const data =
          (await response.json()) as OtpResponse;

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Failed to send OTP"
          );
        }

        startOtpCountdown(
          data.wait_seconds || 60,
          "delete_account"
        );

        toast.success(
          data.message ??
            "OTP sent successfully"
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send OTP"
        );

        return false;
      } finally {
        setDeleteAccountLoading(
          false
        );
      }
    };

  // ------------------------------ Complete Delete Account -------------------------------------------
  const completeDeleteAccount =
    async (
      otp: string
    ): Promise<boolean> => {
      setDeleteAccountLoading(true);

      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/delete-account/`,
          {
            method: "DELETE",
            body: JSON.stringify({
              otp,
            }),
          }
        );

        const data =
          (await response.json()) as {
            message?: string;
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              data.message ??
              "Failed to delete account"
          );
        }

        setOtpCountdowns((prev) => ({
          ...prev,
          delete_account: 0,
        }));

        if (
          otpTimersRef.current
            .delete_account
        ) {
          clearInterval(
            otpTimersRef.current
              .delete_account
          );

          delete otpTimersRef.current
            .delete_account;
        }

        if (
          activeOtpPurpose ===
          "delete_account"
        ) {
          setOtpCountdown(0);
          setOtpSent(false);
        }

        accessTokenRef.current = null;
        setUser(null);
        clearRefreshTimer();

        toast.success(
          data.message ??
            "Account deleted successfully"
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to delete account"
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
      clearRefreshTimer();

      Object.values(
        otpTimersRef.current
      ).forEach((timer) => {
        if (timer) {
          clearInterval(timer);
        }
      });

      otpTimersRef.current = {};
    };
  }, []);

  // ------------------------------ Provider -------------------------------------------
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        logout,
        authFetch,
        sendRegistrationOtp,
        verifyRegistrationOtp,
        sendForgotPasswordOtp,
        completeForgotPassword,
        resendOtp,
        sendChangePasswordOtp,
        completeChangePassword,
        sendDeleteAccountOtp,
        completeDeleteAccount,
        changePasswordLoading,
        resendLoading,
        deleteAccountLoading,
        otpSent,
        otpCountdown,
        otpCountdowns,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ------------------------------ Hook -------------------------------------------
export const useAuth = (): AuthContextType => {
  const context = useContext(
    AuthContext
  );

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
};