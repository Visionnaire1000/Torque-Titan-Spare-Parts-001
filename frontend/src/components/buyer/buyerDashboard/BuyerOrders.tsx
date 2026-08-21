import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, PackageOpen, RefreshCw } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";

/* ---------------- Interfaces ---------------- */
interface SparePart {
  id: string;
  brand: string;
  category: string;
  vehicle_type: string;
  image_url: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  subtotal: number;
  sparepart: SparePart;
}

interface Order {
  id: string;
  status: string;
  total_items: number;
  total_price: number;
  address: string;
  created_at: string;
  order_items: OrderItem[];
}

interface ErrorStateProps {
  onRetry: () => void;
}

interface ToastConfirmProps {
  closeToast?: () => void;
}

type SeenOrders = Record<string, string[]>;


/* ---------------- Skeleton Loader ---------------- */
const SkeletonOrderCard: React.FC = () => (
  <div className="relative mb-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4">

    <div className="mb-4 flex items-center justify-between">
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
    </div>

    <div className="mb-2 h-3 w-2/5 animate-pulse rounded bg-gray-200" />
    <div className="mb-2 h-3 w-1/3 animate-pulse rounded bg-gray-200" />
    <div className="mb-2 h-3 w-3/5 animate-pulse rounded bg-gray-200" />
    <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />

    <div className="mt-3 h-8 w-36 animate-pulse rounded-lg bg-gray-200" />

    <div className="mt-4 border-t border-gray-200 pt-4">

      {[1, 2].map((i) => (
        <div
          key={i}
          className="mt-3 flex gap-3"
        >
          <div className="h-[70px] w-[70px] animate-pulse rounded-lg bg-gray-200" />

          <div className="flex-1">
            <div className="mb-2 h-3 w-4/5 animate-pulse rounded bg-gray-200" />
            <div className="mb-2 h-3 w-2/5 animate-pulse rounded bg-gray-200" />
            <div className="mb-2 h-3 w-2/5 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ---------------- Error State ---------------- */
const ErrorState: React.FC<ErrorStateProps> = ({
  onRetry,
}) => (
  <div className="flex h-[60vh] flex-col items-center justify-center px-5 text-center">

    <h2 className="mb-2 text-2xl font-semibold text-gray-900">
      Something went wrong
    </h2>

    <p className="mb-5 max-w-md text-[15px] text-gray-500">
      Unable to load orders. Please check your connection and try again.
    </p>

    <button
      onClick={onRetry}
      className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-white transition hover:-translate-y-0.5 hover:bg-gray-800"
    >
      <RefreshCw
        size={18}
      />

      Retry
    </button>
  </div>
);

/* ---------------- Component ---------------- */
const BuyerOrders: React.FC = () => {
  const { authFetch } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<string>("pending");

  const [expandedOrderId, setExpandedOrderId] =
    useState<string | null>(null);

  const [seenOrderIds, setSeenOrderIds] =
    useState<SeenOrders>(() => {
      const saved = localStorage.getItem("buyer_seen_order_ids");
      return saved ? JSON.parse(saved) : {};
    });

  const prevOrdersRef = useRef<Order[]>([]);
  const timeZone =
   Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatOrderTime = (
   dateString: string | null | undefined
 ): string => {
  if (!dateString) {
    return "";
  }

  const value = String(dateString).trim();

  if (!value) {
    return "";
  }

  let utcDate: Date;
  // Already contains timezone information:
  // Django: 2026-08-18T10:30:00+00:00
  // Flask:  2026-08-18T10:30:00.000000+00:00
  // ISO:    2026-08-18T10:30:00Z
  if (
    value.endsWith("Z") ||
    /[+-]\d{2}:?\d{2}$/.test(value)
  ) {
    utcDate = new Date(value);

  } else {
    // Naive datetime:
    // 2026-08-18T10:30:00
    // Treats it as UTC.
    utcDate = new Date(`${value}Z`);
  }

  // Prevents Invalid Date from crashing the App
  if (Number.isNaN(utcDate.getTime())) {
    console.error(
      "Invalid order date:",
      dateString
    );

    return "";
  }

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

    const fetchOrders = async (): Promise<void> => {
    setLoading(true);
    setError("");

    try {
      const res = await authFetch(`${config.API_BASE_URL}/orders/`);

      if (!res.ok) {
        throw new Error("Failed to fetch orders");
      }

      const data: { orders?: Order[] } = await res.json();
      const newOrders = data.orders ?? [];

      const hasChanged =
        JSON.stringify(prevOrdersRef.current) !==
        JSON.stringify(newOrders);

      if (hasChanged) {
        setOrders(newOrders);
        prevOrdersRef.current = newOrders;

        localStorage.setItem(
          "buyer_orders_cache",
          JSON.stringify(newOrders)
        );

        window.dispatchEvent(new Event("ordersUpdated"));
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to fetch orders";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

const cancelOrder = (orderId: string): void => {
  toast.warn(
    ({ closeToast }: ToastConfirmProps) => (
      <div>
        <p>Are you sure you want to cancel this order?</p>

        <div style={{ marginTop: "8px" }}>
          <button
            className="toast-btn confirm"
            onClick={async () => {
              closeToast?.();

              try {
                const res = await authFetch(
                  `${config.API_BASE_URL}/orders/${orderId}/`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      status: "cancelled",
                    }),
                  }
                );

                const data: {
                  error?: string;
                  message?: string;
                } = await res.json();

                if (!res.ok) {
                  throw new Error(
                    data.error ?? "Failed to cancel order"
                  );
                }

                toast.success(
                  data.message ?? "Order cancelled"
                );

                await fetchOrders();
              } catch (err) {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Failed to cancel order";

                toast.error(message);
              }
            }}
          >
            Yes
          </button>

          <button
            className="toast-btn cancel"
            style={{ marginLeft: 10 }}
            onClick={() => closeToast?.()}
          >
            No
          </button>
        </div>
      </div>
    ),
    {
      autoClose: false,
    }
  );
};

const handleTabClick = (tab: string): void => {
  setActiveTab(tab);

  const ordersInTab = orders.filter(
    (order) => order.status.toLowerCase() === tab
  );

  const updatedSeen: SeenOrders = {
    ...seenOrderIds,
    [tab]: ordersInTab.map((order) => order.id),
  };

  setSeenOrderIds(updatedSeen);

  localStorage.setItem(
    "buyer_seen_order_ids",
    JSON.stringify(updatedSeen)
  );
};

useEffect(() => {
  if (!orders.length) return;

  const ordersInTab = orders.filter(
    (order) => order.status.toLowerCase() === activeTab
  );

  setSeenOrderIds((currentSeen) => {
    const seenSet = new Set(
      currentSeen[activeTab] ?? []
    );

    ordersInTab.forEach((order) => {
      seenSet.add(order.id);
    });

    const updatedSeen: SeenOrders = {
      ...currentSeen,
      [activeTab]: Array.from(seenSet),
    };

    localStorage.setItem(
      "buyer_seen_order_ids",
      JSON.stringify(updatedSeen)
    );

    return updatedSeen;
  });

  window.dispatchEvent(
    new Event("ordersUpdated")
  );
}, [activeTab, orders]);

useEffect(() => {
  fetchOrders();

  const interval = setInterval(
    fetchOrders,
    30000
  );

  return () => clearInterval(interval);
}, []);

const groupedOrders: Record<string, Order[]> =
  orders.reduce(
    (acc, order) => {
      const status = order.status.toLowerCase();

      if (!acc[status]) {
        acc[status] = [];
      }

      acc[status].push(order);

      return acc;
    },
    {} as Record<string, Order[]>
  );

Object.keys(groupedOrders).forEach((status) => {
  groupedOrders[status].sort(
    (a, b) =>
      new Date(`${b.created_at}Z`).getTime() -
      new Date(`${a.created_at}Z`).getTime()
  );
});

const tabs: string[] = [
  "pending",
  "shipped",
  "delivered",
  "cancelled",
];

const getBadgeCount = (tab: string): number => {
  const ordersInTab = groupedOrders[tab] ?? [];

  const seenIds = new Set(
    seenOrderIds[tab] ?? []
  );

  return ordersInTab.filter(
    (order) => !seenIds.has(order.id)
  ).length;
};

  /* ---------------- Loading ---------------- */
  if (loading) {
    return (
     <div className="mx-auto mt-2 max-w-[900px] px-5 min-[481px]:ml-[140px]">

      <div className="mb-4 flex gap-3">
        {tabs.map((_, i) => (
          <div
            key={i}
            className="h-8 w-[90px] animate-pulse rounded-full bg-gray-200"
          />
        ))}
      </div>

      {[1, 2, 3].map((i) => (
        <SkeletonOrderCard key={i} />
      ))}
    </div>
   );
 }

  /* ---------------- Error ---------------- */
  if (error) {
    return <ErrorState onRetry={fetchOrders} />;
  }

  /* ---------------- Empty ---------------- */
  if (!orders.length) {
   return (
    <div className="flex min-h-[60vh] items-center justify-center mt-12">

      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg shadow-black/5">

        <PackageOpen
          size={48}
          className="mx-auto mb-4 text-gray-400"
        />

        <h2 className="mb-3 text-2xl font-semibold text-gray-900">
          No orders yet
        </h2>

        <p className="mb-6 text-gray-500">
          You haven't placed any orders. Start shopping to see them here.
        </p>

        <Link
          to="/"
          className="inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-white transition hover:-translate-y-0.5 hover:bg-gray-800"
        >
          Browse Products
        </Link>
      </div>
    </div>
   );
  }

 /* ---------------- Main Render ---------------- */
 return (
  <div
    className="
      mx-auto
      mt-[110px]
      mb-[70px]
      w-full
      max-w-[900px]
      px-4
      sm:px-5
      lg:ml-[140px]
    "
  >
    <ToastContainer
      position="top-right"
      autoClose={3000}
    />

    {/* ---------- Tabs ---------- */}
    <div
      className="
        mb-5
        flex
        w-full
        overflow-x-auto
        border-b-2
        border-gray-300
        scrollbar-hide
      "
    >
      {tabs.map((tab) => {
        const count = getBadgeCount(tab);

        return (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`
              relative
              min-w-[120px]
              flex-1
              flex-shrink-0
              border-b-[3px]
              px-3
              py-3
              text-sm
              font-bold
              transition-all
              duration-300
              sm:text-base
              hover:text-[#004080]
              ${
                activeTab === tab
                  ? "border-[#004080] text-[#004080]"
                  : "border-transparent text-black"
              }
            `}
          >
            {tab.charAt(0).toUpperCase() +
              tab.slice(1)}

            {count > 0 && (
              <span
                className="
                  absolute
                  top-0
                  right-0
                  inline-flex
                  h-[18px]
                  min-w-[18px]
                  items-center
                  justify-center
                  rounded-full
                  bg-gradient-to-br
                  from-red-500
                  to-red-600
                  px-1.5
                  text-[11px]
                  font-semibold
                  text-white
                  shadow-md
                  shadow-red-500/30
                  animate-pulse
                  sm:right-4
                  lg:right-6
                "
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>

    {/* ---------- Orders ---------- */}
    <div className="space-y-4">
      {groupedOrders[activeTab]?.length ? (
        groupedOrders[activeTab].map(
          (order: Order) => (
            <div
              key={order.id}
              className="
                w-full
                rounded-lg
                border
                border-gray-300
                bg-gray-50
                p-4
                transition-shadow
                duration-300
                hover:shadow-lg
              "
            >
              {/* ---------- Header ---------- */}
              <div
                onClick={() =>
                  setExpandedOrderId(
                    expandedOrderId === order.id
                      ? null
                      : order.id
                  )
                }
                className="
                  mb-3
                  flex
                  cursor-pointer
                  flex-wrap
                  items-center
                  justify-between
                  gap-2
                  text-base
                "
              >
                <strong>
                  Order #{order.id}
                </strong>

                <span className="font-semibold uppercase text-[#004080]">
                  {order.status}
                </span>

                <span className="cursor-pointer">
                  {expandedOrderId === order.id ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </span>
              </div>

              {/* ---------- Order Info ---------- */}
              <div className="space-y-2 text-[15px]">
                <div>
                  <span className="font-semibold">
                    Total Items:
                  </span>{" "}
                  {order.total_items}
                </div>

                <div>
                  <span className="font-semibold">
                    Total Cost:
                  </span>

                  <span className="ml-2 font-semibold text-red-600">
                    KES{" "}
                    {order.total_price?.toLocaleString() ??
                      "0"}
                  </span>
                </div>

                <div>
                  <span className="font-semibold">
                    Shipping Address:
                  </span>{" "}
                  {order.address}
                </div>

                <div>
                  <span className="font-semibold">
                    Created At:
                  </span>{" "}
                  {formatOrderTime(order.created_at)}

                  <small className="ml-2 text-xs text-gray-500">
                    ({timeZone})
                  </small>
                </div>
              </div>

              {/* ---------- Cancel Button ---------- */}
              {order.status === "pending" && (
                <button
                  onClick={() =>
                    cancelOrder(order.id)
                  }
                  className="
                    mt-4
                    rounded-md
                    bg-red-600
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-white
                    transition
                    hover:bg-red-700
                  "
                >
                  Cancel Order
                </button>
              )}

              {/* ---------- Expanded Items ---------- */}
              {expandedOrderId === order.id &&
                order.order_items?.length > 0 && (
                  <div className="mt-4 border-t border-gray-200 pt-4">

                    {order.order_items.map(
                      (item: OrderItem) => (
                        <div
                          key={item.id}
                          className="
                            mb-4
                            flex
                            flex-col
                            gap-4
                            border-b
                            border-dashed
                            border-gray-300
                            pb-4
                            sm:flex-row
                          "
                        >
                          <Link
                            to={`/items/${item.sparepart.id}`}
                            className="flex justify-center sm:block"
                          >
                            <img
                              src={
                                item.sparepart.image_url ||
                                "/placeholder.png"
                              }
                              alt={
                                item.sparepart.brand
                              }
                              className="
                                h-24
                                w-24
                                rounded-md
                                object-cover
                              "
                            />
                          </Link>

                          <div className="flex-1 text-center sm:text-left">

                            <strong className="block text-base">
                              {item.sparepart.brand}{" "}
                              {item.sparepart.category}{" "}
                              for{" "}
                              {item.sparepart.vehicle_type}
                            </strong>

                            <p className="mt-2">
                              <span className="font-semibold">
                                Quantity:
                              </span>{" "}
                              {item.quantity}
                            </p>

                            <p className="mt-1">
                              <span className="font-semibold">
                                Unit Price:
                              </span>{" "}
                              KES{" "}
                              {item.price?.toLocaleString() ??
                                "0"}
                            </p>

                            <p className="mt-1">
                              <span className="font-semibold">
                                Subtotal:
                              </span>{" "}
                              <span className="text-red-600 font-semibold">
                                KES{" "}
                                {item.subtotal?.toLocaleString() ??
                                  "0"}
                              </span>
                            </p>

                          </div>
                        </div>
                      )
                    )}

                  </div>
                )}
            </div>
          )
        )
      ) : (
        <div
          className="
            flex
            min-h-[300px]
            flex-col
            items-center
            justify-center
            py-10
            text-center
          "
        >
          <PackageOpen
            size={42}
            className="mb-4 text-gray-400"
          />

          <h3 className="text-xl font-semibold text-gray-900">
            No {activeTab} orders
          </h3>

          <p className="mt-2 max-w-md text-sm text-gray-500">
            {activeTab === "pending" &&
              "You have no pending orders right now."}

            {activeTab === "shipped" &&
              "Nothing has been shipped yet."}

            {activeTab === "delivered" &&
              "No delivered orders yet."}

            {activeTab === "cancelled" &&
              "No cancelled orders."}
          </p>
        </div>
      )}
    </div>
  </div>
);

};

export default BuyerOrders;