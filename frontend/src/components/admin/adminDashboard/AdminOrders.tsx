import { useEffect, useState, useRef, type ReactElement } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import config from "../../../config";
import { useTranslation } from "react-i18next";
import { ChevronUp, ChevronDown, RefreshCw, PackageOpen, Search, X } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled";

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
  sparepart?: SparePart | null;
}

interface CustomerProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  national_id: string;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  profile: CustomerProfile | null;
}

interface AddressDetails {
  id: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

interface Order {
  id: string;
  status: OrderStatus;
  paid: boolean;
  total_quantity: number;
  total_price: number;
  payment_method: string | null;
  address: string;
  address_details: AddressDetails | null;
  created_at: string;
  customer: Customer;
  items: OrderItem[];
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

interface AdminOrdersRestoreState {
  expandedOrderId?: string | null;
  restoreScrollY?: number;
  orderSearch?: string;
}

interface SavedAdminOrdersPosition extends AdminOrdersRestoreState {
  from?: string;
}

const tabs: OrderStatus[] = [
  "pending",
  "shipped",
  "delivered",
  "cancelled",
];

const SkeletonOrderCard = (): ReactElement => (
  <div
    className="
      relative mb-4 overflow-hidden rounded-xl bg-[#f6f7f8] p-4
      after:absolute after:left-[-150%] after:top-0 after:h-full
      after:w-[150%] after:content-['']
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
          className="mt-3 flex gap-3 border-b border-dashed border-[#ddd] py-[5px]"
        >
          <div className="h-[70px] w-[70px] shrink-0 rounded-[10px] bg-[#e0e0e0]" />

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

const ErrorState = ({
  onRetry,
}: ErrorStateProps): ReactElement => {
  const { t } = useTranslation();

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center px-5 text-center animate-[fadeIn_0.3s_ease]">
      <h2 className="mb-2 text-2xl font-semibold text-[#111827]">
        {t("common.somethingWentWrong")}
      </h2>

      <p className="mb-5 max-w-[400px] text-[0.95rem] text-[#6b7280]">
        {t("adminOrders.loadError")}
      </p>

      <button
        type="button"
        onClick={() => void onRetry()}
        className="group inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-[10px] text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#1f2933]"
      >
        <RefreshCw
          size={18}
          className="transition-transform duration-300 group-hover:rotate-90"
        />
        {t("common.retry")}
      </button>
    </div>
  );
};

const normalizeLanguage = (language: string): string =>
  language.trim().toLowerCase().replace(/_/g, "-").split("-")[0] || "en";

const translateOrderStatus = (
  status: OrderStatus,
  t: (key: string) => string
): string => t(`adminOrders.status.${status}`);

const translateProductCategory = (
  value: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string => {
  const normalized = value.trim().toLowerCase();

  const categoryKeys: Record<string, string> = {
    tyre: "productCategories.tyres",
    tyres: "productCategories.tyres",
    tire: "productCategories.tyres",
    tires: "productCategories.tyres",
    rim: "productCategories.rims",
    rims: "productCategories.rims",
    battery: "productCategories.batteries",
    batteries: "productCategories.batteries",
    filter: "productCategories.filters",
    filters: "productCategories.filters",
    "oil filter": "productCategories.oilFilters",
    "oil filters": "productCategories.oilFilters",
    sedan: "productCategories.sedan",
    saloon: "productCategories.sedan",
    suv: "productCategories.suv",
    truck: "productCategories.truck",
    lorry: "productCategories.truck",
    bus: "productCategories.bus",
  };

  const key = categoryKeys[normalized];

  return key ? t(key, { defaultValue: value }) : value;
};

const AdminOrders = (): ReactElement => {
  const { authFetch } = useAuth();
  const { t, i18n } = useTranslation();

  const location = useLocation();
  const navigate = useNavigate();

  const activeLanguage = normalizeLanguage(
    i18n.resolvedLanguage || i18n.language || "en"
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<OrderStatus>("pending");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState<string>("");

  const [confirmation, setConfirmation] = useState<{
    orderId: string;
    newStatus: OrderStatus;
  } | null>(null);

  const [seenOrderIds, setSeenOrderIds] = useState<SeenOrderIds>(() => {
    try {
      const raw = localStorage.getItem("admin_seen_order_ids");
      const stored = raw
        ? (JSON.parse(raw) as Partial<SeenOrderIds>)
        : {};

      return {
        pending: stored.pending ?? [],
        shipped: stored.shipped ?? [],
        delivered: stored.delivered ?? [],
        cancelled: stored.cancelled ?? [],
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

  const prevOrdersRef = useRef<Order[]>([]);
  const restorationAppliedRef = useRef<boolean>(false);
  const restoreScrollYRef = useRef<number | null>(null);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    localStorage.setItem(
      "admin_seen_order_ids",
      JSON.stringify(seenOrderIds)
    );

    window.dispatchEvent(
      new CustomEvent("admin_orders_updated", {
        detail: { type: "seen_update" },
      })
    );
  }, [seenOrderIds]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");

    if (tab && tabs.includes(tab as OrderStatus)) {
      setActiveTab(tab as OrderStatus);
    }
  }, [location.search]);

  const formatOrderTime = (dateString: string): string => {
    if (!dateString) {
      return "";
    }

    const parsedDate = new Date(dateString);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(activeLanguage, {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(parsedDate);
    } catch {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(parsedDate);
    }
  };

  const hasOrdersChanged = (
    oldOrders: Order[],
    newOrders: Order[]
  ): boolean => {
    if (oldOrders.length !== newOrders.length) {
      return true;
    }

    for (let i = 0; i < newOrders.length; i++) {
      if (
        oldOrders[i].id !== newOrders[i].id ||
        oldOrders[i].status !== newOrders[i].status ||
        oldOrders[i].total_quantity !== newOrders[i].total_quantity ||
        oldOrders[i].total_price !== newOrders[i].total_price ||
        oldOrders[i].payment_method !== newOrders[i].payment_method
      ) {
        return true;
      }
    }

    return false;
  };

  const groupedOrders = orders.reduce<
    Partial<Record<OrderStatus, Order[]>>
  >((acc, order) => {
    const rawStatus =
      typeof order.status === "string"
        ? order.status.toLowerCase()
        : "";

    if (!tabs.includes(rawStatus as OrderStatus)) {
      return acc;
    }

    const status = rawStatus as OrderStatus;

    if (!acc[status]) {
      acc[status] = [];
    }

    acc[status]!.push(order);

    return acc;
  }, {});

  Object.keys(groupedOrders).forEach((status) => {
    const orderStatus = status as OrderStatus;

    groupedOrders[orderStatus]?.sort((a, b) => {
      const dateA = a.created_at
        ? new Date(
            a.created_at.endsWith("Z")
              ? a.created_at
              : `${a.created_at}Z`
          ).getTime()
        : 0;

      const dateB = b.created_at
        ? new Date(
            b.created_at.endsWith("Z")
              ? b.created_at
              : `${b.created_at}Z`
          ).getTime()
        : 0;

      return (
        (Number.isFinite(dateB) ? dateB : 0) -
        (Number.isFinite(dateA) ? dateA : 0)
      );
    });
  });

  const visibleOrders = (groupedOrders[activeTab] ?? []).filter((order) =>
    order.id.toLowerCase().startsWith(orderSearch.trim().toLowerCase())
  );

  const fetchOrders = async (silent: boolean = false): Promise<void> => {
    if (!silent) {
      setLoading(true);
    }

    setError("");

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/orders/`
      );

      if (!res.ok) {
        let message = t("adminOrders.fetchFailed");

        try {
          const data = (await res.json()) as ErrorResponse;
          message = data.message || data.error || message;
        } catch {
          // Ignore invalid error response.
        }

        throw new Error(message);
      }

      const data = (await res.json()) as OrdersResponse;

      const newOrders: Order[] = Array.isArray(data.orders)
        ? data.orders.filter(
            (order): order is Order =>
              !!order &&
              typeof order === "object" &&
              typeof order.id === "string"
          )
        : [];

      if (hasOrdersChanged(prevOrdersRef.current, newOrders)) {
        setOrders(newOrders);
        prevOrdersRef.current = newOrders;

        localStorage.setItem(
          "admin_orders_cache",
          JSON.stringify(newOrders)
        );

        window.dispatchEvent(
          new CustomEvent("admin_orders_updated", {
            detail: { type: "data_update" },
          })
        );
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("adminOrders.fetchFailed");

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

  const updateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus
  ): void => {
    setConfirmation({ orderId, newStatus });
  };

  const confirmUpdateOrderStatus = async (): Promise<void> => {
    if (!confirmation) {
      return;
    }

    const { orderId, newStatus } = confirmation;
    setConfirmation(null);

    try {
      const res = await authFetch(
        `${config.API_BASE_URL}/admin/orders/${orderId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = (await res.json()) as ErrorResponse;

      if (!res.ok) {
        throw new Error(
          data.message || data.error || t("adminOrders.updateFailed")
        );
      }

      toast.success(
        t("adminOrders.statusUpdated", {
          orderId,
          status: translateOrderStatus(newStatus, t),
        })
      );

      await fetchOrders(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("adminOrders.updateFailed");

      toast.error(message);
    }
  };

  useEffect(() => {
    void fetchOrders();

    const interval = window.setInterval(() => {
      void fetchOrders(true);
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (loading || restorationAppliedRef.current) {
      return;
    }

    const state = location.state as AdminOrdersRestoreState | null;

    if (!state) {
      return;
    }

    restorationAppliedRef.current = true;

    if (typeof state.orderSearch === "string") {
      setOrderSearch(state.orderSearch);
    }

    if (state.expandedOrderId) {
      setExpandedOrderId(state.expandedOrderId);
    }

    if (typeof state.restoreScrollY === "number") {
      restoreScrollYRef.current = state.restoreScrollY;
    }
  }, [loading, location.state]);

  useEffect(() => {
    const targetScrollY = restoreScrollYRef.current;

    if (
      loading ||
      targetScrollY === null ||
      !restorationAppliedRef.current
    ) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let attempts = 0;
    const maxAttempts = 30;

    const restoreScroll = (): void => {
      if (cancelled) {
        return;
      }

      window.scrollTo({
        top: targetScrollY,
        left: 0,
        behavior: "auto",
      });

      attempts += 1;

      const reachedTarget =
        Math.abs(window.scrollY - targetScrollY) <= 2;

      if (reachedTarget || attempts >= maxAttempts) {
        restoreScrollYRef.current = null;
        return;
      }

      frameId = requestAnimationFrame(restoreScroll);
    };

    frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(restoreScroll);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [loading, expandedOrderId, visibleOrders.length]);

  const handleTabClick = (tab: OrderStatus): void => {
    setActiveTab(tab);

    const ordersInTab = groupedOrders[tab] ?? [];

    setSeenOrderIds((prev) => ({
      ...prev,
      [tab]: ordersInTab.map((order) => order.id),
    }));

    const params = new URLSearchParams(location.search);
    params.set("tab", tab);

    navigate(`${location.pathname}?${params.toString()}`, {
      replace: true,
      state: location.state,
    });
  };

  if (loading) {
    return (
      <div
        className="
          mt-[100px] ml-[140px] mb-[50px] max-w-[900px] p-5 font-sans
          max-[900px]:ml-0 max-[640px]:mt-[80px] max-[640px]:px-4
        "
      >
        <div className="mb-4 flex gap-[10px] border-b-2 border-[#ccc]">
          {tabs.map((tab) => (
            <div
              key={tab}
              className="h-8 w-[90px] rounded-[20px] bg-[#e0e0e0] max-[640px]:flex-1"
            />
          ))}
        </div>

        {[1, 2, 3].map((i) => (
          <SkeletonOrderCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState onRetry={() => fetchOrders()} />;
  }

  if (!orders.length) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          className="
            w-full max-w-[420px] animate-[fadeIn_0.3s_ease-in-out]
            rounded-2xl bg-white px-[30px] py-10 text-center
            shadow-[0_8px_24px_rgba(0,0,0,0.06)]
            max-[640px]:px-5 max-[640px]:py-8
          "
        >
          <PackageOpen
            size={48}
            className="mx-auto mb-4 mt-[80px] text-[#9ca3af]"
          />

          <h2 className="mb-[10px] mt-[40px] text-2xl font-semibold text-[#111827]">
            {t("adminOrders.noOrdersYet")}
          </h2>

          <p className="text-[0.95rem] text-[#6b7280]">
            {t("adminOrders.noCustomerOrders")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        mt-[90px] ml-[140px] mb-[50px] max-w-[900px] p-5 font-sans
        max-[1000px]:ml-[80px]
        max-[768px]:ml-0 max-[768px]:mt-[100px]
        max-[640px]:px-3
      "
    >
      {confirmation && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-status-confirmation"
        >
          <div className="w-full max-w-[330px] rounded-xl bg-white p-6 font-sans shadow-2xl sm:p-7">
            <h2
              id="order-status-confirmation"
              className="text-lg font-semibold text-[#111827] sm:text-xl"
            >
              {confirmation.newStatus === "shipped"
                ? t("adminOrders.confirmShipped")
                : t("adminOrders.confirmDelivered")}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#6b7280]">
              {t("adminOrders.confirmStatusMessage", {
                orderId: confirmation.orderId,
                status: translateOrderStatus(confirmation.newStatus, t),
              })}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-300"
              >
                {t("common.cancel")}
              </button>

              <button
                type="button"
                onClick={confirmUpdateOrderStatus}
                className="rounded-md bg-[#004080] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#003366] hover:shadow-md"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5">
        <label
          htmlFor="order-id-search"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          {t("adminOrders.searchOrders")}
        </label>

        <div className="relative">
          <Search
            size={19}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            id="order-id-search"
            type="text"
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder={t("adminOrders.searchPlaceholder")}
            autoComplete="off"
            className="
              w-full rounded-lg border border-gray-300 bg-white
              py-3 pl-10 pr-11 text-sm outline-none transition
              focus:border-[#004080] focus:ring-2 focus:ring-[#004080]/20
            "
          />

          {orderSearch && (
            <button
              type="button"
              onClick={() => setOrderSearch("")}
              aria-label={t("adminOrders.clearSearch")}
              className="
                absolute right-3 top-1/2 -translate-y-1/2
                rounded p-1 text-gray-500 transition
                hover:bg-gray-100 hover:text-gray-800
              "
            >
              <X size={18} />
            </button>
          )}
        </div>

        {orderSearch.trim() && (
          <p className="mt-2 text-sm text-gray-500">
            {t("adminOrders.matchingOrders", {
              count: visibleOrders.length,
              status: translateOrderStatus(activeTab, t),
            })}
          </p>
        )}
      </div>

      <div className="mb-5 flex border-b-2 border-[#ccc]">
        {tabs.map((tab) => {
          const ordersInTab = groupedOrders[tab] ?? [];
          const seenIds = new Set(seenOrderIds[tab] ?? []);

          const count = ordersInTab.filter(
            (order) => !seenIds.has(order.id)
          ).length;

          const isActive = activeTab === tab;

          return (
            <button
              type="button"
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`
                relative flex-1 cursor-pointer border-b-[3px]
                bg-transparent py-[10px] text-base font-bold
                transition-all duration-300
                max-[640px]:text-[12px] max-[480px]:px-1
                ${
                  isActive
                    ? "border-[#004080] text-[#004080]"
                    : "border-transparent text-inherit hover:text-[#004080]"
                }
              `}
            >
              {translateOrderStatus(tab, t)}

              {count > 0 && (
                <span
                  className="
                    absolute -right-[-54px] -top-1 flex h-[18px]
                    min-w-[18px] items-center justify-center
                    rounded-full bg-red-600 px-1 text-[11px]
                    font-bold text-white shadow-[0_0_0_2px_white]
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

      <div>
        {visibleOrders.length > 0 ? (
          visibleOrders.map((order) => (
            <div
              key={order.id}
              className="
                mb-[15px] rounded-lg border border-[#ddd]
                bg-[#fafafa] p-[15px] transition-shadow duration-300
                hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]
              "
            >
              <div
                onClick={() =>
                  setExpandedOrderId(
                    expandedOrderId === order.id ? null : order.id
                  )
                }
                className="mb-[10px] flex cursor-pointer items-center justify-between gap-3 text-base"
              >
                <div className="min-w-0 break-all">
                  <strong>
                    {t("adminOrders.orderNumber", { orderId: order.id })}
                  </strong>{" "}
                  — {translateOrderStatus(order.status, t).toUpperCase()}
                </div>

                <span className="shrink-0 cursor-pointer font-bold">
                  {expandedOrderId === order.id ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </span>
              </div>

              <div className="space-y-1 text-sm sm:text-base">
                <div>
                  <span className="font-semibold">
                    {t("adminOrders.customer")}:
                  </span>{" "}
                  {order.customer?.name || t("common.notAvailable")}
                </div>

                <div>
                  <span className="font-semibold">
                    {t("adminOrders.email")}:
                  </span>{" "}
                  {order.customer?.email || t("common.notAvailable")}
                </div>

                <div>
                  <span className="font-semibold">
                    {t("adminOrders.phone")}:
                  </span>{" "}
                  {order.customer?.profile?.phone_number ||
                    t("common.notAvailable")}
                </div>

                <div>
                  <span className="font-semibold">
                    {t("adminOrders.nationalId")}:
                  </span>{" "}
                  {order.customer?.profile?.national_id ||
                    t("common.notAvailable")}
                </div>

                <div>
                  {t("adminOrders.totalItems")}: {order.total_quantity}
                </div>

                <div>
                  {t("adminOrders.totalCost")}: KES{" "}
                  {order.total_price?.toLocaleString(activeLanguage)}
                </div>

                <div>
                  <span className="font-semibold">
                    {t("adminOrders.paymentMethod")}:
                  </span>{" "}
                  <span className="font-medium uppercase text-[#004080]">
                    {order.payment_method === "stripe"
                      ? t("adminOrders.paymentMethods.card")
                      : order.payment_method === "mpesa"
                      ? t("adminOrders.paymentMethods.mpesa")
                      : order.payment_method === "airtel"
                      ? t("adminOrders.paymentMethods.airtel")
                      : order.payment_method === "paypal"
                      ? t("adminOrders.paymentMethods.paypal")
                      : order.payment_method || t("common.notAvailable")}
                  </span>
                </div>

                <div className="break-words">
                  {t("adminOrders.shippingAddress")}:{" "}
                  {order.address || t("common.notAvailable")}
                </div>

                <div>
                  {t("adminOrders.createdAt")}:{" "}
                  {formatOrderTime(order.created_at)}
                  <small className="ml-1.5 text-xs opacity-70">
                    ({timeZone})
                  </small>
                </div>
              </div>

              {order.status === "pending" && (
                <div>
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order.id, "shipped")}
                    className="
                      mt-[16px] cursor-pointer rounded-[5px]
                      border-0 bg-[#004080] px-[14px] py-2
                      font-bold text-white transition-all duration-300
                      hover:-translate-y-px hover:bg-[#004080]/60
                      active:translate-y-0 active:bg-[#004080]/60
                      active:text-[#ccc] max-[640px]:w-full
                    "
                  >
                    {t("adminOrders.markShipped")}
                  </button>
                </div>
              )}

              {order.status === "shipped" && (
                <div>
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order.id, "delivered")}
                    className="
                      mt-[16px] cursor-pointer rounded-[5px]
                      border-0 bg-[#004080] px-[14px] py-2
                      font-bold text-white transition-all duration-300
                      hover:-translate-y-px hover:bg-[#004080]/60
                      active:translate-y-0 active:bg-[#004080]/60
                      active:text-[#ccc] max-[640px]:w-full
                    "
                  >
                    {t("adminOrders.markDelivered")}
                  </button>
                </div>
              )}

              {expandedOrderId === order.id &&
                Array.isArray(order.items) &&
                order.items.length > 0 && (
                  <div className="mt-[15px] border-t border-[#eee] pt-[10px]">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="
                          mb-[10px] flex gap-3 border-b
                          border-dashed border-[#ddd] py-[5px]
                          max-[500px]:items-start
                        "
                      >
                        {item.sparepart ? (
                          <Link
                            to={`/items/${item.sparepart.id}`}
                            state={{
                              from: `${location.pathname}${location.search}`,
                              restoreScrollY: window.scrollY,
                              expandedOrderId: order.id,
                              orderSearch,
                            }}
                            onClick={() => {
                              const restoreState: SavedAdminOrdersPosition = {
                                from: `${location.pathname}${location.search}`,
                                restoreScrollY: window.scrollY,
                                expandedOrderId: order.id,
                                orderSearch,
                              };

                              sessionStorage.setItem(
                                `titan_item_restore_${item.sparepart!.id}`,
                                JSON.stringify(restoreState)
                              );
                            }}
                            className="shrink-0"
                          >
                            <img
                              src={item.sparepart.image}
                              alt={item.sparepart.brand || t("adminOrders.sparePart")}
                              className="
                                h-20 w-20 rounded object-cover
                                max-[500px]:h-[70px] max-[500px]:w-[70px]
                              "
                            />
                          </Link>
                        ) : (
                          <div className="h-20 w-20 shrink-0 rounded bg-[#e5e7eb] max-[500px]:h-[70px] max-[500px]:w-[70px]" />
                        )}

                        <div className="min-w-0 flex-1 text-sm">
                          {item.sparepart ? (
                            <strong className="block break-words">
                              {item.sparepart.brand}{" "}
                              {translateProductCategory(
                                item.sparepart.category,
                                t
                              )}{" "}
                              {item.sparepart.vehicle_type
                                ? t("adminOrders.forVehicle", {
                                    vehicle: translateProductCategory(
                                      item.sparepart.vehicle_type,
                                      t
                                    ),
                                  })
                                : ""}
                            </strong>
                          ) : (
                            <strong className="block break-words">
                              {t("adminOrders.sparePartUnavailable")}
                            </strong>
                          )}

                          <p>
                            {t("adminOrders.quantity")}: {item.quantity}
                          </p>

                          <p>
                            {t("adminOrders.unitPrice")}: KES{" "}
                            {item.unit_price?.toLocaleString(activeLanguage)}
                          </p>

                          <p>
                            {t("adminOrders.subtotal")}: KES{" "}
                            {item.subtotal?.toLocaleString(activeLanguage)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))
        ) : (
          <div
            className="
              animate-[fadeIn_0.3s_ease-in-out]
              px-5 py-10 text-center text-[#6b7280]
            "
          >
            <PackageOpen
              size={36}
              className="mx-auto mb-4 text-[#9ca3af]"
            />

            <h3 className="mt-[10px] text-[1.2rem] font-semibold text-[#111827]">
              {orderSearch.trim()
                ? t("adminOrders.noMatchingOrders")
                : t("adminOrders.noStatusOrders", {
                    status: translateOrderStatus(activeTab, t),
                  })}
            </h3>

            <p className="mt-1.5 text-[0.9rem]">
              {orderSearch.trim()
                ? t("adminOrders.noOrdersMatchSearch", {
                    status: translateOrderStatus(activeTab, t),
                    search: orderSearch.trim(),
                  })
                : t(`adminOrders.emptyStatus.${activeTab}`)}
            </p>
          </div>
        )}
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="colored"
      />
    </div>
  );
};

export default AdminOrders;
