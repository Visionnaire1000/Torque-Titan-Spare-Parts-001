import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
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
  image: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sparepart: SparePart;
}

interface Order {
  id: string;
  status: string;
  paid: boolean;
  total_quantity: number;
  total_price: number;
  payment_method: string | null;
  address: string;
  address_details?: {
    id: string;
    street: string;
    city: string;
    postal_code: string;
    country: string;
  } | null;
  created_at: string;
  items: OrderItem[];
}

interface ErrorStateProps {
  onRetry: () => void;
}

type SeenOrders = Record<string, string[]>;

interface BuyerOrdersLocationState {
  expandedOrderId?: string | null;
  restoreScrollY?: number;
}


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
      type="button"
      onClick={onRetry}
      className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-white transition hover:-translate-y-0.5 hover:bg-gray-800"
    >
      <RefreshCw size={18} />
      Retry
    </button>
  </div>
);


/* ---------------- Component ---------------- */
const BuyerOrders: React.FC = () => {
  const { authFetch } = useAuth();

  const location = useLocation();

  const [orders, setOrders] =
    useState<Order[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const [activeTab, setActiveTab] =
    useState<string>("pending");

  const [expandedOrderId, setExpandedOrderId] =
    useState<string | null>(null);

  const [orderIdToCancel, setOrderIdToCancel] =
    useState<string | null>(null);

  const [seenOrderIds, setSeenOrderIds] =
    useState<SeenOrders>(() => {
      try {
        const saved =
          localStorage.getItem(
            "buyer_seen_order_ids",
          );

        return saved
          ? JSON.parse(saved)
          : {};
      } catch {
        return {};
      }
    });

  const prevOrdersRef =
    useRef<Order[]>([]);

  const restoreScrollYRef =
    useRef<number | null>(null);

  const restoreExpandedOrderRef =
    useRef<string | null>(null);

  const initialRestoreRef =
    useRef<boolean>(false);

  const isRestoringRef =
    useRef<boolean>(false);

  const timeZone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone;


  /* ---------------- Disable Browser Scroll Restoration ---------------- */
  useEffect(() => {
    const previousScrollRestoration =
      window.history.scrollRestoration;

    window.history.scrollRestoration =
      "manual";

    return () => {
      window.history.scrollRestoration =
        previousScrollRestoration;
    };
  }, []);


  /* ---------------- Prepare Navigation Restore State ---------------- */

  useEffect(() => {
    const state =
      location.state as
        | BuyerOrdersLocationState
        | null;

    if (!state) {
      return;
    }

    const hasScrollRestore =
      typeof state.restoreScrollY ===
      "number";

    const hasExpandedOrder =
      typeof state.expandedOrderId ===
      "string";

    if (
      hasScrollRestore ||
      hasExpandedOrder
    ) {
      initialRestoreRef.current =
        true;

      isRestoringRef.current =
        true;
    }

    if (hasScrollRestore) {
      restoreScrollYRef.current =
        state.restoreScrollY ?? null;
    }

    if (hasExpandedOrder) {
      restoreExpandedOrderRef.current =
        state.expandedOrderId ?? null;
    }
  }, [location.state]);


  /* ---------------- Restore Expanded Order ---------------- */
  useEffect(() => {
    if (!initialRestoreRef.current) {
      return;
    }

    const orderId =
      restoreExpandedOrderRef.current;

    if (!orderId) {
      return;
    }

    const order =
      orders.find(
        (currentOrder) =>
          currentOrder.id === orderId,
      );

    if (!order) {
      return;
    }

    const restoredStatus =
      order.status.toLowerCase();

    if (
      activeTab !== restoredStatus &&
      [
        "pending",
        "shipped",
        "delivered",
        "cancelled",
      ].includes(restoredStatus)
    ) {
      setActiveTab(
        restoredStatus,
      );
    }

    setExpandedOrderId(
      orderId,
    );
  }, [orders]);


  /* ---------------- Restore Scroll Position ---------------- */
  useLayoutEffect(() => {
    if (
      !initialRestoreRef.current ||
      !isRestoringRef.current
    ) {
      return;
    }

    if (
      loading ||
      !orders.length
    ) {
      return;
    }

    const restoreScrollY =
      restoreScrollYRef.current;

    const restoreOrderId =
      restoreExpandedOrderRef.current;

    if (
      restoreOrderId &&
      expandedOrderId !==
        restoreOrderId
    ) {
      return;
    }

    if (restoreScrollY === null) {
      initialRestoreRef.current =
        false;

      isRestoringRef.current =
        false;

      restoreExpandedOrderRef.current =
        null;

      return;
    }

    let cancelled = false;

    const restoreScroll = (): void => {
      if (cancelled) {
        return;
      }

      window.scrollTo({
        top: restoreScrollY,
        left: 0,
        behavior: "auto",
      });

      requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        window.scrollTo({
          top: restoreScrollY,
          left: 0,
          behavior: "auto",
        });

        requestAnimationFrame(() => {
          if (cancelled) {
            return;
          }

          window.scrollTo({
            top: restoreScrollY,
            left: 0,
            behavior: "auto",
          });

          requestAnimationFrame(() => {
            if (cancelled) {
              return;
            }

            window.scrollTo({
              top: restoreScrollY,
              left: 0,
              behavior: "auto",
            });

            initialRestoreRef.current =
              false;

            isRestoringRef.current =
              false;

            restoreScrollYRef.current =
              null;

            restoreExpandedOrderRef.current =
              null;
          });
        });
      });
    };

    const images =
      Array.from(
        document.images,
      );

    const pendingImages =
      images.filter(
        (image) =>
          !image.complete,
      );

    if (
      pendingImages.length === 0
    ) {
      restoreScroll();
    } else {
      let remaining =
        pendingImages.length;

      const handleImageLoad =
        (): void => {
          remaining -= 1;

          if (remaining <= 0) {
            restoreScroll();
          }
        };

      pendingImages.forEach(
        (image) => {
          image.addEventListener(
            "load",
            handleImageLoad,
            {
              once: true,
            },
          );

          image.addEventListener(
            "error",
            handleImageLoad,
            {
              once: true,
            },
          );
        },
      );

      const fallbackTimer =
        window.setTimeout(() => {
          restoreScroll();
        }, 1500);

      return () => {
        cancelled = true;

        window.clearTimeout(
          fallbackTimer,
        );

        pendingImages.forEach(
          (image) => {
            image.removeEventListener(
              "load",
              handleImageLoad,
            );

            image.removeEventListener(
              "error",
              handleImageLoad,
            );
          },
        );
      };
    }

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    orders,
    expandedOrderId,
  ]);


  /* ---------------- Format Order Time ---------------- */
  const formatOrderTime = (
    dateString:
      | string
      | null
      | undefined,
  ): string => {
    if (!dateString) {
      return "";
    }

    const value =
      String(
        dateString,
      ).trim();

    if (!value) {
      return "";
    }

    let utcDate: Date;

    if (
      value.endsWith("Z") ||
      /[+-]\d{2}:?\d{2}$/.test(
        value,
      )
    ) {
      utcDate =
        new Date(value);
    } else {
      utcDate =
        new Date(
          `${value}Z`,
        );
    }

    if (
      Number.isNaN(
        utcDate.getTime(),
      )
    ) {
      console.error(
        "Invalid order date:",
        dateString,
      );

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
      },
    ).format(utcDate);
  };


  /* ---------------- Image URL ---------------- */
  const getImageUrl = (
    image:
      | string
      | null
      | undefined,
  ): string => {
    if (!image) {
      return "/placeholder.png";
    }

    const trimmedImage =
      image.trim();

    if (!trimmedImage) {
      return "/placeholder.png";
    }

    if (
      trimmedImage.startsWith(
        "http://",
      ) ||
      trimmedImage.startsWith(
        "https://",
      ) ||
      trimmedImage.startsWith(
        "data:",
      )
    ) {
      return trimmedImage;
    }

    if (
      trimmedImage.startsWith(
        "/",
      )
    ) {
      return `${config.API_BASE_URL}${trimmedImage}`;
    }

    return `${config.API_BASE_URL}/${trimmedImage}`;
  };


  /* ---------------- Fetch Orders ---------------- */
  const fetchOrders =
    async (): Promise<void> => {
      setLoading(true);
      setError("");

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/orders/`,
          );

        if (!res.ok) {
          throw new Error(
            "Failed to fetch orders",
          );
        }

        const data: Order[] =
          await res.json();

        const newOrders =
          Array.isArray(data)
            ? data
            : [];

        const hasChanged =
          JSON.stringify(
            prevOrdersRef.current,
          ) !==
          JSON.stringify(
            newOrders,
          );

        if (hasChanged) {
          setOrders(
            newOrders,
          );

          prevOrdersRef.current =
            newOrders;

          localStorage.setItem(
            "buyer_orders_cache",
            JSON.stringify(
              newOrders,
            ),
          );

          window.dispatchEvent(
            new Event(
              "ordersUpdated",
            ),
          );
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to fetch orders";

        setError(message);

        toast.error(
          message,
        );
      } finally {
        setLoading(false);
      }
    };


  /* ---------------- Cancel Order ---------------- */
  const cancelOrder = (
    orderId: string,
  ): void => {
    setOrderIdToCancel(
      orderId,
    );
  };


  /* ---------------- Confirm Cancel Order ---------------- */
  const confirmCancelOrder =
    async (): Promise<void> => {
      if (!orderIdToCancel) {
        return;
      }

      const orderId =
        orderIdToCancel;

      setOrderIdToCancel(
        null,
      );

      try {
        const res =
          await authFetch(
            `${config.API_BASE_URL}/orders/${orderId}/`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                status: "cancelled",
              }),
            },
          );

        const data: {
          error?: string;
          message?: string;
        } =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ??
              "Failed to cancel order",
          );
        }

        toast.success(
          data.message ??
            "Order cancelled",
        );

        await fetchOrders();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to cancel order";

        toast.error(
          message,
        );
      }
    };


  /* ---------------- Tab Click ---------------- */
  const handleTabClick = (
    tab: string,
  ): void => {
    if (
      isRestoringRef.current
    ) {
      return;
    }

    setActiveTab(tab);

    const ordersInTab =
      orders.filter(
        (order) =>
          order.status.toLowerCase() ===
          tab,
      );

    const updatedSeen: SeenOrders =
      {
        ...seenOrderIds,
        [tab]:
          ordersInTab.map(
            (order) =>
              order.id,
          ),
      };

    setSeenOrderIds(
      updatedSeen,
    );

    localStorage.setItem(
      "buyer_seen_order_ids",
      JSON.stringify(
        updatedSeen,
      ),
    );
  };


  /* ---------------- Mark Orders Seen ---------------- */
  useEffect(() => {
    if (!orders.length) {
      return;
    }

    const ordersInTab =
      orders.filter(
        (order) =>
          order.status.toLowerCase() ===
          activeTab,
      );

    setSeenOrderIds(
      (currentSeen) => {
        const seenSet =
          new Set(
            currentSeen[
              activeTab
            ] ?? [],
          );

        ordersInTab.forEach(
          (order) => {
            seenSet.add(
              order.id,
            );
          },
        );

        const updatedSeen: SeenOrders =
          {
            ...currentSeen,
            [activeTab]:
              Array.from(
                seenSet,
              ),
          };

        localStorage.setItem(
          "buyer_seen_order_ids",
          JSON.stringify(
            updatedSeen,
          ),
        );

        return updatedSeen;
      },
    );

    window.dispatchEvent(
      new Event(
        "ordersUpdated",
      ),
    );
  }, [
    activeTab,
    orders,
  ]);


  /* ---------------- Initial Fetch + Polling ---------------- */
  useEffect(() => {
    void fetchOrders();

    const interval =
      setInterval(
        () => {
          void fetchOrders();
        },
        30000,
      );

    return () =>
      clearInterval(
        interval,
      );
  }, []);


  /* ---------------- Group Orders ---------------- */
  const groupedOrders:
    Record<string, Order[]> =
    orders.reduce(
      (
        acc,
        order,
      ) => {
        const status =
          order.status.toLowerCase();

        if (!acc[status]) {
          acc[status] = [];
        }

        acc[status].push(
          order,
        );

        return acc;
      },
      {} as Record<
        string,
        Order[]
      >,
    );


  /* ---------------- Sort Orders ---------------- */
  Object.keys(
    groupedOrders,
  ).forEach(
    (status) => {
      groupedOrders[
        status
      ].sort(
        (a, b) => {
          const dateA =
            a.created_at
              ? new Date(
                  a.created_at,
                ).getTime()
              : 0;

          const dateB =
            b.created_at
              ? new Date(
                  b.created_at,
                ).getTime()
              : 0;

          return (
            (Number.isFinite(
              dateB,
            )
              ? dateB
              : 0) -
            (Number.isFinite(
              dateA,
            )
              ? dateA
              : 0)
          );
        },
      );
    },
  );


  /* ---------------- Tabs ---------------- */
  const tabs: string[] = [
    "pending",
    "shipped",
    "delivered",
    "cancelled",
  ];


  /* ---------------- Badge Count ---------------- */
  const getBadgeCount = (
    tab: string,
  ): number => {
    const ordersInTab =
      groupedOrders[
        tab
      ] ?? [];

    const seenIds =
      new Set(
        seenOrderIds[
          tab
        ] ?? [],
      );

    return ordersInTab.filter(
      (order) =>
        !seenIds.has(
          order.id,
        ),
    ).length;
  };


  /* ---------------- Payment Method ---------------- */
  const getPaymentMethodLabel = (
    paymentMethod:
      | string
      | null,
  ): string => {
    switch (
      paymentMethod?.toLowerCase()
    ) {
      case "stripe":
        return "Card";

      case "mpesa":
        return "M-PESA";

      case "airtel":
        return "Airtel Money";

      case "paypal":
        return "PayPal";

      default:
        return (
          paymentMethod ||
          "N/A"
        );
    }
  };


  /* ---------------- Loading ---------------- */
  if (loading) {
    return (
      <div className="mx-auto mt-2 max-w-[900px] px-5 min-[481px]:ml-[140px]">
        <div className="mb-4 flex gap-3">
          {tabs.map(
            (_, i) => (
              <div
                key={i}
                className="h-8 w-[90px] animate-pulse rounded-full bg-gray-200"
              />
            ),
          )}
        </div>

        {[1, 2, 3].map(
          (i) => (
            <SkeletonOrderCard
              key={i}
            />
          ),
        )}
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (error) {
    return (
      <ErrorState
        onRetry={fetchOrders}
      />
    );
  }

  /* ---------------- Empty ---------------- */
  if (!orders.length) {
    return (
      <div className="mt-22 flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg shadow-black/5">
          <PackageOpen
            size={48}
            className="mx-auto mb-4 text-gray-400"
          />

          <h2 className="mb-3 text-2xl font-semibold text-gray-900">
            No orders yet
          </h2>

          <p className="mb-6 text-gray-500">
            You haven't placed any orders. Start
            shopping to see them here.
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
        max-[480px]:mb-10
      "
    >
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="colored"
      />

      {/* ---------- Cancel Order Dialog ---------- */}
      {orderIdToCancel && (
        <div
          className="
            fixed
            inset-0
            z-[9999]
            flex
            items-center
            justify-center
            bg-black/50
            px-4
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-order-title"
        >
          <div
            className="
              w-full
              max-w-[330px]
              rounded-xl
              bg-white
              p-6
              shadow-2xl
              sm:p-7
            "
          >
            <h2
              id="cancel-order-title"
              className="
                text-lg
                font-semibold
                text-gray-900
                sm:text-xl
              "
            >
              Are you sure you want to cancel this order?
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              This action will cancel the order and cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setOrderIdToCancel(null)
                }
                className="
                  rounded-md
                  bg-gray-200
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-gray-800
                  transition
                  hover:bg-gray-300
                "
              >
                No
              </button>

              <button
                type="button"
                onClick={confirmCancelOrder}
                className="
                  rounded-md
                  bg-red-600
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-red-700
                  hover:shadow-md
                "
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
        {tabs.map(
          (tab) => {
            const count =
              getBadgeCount(
                tab,
              );

            return (
              <button
                type="button"
                key={tab}
                onClick={() =>
                  handleTabClick(
                    tab,
                  )
                }
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
                    activeTab ===
                    tab
                      ? "border-[#004080] text-[#004080]"
                      : "border-transparent text-black"
                  }
                `}
              >
                {tab
                  .charAt(
                    0,
                  )
                  .toUpperCase() +
                  tab.slice(
                    1,
                  )}

                {count > 0 && (
                  <span
                    className="
                      absolute
                      -right-[44px]
                      top-0
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
                      max-[480px]:right-0
                      sm:right-4
                      lg:right-6
                    "
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          },
        )}
      </div>


      {/* ---------- Orders ---------- */}
      <div className="space-y-4">
        {groupedOrders[
          activeTab
        ]?.length ? (
          groupedOrders[
            activeTab
          ].map(
            (
              order: Order,
            ) => (
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
                      expandedOrderId ===
                        order.id
                        ? null
                        : order.id,
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
                    {expandedOrderId ===
                    order.id ? (
                      <ChevronUp
                        size={18}
                      />
                    ) : (
                      <ChevronDown
                        size={18}
                      />
                    )}
                  </span>
                </div>


                {/* ---------- Order Info ---------- */}
                <div className="space-y-2 text-[15px]">
                  <div>
                    <span className="font-semibold">
                      Total Items:
                    </span>{" "}
                    {order.total_quantity}
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
                      Payment Method:
                    </span>{" "}
                    <span className="font-medium text-[#004080]">
                      {getPaymentMethodLabel(
                        order.payment_method,
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold">
                      Shipping Address:
                    </span>{" "}
                    {order.address ||
                      "N/A"}
                  </div>

                  <div>
                    <span className="font-semibold">
                      Created At:
                    </span>{" "}
                    {formatOrderTime(
                      order.created_at,
                    )}

                    <small className="ml-2 text-xs text-gray-500">
                      ({timeZone})
                    </small>
                  </div>
                </div>


                {/* ---------- Cancel Button ---------- */}
                {order.status ===
                  "pending" && (
                  <button
                    type="button"
                    onClick={() =>
                      cancelOrder(
                        order.id,
                      )
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
                {expandedOrderId ===
                  order.id &&
                  Array.isArray(
                    order.items,
                  ) &&
                  order.items.length >
                    0 && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      {order.items.map(
                        (
                          item: OrderItem,
                        ) => (
                          <div
                            key={
                              item.id
                            }
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
                            {/* ---------- ITEM IMAGE ---------- */}
                            <Link
                              to={`/items/${item.sparepart.id}`}
                              state={{
                                from:
                                  location.pathname,
                                restoreScrollY:
                                  window.scrollY,
                                expandedOrderId:
                                  order.id,
                              }}
                              className="flex justify-center sm:block"
                            >
                              <img
                                src={getImageUrl(
                                  item
                                    .sparepart
                                    .image,
                                )}
                                alt={
                                  item
                                    .sparepart
                                    .brand ||
                                  "Spare part"
                                }
                                className="
                                  h-24
                                  w-24
                                  rounded-md
                                  object-cover
                                "
                                onError={(
                                  event,
                                ) => {
                                  const target =
                                    event.currentTarget;

                                  if (
                                    target.src.endsWith(
                                      "/placeholder.png",
                                    )
                                  ) {
                                    return;
                                  }

                                  target.src =
                                    "/placeholder.png";
                                }}
                              />
                            </Link>


                            {/* ---------- ITEM INFORMATION ---------- */}
                            <div className="flex-1 text-center sm:text-left">
                              <strong className="block text-base">
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
                                for{" "}
                                {
                                  item
                                    .sparepart
                                    .vehicle_type
                                }
                              </strong>

                              <p className="mt-2">
                                <span className="font-semibold">
                                  Quantity:
                                </span>{" "}
                                {
                                  item.quantity
                                }
                              </p>

                              <p className="mt-1">
                                <span className="font-semibold">
                                  Unit Price:
                                </span>{" "}
                                KES{" "}
                                {item.unit_price?.toLocaleString() ??
                                  "0"}
                              </p>

                              <p className="mt-1">
                                <span className="font-semibold">
                                  Subtotal:
                                </span>{" "}
                                <span className="font-semibold text-red-600">
                                  KES{" "}
                                  {item.subtotal?.toLocaleString() ??
                                    "0"}
                                </span>
                              </p>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
              </div>
            ),
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
              {activeTab ===
                "pending" &&
                "You have no pending orders right now."}

              {activeTab ===
                "shipped" &&
                "Nothing has been shipped yet."}

              {activeTab ===
                "delivered" &&
                "No delivered orders yet."}

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

export default BuyerOrders;