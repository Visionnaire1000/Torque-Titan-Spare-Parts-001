import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import config from "../config";

type OtpPurpose =
  | "email"
  | "forgot_password"
  | "change_password"
  | "delete_account";

type UserProfile = {
  first_name: string;
  last_name: string;
  phone_number: string;
  national_id: string;
};

type User = {
  id: string;
  email: string;
  role: string;
  display_name: string;
  auth_provider?: string;
  profile?: UserProfile | null;
};

type JwtPayload = {
  user_id: string;
  email: string;
  role: string;
  auth_provider?: string;
  exp: number;
};

type ApiResponse = {
  code?: string;
  params?: Record<string, string | number>;
  message?: string;
  error?: string | Record<string, unknown> | string[];
  detail?: string;
  wait_seconds?: number;
  attempts_remaining?: number;
};

type OtpResponse = ApiResponse;

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  GoogleOauth: (credential: string) => Promise<boolean>;
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

  updateProfile: (profileData: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    national_id?: string;
  }) => Promise<boolean>;

  changePasswordLoading: boolean;
  resendLoading: boolean;
  deleteAccountLoading: boolean;
  otpSent: boolean;
  otpCountdown: number;
  otpCountdowns: Record<OtpPurpose, number>;
};

type AuthProviderProps = {
  children: React.ReactNode;
};

const DEVICE_ID_KEY = "titan_device_id";

