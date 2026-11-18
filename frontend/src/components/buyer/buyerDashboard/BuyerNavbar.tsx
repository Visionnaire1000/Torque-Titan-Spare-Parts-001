import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, Link, NavLink } from "react-router-dom";
import { ShoppingCart, Menu, Home, User, Package, MapPin, MessageSquare, Search, ChevronDown } from "lucide-react";

import { useCart } from "../../../contexts/CartContext";
import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";
import LanguageSelector from "./LanguageSelector";
import "../../../styles/buyer/buyerNavbar.css";


interface SelectedCategory {
  tyres: string;
  rims: string;
  batteries: string;
  filters: string;
}

interface Category {
  label: string;
  path: keyof SelectedCategory;
}

interface Order {
  id: string;
  status: string;
}

interface Review {
  id: string;
}

interface GroupedOrders {
  [key: string]: Order[];
}

interface SeenOrderIds {
  pending: string[];
  shipped: string[];
  delivered: string[];
  cancelled: string[];
  [key: string]: string[];
}

const BuyerNavbar = () => {
  const { t } = useTranslation();
  const { user, logout, authFetch } = useAuth();
  const { items } = useCart();

  const navigate = useNavigate();
  const location = useLocation();

  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [newReviewsCount, setNewReviewsCount] = useState<number>(0);

  const [openDropdown, setOpenDropdown] =
    useState<keyof SelectedCategory | null>(null);

  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  const [menuWidth, setMenuWidth] = useState<number>(150);

  const [selectedCategory, setSelectedCategory] =
    useState<SelectedCategory>({
      tyres: "",
      rims: "",
      batteries: "",
      filters: "",
    });

  const categories: Category[] = [
    { label: "tyres", path: "tyres" },
    { label: "rims", path: "rims" },
    { label: "batteries", path: "batteries" },
    { label: "filters", path: "filters" },
  ];

  useEffect(() => {
    const pathSegment = location.pathname.slice(1);

    if (!pathSegment) {
      setSelectedCategory({
        tyres: "",
        rims: "",
        batteries: "",
        filters: "",
      });
      return;
    }

    const parts = pathSegment.split("-");

    if (parts.length !== 2) return;

    const category = parts[1] as keyof SelectedCategory;

    setSelectedCategory((prev) => {
      const updated = {} as SelectedCategory;

      (Object.keys(prev) as (keyof SelectedCategory)[]).forEach(
        (key) => {
          updated[key] = key === category ? pathSegment : "";
        }
      );

      return updated;
    });
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null);
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleCategorySelect = (
    value: string,
    path: keyof SelectedCategory
  ): void => {
    navigate(`/${value}`);

    setSelectedCategory((prev) => {
      const updated = {} as SelectedCategory;

      (Object.keys(prev) as (keyof SelectedCategory)[]).forEach(
        (key) => {
          updated[key] = key === path ? value : "";
        }
      );

      return updated;
    });

    setOpenDropdown(null);
  };

  const calculateNotifications = (): void => {
    const seenOrderIds: Partial<SeenOrderIds> = JSON.parse(
      localStorage.getItem("buyer_seen_order_ids") || "{}"
    );

    const orders: Order[] = JSON.parse(
      localStorage.getItem("buyer_orders_cache") || "[]"
    );

    const groupedOrders = orders.reduce<GroupedOrders>(
      (acc, order) => {
        const status = order.status.toLowerCase();

        if (!acc[status]) {
          acc[status] = [];
        }

        acc[status].push(order);
        return acc;
      },
      {}
    );

    const tabsToCount = ["shipped", "delivered"];
    let total = 0;

    tabsToCount.forEach((tab) => {
      const allOrders = groupedOrders[tab] || [];
      const seenIds = new Set(seenOrderIds[tab] || []);

      total += allOrders.filter(
        (order) => !seenIds.has(order.id)
      ).length;
    });

    setOrdersCount(total);
  };

  const markPendingAsSeen = (): void => {
    const orders: Order[] = JSON.parse(
      localStorage.getItem("buyer_orders_cache") || "[]"
    );

    const groupedOrders = orders.reduce<GroupedOrders>(
      (acc, order) => {
        const status = order.status.toLowerCase();

        if (!acc[status]) {
          acc[status] = [];
        }

        acc[status].push(order);
        return acc;
      },
      {}
    );

    const seenOrderIds: SeenOrderIds = JSON.parse(
      localStorage.getItem("buyer_seen_order_ids") ||
        JSON.stringify({
          pending: [],
          shipped: [],
          delivered: [],
          cancelled: [],
        })
    );

    seenOrderIds.pending = (groupedOrders.pending || []).map(
      (order) => order.id
    );

    localStorage.setItem(
      "buyer_seen_order_ids",
      JSON.stringify(seenOrderIds)
    );

    calculateNotifications();
  };

  const calculateReviewNotifications = (
    data: Review[] | null = null
  ): void => {
    const reviews: Review[] =
      data ??
      JSON.parse(
        localStorage.getItem("buyer_reviews_cache") || "[]"
      );

    const seen: string[] = JSON.parse(
      localStorage.getItem("buyer_seen_review_ids") || "[]"
    );

    const seenSet = new Set(seen);

    const unseen = reviews.filter(
      (review) => !seenSet.has(review.id)
    ).length;

    setNewReviewsCount(unseen);
  };

  const fetchReviewNotifications = async (): Promise<void> => {
    if (!user) {
      setNewReviewsCount(0);
      return;
    }

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/buyer-reviews/`
      );

      if (!res.ok) {
        throw new Error(
          `Failed to fetch reviews: ${res.status}`
        );
      }

      const data: Review[] = await res.json();

      localStorage.setItem(
        "buyer_reviews_cache",
        JSON.stringify(data)
      );

      calculateReviewNotifications(data);
    } catch (err) {
      console.error("Failed to fetch buyer reviews:", err);
    }
  };

  const markReviewsAsSeen = (): void => {
    const reviews: Review[] = JSON.parse(
      localStorage.getItem("buyer_reviews_cache") || "[]"
    );

    const allIds = reviews.map((review) => review.id);

    localStorage.setItem(
      "buyer_seen_review_ids",
      JSON.stringify(allIds)
    );

    setNewReviewsCount(0);

    window.dispatchEvent(new Event("buyer_reviews_updated"));
  };

  useEffect(() => {
    if (!user) {
      setOrdersCount(0);
      setNewReviewsCount(0);
      return;
    }

    calculateNotifications();
    fetchReviewNotifications();

    const handleOrdersUpdated = (): void => {
      calculateNotifications();
    };

    const handleOrderStorageChange = (
      e: StorageEvent
    ): void => {
      if (
        e.key === "buyer_orders_cache" ||
        e.key === "buyer_seen_order_ids"
      ) {
        calculateNotifications();
      }
    };

    window.addEventListener(
      "ordersUpdated",
      handleOrdersUpdated as EventListener
    );

    window.addEventListener("storage", handleOrderStorageChange);

    const handleReviewsUpdated = (): void => {
      calculateReviewNotifications();
    };

    const handleReviewStorageChange = (
      e: StorageEvent
    ): void => {
      if (
        e.key === "buyer_reviews_cache" ||
        e.key === "buyer_seen_review_ids"
      ) {
        calculateReviewNotifications();
      }
    };

    window.addEventListener(
      "buyer_reviews_updated",
      handleReviewsUpdated
    );

    window.addEventListener(
      "storage",
      handleReviewStorageChange
    );

    const interval = setInterval(
      calculateNotifications,
      30000
    );

    return () => {
      clearInterval(interval);

      window.removeEventListener(
        "ordersUpdated",
        handleOrdersUpdated as EventListener
      );

      window.removeEventListener(
        "storage",
        handleOrderStorageChange
      );

      window.removeEventListener(
        "buyer_reviews_updated",
        handleReviewsUpdated
      );

      window.removeEventListener(
        "storage",
        handleReviewStorageChange
      );
    };
  }, [user]);

  return (
    <nav className={`navbar ${user ? "logged-in" : "logged-out"}`}>
      <div className="logo">
        <img
          src="https://i.imgur.com/wVCDyd7.png"
          alt="Torque Titan logo"
        />
      </div>

      <div className="dashboard-dropdown">
        <button
          className="dashboard-button"
          onClick={() => setShowDropdown(!showDropdown)}
          title={t("buyerNavbar.dashboard")}
          aria-label={t("buyerNavbar.dashboard")}
        >
          <Menu />
        </button>

        {showDropdown && (
          <div className="dropdown-menu">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "tab active-tab" : "tab"
              }
            >
              <Home size={18} />
              {t("buyerNavbar.home")}
            </NavLink>

            <NavLink
              to="/orders"
              className={({ isActive }) =>
                isActive
                  ? "tab active-tab orders-tab"
                  : "tab orders-tab"
              }
              onClick={markPendingAsSeen}
            >
              <div className="orders-icon-wrapper">
                <Package size={20} />
                {ordersCount > 0 && (
                  <span className="notification-badge">
                    {ordersCount}
                  </span>
                )}
              </div>
              {t("buyerNavbar.myOrders")}
            </NavLink>

            <NavLink
              to="/address"
              className={({ isActive }) =>
                isActive ? "tab active-tab" : "tab"
              }
            >
              <MapPin size={18} />
              {t("buyerNavbar.addressBook")}
            </NavLink>

            <NavLink
              to="/account-management"
              className={({ isActive }) =>
                isActive ? "tab active-tab" : "tab"
              }
            >
              <User size={18} />
              {t("buyerNavbar.accountManagement")}
            </NavLink>

            <NavLink
              to="/buyer-reviews"
              className={({ isActive }) =>
                isActive ? "tab active-tab" : "tab"
              }
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
              {t("buyerNavbar.myReviews")}
            </NavLink>

            {user && (
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                {t("buyerNavbar.logout")}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="categories-wrapper">
        <div className="categories">
          {categories.map(({ label, path }) => (
            <div key={path} className="category-dropdown">
              <button
                type="button"
                className="category-button"
                onClick={(e) => {
                  e.stopPropagation();

                  if (openDropdown === path) {
                    setOpenDropdown(null);
                    return;
                  }

                  const rect =
                    e.currentTarget.getBoundingClientRect();

                  setMenuPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.left + window.scrollX,
                  });

                  setMenuWidth(rect.width);
                  setOpenDropdown(path);
                }}
              >
                {selectedCategory[path]
                  ? selectedCategory[path]
                      .split("-")
                      .map((part) => t(`categories.${part}`))
                      .join(" ")
                      .toUpperCase()
                  : t(`categories.${label}`).toUpperCase()}

                <ChevronDown
                  size={18}
                  className={
                    openDropdown === path
                      ? "dropdown-arrow open"
                      : "dropdown-arrow"
                  }
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {openDropdown &&
        createPortal(
          <div
            className="category-menu"
            style={{
              position: "absolute",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuWidth,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {["sedan", "suv", "truck", "bus"].map((type) => (
              <button
                key={type}
                type="button"
                className="category-option"
                onClick={() =>
                  handleCategorySelect(
                    `${type}-${openDropdown}`,
                    openDropdown
                  )
                }
              >
                {t(`categories.${type}`).toUpperCase()}{" "}
                {t(`categories.${openDropdown}`).toUpperCase()}
              </button>
            ))}
          </div>,
          document.body
        )}

      <div className="navbar-smart-search">
        <button
          className="navbar-search-icon"
          title={t("buyerNavbar.search")}
          aria-label={t("buyerNavbar.search")}
          onClick={() => navigate("/search")}
        >
          <Search />
        </button>
      </div>

      <div className="right-section">
        <Link to="/cart" className="cart" aria-label={t("buyerNavbar.cart")}>
          <ShoppingCart />
          <span className="cart-count">{items.length}</span>
        </Link>

        {!user && (
          <Link to="/login" className="login">
            {t("buyerNavbar.login")}
          </Link>
        )}

        {!user && (
          <Link to="/register" className="register">
            {t("buyerNavbar.register")}
          </Link>
        )}
      <LanguageSelector />
      </div>
    </nav>
  );
};

export default BuyerNavbar;
