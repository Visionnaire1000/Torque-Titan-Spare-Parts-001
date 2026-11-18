import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Eye, EyeOff, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";


/* ---------------- Types ---------------- */
type AdminRole = "admin" | "super_admin";

interface Admin {
  id: string;
  email: string;
  display_name?: string | null;
  role: AdminRole;
  is_active: boolean;
  initial_password_expired: boolean;
  is_locked: boolean;
}

interface AdminsResponse {
  admins: Admin[];
  error?: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
}

/* ---------------- Component ---------------- */
const AdminManagement = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { user, authFetch } = useAuth();

  const [admins, setAdmins] = useState<Admin[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole | "">("");

  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [selectedId, setSelectedId] = useState("");

  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [deleteDropdownOpen, setDeleteDropdownOpen] = useState(false);
  const [unlockDropdownOpen, setUnlockDropdownOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const deleteDropdownRef = useRef<HTMLDivElement>(null);
  const unlockDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [currentSection, setCurrentSection] =
    useState<"main" | "unlock">("main");

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------------- Fetch Admins ---------------- */
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/admins/`
      );

      const data: AdminsResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || t("adminManagement.fetchFailed")
        );
      }

      setAdmins(data.admins ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("adminManagement.somethingWentWrong")
      );
    }
  }, [authFetch, t]);

  /* ---------------- Initial Fetch ---------------- */
  useEffect(() => {
    if (user?.role === "super_admin") {
      void fetchAdmins();
    }
  }, [user, fetchAdmins]);

  /* ---------------- Scroll to Top ---------------- */
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, []);

  /* ---------------- Close Dropdowns ---------------- */
  useEffect(() => {
    const handleClickOutside = (
      event: globalThis.MouseEvent
    ): void => {
      const target = event.target as Node;

      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(target)
      ) {
        setRoleDropdownOpen(false);
      }

      if (
        deleteDropdownRef.current &&
        !deleteDropdownRef.current.contains(target)
      ) {
        setDeleteDropdownOpen(false);
      }

      if (
        unlockDropdownRef.current &&
        !unlockDropdownRef.current.contains(target)
      ) {
        setUnlockDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  /* ---------------- Email ---------------- */
  const handleEmailChange = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value;

    setEmail(value);

    setEmailError(
      value && !emailPattern.test(value)
        ? t("adminManagement.validEmail")
        : ""
    );
  };

  /* ---------------- Password ---------------- */
  const handlePasswordChange = (
    e: ChangeEvent<HTMLInputElement>
  ): void => {
    setPassword(e.target.value);
  };

  /* ---------------- Create Admin ---------------- */
  const createAdmin = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (emailError) {
      return;
    }

    if (!role) {
      toast.warn(t("adminManagement.selectRoleWarning"));
      return;
    }

    setLoading(true);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/create-admin/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            role,
          }),
        }
      );

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || t("adminManagement.createFailed")
        );
      }

      setEmail("");
      setPassword("");
      setRole("");
      setEmailError("");
      setShowPassword(false);

      toast.success(t("adminManagement.createSuccess"));

      await fetchAdmins();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("adminManagement.somethingWentWrong")
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Delete Admin ---------------- */
  const deleteAdmin = async (): Promise<void> => {
    if (!selectedId || deleteLoading) {
      return;
    }

    setDeleteLoading(true);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/delete-admin/${selectedId}/`,
        {
          method: "DELETE",
        }
      );

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || t("adminManagement.deleteFailed")
        );
      }

      setSelectedId("");
      setDeleteDropdownOpen(false);
      setDeleteDialogOpen(false);

      toast.success(t("adminManagement.deleteSuccess"));

      await fetchAdmins();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("adminManagement.somethingWentWrong")
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ---------------- Unlock Admin ---------------- */
  const unlockAdmin = async (): Promise<void> => {
    if (!selectedId) {
      toast.warn(t("adminManagement.selectLockedWarning"));
      return;
    }

    setUnlockLoading(true);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/unlock-admin/${selectedId}/`,
        {
          method: "POST",
        }
      );

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || t("adminManagement.unlockFailed")
        );
      }

      setSelectedId("");
      setUnlockDropdownOpen(false);

      toast.success(t("adminManagement.unlockSuccess"));

      await fetchAdmins();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("adminManagement.somethingWentWrong")
      );
    } finally {
      setUnlockLoading(false);
    }
  };

  /* ---------------- Selected Admin ---------------- */
  const selectedAdmin = admins.find(
    (admin) => admin.id === selectedId
  );

  /* ---------------- Locked Admins ---------------- */
  const lockedAdmins = admins.filter(
    (admin) => admin.is_locked
  );

  /* ---------------- Access Control ---------------- */
  if (user?.role !== "super_admin") {
    return (
      <p className="py-10 text-center text-lg font-medium">
        {t("adminManagement.accessDenied")}
      </p>
    );
  }

  /* ---------------- Unlock Section ---------------- */
  if (currentSection === "unlock") {
    return (
      <div
        className="
          mx-auto mt-[90px] mb-[80px] max-w-[520px]
          rounded-2xl bg-white p-6
          shadow-[0_10px_30px_rgba(0,0,0,0.08)]
        "
      >
        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="colored"
        />

        <div className="relative mb-5 flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              setCurrentSection("main");
              setSelectedId("");
              setUnlockDropdownOpen(false);
            }}
            className="
              absolute left-0 rounded-lg p-2
              text-gray-600 transition cursor-pointer
              hover:bg-gray-100 hover:text-gray-900
            "
            aria-label={t("adminManagement.back")}
          >
            <ArrowLeft size={20} />
          </button>

          <h2 className="text-[22px] font-bold">
            {t("adminManagement.unlockAccount")}
          </h2>
        </div>

        <section className="rounded-xl bg-gray-50 p-4">
          <h3 className="mb-3 text-base font-semibold text-gray-800">
            {t("adminManagement.lockedAccounts")}
          </h3>

          {lockedAdmins.length === 0 ? (
            <div
              className="
                rounded-lg border border-gray-200 bg-white
                px-3 py-4 text-center text-sm text-gray-500
              "
            >
              {t("adminManagement.noLockedAccounts")}
            </div>
          ) : (
            <>
              <div
                ref={unlockDropdownRef}
                className="relative mb-3 w-full"
              >
                <button
                  type="button"
                  onClick={() =>
                    setUnlockDropdownOpen((open) => !open)
                  }
                  className="
                    flex w-full items-center justify-between
                    rounded-lg border border-gray-300 bg-white
                    px-3 py-2.5 text-left text-sm
                    transition-colors hover:border-[#0077ff]
                    focus:border-[rgb(0,64,128)] cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-blue-100
                  "
                >
                  <span
                    className={
                      lockedAdmins.some(
                        (admin) => admin.id === selectedId
                      )
                        ? "truncate text-gray-800"
                        : "truncate text-gray-500"
                    }
                  >
                    {lockedAdmins.some(
                      (admin) => admin.id === selectedId
                    )
                      ? `${selectedAdmin?.email} (${
                          selectedAdmin?.role === "super_admin"
                            ? t("adminManagement.superAdmin")
                            : t("adminManagement.admin")
                        })`
                      : t("adminManagement.selectLockedAccount")}
                  </span>

                  {unlockDropdownOpen ? (
                    <ChevronUp
                      size={18}
                      className="ml-2 shrink-0 text-gray-600"
                    />
                  ) : (
                    <ChevronDown
                      size={18}
                      className="ml-2 shrink-0 text-gray-600"
                    />
                  )}
                </button>

                {unlockDropdownOpen && (
                  <div
                    className="
                      absolute left-0 top-full z-50 mt-1
                      max-h-60 w-full overflow-y-auto
                      rounded-lg border border-gray-300
                      bg-white shadow-lg
                    "
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId("");
                        setUnlockDropdownOpen(false);
                      }}
                      className="
                        block w-full px-3 py-2.5 text-left
                        text-sm text-gray-500 transition-colors
                        hover:bg-[#f0f6ff]
                      "
                    >
                      {t("adminManagement.selectLockedAccount")}
                    </button>

                    {lockedAdmins.map((admin) => {
                      const isSelected = selectedId === admin.id;

                      return (
                        <button
                          key={admin.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(admin.id);
                            setUnlockDropdownOpen(false);
                          }}
                          className={`
                            block w-full px-3 py-2.5 text-left cursor-pointer
                            text-sm transition-colors hover:bg-[#f0f6ff]
                            ${
                              isSelected
                                ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                                : "text-[#333]"
                            }
                          `}
                        >
                          <span className="block truncate">
                            {admin.email}
                          </span>

                          <span className="block text-xs text-gray-500">
                            {admin.role === "super_admin"
                              ? t("adminManagement.superAdmin")
                              : t("adminManagement.admin")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  void unlockAdmin();
                }}
                disabled={unlockLoading || !selectedId}
                className="
                  w-full rounded-lg bg-[rgb(0,64,128)]
                  px-4 py-2.5 text-sm font-medium text-white
                  transition hover:opacity-90 cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-60
                "
              >
                {unlockLoading
                  ? t("adminManagement.unlocking")
                  : t("adminManagement.unlock")}
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  /* ---------------- Main Section ---------------- */
  return (
    <div
      className="
        mx-auto mt-[90px] mb-[240px] max-w-[520px]
        rounded-2xl bg-white p-6
        shadow-[0_10px_30px_rgba(0,0,0,0.08)]
      "
    >
      <h2 className="mb-5 text-center text-[22px] font-bold">
        {t("adminManagement.title")}
      </h2>

      {/* CREATE ACCOUNT */}
      <section className="mb-6 rounded-xl bg-gray-50 p-4">
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          {t("adminManagement.createAccount")}
        </h3>

        <form
          onSubmit={(e) => {
            void createAdmin(e);
          }}
          className="relative"
        >
          <div
            ref={roleDropdownRef}
            className="relative mb-3 w-full"
          >
            <button
              type="button"
              onClick={() =>
                setRoleDropdownOpen((open) => !open)
              }
              className="
                flex w-full items-center justify-between
                rounded-lg border border-gray-300 bg-white
                px-3 py-2.5 text-left text-sm
                transition-colors hover:border-[#0077ff]
                focus:border-[rgb(0,64,128)] cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            >
              <span className={role ? "text-gray-800" : "text-gray-500"}>
                {role === "admin"
                  ? t("adminManagement.admin")
                  : role === "super_admin"
                    ? t("adminManagement.superAdmin")
                    : t("adminManagement.selectAccountRole")}
              </span>

              {roleDropdownOpen ? (
                <ChevronUp
                  size={18}
                  className="ml-2 shrink-0 text-gray-600"
                />
              ) : (
                <ChevronDown
                  size={18}
                  className="ml-2 shrink-0 text-gray-600"
                />
              )}
            </button>

            {roleDropdownOpen && (
              <div
                className="
                  absolute left-0 top-full z-50 mt-1 w-full
                  overflow-hidden rounded-lg border border-gray-300
                  bg-white shadow-lg
                "
              >
                <button
                  type="button"
                  onClick={() => {
                    setRole("");
                    setRoleDropdownOpen(false);
                  }}
                  className={`
                    block w-full px-3 py-2.5 text-left text-sm
                    transition-colors hover:bg-[#f0f6ff]
                    ${
                      role === ""
                        ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                        : "text-gray-500"
                    }
                  `}
                >
                  {t("adminManagement.selectAccountRole")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("admin");
                    setRoleDropdownOpen(false);
                  }}
                  className={`
                    block w-full px-3 py-2.5 text-left text-sm
                    transition-colors hover:bg-[#f0f6ff] cursor-pointer
                    ${
                      role === "admin"
                        ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                        : "text-[#333]"
                    }
                  `}
                >
                  {t("adminManagement.admin")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("super_admin");
                    setRoleDropdownOpen(false);
                  }}
                  className={`
                    block w-full px-3 py-2.5 text-left text-sm
                    transition-colors hover:bg-[#f0f6ff] cursor-pointer
                    ${
                      role === "super_admin"
                        ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                        : "text-[#333]"
                    }
                  `}
                >
                  {t("adminManagement.superAdmin")}
                </button>
              </div>
            )}
          </div>

          <input
            type="email"
            placeholder={t("adminManagement.email")}
            value={email}
            onChange={handleEmailChange}
            required
            className="
              mb-2 w-full rounded-lg border border-gray-300
              px-3 py-2.5 text-sm transition
              focus:border-[rgb(0,64,128)]
              focus:outline-none focus:ring-2 focus:ring-blue-100
            "
          />

          {emailError && (
            <p className="mb-2 text-sm font-medium text-red-600">
              {emailError}
            </p>
          )}

          <div className="relative mb-3">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t("adminManagement.password")}
              value={password}
              onChange={handlePasswordChange}
              required
              className="
                w-full rounded-lg border border-gray-300
                px-3 py-2.5 pr-12 text-sm transition
                focus:border-[rgb(0,64,128)]
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              className="
                absolute right-3 top-1/2 -translate-y-1/2
                rounded p-1 text-gray-500
                hover:bg-gray-100 hover:text-gray-700
              "
              aria-label={
                showPassword
                  ? t("adminManagement.hidePassword")
                  : t("adminManagement.showPassword")
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || Boolean(emailError)}
            className="
              w-full rounded-lg bg-[rgb(0,64,128)]
              px-4 py-2.5 text-sm font-medium text-white
              transition hover:opacity-90 cursor-pointer
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {loading
              ? t("adminManagement.creating")
              : t("adminManagement.create")}
          </button>
        </form>
      </section>

      {/* UNLOCK ACCOUNT */}
      <section className="mb-6 rounded-xl bg-gray-50 p-4">
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          {t("adminManagement.unlockAccount")}
        </h3>

        <button
          type="button"
          onClick={() => {
            setCurrentSection("unlock");
            setSelectedId("");
            setUnlockDropdownOpen(false);
            void fetchAdmins();
          }}
          className="
            w-full rounded-lg bg-[rgb(0,64,128)]
            px-4 py-2.5 text-sm font-medium text-white
            transition hover:opacity-90 cursor-pointer
          "
        >
          {t("adminManagement.manageLockedAccounts")}
        </button>
      </section>

      {/* DELETE ACCOUNT */}
      <section className="rounded-xl bg-gray-50 p-4">
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          {t("adminManagement.deleteAccount")}
        </h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();

            if (!selectedId) {
              toast.warn(t("adminManagement.selectAdminWarning"));
              return;
            }

            setDeleteDialogOpen(true);
          }}
          className="relative"
        >
          <div
            ref={deleteDropdownRef}
            className="relative mb-3 w-full"
          >
            <button
              type="button"
              onClick={() =>
                setDeleteDropdownOpen((open) => !open)
              }
              className="
                flex w-full items-center justify-between
                rounded-lg border border-gray-300 bg-white
                px-3 py-2.5 text-left text-sm
                transition-colors hover:border-[#0077ff]
                focus:border-[rgb(0,64,128)] cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-blue-100
              "
            >
              <span
                className={
                  selectedAdmin
                    ? "truncate text-gray-800"
                    : "truncate text-gray-500"
                }
              >
                {selectedAdmin
                  ? `${selectedAdmin.email} (${
                      selectedAdmin.role === "super_admin"
                        ? t("adminManagement.superAdmin")
                        : t("adminManagement.admin")
                    })`
                  : t("adminManagement.selectAccount")}
              </span>

              {deleteDropdownOpen ? (
                <ChevronUp
                  size={18}
                  className="ml-2 shrink-0 text-gray-600"
                />
              ) : (
                <ChevronDown
                  size={18}
                  className="ml-2 shrink-0 text-gray-600"
                />
              )}
            </button>

            {deleteDropdownOpen && (
              <div
                className="
                  absolute left-0 top-full z-50 mt-1
                  max-h-60 w-full overflow-y-auto
                  rounded-lg border border-gray-300
                  bg-white shadow-lg
                "
              >
                {admins.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-gray-500">
                    {t("adminManagement.noAccounts")}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId("");
                        setDeleteDropdownOpen(false);
                      }}
                      className={`
                        block w-full px-3 py-2.5 text-left
                        text-sm transition-colors hover:bg-[#f0f6ff]
                        ${
                          selectedId === ""
                            ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                            : "text-gray-500"
                        }
                      `}
                    >
                      {t("adminManagement.selectAccount")}
                    </button>

                    {admins.map((admin) => {
                      const isSelected = selectedId === admin.id;

                      return (
                        <button
                          key={admin.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(admin.id);
                            setDeleteDropdownOpen(false);
                          }}
                          className={`
                            block w-full px-3 py-2.5 text-left cursor-pointer
                            text-sm transition-colors hover:bg-[#f0f6ff]
                            ${
                              isSelected
                                ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                                : "text-[#333]"
                            }
                          `}
                        >
                          <span className="block truncate">
                            {admin.email}
                          </span>

                          <span className="block text-xs text-gray-500">
                            {admin.role === "super_admin"
                              ? t("adminManagement.superAdmin")
                              : t("adminManagement.admin")}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={deleteLoading || !selectedId}
            className="
              w-full rounded-lg bg-red-600
              px-4 py-2.5 text-sm font-medium text-white
              transition hover:bg-red-700 cursor-pointer
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {t("adminManagement.delete")}
          </button>
        </form>
      </section>

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteDialogOpen && (
        <div
          className="
            fixed inset-0 z-[100]
            flex items-center justify-center
            bg-black/50 p-4
          "
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !deleteLoading
            ) {
              setDeleteDialogOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="
              w-full max-w-[320px] rounded-2xl
              bg-white p-6 shadow-2xl
            "
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="
                  flex h-11 w-11 shrink-0 items-center
                  justify-center rounded-full
                  bg-red-100 text-red-600
                "
              >
                <Trash2 size={22} />
              </div>

              <h3
                id="delete-dialog-title"
                className="text-lg font-bold text-gray-900"
              >
                {t("adminManagement.deleteTitle")}
              </h3>
            </div>

            <p className="mb-3 text-sm leading-6 text-gray-600">
              {t("adminManagement.deleteConfirmation")}
            </p>

            {selectedAdmin && (
              <div className="mb-4 rounded-lg bg-gray-50 p-3">
                <p className="break-all text-sm font-semibold text-gray-800">
                  {selectedAdmin.email}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {selectedAdmin.role === "super_admin"
                    ? t("adminManagement.superAdmin")
                    : t("adminManagement.admin")}
                </p>
              </div>
            )}

            <p className="mb-5 text-sm font-medium text-red-600">
              {t("adminManagement.deleteWarning")}
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteDialogOpen(false)}
                className="
                  rounded-lg border border-gray-300
                  px-4 py-2.5 text-sm font-medium text-gray-700
                  transition hover:bg-gray-100 cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-60
                "
              >
                {t("adminManagement.cancel")}
              </button>

              <button
                type="button"
                disabled={deleteLoading || !selectedId}
                onClick={() => {
                  void deleteAdmin();
                }}
                className="
                  flex items-center justify-center gap-2
                  rounded-lg bg-red-600 px-4 py-2.5
                  text-sm font-medium text-white
                  transition hover:bg-red-700 cursor-pointer
                  disabled:cursor-not-allowed disabled:opacity-60
                "
              >
                {deleteLoading && (
                  <span
                    className="
                      h-4 w-4 animate-spin rounded-full
                      border-2 border-white/40 border-t-white
                    "
                  />
                )}

                {deleteLoading
                  ? t("adminManagement.deleting")
                  : t("adminManagement.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="colored"
      />
    </div>
  );
};

export default AdminManagement;