const getDeviceId = (): string => {
  const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId = crypto.randomUUID();

  localStorage.setItem(DEVICE_ID_KEY, deviceId);

  return deviceId;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider = ({
  children,
}: AuthProviderProps) => {
  const { t } = useTranslation();

  // ------------------------------ API Message Translation -------------------------------------------
  const getApiMessage = (
    data: ApiResponse,
    fallback: string
  ): string => {
    const defaultMessage =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : typeof data.detail === "string"
            ? data.detail
            : fallback;

    if (!data.code) {
      return defaultMessage;
    }

    const codeTranslations: Record<string, string> = {
      // Authentication success messages
      "auth.login_successful": "auth.success.login",
      "auth.google_login_successful": "auth.success.googleLogin",
      "auth.otp_sent": "auth.success.otpSent",
      "auth.otp_resent": "auth.success.otpResent",
      "auth.password_reset_successful": "auth.success.passwordReset",
      "auth.password_changed_successfully": "auth.success.passwordChanged",
      "auth.account_deleted_successfully": "auth.success.accountDeleted",
      "auth.logout_successful": "auth.success.logout",

      // Registration and verification
      "auth.registration_successful": "auth.registration_successful",
      "auth.account_verified": "auth.account_verified",

      // Authentication errors
      "auth.login_failed": "auth.errors.loginFailed",
      "auth.google_login_failed": "auth.errors.googleLoginFailed",
      "auth.otp_send_failed": "auth.errors.sendOtpFailed",
      "auth.otp_resend_failed": "auth.errors.resendOtpFailed",
      "auth.otp_verification_failed": "auth.errors.otpVerificationFailed",
      "auth.password_reset_failed": "auth.errors.passwordResetFailed",
      "auth.password_change_failed": "auth.errors.passwordChangeFailed",
      "auth.account_deletion_failed": "auth.errors.accountDeleteFailed",
      "auth.authentication_required": "auth.errors.authenticationRequired",
      "auth.email_required": "auth.errors.emailRequired",
      "auth.email_and_password_required": "auth.errors.emailAndPasswordRequired",
      "auth.password_fields_required": "auth.errors.passwordFieldsRequired",
      "auth.account_already_verified": "auth.errors.accountAlreadyVerified",

      // Credentials and account errors
      "auth.invalid_credentials": "auth.invalid_email_or_password",
      "auth.invalid_email_or_password": "auth.invalid_email_or_password",
      "auth.email_not_verified": "auth.email_not_verified",
      "auth.email_already_registered": "auth.errors.emailAlreadyRegistered",
      "auth.different_auth_method": "auth.errors.differentAuthMethod",
      "auth.account_inactive": "auth.errors.accountInactive",
      "auth.account_not_found": "auth.errors.accountNotFound",

      // OTP errors
      "auth.invalid_otp_type": "auth.errors.invalidOtpType",
      "auth.email_and_otp_required": "auth.errors.emailAndOtpRequired",
      "auth.otp_expired": "auth.errors.otpExpired",
      "auth.otp_required": "auth.errors.otpRequired",
      "auth.invalid_otp": "auth.invalid_otp",
      "auth.otp_locked": "auth.errors.otpLocked",
      "auth.otp_resend_wait": "auth.errors.otpResendWait",
      "auth.otp_resend_limit_reached": "auth.maximum_otp_resends",
      "auth.maximum_otp_resends": "auth.maximum_otp_resends",

      // Google authentication errors
      "auth.google_credential_required": "auth.errors.googleCredentialRequired",
      "auth.invalid_google_credential": "auth.errors.invalidGoogleCredential",
      "auth.google_account_incomplete": "auth.errors.googleAccountIncomplete",
      "auth.google_email_not_verified": "auth.errors.googleEmailNotVerified",
      "auth.google_account_linked_elsewhere": "auth.errors.googleAccountLinkedElsewhere",
      "auth.google_password_reset_unavailable": "auth.errors.googlePasswordResetUnavailable",

      // Admin initial password errors
      "auth.initial_password_expired": "auth.errors.initialPasswordExpired",
      "auth.initial_password_required": "auth.errors.initialPasswordRequired",

      // Token errors
      "auth.refresh_token_not_found": "auth.errors.refreshTokenNotFound",
      "auth.invalid_refresh_token": "auth.errors.invalidRefreshToken",

      // Profile errors
      "auth.buyer_profile_only": "auth.errors.buyerProfileOnly",
      "auth.invalid_profile_fields": "auth.errors.invalidProfileFields",
      "auth.profile_fields_required": "auth.errors.profileFieldsRequired",
      "auth.phone_number_already_used": "auth.errors.phoneNumberAlreadyUsed",
      "auth.national_id_already_used": "auth.errors.nationalIdAlreadyUsed",
      "auth.profile_validation_error": "auth.errors.profileValidationError",
      "auth.profile_readonly_fields": "auth.errors.profileReadonlyFields",
      "auth.phone_number_required": "auth.errors.phoneNumberRequired",

      // Password errors
      "auth.new_password_required": "auth.errors.newPasswordRequired",
      "auth.password_must_be_different": "auth.errors.passwordMustBeDifferent",
      "auth.password_policy_invalid": "auth.errors.passwordPolicyInvalid",
      "auth.email_otp_and_password_required": "auth.errors.emailOtpAndPasswordRequired",
      "auth.current_password_incorrect": "auth.errors.currentPasswordIncorrect",

      // Profile messages
      "profile.updated_successfully": "profile.updated_successfully",
      "profile.update_failed": "auth.errors.profileUpdateFailed",
    };

    const translationKey =
      codeTranslations[data.code] ?? data.code;

    return t(translationKey, {
      ...(data.params ?? {}),
      defaultValue: defaultMessage,
    });
  };

  // ------------------------------ Authentication State -------------------------------------------
  const [user, setUser] = useState<User | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ------------------------------ Authentication Loading States -------------------------------------------
  const [
    changePasswordLoading,
    setChangePasswordLoading,
  ] = useState<boolean>(false);

  const [resendLoading, setResendLoading] =
    useState<boolean>(false);

  const [
    deleteAccountLoading,
    setDeleteAccountLoading,
  ] = useState<boolean>(false);

  // ------------------------------ OTP Verification State -------------------------------------------
  const [otpSent, setOtpSent] = useState<boolean>(false);

  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  const [
    otpCountdowns,
    setOtpCountdowns,
  ] = useState<Record<OtpPurpose, number>>({
    email: 0,
    forgot_password: 0,
    change_password: 0,
    delete_account: 0,
  });

  const activeOtpPurposeRef = useRef<OtpPurpose | null>(null);

  // ------------------------------ Refs -------------------------------------------
  const accessTokenRef = useRef<string | null>(null);

  const refreshPromiseRef =
    useRef<Promise<string | null> | null>(null);

  const refreshTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const otpTimersRef = useRef<
    Partial<Record<OtpPurpose, ReturnType<typeof setInterval>>>
  >({});

  const refreshAccessTokenRef = useRef<
    () => Promise<string | null>
  >(async () => null);

  const scheduleRefreshRef = useRef<
    (token: string) => void
  >(() => {});

  // ------------------------------ Token Expiry -------------------------------------------
  const clearRefreshTimer = (): void => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  // ------------------------------ Build User From Token -------------------------------------------
  const buildUserFromToken = (token: string): User | null => {
    try {
      const decoded = jwtDecode<JwtPayload>(token);

      if (!decoded.user_id || !decoded.email || !decoded.role) {
        return null;
      }

      return {
        id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
        display_name: "",
        auth_provider: decoded.auth_provider,
        profile: null,
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
        const decoded = jwtDecode<JwtPayload>(token);

        const expiresAt = decoded.exp * 1000;

        const refreshDelay = Math.max(
          expiresAt - Date.now() - 60_000,
          5_000
        );

        refreshTimerRef.current = setTimeout(() => {
          void refreshAccessTokenRef.current();
        }, refreshDelay);
      } catch {
        clearRefreshTimer();
      }
    },
    []
  );

  scheduleRefreshRef.current = scheduleRefresh;

  // ------------------------------ Refresh Access Token -------------------------------------------
  const refreshAccessToken =
    useCallback(async (): Promise<string | null> => {
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      refreshPromiseRef.current = (async () => {
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

          const data = (await response.json()) as {
            access?: string;
          };

          if (!data.access) {
            accessTokenRef.current = null;
            setUser(null);
            clearRefreshTimer();

            return null;
          }

          accessTokenRef.current = data.access;

          scheduleRefreshRef.current(data.access);

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
    }, []);

  refreshAccessTokenRef.current = refreshAccessToken;

  // ------------------------------ Protected Fetch -------------------------------------------
  const authFetch = useCallback(
    async (
      input: RequestInfo | URL,
      init: RequestInit = {}
    ): Promise<Response> => {
      let token = accessTokenRef.current;

      if (!token) {
        token = await refreshAccessToken();
      }

      const headers = new Headers(init.headers);

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      if (
        init.body &&
        !(init.body instanceof FormData) &&
        !headers.has("Content-Type")
      ) {
        headers.set("Content-Type", "application/json");
      }

      let response = await fetch(input, {
        ...init,
        headers,
        credentials: "include",
      });

      if (response.status !== 401) {
        return response;
      }

      const refreshedToken = await refreshAccessToken();

      if (!refreshedToken) {
        return response;
      }

      const retryHeaders = new Headers(init.headers);

      retryHeaders.set(
        "Authorization",
        `Bearer ${refreshedToken}`
      );

      if (
        init.body &&
        !(init.body instanceof FormData) &&
        !retryHeaders.has("Content-Type")
      ) {
        retryHeaders.set("Content-Type", "application/json");
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

  // ------------------------------ Fetch Current User(Profile) -------------------------------------------
  const fetchCurrentUser =
    useCallback(async (): Promise<User | null> => {
      try {
        const response = await authFetch(
          `${config.API_BASE_URL}/profile/`,
          {
            method: "GET",
          }
        );

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as {
          id: string;
          email: string;
          role: string;
          display_name: string;
          auth_provider?: string;
          first_name: string | null;
          last_name: string | null;
          phone_number: string | null;
          national_id: string | null;
        };

        const hasProfile =
          data.first_name !== null ||
          data.last_name !== null ||
          data.phone_number !== null ||
          data.national_id !== null;

        return {
          id: data.id,
          email: data.email,
          role: data.role,
          display_name: data.display_name,
          auth_provider: data.auth_provider,
          profile: hasProfile
            ? {
                first_name: data.first_name ?? "",
                last_name: data.last_name ?? "",
                phone_number: data.phone_number ?? "",
                national_id: data.national_id ?? "",
              }
            : null,
        };
      } catch {
        return null;
      }
    }, [authFetch]);

  // ------------------------------ Update Profile ------------------------------------------
  const updateProfile = async (
    profileData: {
      first_name?: string;
      last_name?: string;
      phone_number?: string;
      national_id?: string;
    }
  ): Promise<boolean> => {
    try {
      const response = await authFetch(
        `${config.API_BASE_URL}/profile/`,
        {
          method: "PATCH",
          body: JSON.stringify(profileData),
        }
      );

      const data = (await response.json()) as ApiResponse & {
        id: string;
        email: string;
        role: string;
        display_name: string;
        auth_provider?: string;
        first_name: string | null;
        last_name: string | null;
        phone_number: string | null;
        national_id: string | null;
      };

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.profileUpdateFailed", {
              defaultValue: "Failed to update profile.",
            })
          )
        );
      }

      const hasProfile =
        data.first_name !== null ||
        data.last_name !== null ||
        data.phone_number !== null ||
        data.national_id !== null;

      const updatedUser: User = {
        id: data.id,
        email: data.email,
        role: data.role,
        display_name: data.display_name,
        auth_provider: data.auth_provider,
        profile: hasProfile
          ? {
              first_name: data.first_name ?? "",
              last_name: data.last_name ?? "",
              phone_number: data.phone_number ?? "",
              national_id: data.national_id ?? "",
            }
          : null,
      };

      setUser(updatedUser);

      toast.success(
        getApiMessage(
          data,
          t("profile.updated_successfully", {
            defaultValue: "Profile updated successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.profileUpdateFailed", {
              defaultValue: "Failed to update profile.",
            })
      );

      return false;
    }
  };

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
            device_id: getDeviceId(),
          }),
        }
      );

      const data = (await response.json()) as ApiResponse & {
        access?: string;
      };

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.loginFailed", {
              defaultValue: "Login failed.",
            })
          )
        );
      }

      if (!data.access) {
        throw new Error(
          t("auth.errors.loginTokenMissing", {
            defaultValue: "Login response did not contain an access token.",
          })
        );
      }

      accessTokenRef.current = data.access;

      const loggedInUser = buildUserFromToken(data.access);

      if (!loggedInUser) {
        accessTokenRef.current = null;
        clearRefreshTimer();

        throw new Error(
          t("auth.errors.invalidToken", {
            defaultValue: "Invalid access token.",
          })
        );
      }

      const currentUser = await fetchCurrentUser();

      if (!currentUser) {
        accessTokenRef.current = null;
        clearRefreshTimer();

        throw new Error(
          t("auth.errors.fetchUserFailed", {
            defaultValue: "Failed to fetch current user.",
          })
        );
      }

      setUser(currentUser);
      scheduleRefresh(data.access);

      toast.success(
        getApiMessage(
          data,
          t("auth.success.login", {
            defaultValue: "Login successful.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.loginFailed", {
              defaultValue: "Login failed.",
            })
      );

      return false;
    }
  };

  // ------------------------------ Google Login -------------------------------------------
  const GoogleOauth = async (
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
            device_id: getDeviceId(),
          }),
        }
      );

      const data = (await response.json()) as ApiResponse & {
        access?: string;
      };

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.googleLoginFailed", {
              defaultValue: "Google login failed.",
            })
          )
        );
      }

      if (!data.access) {
        throw new Error(
          t("auth.errors.googleLoginTokenMissing", {
            defaultValue: "Google login response did not contain an access token.",
          })
        );
      }

      accessTokenRef.current = data.access;

      const loggedInUser = buildUserFromToken(data.access);

      if (!loggedInUser) {
        accessTokenRef.current = null;
        clearRefreshTimer();

        throw new Error(
          t("auth.errors.invalidToken", {
            defaultValue: "Invalid access token.",
          })
        );
      }

      const currentUser = await fetchCurrentUser();

      if (!currentUser) {
        accessTokenRef.current = null;
        clearRefreshTimer();

        throw new Error(
          t("auth.errors.fetchUserFailed", {
            defaultValue: "Failed to fetch current user.",
          })
        );
      }

      setUser(currentUser);
      scheduleRefresh(data.access);

      toast.success(
        getApiMessage(
          data,
          t("auth.success.googleLogin", {
            defaultValue: "Google login successful.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.googleLoginFailed", {
              defaultValue: "Google login failed.",
            })
      );

      return false;
    }
  };

  // ------------------------------ OTP Countdown -------------------------------------------
  const startOtpCountdown = (
    seconds: number,
    purpose: OtpPurpose
  ): void => {
    const duration = Math.max(0, seconds);

    const existingTimer = otpTimersRef.current[purpose];

    if (existingTimer) {
      clearInterval(existingTimer);
      delete otpTimersRef.current[purpose];
    }

    activeOtpPurposeRef.current = purpose;

    setOtpSent(true);

    setOtpCountdowns((previous) => ({
      ...previous,
      [purpose]: duration,
    }));

    setOtpCountdown(duration);

    if (duration <= 0) {
      setOtpSent(false);
      activeOtpPurposeRef.current = null;
      return;
    }

    const timer = setInterval(() => {
      setOtpCountdowns((previous) => {
        const current = previous[purpose];

        if (current <= 1) {
          clearInterval(timer);

          delete otpTimersRef.current[purpose];

          if (activeOtpPurposeRef.current === purpose) {
            setOtpCountdown(0);
            setOtpSent(false);
            activeOtpPurposeRef.current = null;
          }

          return {
            ...previous,
            [purpose]: 0,
          };
        }

        if (activeOtpPurposeRef.current === purpose) {
          setOtpCountdown(current - 1);
        }

        return {
          ...previous,
          [purpose]: current - 1,
        };
      });
    }, 1000);

    otpTimersRef.current[purpose] = timer;
  };

  // ------------------------------ Clear OTP Timers -------------------------------------------
  const clearOtpTimers = (): void => {
    Object.values(otpTimersRef.current).forEach((timer) => {
      if (timer) {
        clearInterval(timer);
      }
    });

    otpTimersRef.current = {};

    activeOtpPurposeRef.current = null;

    setOtpSent(false);
    setOtpCountdown(0);

    setOtpCountdowns({
      email: 0,
      forgot_password: 0,
      change_password: 0,
      delete_account: 0,
    });
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
      clearOtpTimers();
    }
  };

  // ------------------------------ Restore Session -------------------------------------------
  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      try {
        const token = await refreshAccessToken();

        if (token) {
          const currentUser = await fetchCurrentUser();

          if (currentUser) {
            setUser(currentUser);
          } else {
            accessTokenRef.current = null;
            clearRefreshTimer();
            setUser(null);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, [refreshAccessToken, fetchCurrentUser]);

  // ------------------------------ Registration OTP -------------------------------------------

  const sendRegistrationOtp = async (
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.API_BASE_URL}/register/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = (await response.json()) as OtpResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.registrationOtpFailed", {
              defaultValue: "Failed to send registration OTP.",
            })
          )
        );
      }

      startOtpCountdown(data.wait_seconds ?? 60, "email");

      toast.success(
        getApiMessage(
          data,
          t("auth.success.otpSent", {
            defaultValue: "OTP sent successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.registrationOtpFailed", {
              defaultValue: "Failed to send registration OTP.",
            })
      );

      return false;
    }
  };

  // ------------------------------ Verify Registration OTP -------------------------------------------
  const verifyRegistrationOtp = async (
    email: string,
    otp: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.API_BASE_URL}/verify-account/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp,
          }),
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.otpVerificationFailed", {
              defaultValue: "OTP verification failed.",
            })
          )
        );
      }

      setOtpCountdowns((previous) => ({
        ...previous,
        email: 0,
      }));

      if (otpTimersRef.current.email) {
        clearInterval(otpTimersRef.current.email);
        delete otpTimersRef.current.email;
      }

      if (activeOtpPurposeRef.current === "email") {
        setOtpCountdown(0);
        setOtpSent(false);
        activeOtpPurposeRef.current = null;
      }

      toast.success(
        getApiMessage(
          data,
          t("auth.account_verified", {
            defaultValue: "Account verified successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.otpVerificationFailed", {
              defaultValue: "OTP verification failed.",
            })
      );

      return false;
    }
  };

  // ------------------------------ Forgot Password OTP -------------------------------------------
  const sendForgotPasswordOtp = async (
    email: string,
    newPassword: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.API_BASE_URL}/forgot-password/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            new_password: newPassword,
          }),
        }
      );

      const data = (await response.json()) as OtpResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.sendOtpFailed", {
              defaultValue: "Failed to send OTP.",
            })
          )
        );
      }

      startOtpCountdown(
        data.wait_seconds ?? 60,
        "forgot_password"
      );

      toast.success(
        getApiMessage(
          data,
          t("auth.success.otpSent", {
            defaultValue: "OTP sent successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.sendOtpFailed", {
              defaultValue: "Failed to send OTP.",
            })
      );

      return false;
    }
  };

  // ------------------------------ Complete Forgot Password -------------------------------------------
  const completeForgotPassword = async (
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
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp,
            new_password: newPassword,
          }),
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.passwordResetFailed", {
              defaultValue: "Failed to reset password.",
            })
          )
        );
      }

      setOtpCountdowns((previous) => ({
        ...previous,
        forgot_password: 0,
      }));

      if (otpTimersRef.current.forgot_password) {
        clearInterval(
          otpTimersRef.current.forgot_password
        );

        delete otpTimersRef.current.forgot_password;
      }

      if (
        activeOtpPurposeRef.current === "forgot_password"
      ) {
        setOtpCountdown(0);
        setOtpSent(false);
        activeOtpPurposeRef.current = null;
      }

      toast.success(
        getApiMessage(
          data,
          t("auth.success.passwordReset", {
            defaultValue: "Password reset successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.passwordResetFailed", {
              defaultValue: "Failed to reset password.",
            })
      );

      return false;
    }
  };

  // ------------------------------ Resend OTP -------------------------------------------
  const resendOtp = async (
    email: string | null,
    purpose: OtpPurpose
  ): Promise<boolean> => {
    const currentCountdown = otpCountdowns[purpose];

    if (currentCountdown > 0) {
      return false;
    }

    if (resendLoading) {
      return false;
    }

    const requiresEmail =
      purpose === "email" ||
      purpose === "forgot_password";

    const resendEmail = requiresEmail
      ? email?.trim() || null
      : null;

    if (requiresEmail && !resendEmail) {
      toast.error(
        t("auth.errors.emailRequired", {
          defaultValue: "Email is required to resend OTP.",
        })
      );

      return false;
    }

    if (!requiresEmail && !user) {
      toast.error(
        t("auth.errors.authenticationRequired", {
          defaultValue: "Please log in to continue.",
        })
      );

      return false;
    }

    setResendLoading(true);

    try {
      const requestBody = JSON.stringify({
        ...(resendEmail ? { email: resendEmail } : {}),
        otp_type: purpose,
      });

      const response = requiresEmail
        ? await fetch(
            `${config.API_BASE_URL}/resend-otp/`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: requestBody,
            }
          )
        : await authFetch(
            `${config.API_BASE_URL}/resend-otp/`,
            {
              method: "POST",
              body: requestBody,
            }
          );

      const data = (await response.json()) as OtpResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.resendOtpFailed", {
              defaultValue: "Failed to resend OTP.",
            })
          )
        );
      }

      startOtpCountdown(
        data.wait_seconds ?? 60,
        purpose
      );

      toast.success(
        getApiMessage(
          data,
          t("auth.success.otpResent", {
            defaultValue: "OTP resent successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.resendOtpFailed", {
              defaultValue: "Failed to resend OTP.",
            })
      );

      return false;
    } finally {
      setResendLoading(false);
    }
  };

  // ------------------------------ Password Change OTP -------------------------------------------
  const sendChangePasswordOtp = async (
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
            current_password: currentPassword,
            new_password: newPassword,
          }),
        }
      );

      const data = (await response.json()) as OtpResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.sendOtpFailed", {
              defaultValue: "Failed to send OTP.",
            })
          )
        );
      }

      startOtpCountdown(
        data.wait_seconds ?? 60,
        "change_password"
      );

      toast.success(
        getApiMessage(
          data,
          t("auth.success.otpSent", {
            defaultValue: "OTP sent successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.sendOtpFailed", {
              defaultValue: "Failed to send OTP.",
            })
      );

      return false;
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // ------------------------------ Complete Password Change -------------------------------------------
  const completeChangePassword = async (
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
            new_password: newPassword,
          }),
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.passwordChangeFailed", {
              defaultValue: "Failed to change password.",
            })
          )
        );
      }

      setOtpCountdowns((previous) => ({
        ...previous,
        change_password: 0,
      }));

      if (otpTimersRef.current.change_password) {
        clearInterval(
          otpTimersRef.current.change_password
        );

        delete otpTimersRef.current.change_password;
      }

      if (
        activeOtpPurposeRef.current === "change_password"
      ) {
        setOtpCountdown(0);
        setOtpSent(false);
        activeOtpPurposeRef.current = null;
      }

      await logout();

      toast.success(
        getApiMessage(
          data,
          t("auth.success.passwordChanged", {
            defaultValue: "Password changed successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.passwordChangeFailed", {
              defaultValue: "Failed to change password.",
            })
      );

      return false;
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // ------------------------------ Delete Account OTP -------------------------------------------
  const sendDeleteAccountOtp = async (): Promise<boolean> => {
    setDeleteAccountLoading(true);

    try {
      const response = await authFetch(
        `${config.API_BASE_URL}/delete-account/`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const data = (await response.json()) as OtpResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.sendOtpFailed", {
              defaultValue: "Failed to send OTP.",
            })
          )
        );
      }

      startOtpCountdown(
        data.wait_seconds ?? 60,
        "delete_account"
      );

      toast.success(
        getApiMessage(
          data,
          t("auth.success.otpSent", {
            defaultValue: "OTP sent successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.sendOtpFailed", {
              defaultValue: "Failed to send OTP.",
            })
      );

      return false;
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // ------------------------------ Complete Delete Account -------------------------------------------
  const completeDeleteAccount = async (
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

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          getApiMessage(
            data,
            t("auth.errors.accountDeleteFailed", {
              defaultValue: "Failed to delete account.",
            })
          )
        );
      }

      setOtpCountdowns((previous) => ({
        ...previous,
        delete_account: 0,
      }));

      if (otpTimersRef.current.delete_account) {
        clearInterval(
          otpTimersRef.current.delete_account
        );

        delete otpTimersRef.current.delete_account;
      }

      if (
        activeOtpPurposeRef.current === "delete_account"
      ) {
        setOtpCountdown(0);
        setOtpSent(false);
        activeOtpPurposeRef.current = null;
      }

      accessTokenRef.current = null;
      setUser(null);

      clearRefreshTimer();
      clearOtpTimers();

      toast.success(
        getApiMessage(
          data,
          t("auth.success.accountDeleted", {
            defaultValue: "Account deleted successfully.",
          })
        )
      );

      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth.errors.accountDeleteFailed", {
              defaultValue: "Failed to delete account.",
            })
      );

      return false;
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // ------------------------------ Cleanup -------------------------------------------
  useEffect(() => {
    return () => {
      clearRefreshTimer();

      Object.values(otpTimersRef.current).forEach((timer) => {
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
        GoogleOauth,
        logout,
        authFetch,
        updateProfile,
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
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
};
