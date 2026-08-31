import { useEffect, useState, useRef, type ReactElement } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import config from "../../../config";
import { ChevronUp, ChevronDown, RefreshCw, PackageOpen } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------------- Types ---------------- */
type OrderStatus =
  | "pending"
  | "shipped"
  | "delivered"
  | "cancelled";

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
  sparepart?: SparePart | null;
}

interface Order {
  id: string;
  status: OrderStatus;
  total_items: number;
  total_price: number;
  address: string;
  created_at: string;
  order_items?: OrderItem[];
}

interface OrdersResponse {
  orders?: Order[];
}

interface SeenOrderIds {
  pending: string[];
  shipped: string[];
  delivered: string[];
  cancelled: string[];
}

interface ErrorStateProps {
  onRetry: () => void | Promise<void>;
}

interface ErrorResponse {
  message?: string;
  error?: string;
}

const tabs: OrderStatus[] = [
  "pending",
  "shipped",
  "delivered",
  "cancelled",
];

/* ---------------- Skeleton Loader ---------------- */
const SkeletonOrderCard = (): ReactElement => (
  <div
    className="
      relative
      mb-4
      overflow-hidden
      rounded-xl
      bg-[#f6f7f8]
      p-4

      after:absolute
      after:left-[-150%]
      after:top-0
      after:h-full
      after:w-[150%]
      after:content-['']
      after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]
      after:animate-[shimmer_1.4s_infinite]
    "
  >
    <div className="mb-[10px] flex justify-between">
      <div className="my-2 h-4 w-1/2 rounded-md bg-[#e0e0e0]" />
      <div className="h-4 w-4 rounded bg-[#e0e0e0]" />
    </div>

    <div className="my-2 h-3 w-[40%] rounded-md bg-[#e0e0e0]" />
    <div className="my-2 h-3 w-[30%] rounded-md bg-[#e0e0e0]" />
    <div className="my-2 h-3 w-[60%] rounded-md bg-[#e0e0e0]" />
    <div className="my-2 h-3 w-1/2 rounded-md bg-[#e0e0e0]" />

    <div className="mt-[10px] h-8 w-[140px] rounded-lg bg-[#e0e0e0]" />

    <div className="mt-[15px] border-t border-[#eee] pt-[10px]">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="
            mt-3
            flex
            gap-3
            border-b
            border-dashed
            border-[#ddd]
            py-[5px]
          "
        >
          <div
            className="
              h-[70px]
              w-[70px]
              shrink-0
              rounded-[10px]
              bg-[#e0e0e0]
            "
          />

          <div className="flex-1">
            <div className="my-2 h-3 w-[80%] rounded-md bg-[#e0e0e0]" />
            <div className="my-2 h-3 w-[40%] rounded-md bg-[#e0e0e0]" />
            <div className="my-2 h-3 w-[40%] rounded-md bg-[#e0e0e0]" />
            <div className="my-2 h-3 w-1/2 rounded-md bg-[#e0e0e0]" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ---------------- Error State ---------------- */
const ErrorState = ({
  onRetry,
}: ErrorStateProps): ReactElement => (
  <div
    className="
      flex
      h-[60vh]
      flex-col
      items-center
      justify-center
      px-5
      text-center
      animate-[fadeIn_0.3s_ease]
    "
  >
    <h2 className="mb-2 text-2xl font-semibold text-[#111827]">
      Something went wrong
    </h2>

    <p
      className="
        mb-5
        max-w-[400px]
        text-[0.95rem]
        text-[#6b7280]
      "
    >
      Unable to load orders. Please check your connection and try
      again.
    </p>

    <button
      type="button"
      onClick={() => void onRetry()}
      className="
        group
        inline-flex
        items-center
        gap-2
        rounded-lg
        bg-[#111827]
        px-4
        py-[10px]
        text-white
        transition-all
        duration-200
        hover:-translate-y-px
        hover:bg-[#1f2933]
      "
    >
      <RefreshCw
        size={18}
        className="
          transition-transform
          duration-300
          group-hover:rotate-90
        "
      />

      Retry
    </button>
  </div>
);

/* ---------------- Admin Orders ---------------- */
const AdminOrders = (): ReactElement => {
  const { authFetch } = useAuth();
  const location = useLocation();

  /* ---------------- State ---------------- */
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const [activeTab, setActiveTab] =
    useState<OrderStatus>("pending");

  const [expandedOrderId, setExpandedOrderId] =
    useState<string | null>(null);

  const [seenOrderIds, setSeenOrderIds] =
    useState<SeenOrderIds>(() => {
      try {
        const raw =
          localStorage.getItem(
            "admin_seen_order_ids"
          );

        const stored = raw
          ? (JSON.parse(
              raw
            ) as Partial<SeenOrderIds>)
          : {};

        return {
          pending: stored.pending ?? [],
          shipped: stored.shipped ?? [],
          delivered:
            stored.delivered ?? [],
          cancelled:
            stored.cancelled ?? [],
        };
      } catch {
        return {
          pending: [],
          shipped: [],
          delivered: [],
          cancelled: [],
        };
      }
    });

  const prevOrdersRef =
    useRef<Order[]>([]);

  const timeZone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone;

  /* ---------------- Persist Seen ---------------- */
  useEffect(() => {
    localStorage.setItem(
      "admin_seen_order_ids",
      JSON.stringify(seenOrderIds)
    );

    window.dispatchEvent(
      new CustomEvent(
        "admin_orders_updated",
        {
          detail: {
            type: "seen_update",
          },
        }
      )
    );
  }, [seenOrderIds]);

  /* ---------------- Set Tab From URL ---------------- */
  useEffect(() => {
    const params =
      new URLSearchParams(
        location.search
      );

    const tab = params.get("tab");

    if (
      tab &&
      tabs.includes(
        tab as OrderStatus
      )
    ) {
      setActiveTab(
        tab as OrderStatus
      );
    }
  }, [location.search]);

  /* ---------------- Format Order Time ---------------- */
  const formatOrderTime = (
    dateString: string
  ): string => {
    if (!dateString) {
      return "";
    }

    const parsedDate =
      dateString.endsWith("Z")
        ? new Date(dateString)
        : new Date(`${dateString}Z`);

    if (
      Number.isNaN(parsedDate.getTime())
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      undefined,
      {
        timeZone,
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }
    ).format(parsedDate);
  };

  /* ---------------- Detect Order Changes ---------------- */
  const hasOrdersChanged = (
    oldOrders: Order[],
    newOrders: Order[]
  ): boolean => {
    if (
      oldOrders.length !==
      newOrders.length
    ) {
      return true;
    }

    for (
      let i = 0;
      i < newOrders.length;
      i++
    ) {
      if (
        oldOrders[i].id !==
          newOrders[i].id ||
        oldOrders[i].status !==
          newOrders[i].status ||
        oldOrders[i].total_items !==
          newOrders[i].total_items ||
        oldOrders[i].total_price !==
          newOrders[i].total_price
      ) {
        return true;
      }
    }

    return false;
  };

  /* ---------------- Group Orders ---------------- */
  const groupedOrders = orders.reduce<
    Partial<
      Record<OrderStatus, Order[]>
    >
  >((acc, order) => {
    const rawStatus =
      typeof order.status === "string"
        ? order.status.toLowerCase()
        : "";

    if (
      !tabs.includes(
        rawStatus as OrderStatus
      )
    ) {
      return acc;
    }

    const status =
      rawStatus as OrderStatus;

    if (!acc[status]) {
      acc[status] = [];
    }

    acc[status]!.push(order);

    return acc;
  }, {});

  /* ---------------- Sort Orders ---------------- */
  Object.keys(groupedOrders).forEach(
    (status) => {
      const orderStatus =
        status as OrderStatus;

      groupedOrders[
        orderStatus
      ]?.sort((a, b) => {
        const dateA =
          a.created_at
            ? new Date(
                a.created_at.endsWith(
                  "Z"
                )
                  ? a.created_at
                  : `${a.created_at}Z`
              ).getTime()
            : 0;

        const dateB =
          b.created_at
            ? new Date(
                b.created_at.endsWith(
                  "Z"
                )
                  ? b.created_at
                  : `${b.created_at}Z`
              ).getTime()
            : 0;

        return (
          (Number.isFinite(dateB)
            ? dateB
            : 0) -
          (Number.isFinite(dateA)
            ? dateA
            : 0)
        );
      });
    }
  );

  /* ---------------- Fetch Orders ---------------- */
  const fetchOrders = async (
    silent: boolean = false
  ): Promise<void> => {
    if (!silent) {
      setLoading(true);
    }

    setError("");

    try {
      const res =
        await authFetch(
          `${config.API_BASE_URL}/admin/orders/`
        );

      if (!res.ok) {
        let message =
          "Failed to fetch orders";

        try {
          const data =
            (await res.json()) as ErrorResponse;

          message =
            data.message ||
            data.error ||
            message;
        } catch {
          // Ignore invalid error response.
        }

        throw new Error(message);
      }

      const data =
        (await res.json()) as OrdersResponse;

      const newOrders: Order[] =
        Array.isArray(data.orders)
          ? data.orders.filter(
              (
                order
              ): order is Order =>
                !!order &&
                typeof order ===
                  "object" &&
                typeof order.id ===
                  "string"
            )
          : [];

      if (
        hasOrdersChanged(
          prevOrdersRef.current,
          newOrders
        )
      ) {
        setOrders(newOrders);

        prevOrdersRef.current =
          newOrders;

        localStorage.setItem(
          "admin_orders_cache",
          JSON.stringify(
            newOrders
          )
        );

        window.dispatchEvent(
          new CustomEvent(
            "admin_orders_updated",
            {
              detail: {
                type: "data_update",
              },
            }
          )
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to fetch orders";

      setError(message);

      if (!silent) {
        toast.error(message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  /* ---------------- Update Status ---------------- */
  const updateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus
  ): void => {
    const toastId =
      toast.info(
        <div>
          <div>
            Mark order #{orderId} as{" "}
            {newStatus}?
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(
                  toastId
                );

                try {
                  const res =
                    await authFetch(
                      `${config.API_BASE_URL}/admin/orders/${orderId}/`,
                      {
                        method:
                          "PATCH",
                        headers: {
                          "Content-Type":
                            "application/json",
                        },
                        body: JSON.stringify(
                          {
                            status:
                              newStatus,
                          }
                        ),
                      }
                    );

                  const data =
                    (await res.json()) as ErrorResponse;

                  if (!res.ok) {
                    throw new Error(
                      data.message ||
                        data.error ||
                        "Failed to update order"
                    );
                  }

                  toast.success(
                    `Order #${orderId} marked as ${newStatus}`
                  );

                  await fetchOrders(
                    true
                  );
                } catch (
                  err: unknown
                ) {
                  const message =
                    err instanceof
                    Error
                      ? err.message
                      : "Failed to update order";

                  toast.error(
                    message
                  );
                }
              }}
              className="
                cursor-pointer
                rounded
                border-0
                bg-[#28a745]
                px-3
                py-1.5
                text-white
                transition-all
                duration-200
                hover:bg-[#218838]
              "
            >
              Confirm
            </button>

            <button
              type="button"
              onClick={() =>
                toast.dismiss(
                  toastId
                )
              }
              className="
                cursor-pointer
                rounded
                border-0
                bg-[#dc3545]
                px-3
                py-1.5
                text-white
                transition-all
                duration-200
                hover:bg-[#c82333]
              "
            >
              Cancel
            </button>
          </div>
        </div>,
        {
          autoClose: false,
        }
      );
  };

  /* ---------------- Polling ---------------- */
  useEffect(() => {
    void fetchOrders();

    const interval =
      window.setInterval(() => {
        void fetchOrders(true);
      }, 30000);

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  /* ---------------- Tab Click ---------------- */
  const handleTabClick = (
    tab: OrderStatus
  ): void => {
    setActiveTab(tab);

    const ordersInTab =
      groupedOrders[tab] ?? [];

    setSeenOrderIds((prev) => ({
      ...prev,
      [tab]: ordersInTab.map(
        (order) => order.id
      ),
    }));
  };

  /* ---------------- Loading ---------------- */
  if (loading) {
    return (
      <div
        className="
          mt-[100px]
          ml-[140px]
          mb-[50px]
          max-w-[900px]
          p-5
          font-sans

          max-[900px]:ml-0
          max-[640px]:mt-[80px]
          max-[640px]:px-4
        "
      >
        <div
          className="
            mb-4
            flex
            gap-[10px]
            border-b-2
            border-[#ccc]
          "
        >
          {tabs.map((tab) => (
            <div
              key={tab}
              className="
                h-8
                w-[90px]
                rounded-[20px]
                bg-[#e0e0e0]

                max-[640px]:flex-1
              "
            />
          ))}
        </div>

        <div>
          {[1, 2, 3].map(
            (i) => (
              <SkeletonOrderCard
                key={i}
              />
            )
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (error) {
    return (
      <ErrorState
        onRetry={() =>
          fetchOrders()
        }
      />
    );
  }

  /* ---------------- No Orders ---------------- */
  if (!orders.length) {
    return (
      <div
        className="
          flex
          min-h-[60vh]
          items-center
          justify-center
          px-4
        "
      >
        <div
          className="
            w-full
            max-w-[420px]
            animate-[fadeIn_0.3s_ease-in-out]
            rounded-2xl
            bg-white
            px-[30px]
            py-10
            text-center
            shadow-[0_8px_24px_rgba(0,0,0,0.06)]

            max-[640px]:px-5
            max-[640px]:py-8
          "
        >
          <PackageOpen
            size={48}
            className="mx-auto mb-4 mt-[80px] text-[#9ca3af]"
          />

          <h2
            className="
              mb-[10px]
              mt-[40px]
              text-2xl
              font-semibold
              text-[#111827]
            "
          >
            No orders yet
          </h2>

          <p
            className="
              text-[0.95rem]
              text-[#6b7280]
            "
          >
            No customer orders have been
            placed yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        mt-[90px]
        ml-[140px]
        mb-[50px]
        max-w-[900px]
        p-5
        font-sans

        max-[1000px]:ml-[80px]

        max-[768px]:ml-0
        max-[768px]:mt-[100px]

        max-[640px]:px-3
      "
    >
      <ToastContainer
        position="top-right"
        autoClose={3000}
      />

      {/* ================= TABS ================= */}
      <div
        className="
          mb-5
          flex
          border-b-2
          border-[#ccc]
        "
      >
        {tabs.map((tab) => {
          const ordersInTab =
            groupedOrders[tab] ?? [];

          const seenIds =
            new Set(
              seenOrderIds[tab] ?? []
            );

          const count =
            ordersInTab.filter(
              (order) =>
                !seenIds.has(
                  order.id
                )
            ).length;

          const isActive =
            activeTab === tab;

          return (
            <button
              type="button"
              key={tab}
              onClick={() =>
                handleTabClick(tab)
              }
              className={`
                relative
                flex-1
                cursor-pointer
                border-b-[3px]
                bg-transparent
                py-[10px]
                text-base
                font-bold
                transition-all
                duration-300

                max-[640px]:text-[12px]
                max-[480px]:px-1

                ${
                  isActive
                    ? "border-[#004080] text-[#004080]"
                    : "border-transparent text-inherit hover:text-[#004080]"
                }
              `}
            >
              {tab.charAt(0).toUpperCase() +
                tab.slice(1)}

              {count > 0 && (
                <span
                  className="
                    absolute
                    -right-1
                    -top-1
                    flex
                    h-[18px]
                    min-w-[18px]
                    items-center
                    justify-center
                    rounded-full
                    bg-red-600
                    px-1
                    text-[11px]
                    font-bold
                    text-white
                    shadow-[0_0_0_2px_white]

                    max-[640px]:right-0
                  "
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= ORDERS ================= */}
      <div>
        {groupedOrders[
          activeTab
        ]?.length ? (
          groupedOrders[
            activeTab
          ]!.map((order) => (
            <div
              key={order.id}
              className="
                mb-[15px]
                rounded-lg
                border
                border-[#ddd]
                bg-[#fafafa]
                p-[15px]
                transition-shadow
                duration-300
                hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]
              "
            >
              {/* ORDER HEADER */}
              <div
                onClick={() =>
                  setExpandedOrderId(
                    expandedOrderId ===
                      order.id
                      ? null
                      : order.id
                  )
                }
                className="
                  mb-[10px]
                  flex
                  cursor-pointer
                  items-center
                  justify-between
                  gap-3
                  text-base
                "
              >
                <div>
                  <strong>
                    Order #{order.id}
                  </strong>{" "}
                  —{" "}
                  {order.status.toUpperCase()}
                </div>

                <span
                  className="
                    shrink-0
                    cursor-pointer
                    font-bold
                  "
                >
                  {expandedOrderId ===
                  order.id ? (
                    <ChevronUp
                      size={16}
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                    />
                  )}
                </span>
              </div>

              {/* ORDER DETAILS */}
              <div className="space-y-1 text-sm sm:text-base">
                <div>
                  Total Items:{" "}
                  {order.total_items}
                </div>

                <div>
                  Total Cost: KES{" "}
                  {order.total_price?.toLocaleString()}
                </div>

                <div className="break-words">
                  Shipping Address:{" "}
                  {order.address ||
                    "N/A"}
                </div>

                <div>
                  Created At:{" "}
                  {formatOrderTime(
                    order.created_at
                  )}

                  <small
                    className="
                      ml-1.5
                      text-xs
                      opacity-70
                    "
                  >
                    ({timeZone})
                  </small>
                </div>
              </div>

              {/* PENDING ACTION */}
              {order.status ===
                "pending" && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "shipped"
                      )
                    }
                    className="
                      mt-[16px]
                      cursor-pointer
                      rounded-[5px]
                      border-0
                      bg-[#004080]
                      px-[14px]
                      py-2
                      font-bold
                      text-white
                      transition-all
                      duration-300

                      hover:-translate-y-px
                      hover:bg-[#004080]/60

                      active:translate-y-0
                      active:bg-[#004080]/60
                      active:text-[#ccc]

                      max-[640px]:w-full
                    "
                  >
                    Mark as Shipped
                  </button>
                </div>
              )}

              {/* SHIPPED ACTION */}
              {order.status ===
                "shipped" && (
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "delivered"
                      )
                    }
                    className="
                      mt-[16px]
                      cursor-pointer
                      rounded-[5px]
                      border-0
                      bg-[#004080]
                      px-[14px]
                      py-2
                      font-bold
                      text-white
                      transition-all
                      duration-300

                      hover:-translate-y-px
                      hover:bg-[#004080]/60

                      active:translate-y-0
                      active:bg-[#004080]/60
                      active:text-[#ccc]

                      max-[640px]:w-full
                    "
                  >
                    Mark as Delivered
                  </button>
                </div>
              )}

              {/* ================= ORDER ITEMS ================= */}
              {expandedOrderId ===
                order.id &&
                Array.isArray(
                  order.order_items
                ) &&
                order.order_items.length >
                  0 && (
                  <div
                    className="
                      mt-[15px]
                      border-t
                      border-[#eee]
                      pt-[10px]
                    "
                  >
                    {order.order_items.map(
                      (item) => (
                        <div
                          key={item.id}
                          className="
                            mb-[10px]
                            flex
                            gap-3
                            border-b
                            border-dashed
                            border-[#ddd]
                            py-[5px]

                            max-[500px]:items-start
                          "
                        >
                          {/* IMAGE */}
                          {item.sparepart ? (
                            <Link
                              to={`/items/${item.sparepart.id}`}
                              className="shrink-0"
                            >
                              <img
                                src={
                                  item.sparepart
                                    .image_url ||
                                  "/placeholder.png"
                                }
                                alt={
                                  item.sparepart
                                    .brand ||
                                  "Spare part"
                                }
                                className="
                                  h-20
                                  w-20
                                  rounded
                                  object-cover

                                  max-[500px]:h-[70px]
                                  max-[500px]:w-[70px]
                                "
                              />
                            </Link>
                          ) : (
                            <div
                              className="
                                h-20
                                w-20
                                shrink-0
                                rounded
                                bg-[#e5e7eb]

                                max-[500px]:h-[70px]
                                max-[500px]:w-[70px]
                              "
                            />
                          )}

                          {/* ITEM INFORMATION */}
                          <div
                            className="
                              min-w-0
                              flex-1
                              text-sm
                            "
                          >
                            {item.sparepart ? (
                              <strong
                                className="
                                  block
                                  break-words
                                "
                              >
                                {
                                  item
                                    .sparepart
                                    .brand
                                }{" "}
                                {
                                  item
                                    .sparepart
                                    .category
                                }{" "}
                                {item
                                  .sparepart
                                  .vehicle_type
                                  ? `for ${item.sparepart.vehicle_type}`
                                  : ""}
                              </strong>
                            ) : (
                              <strong className="block break-words">
                                Spare part unavailable
                              </strong>
                            )}

                            <p>
                              Quantity:{" "}
                              {item.quantity}
                            </p>

                            <p>
                              Unit Price:
                              {" "}
                              KES{" "}
                              {item.price?.toLocaleString()}
                            </p>

                            <p>
                              Subtotal:
                              {" "}
                              KES{" "}
                              {item.subtotal?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          ))
        ) : (

          /* ================= EMPTY TAB ================= */
          <div
            className="
              animate-[fadeIn_0.3s_ease-in-out]
              px-5
              py-10
              text-center
              text-[#6b7280]
            "
          >
            <PackageOpen
              size={36}
              className="
                mx-auto
                mb-4
                text-[#9ca3af]
              "
            />

            <h3
              className="
                mt-[10px]
                text-[1.2rem]
                font-semibold
                text-[#111827]
              "
            >
              No {activeTab} orders
            </h3>

            <p
              className="
                mt-1.5
                text-[0.9rem]
              "
            >
              {activeTab ===
                "pending" &&
                "No pending orders to process."}

              {activeTab ===
                "shipped" &&
                "No orders currently in transit."}

              {activeTab ===
                "delivered" &&
                "No completed deliveries yet."}

              {activeTab ===
                "cancelled" &&
                "No cancelled orders."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;