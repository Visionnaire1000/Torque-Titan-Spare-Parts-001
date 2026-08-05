import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";

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

const AdminManagement = () => {
  const { user, authFetch } = useAuth();

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await authFetch(`${config.API_BASE_URL}/admin/admins`);

      const data: AdminsResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch admins");
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

  useEffect(() => {
    if (user?.role === "super_admin") {
      fetchAdmins();
    }
  }, [user, fetchAdmins]);

  const handleEmailChange = (e: any) => {
    const value = e.target.value;

    setEmail(value);

    setEmailError(
      value && !emailPattern.test(value)
        ? "Enter a valid email address"
        : ""
    );
  };

  const handlePasswordChange = (e: any) => {
    setPassword(e.target.value);
  };

  const handleSelectChange = (e: any) => {
    setSelectedId(e.target.value);
  };

    const createAdmin = async (e: any) => {
    e.preventDefault();

    if (emailError) return;

    setLoading(true);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/create-admin`,
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

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create admin");
      }

      setEmail("");
      setPassword("");
      setEmailError("");

      toast.success("Admin created successfully!");

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

  const deleteAdmin = async (e: any) => {
    e.preventDefault();

    if (!selectedId) {
      toast.warn("Please select an admin");
      return;
    }

    setDeleteLoading(true);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/delete-admin/${selectedId}`,
        {
          method: "DELETE",
        }
      );

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete admin");
      }

      setSelectedId("");

      toast.success("Admin deleted successfully!");

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

  if (user?.role !== "super_admin") {
    return (
      <p className="py-10 text-center text-lg font-medium">
        Access denied
      </p>
    );
  }

    return (
    <div className="mx-auto mt-[90px] max-w-[520px] rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      <ToastContainer position="top-right" autoClose={3000} />

      <h2 className="mb-5 text-center text-[22px] font-bold">
        Admin Management
      </h2>

      {/* Create Admin */}
      <section className="mb-6 rounded-xl bg-gray-50 p-4">
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          Create Admin
        </h3>

        <form onSubmit={createAdmin} className="relative">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={handleEmailChange}
            required
            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition focus:border-[rgb(0,64,128)] focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          {emailError && (
            <p className="mb-2 text-sm font-medium text-red-600">
              {emailError}
            </p>
          )}

          <div className="relative mb-3">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-12 text-sm transition focus:border-[rgb(0,64,128)] focus:outline-none focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || Boolean(emailError)}
            className="w-full rounded-lg bg-[rgb(0,64,128)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      {/* Delete Admin */}
      <section className="rounded-xl bg-gray-50 p-4">
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          Delete Admin
        </h3>

        <form onSubmit={deleteAdmin} className="relative">
          <select
            value={selectedId}
            onChange={handleSelectChange}
            required
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm transition focus:border-[rgb(0,64,128)] focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Select admin</option>

            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.email}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={deleteLoading}
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AdminManagement;