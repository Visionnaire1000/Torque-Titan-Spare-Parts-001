import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, Link, NavLink } from "react-router-dom";
import { ShoppingCart, Menu, Home, User, Package, MapPin, Search, ChevronDown } from "lucide-react";
import { useCart } from "../../../contexts/CartContext";
import { useAuth } from "../../../contexts/AuthContext";
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

  const { user, logout } = useAuth();
  const { items } = useCart();

  const navigate = useNavigate();
  const location = useLocation();


  const [showDropdown, setShowDropdown] =
    useState<boolean>(false);


  const [ordersCount, setOrdersCount] =
    useState<number>(0);


  const [openDropdown, setOpenDropdown] =
    useState<keyof SelectedCategory | null>(null);


  const [menuPosition, setMenuPosition] =
    useState({
      top: 0,
      left: 0,
    });


  const [menuWidth, setMenuWidth] =
    useState<number>(150);


  const [selectedCategory, setSelectedCategory] =
    useState<SelectedCategory>({
      tyres: "",
      rims: "",
      batteries: "",
      filters: "",
    });


  const categories: Category[] = [
    {
      label: "TYRES",
      path: "tyres",
    },
    {
      label: "RIMS",
      path: "rims",
    },
    {
      label: "BATTERIES",
      path: "batteries",
    },
    {
      label: "OIL FILTERS",
      path: "filters",
    },
  ];

  useEffect(() => {

  const pathSegment =
    location.pathname.slice(1);


  if (!pathSegment) {

    setSelectedCategory({
      tyres: "",
      rims: "",
      batteries: "",
      filters: "",
    });

    return;
  }


  const parts =
    pathSegment.split("-");


  if (parts.length !== 2) return;


  const category =
    parts[1] as keyof SelectedCategory;


  setSelectedCategory((prev) => {

    const updated =
      {} as SelectedCategory;


    (
      Object.keys(prev) as (keyof SelectedCategory)[]
    ).forEach((key) => {

      updated[key] =
        key === category
          ? pathSegment
          : "";

    });


    return updated;

  });


}, [location.pathname]);



useEffect(() => {

  const handleClickOutside = () => {

    setOpenDropdown(null);

  };


  document.addEventListener(
    "click",
    handleClickOutside
  );


  return () => {

    document.removeEventListener(
      "click",
      handleClickOutside
    );

  };


}, []);

const handleCategorySelect = (
  value: string,
  path: keyof SelectedCategory
): void => {


  navigate(`/${value}`);


  setSelectedCategory((prev) => {

    const updated =
      {} as SelectedCategory;


    (
      Object.keys(prev) as (keyof SelectedCategory)[]
    ).forEach((key) => {

      updated[key] =
        key === path
          ? value
          : "";

    });


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

    const groupedOrders = orders.reduce<GroupedOrders>((acc, order) => {
      const status = order.status.toLowerCase();

      if (!acc[status]) {
        acc[status] = [];
      }

      acc[status].push(order);

      return acc;
    }, {});

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

    const groupedOrders = orders.reduce<GroupedOrders>((acc, order) => {
      const status = order.status.toLowerCase();

      if (!acc[status]) {
        acc[status] = [];
      }

      acc[status].push(order);

      return acc;
    }, {});

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

  useEffect(() => {
    calculateNotifications();

    const handleOrdersUpdated = () => calculateNotifications();

    window.addEventListener(
      "ordersUpdated",
      handleOrdersUpdated as EventListener
    );

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "buyer_orders_cache") {
        calculateNotifications();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    const interval = setInterval(calculateNotifications, 30000);

    return () => {
      clearInterval(interval);

      window.removeEventListener(
        "ordersUpdated",
        handleOrdersUpdated as EventListener
      );

      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
   }, []);

  return (
   <nav className={`navbar ${user ? "logged-in" : "logged-out"}`}>
    <div className="logo">
      <img
        src="https://i.imgur.com/wVCDyd7.png"
        alt="Torque Titan logo"
      />
    </div>
    {/* Dashboard */}
    <div className="dashboard-dropdown">
      <button
        className="dashboard-button"
        onClick={() =>
          setShowDropdown(!showDropdown)
        }
        title="Dashboard"
      >
        <Menu />
      </button>
      {showDropdown && (
        <div className="dropdown-menu">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? "tab active-tab"
                : "tab"
            }
          >
            <Home size={18} />
            Home
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
              <Package size={18} />

              {ordersCount > 0 && (

                <span className="orders-badge">
                  {ordersCount}
                </span>

              )}
            </div>
            My Orders
          </NavLink>
          <NavLink
            to="/address"
            className={({ isActive }) =>
              isActive
                ? "tab active-tab"
                : "tab"
            }
          >
            <MapPin size={18} />
            Address Book
          </NavLink>
          <NavLink
            to="/account-management"
            className={({ isActive }) =>
              isActive
                ? "tab active-tab"
                : "tab"
            }
          >
            <User size={18} />
              Account Management
          </NavLink>

          {user && (
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}

            >
              Logout
            </button>

          )}
        </div>
      )}

    </div>

    {/* Categories */}
    <div className="categories-wrapper">
      <div className="categories">
        {categories.map(
          ({
            label,
            path
          }) => (

          <div
            key={path}
            className="category-dropdown"
          >
            <button
              type="button"
              className="category-button"
              onClick={(e) => {
                e.stopPropagation();
                if (
                  openDropdown === path
                ) {

                  setOpenDropdown(null);
                  return;

                }
                const rect =
                  e.currentTarget
                    .getBoundingClientRect();
                setMenuPosition({
                  top:
                    rect.bottom +
                    window.scrollY +
                    4,
                  left:
                    rect.left +
                    window.scrollX,

                });

                setMenuWidth(
                  rect.width
                );

                setOpenDropdown(path);
              }}

            >
              {
                selectedCategory[path]
                  ? selectedCategory[path]
                      .replace("-", " ")
                      .toUpperCase()
                  : label
              }
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
    {/* Category Portal Dropdown */}
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
          onClick={(e) =>
            e.stopPropagation()
          }
        >
          {
            [
              "sedan",
              "suv",
              "truck",
              "bus",
            ]
            .map((type) => (
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
                {type.toUpperCase()}

                {" "}

                {
                  categories.find(
                    (category) =>
                      category.path === openDropdown
                  )?.label
                }
              </button>
            ))
          }
        </div>,
        document.body
      )
    }
    {/* Search */}
    <div className="navbar-smart-search">
      <button
        className="navbar-search-icon"
        title="Search"
        onClick={() =>
          navigate("/search")
        }

      >
        <Search />
      </button>
    </div>
    {/* Right Section */}
    <div className="right-section">
      <Link
        to="/cart"
        className="cart"
      >
        <ShoppingCart />
        <span className="cart-count">
          {items.length}
        </span>
      </Link>
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
    </div>
  </nav>
 );
};

export default BuyerNavbar;

  