import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {Menu, Home, User, Package, MessageSquare } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";
import "../../../styles/admin/adminNavbar.css";

interface Order {
  id: string;
  status: string;
}

interface Review {
  id: string;
}

interface SeenOrderIds {
  pending: string[];
  shipped: string[];
  delivered: string[];
  cancelled: string[];
}

const AdminNavbar = () => {
  const { logout, authFetch, user } = useAuth();

  const [showDropdown, setShowDropdown] =
    useState<boolean>(false);

  const [newReviewsCount, setNewReviewsCount] =
    useState<number>(0);

  const [orderNotifications, setOrderNotifications] =
    useState<number>(0);

  const navigate = useNavigate();
  const location = useLocation();

  // -------------------- ORDER NOTIFICATIONS --------------------
  const calculateOrderNotifications = (): void => {
    const orders: Order[] = JSON.parse(
      localStorage.getItem("admin_orders_cache") || "[]"
    );

    const seenRaw: Partial<SeenOrderIds> = JSON.parse(
      localStorage.getItem("admin_seen_order_ids") || "{}"
    );

    const seenPending = new Set(seenRaw.pending || []);
    const seenCancelled = new Set(seenRaw.cancelled || []);

    const pendingUnseen = orders.filter(
      (order) =>
        order.status.toLowerCase() === "pending" &&
        !seenPending.has(order.id)
    ).length;

    const cancelledUnseen = orders.filter(
      (order) =>
        order.status.toLowerCase() === "cancelled" &&
        !seenCancelled.has(order.id)
    ).length;

    setOrderNotifications(
      pendingUnseen + cancelledUnseen
    );
  };

  const markPendingOrdersAsSeen = (): void => {
    const orders: Order[] = JSON.parse(
      localStorage.getItem("admin_orders_cache") || "[]"
    );

    const seenRaw: Partial<SeenOrderIds> = JSON.parse(
      localStorage.getItem("admin_seen_order_ids") || "{}"
    );

    const pendingIds = orders
      .filter(
        (order) =>
          order.status.toLowerCase() === "pending"
      )
      .map((order) => order.id);

    const updatedSeen: SeenOrderIds = {
      pending: Array.from(
        new Set([
          ...(seenRaw.pending || []),
          ...pendingIds,
        ])
      ),
      shipped: seenRaw.shipped || [],
      delivered: seenRaw.delivered || [],
      cancelled: seenRaw.cancelled || [],
    };

    localStorage.setItem(
      "admin_seen_order_ids",
      JSON.stringify(updatedSeen)
    );

    calculateOrderNotifications();

    window.dispatchEvent(
      new Event("admin_orders_updated")
    );
  };

   // -------------------- REVIEW NOTIFICATIONS --------------------

  const calculateReviewNotifications = (
    data: Review[] | null = null
  ): void => {
    const reviews: Review[] =
      data ??
      JSON.parse(
        localStorage.getItem("admin_reviews_cache") ||
          "[]"
      );

    const seen: string[] = JSON.parse(
      localStorage.getItem("admin_seen_review_ids") ||
        "[]"
    );

    const seenSet = new Set(seen);

    const unseen = reviews.filter(
      (review) => !seenSet.has(review.id)
    ).length;

    setNewReviewsCount(unseen);
  };

  const fetchReviewNotifications = async (): Promise<void> => {
    if (!user) return;

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/reviews`
      );

      const data: Review[] = await res.json();

      localStorage.setItem(
        "admin_reviews_cache",
        JSON.stringify(data)
      );

      calculateReviewNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  const markReviewsAsSeen = async (): Promise<void> => {
    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/reviews`
      );

      const data: Review[] = await res.json();

      const allIds = data.map(
        (review) => review.id
      );

      localStorage.setItem(
        "admin_seen_review_ids",
        JSON.stringify(allIds)
      );

      window.dispatchEvent(
        new Event("admin_reviews_updated")
      );
    } catch (err) {
      console.error(err);
    }
  };
    // -------------------- INIT --------------------

  useEffect(() => {
    calculateOrderNotifications();
    fetchReviewNotifications();

    const handleOrders = (): void =>
      calculateOrderNotifications();

    const handleReviews = (): void =>
      calculateReviewNotifications();

    window.addEventListener(
      "admin_orders_updated",
      handleOrders as EventListener
    );

    window.addEventListener(
      "admin_reviews_updated",
      handleReviews as EventListener
    );

    const handleStorage = (
      e: StorageEvent
    ): void => {
      if (
        e.key === "admin_orders_cache" ||
        e.key === "admin_seen_order_ids"
      ) {
        calculateOrderNotifications();
      }

      if (
        e.key === "admin_reviews_cache" ||
        e.key === "admin_seen_review_ids"
      ) {
        calculateReviewNotifications();
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "admin_orders_updated",
        handleOrders as EventListener
      );

      window.removeEventListener(
        "admin_reviews_updated",
        handleReviews as EventListener
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [user]);

  // -------------------- ACTIVE TAB LOGIC --------------------
  const getActiveTabClass = (
    tabRoute: string
  ): string => {
    if (tabRoute === "orders") {
      return location.pathname.startsWith(
        "/admin-orders"
      )
        ? "active-tab"
        : "";
    }

    if (tabRoute === "reviews") {
      return location.pathname.startsWith(
        "/reviews"
      )
        ? "active-tab"
        : "";
    }

    if (tabRoute === "/") {
      return location.pathname === "/"
        ? "active-tab"
        : "";
    }

    if (tabRoute === "/super-admin-account") {
      return location.pathname ===
        "/super-admin-account"
        ? "active-tab"
        : "";
    }

    if (tabRoute === "/account-management") {
      return location.pathname ===
        "/account-management"
        ? "active-tab"
        : "";
    }

    return "";
  };

   return (
    <nav className="navbar admin-navbar">
      <div className="logo">
        <img
          src="https://i.imgur.com/wVCDyd7.png"
          alt="logo"
        />
      </div>

      <div className="dashboard-dropdown">
        <button
          className="dashboard-button"
          onClick={() =>
            setShowDropdown(!showDropdown)
          }
        >
          <Menu />
        </button>

        {showDropdown && (
          <div className="dropdown-menu">
            <NavLink
              to="/"
              className={`tab ${getActiveTabClass("/")}`}
            >
              <Home size={18} /> Home
            </NavLink>

            <div
              className={`tab orders-tab ${getActiveTabClass(
                "orders"
              )}`}
              onClick={() => {
                markPendingOrdersAsSeen();
                navigate(
                  "/admin-orders?tab=pending"
                );
              }}
            >
              <div className="icon-wrapper">
                <Package size={18} />

                {orderNotifications > 0 && (
                  <span className="notification-badge">
                    {orderNotifications > 9
                      ? "9+"
                      : orderNotifications}
                  </span>
                )}
              </div>

              Orders
            </div>

            <NavLink
              to="/reviews"
              className={`tab review-tab ${getActiveTabClass(
                "reviews"
              )}`}
              onClick={markReviewsAsSeen}
            >
              <div className="icon-wrapper">
                <MessageSquare size={18} />

                {newReviewsCount > 0 && (
                  <span className="notification-badge">
                    {newReviewsCount > 9
                      ? "9+"
                      : newReviewsCount}
                  </span>
                )}
              </div>

              Reviews
            </NavLink>

            {user?.role === "super_admin" ? (
              <NavLink
                to="/super-admin-account"
                className={`tab ${getActiveTabClass(
                  "/super-admin-account"
                )}`}
              >
                <User size={18} /> Account
              </NavLink>
            ) : user?.role === "admin" ? (
              <NavLink
                to="/account-management"
                className={`tab ${getActiveTabClass(
                  "/account-management"
                )}`}
              >
                <User size={18} /> Account
              </NavLink>
            ) : null}

            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {!user && (
        <Link
          to="/login"
          className="login"
        >
          Login
        </Link>
      )}

      {!user && (
        <Link
          to="/register"
          className="register"
        >
          Register
        </Link>
      )}
    </nav>
  );
};

export default AdminNavbar;