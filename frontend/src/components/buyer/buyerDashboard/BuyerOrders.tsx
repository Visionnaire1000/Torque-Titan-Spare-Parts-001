import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, PackageOpen, RefreshCw } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import config from "../../config";
import "../../styles/buyerOrders.css";

/* ---------------- Skeleton Loader ---------------- */
const SkeletonOrderCard = () => (
  <div className="order-card skeleton">
    <div className="order-header">
      <div className="skeleton-text title" />
      <div className="skeleton-icon" />
    </div>

    <div className="skeleton-text w-40" />
    <div className="skeleton-text w-30" />
    <div className="skeleton-text w-60" />
    <div className="skeleton-text w-50" />

    <div className="skeleton-btn" />

    <div className="order-items">
      {[1, 2].map((i) => (
        <div key={i} className="order-item-card">
          <div className="skeleton-image" />

          <div className="order-item-info">
            <div className="skeleton-text w-80" />
            <div className="skeleton-text w-40" />
            <div className="skeleton-text w-40" />
            <div className="skeleton-text w-50" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ---------------- Error State ---------------- */
const ErrorState = ({ onRetry }) => (
  <div className="error-state">
    <h2>Something went wrong</h2>
    <p>Unable to load orders. Please check your connection and try again.</p>

    <button className="retry-btn" onClick={onRetry}>
      <RefreshCw size={18} className="retry-icon" />
      Retry
    </button>
  </div>
);

const BuyerOrders = () => {
  const { authFetch } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const [seenOrderIds, setSeenOrderIds] = useState(() => {
    return JSON.parse(localStorage.getItem("buyer_seen_order_ids")) || {};
  });

  const prevOrdersRef = useRef([]);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatOrderTime = (dateString) => {
    if (!dateString) return "";
    const utcDate = dateString.endsWith("Z")
      ? new Date(dateString)
      : new Date(`${dateString}Z`);

    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(utcDate);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`${config.API_BASE_URL}/orders`);
      if (!res.ok) throw new Error("Failed to fetch orders");

      const data = await res.json();
      const newOrders = data.orders || [];

      const hasChanged =
        JSON.stringify(prevOrdersRef.current) !== JSON.stringify(newOrders);

      if (hasChanged) {
        setOrders(newOrders);
        prevOrdersRef.current = newOrders;

        localStorage.setItem("buyer_orders_cache", JSON.stringify(newOrders));
        window.dispatchEvent(new Event("ordersUpdated"));
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = (orderId) => {
    toast.warn(
      ({ closeToast }) => (
        <div>
          <p>Are you sure you want to cancel this order?</p>
          <div style={{ marginTop: "8px" }}>
            <button
              onClick={async () => {
                closeToast();
                try {
                  const res = await authFetch(
                    `${config.API_BASE_URL}/orders/${orderId}`,
                    {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "cancelled" }),
                    }
                  );
                  const data = await res.json();
                  if (!res.ok)
                    throw new Error(data.error || "Failed to cancel order");

                  toast.success(data.message || "Order cancelled");
                  fetchOrders();
                } catch (err) {
                  toast.error(err.message);
                }
              }}
              className="toast-btn confirm"
            >
              Yes
            </button>

            <button onClick={closeToast} className="toast-btn cancel" style={{ marginLeft: 10 }}>
              No
            </button>
          </div>
        </div>
      ),
      { autoClose: false }
    );
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);

    const ordersInTab = (orders || []).filter(o => o.status.toLowerCase() === tab);
    const updatedSeen = { ...seenOrderIds, [tab]: ordersInTab.map(o => o.id) };
    setSeenOrderIds(updatedSeen);
    localStorage.setItem("buyer_seen_order_ids", JSON.stringify(updatedSeen));
  };

  useEffect(() => {
    if (!orders.length) return;

    const ordersInTab = (orders || []).filter(o => o.status.toLowerCase() === activeTab);
    const updatedSeen = { ...seenOrderIds };
    if (!updatedSeen[activeTab]) updatedSeen[activeTab] = [];
    const seenSet = new Set(updatedSeen[activeTab]);
    ordersInTab.forEach(o => seenSet.add(o.id));
    updatedSeen[activeTab] = Array.from(seenSet);
    setSeenOrderIds(updatedSeen);
    localStorage.setItem("buyer_seen_order_ids", JSON.stringify(updatedSeen));

    window.dispatchEvent(new Event("ordersUpdated"));
  }, [activeTab, orders]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const groupedOrders = (orders || []).reduce((acc, order) => {
    const status = order.status.toLowerCase();
    if (!acc[status]) acc[status] = [];
    acc[status].push(order);
    return acc;
  }, {});

  Object.keys(groupedOrders).forEach((status) => {
    groupedOrders[status].sort(
      (a, b) => new Date(`${b.created_at}Z`) - new Date(`${a.created_at}Z`)
    );
  });

  const tabs = ["pending", "shipped", "delivered", "cancelled"];

  const getBadgeCount = (tab) => {
    const ordersInTab = groupedOrders[tab] || [];
    const seenIds = new Set(seenOrderIds[tab] || []);
    return ordersInTab.filter((order) => !seenIds.has(order.id)).length;
  };

  /* ---------------- Skeleton Render ---------------- */
  if (loading) {
    return (
      <div className="orders-container">
        <div className="orders-tabs skeleton-tabs">
          {tabs.map((_, i) => (
            <div key={i} className="skeleton-tab" />
          ))}
        </div>

        <div className="orders-list">
          {[1, 2, 3].map((i) => (
            <SkeletonOrderCard key={i} />
          ))}
        </div>
      </div>
    );
  }
  
  if (error) return <ErrorState onRetry={fetchOrders} />;
  if (!orders.length) {
  return (
    <div className="orders-empty">
      <div className="empty-card">
        <PackageOpen size={48} className="empty-icon" />
        <h2>No orders yet</h2>
        <p>You haven't placed any orders. Start shopping to see them here.</p>
        <Link to="/" className="empty-btn">Browse Products</Link>
      </div>
    </div>
  );
 }

  return (
    <div className="orders-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="orders-tabs">
        {tabs.map((tab) => {
          const count = getBadgeCount(tab);
          return (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => handleTabClick(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {count > 0 && <span className="tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="orders-list">
        {groupedOrders[activeTab]?.length ? (
          groupedOrders[activeTab].map((order) => (
            <div key={order.id} className="order-card">
              <div
                className="order-header"
                onClick={() =>
                  setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                }
              >
                <strong>Order #{order.id}</strong> — {order.status.toUpperCase()}
                <span className="toggle-icon">
                  {expandedOrderId === order.id ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </span>
              </div>

              <div>Total Items: {order.total_items}</div>
              <div>Total Cost: KES {order.total_price?.toLocaleString() || "0"}</div>
              <div>Shipping Address: {order.address}</div>
              <div>
                Created At: {formatOrderTime(order.created_at)}
                <small className="timezone-label">({timeZone})</small>
              </div>

              {order.status === "pending" && (
                <button
                  className="cancel-btn"
                  onClick={() => cancelOrder(order.id)}
                >
                  Cancel Order
                </button>
              )}

              {expandedOrderId === order.id && order.order_items?.length > 0 && (
                <div className="order-items">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="order-item-card">
                      <Link
                        to={`/items/${item.sparepart.id}`}
                        className="item-card-link"
                      >
                        <img
                          src={item.sparepart.image_url || "/placeholder.png"}
                          alt={item.sparepart.brand}
                          className="order-item-img"
                        />
                      </Link>

                      <div className="order-item-info">
                        <strong>
                          {item.sparepart.brand} {item.sparepart.category} for{" "}
                          {item.sparepart.vehicle_type}
                        </strong>
                        <p>Quantity: {item.quantity}</p>
                        <p>Unit Price: KES {item.price?.toLocaleString() || "0"}</p>
                        <p>Subtotal: KES {item.subtotal?.toLocaleString() || "0"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-tab">
            <PackageOpen size={36} className="empty-icon" />
            <h3>No {activeTab} orders</h3>
            <p>
             {activeTab === "pending" && "You have no pending orders right now."}
             {activeTab === "shipped" && "Nothing has been shipped yet."}
             {activeTab === "delivered" && "No delivered orders yet."}
             {activeTab === "cancelled" && "No cancelled orders."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerOrders;