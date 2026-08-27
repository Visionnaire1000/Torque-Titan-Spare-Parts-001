import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";

/* ---------------- Types ---------------- */
interface Admin {
  id: number;
  email: string;
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
const AdminManagement = () => {
  const { user, authFetch } = useAuth();

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [selectedId, setSelectedId] = useState("");

  const [deleteDropdownOpen, setDeleteDropdownOpen] =
    useState(false);

  const deleteDropdownRef =
    useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------------- Fetch Admins ---------------- */
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/admins/`
      );

      const data: AdminsResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to fetch admins"
        );
      }

      setAdmins(data.admins ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    }
  }, [authFetch]);

  /* ---------------- Initial Fetch ---------------- */
  useEffect(() => {
    if (user?.role === "super_admin") {
      void fetchAdmins();
    }
  }, [user, fetchAdmins]);

  /* ---------------- Close Dropdown ---------------- */
  useEffect(() => {
    const handleClickOutside = (
      event: globalThis.MouseEvent
    ): void => {
      if (
        deleteDropdownRef.current &&
        !deleteDropdownRef.current.contains(
          event.target as Node
        )
      ) {
        setDeleteDropdownOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

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
        ? "Enter a valid email address"
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
    e: SubmitEvent
  ): Promise<void> => {
    e.preventDefault();

    if (emailError) {
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
          }),
        }
      );

      const data: ApiResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to create admin"
        );
      }

      setEmail("");
      setPassword("");
      setEmailError("");

      toast.success(
        "Admin created successfully!"
      );

      await fetchAdmins();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Delete Admin ---------------- */
  const deleteAdmin = async (
    e: SubmitEvent
  ): Promise<void> => {
    e.preventDefault();

    if (!selectedId) {
      toast.warn("Please select an admin");
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

      const data: ApiResponse =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Failed to delete admin"
        );
      }

      setSelectedId("");
      setDeleteDropdownOpen(false);

      toast.success(
        "Admin deleted successfully!"
      );

      await fetchAdmins();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ---------------- Selected Admin ---------------- */
  const selectedAdmin = admins.find(
    (admin) =>
      String(admin.id) === selectedId
  );

  /* ---------------- Access Control ---------------- */
  if (user?.role !== "super_admin") {
    return (
      <p className="py-10 text-center text-lg font-medium">
        Access denied
      </p>
    );
  }

  /* ---------------- Render ---------------- */
  return (
    <div
      className="
        mx-auto
        mt-[90px]
        mb-[80px]
        max-w-[520px]
        rounded-2xl
        bg-white
        p-6
        shadow-[0_10px_30px_rgba(0,0,0,0.08)]
      "
    >
      <ToastContainer
        position="top-right"
        autoClose={3000}
      />

      <h2
        className="
          mb-5
          text-center
          text-[22px]
          font-bold
        "
      >
        Admin Management
      </h2>

      {/*CREATE ADMIN*/}
      <section
        className="
          mb-6
          rounded-xl
          bg-gray-50
          p-4
        "
      >
        <h3
          className="
            mb-3
            text-base
            font-semibold
            text-gray-800
          "
        >
          Create Admin
        </h3>

        <form
          onSubmit={(e) => {
            void createAdmin(
              e.nativeEvent
            );
          }}
          className="relative"
        >
          {/* Email */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={handleEmailChange}
            required
            className="
              mb-2
              w-full
              rounded-lg
              border
              border-gray-300
              px-3
              py-2.5
              text-sm
              transition
              focus:border-[rgb(0,64,128)]
              focus:outline-none
              focus:ring-2
              focus:ring-blue-100
            "
          />

          {emailError && (
            <p
              className="
                mb-2
                text-sm
                font-medium
                text-red-600
              "
            >
              {emailError}
            </p>
          )}

          {/* Password */}
          <div className="relative mb-3">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Password"
              value={password}
              onChange={
                handlePasswordChange
              }
              required
              className="
                w-full
                rounded-lg
                border
                border-gray-300
                px-3
                py-2.5
                pr-12
                text-sm
                transition
                focus:border-[rgb(0,64,128)]
                focus:outline-none
                focus:ring-2
                focus:ring-blue-100
              "
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (prev) => !prev
                )
              }
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                rounded
                p-1
                text-gray-500
                hover:bg-gray-100
                hover:text-gray-700
              "
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {/* Create Button */}
          <button
            type="submit"
            disabled={
              loading ||
              Boolean(emailError)
            }
            className="
              w-full
              rounded-lg
              bg-[rgb(0,64,128)]
              px-4
              py-2.5
              text-sm
              font-medium
              text-white
              transition
              hover:opacity-90
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading
              ? "Creating..."
              : "Create"}
          </button>
        </form>
      </section>

      {/*DELETE ADMIN*/}
      <section
        className="
          rounded-xl
          bg-gray-50
          p-4
        "
      >
        <h3
          className="
            mb-3
            text-base
            font-semibold
            text-gray-800
          "
        >
          Delete Admin
        </h3>

        <form
          onSubmit={(e) => {
            void deleteAdmin(
              e.nativeEvent
            );
          }}
          className="relative"
        >
          {/* ---------------- Custom Dropdown ---------------- */}

          <div
            ref={deleteDropdownRef}
            className="
              relative
              mb-3
              w-full
            "
          >
            {/* Dropdown Trigger */}

            <button
              type="button"
              onClick={() =>
                setDeleteDropdownOpen(
                  (open) => !open
                )
              }
              className="
                flex
                w-full
                items-center
                justify-between
                rounded-lg
                border
                border-gray-300
                bg-white
                px-3
                py-2.5
                text-left
                text-sm
                transition-colors
                hover:border-[#0077ff]
                focus:border-[rgb(0,64,128)]
                focus:outline-none
                focus:ring-2
                focus:ring-blue-100
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
                  ? selectedAdmin.email
                  : "Select admin"}
              </span>

              {deleteDropdownOpen ? (
                <ChevronUp
                  size={18}
                  className="
                    ml-2
                    shrink-0
                    text-gray-600
                  "
                />
              ) : (
                <ChevronDown
                  size={18}
                  className="
                    ml-2
                    shrink-0
                    text-gray-600
                  "
                />
              )}
            </button>

            {/* Dropdown Options */}

            {deleteDropdownOpen && (
              <div
                className="
                  absolute
                  left-0
                  top-full
                  z-50
                  mt-1
                  max-h-60
                  w-full
                  overflow-y-auto
                  rounded-lg
                  border
                  border-gray-300
                  bg-white
                  shadow-lg
                "
              >
                {admins.length === 0 ? (
                  <div
                    className="
                      px-3
                      py-2.5
                      text-sm
                      text-gray-500
                    "
                  >
                    No admins available
                  </div>
                ) : (
                  <>
                    {/* Select Admin */}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId("");
                        setDeleteDropdownOpen(
                          false
                        );
                      }}
                      className={`
                        block
                        w-full
                        px-3
                        py-2.5
                        text-left
                        text-sm
                        transition-colors
                        hover:bg-[#f0f6ff]
                        ${
                          selectedId === ""
                            ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                            : "text-gray-500"
                        }
                      `}
                    >
                      Select admin
                    </button>

                    {/* Admin List */}

                    {admins.map((admin) => {
                      const adminId =
                        String(admin.id);

                      const isSelected =
                        selectedId ===
                        adminId;

                      return (
                        <button
                          key={admin.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(
                              adminId
                            );

                            setDeleteDropdownOpen(
                              false
                            );
                          }}
                          className={`
                            block
                            w-full
                            px-3
                            py-2.5
                            text-left
                            text-sm
                            transition-colors
                            hover:bg-[#f0f6ff]
                            ${
                              isSelected
                                ? "bg-[#f0f6ff] font-semibold text-[rgb(0,64,128)]"
                                : "text-[#333]"
                            }
                          `}
                        >
                          {admin.email}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            type="submit"
            disabled={deleteLoading}
            className="
              w-full
              rounded-lg
              bg-red-600
              px-4
              py-2.5
              text-sm
              font-medium
              text-white
              transition
              hover:bg-red-700
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {deleteLoading
              ? "Deleting..."
              : "Delete"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AdminManagement;