import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, BusFront, CalendarDays, Car, CarFront, ChevronRight,
         Package, RefreshCw, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import config from "../../../config";


type Period = "daily" | "weekly" | "monthly" | "yearly";
type VehicleType = "sedan" | "suv" | "truck" | "bus";
type Category = "tyre" | "rim" | "battery" | "oil filter";

interface Summary {
  parts_sold: number;
  revenue: number;
  orders: number;
}

interface TimelineItem {
  period: string;
  parts_sold: number;
  revenue: number;
}

interface VehicleTypeItem {
  vehicle_type: string;
  parts_sold: number;
  revenue: number;
}

interface CategoryItem {
  category: string;
  parts_sold: number;
  revenue: number;
}

interface BrandItem {
  brand: string;
  parts_sold: number;
  revenue: number;
}

interface BrandTimelineItem {
  period: string;
  brand: string;
  parts_sold: number;
  revenue: number;
}

interface AnalyticsResponse {
  summary: Summary;
  timeline: TimelineItem[];
  vehicle_types: VehicleTypeItem[];
  categories: CategoryItem[];
  brands: BrandItem[];
  all_time_brands: BrandItem[];
  brand_timeline: BrandTimelineItem[];
}

interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  disabled?: boolean;
}

interface DisplayedSelection {
  period: Period;
  vehicleType: VehicleType | null;
  category: Category | null;
}

const normalizeVehicleType = (value: string): VehicleType | null => {
  const normalized = value.toLowerCase().trim();

  return ["sedan", "suv", "truck", "bus"].includes(normalized)
    ? (normalized as VehicleType)
    : null;
};

const normalizeCategory = (value: string): Category | null => {
  const normalized = value.toLowerCase().trim();

  return ["tyre", "rim", "battery", "oil filter"].includes(normalized)
    ? (normalized as Category)
    : null;
};

const formatCurrency = (value: number): string =>
  `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatNumber = (value: number): string =>
  value.toLocaleString("en-KE");

const formatPeriodLabel = (value: string, period: Period): string => {
  if (!value) return "";

  if (period === "yearly") return value.substring(0, 4);

  if (period === "monthly") {
    const date = new Date(`${value}-01T12:00:00`);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-KE", {
          month: "short",
          year: "numeric",
          timeZone: "Africa/Nairobi",
        });
  }

  if (period === "weekly") {
    const date = new Date(`${value}T12:00:00`);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-KE", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Africa/Nairobi",
        });
  }

  const date = new Date(`${value}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        timeZone: "Africa/Nairobi",
      });
};

const getSelectedPeriodLabel = (period: Period): string => {
  const now = new Date();

  if (period === "daily") {
    return now.toLocaleDateString("en-KE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    });
  }

  if (period === "weekly") {
    const start = new Date(now);
    const day = (start.getDay() + 6) % 7;

    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const formatDate = (date: Date) =>
      date.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Nairobi",
      });

    return `${formatDate(start)} – ${formatDate(end)}`;
  }

  if (period === "monthly") {
    return now.toLocaleDateString("en-KE", {
      month: "long",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    });
  }

  return now.toLocaleDateString("en-KE", {
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
};

const getVehicleTypeLabel = (value: string): string => {
  switch (normalizeVehicleType(value)) {
    case "sedan":
      return "Sedan";
    case "suv":
      return "SUV";
    case "truck":
      return "Truck";
    case "bus":
      return "Bus";
    default:
      return value || "Unknown";
  }
};

const getCategoryLabel = (value: string): string => {
  switch (normalizeCategory(value)) {
    case "tyre":
      return "Tyres";
    case "rim":
      return "Rims";
    case "battery":
      return "Batteries";
    case "oil filter":
      return "Oil Filters";
    default:
      return value || "Unknown";
  }
};

const getVehicleIcon = (
  vehicleType: string,
  size = 32
): ReactNode => {
  switch (normalizeVehicleType(vehicleType)) {
    case "sedan":
      return <CarFront size={size} />;
    case "suv":
      return <Car size={size} />;
    case "truck":
      return <Truck size={size} />;
    case "bus":
      return <BusFront size={size} />;
    default:
      return <Car size={size} />;
  }
};

function CustomDropdown({
  label,
  value,
  options,
  onChange,
  icon,
  disabled = false,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <div ref={dropdownRef} className="relative w-full md:w-auto">
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((previous) => !previous);
        }}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-4 py-2.5 text-left text-sm transition md:min-w-[205px] ${
          disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
            : open
              ? "border-blue-600 ring-2 ring-blue-100"
              : "border-gray-300 text-gray-700 hover:border-gray-400"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="flex-shrink-0 text-gray-400">{icon}</span>}
          <span className="truncate">{selectedOption?.label ?? "Select"}</span>
        </span>

        <ChevronRight
          size={17}
          className={`flex-shrink-0 text-gray-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-50 mt-2 w-full min-w-[205px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition ${
                option.value === value
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RevenueAnalytics() {
  const { user, authFetch } = useAuth();

  const [period, setPeriod] = useState<Period>("monthly");
  const [selectedVehicleType, setSelectedVehicleType] =
    useState<VehicleType | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

  const [displayedSelection, setDisplayedSelection] =
    useState<DisplayedSelection>({
      period: "monthly",
      vehicleType: null,
      category: null,
    });

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasAnalyticsRef = useRef(false);

  const periodOptions: DropdownOption[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ];

  useEffect(() => {
    hasAnalyticsRef.current = Boolean(analytics);
  }, [analytics]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      abortControllerRef.current?.abort();
    };
  }, []);

  const fetchAnalytics = useCallback(
    async (
      showRefreshIndicator = false,
      vehicleOverride: VehicleType | null = selectedVehicleType,
      categoryOverride: Category | null = selectedCategory
    ) => {
      if (!user || user.role === "buyer") {
        setLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;

      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (showRefreshIndicator) {
        setRefreshing(true);
      } else if (!hasAnalyticsRef.current) {
        setLoading(true);
      }

      setError("");

      const requestedPeriod = period;
      const requestedVehicle = vehicleOverride;
      const requestedCategory = categoryOverride;

      try {
        const params = new URLSearchParams();
        params.set("period", requestedPeriod);

        if (requestedVehicle) {
          params.set("vehicle_type", requestedVehicle);
        }

        if (requestedCategory) {
          params.set("category", requestedCategory);
        }

        const response = await authFetch(
          `${config.API_BASE_URL}/admin/revenue-analytics/?${params.toString()}`,
          {
            method: "GET",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          let message = "Failed to load analytics.";

          try {
            const errorData = await response.json();

            if (typeof errorData?.detail === "string") {
              message = errorData.detail;
            } else if (typeof errorData?.error === "string") {
              message = errorData.error;
            }
          } catch {
            message = "Failed to load analytics.";
          }

          throw new Error(message);
        }

        const data: AnalyticsResponse = await response.json();

        if (
          requestId !== requestIdRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        const normalizeBrands = (items: unknown): BrandItem[] =>
          Array.isArray(items)
            ? items.map((item: BrandItem) => ({
                brand: String(item?.brand ?? ""),
                parts_sold: Number(item?.parts_sold ?? 0),
                revenue: Number(item?.revenue ?? 0),
              }))
            : [];

        const normalizedData: AnalyticsResponse = {
          summary: {
            parts_sold: Number(data?.summary?.parts_sold ?? 0),
            revenue: Number(data?.summary?.revenue ?? 0),
            orders: Number(data?.summary?.orders ?? 0),
          },
          timeline: Array.isArray(data?.timeline)
            ? data.timeline.map((item) => ({
                period: String(item?.period ?? ""),
                parts_sold: Number(item?.parts_sold ?? 0),
                revenue: Number(item?.revenue ?? 0),
              }))
            : [],
          vehicle_types: Array.isArray(data?.vehicle_types)
            ? data.vehicle_types.map((item) => ({
                vehicle_type: String(item?.vehicle_type ?? ""),
                parts_sold: Number(item?.parts_sold ?? 0),
                revenue: Number(item?.revenue ?? 0),
              }))
            : [],
          categories: Array.isArray(data?.categories)
            ? data.categories.map((item) => ({
                category: String(item?.category ?? ""),
                parts_sold: Number(item?.parts_sold ?? 0),
                revenue: Number(item?.revenue ?? 0),
              }))
            : [],
          brands: normalizeBrands(data?.brands),
          all_time_brands: normalizeBrands(data?.all_time_brands),
          brand_timeline: Array.isArray(data?.brand_timeline)
            ? data.brand_timeline.map((item) => ({
                period: String(item?.period ?? ""),
                brand: String(item?.brand ?? ""),
                parts_sold: Number(item?.parts_sold ?? 0),
                revenue: Number(item?.revenue ?? 0),
              }))
            : [],
        };

        setAnalytics(normalizedData);
        setDisplayedSelection({
          period: requestedPeriod,
          vehicleType: requestedVehicle,
          category: requestedCategory,
        });
      } catch (err) {
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current
        ) {
          return;
        }

        console.error("Failed to fetch analytics:", err);

        setError(
          err instanceof Error ? err.message : "Failed to load analytics."
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [authFetch, period, selectedVehicleType, selectedCategory, user]
  );

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const displayedVehicleType = displayedSelection.vehicleType;
  const displayedCategory = displayedSelection.category;
  const displayedPeriod = displayedSelection.period;

  const maxTimelineRevenue = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.timeline.map((item) => item.revenue) ?? [])
      ),
    [analytics]
  );

  const maxVehicleRevenue = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.vehicle_types.map((item) => item.revenue) ?? [])
      ),
    [analytics]
  );

  const maxCategoryRevenue = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.categories.map((item) => item.revenue) ?? [])
      ),
    [analytics]
  );

  const sortedVehicleTypes = useMemo(
    () =>
      [...(analytics?.vehicle_types ?? [])].sort(
        (a, b) => b.revenue - a.revenue
      ),
    [analytics]
  );

  const sortedCategories = useMemo(
    () =>
      [...(analytics?.categories ?? [])].sort(
        (a, b) => b.revenue - a.revenue
      ),
    [analytics]
  );


  const sortedAllTimeBrands = useMemo(
    () =>
      [...(analytics?.all_time_brands ?? [])].sort(
        (a, b) => b.revenue - a.revenue
      ),
    [analytics]
  );


  const maxAllTimeBrandRevenue = useMemo(
    () => Math.max(0, ...sortedAllTimeBrands.map((item) => item.revenue)),
    [sortedAllTimeBrands]
  );

  const maxBrandTimelineRevenue = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.brand_timeline.map((item) => item.revenue) ?? [])
      ),
    [analytics]
  );

  const handleVehicleSelect = (vehicle: VehicleType) => {
    setSelectedVehicleType(vehicle);
    setSelectedCategory(null);
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const handleBackToVehicles = () => {
    setSelectedVehicleType(null);
    setSelectedCategory(null);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
  };

  if (!user || user.role === "buyer") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Access denied
          </h2>
          <p className="mt-2 text-gray-500">
            You do not have permission to view analytics.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={32} className="animate-spin text-blue-700" />
              <p className="text-gray-500">Loading analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-[90px] min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3">
              <BarChart3 size={26} className="text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Revenue Analytics
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Track sparepart sales performance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchAnalytics(true)}
            disabled={refreshing}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {analytics && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Spareparts Sold
                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {formatNumber(analytics.summary.parts_sold)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-100 p-3">
                    <Package size={22} className="text-blue-700" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <TrendingUp size={14} />
                  <span>Total quantities sold</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Revenue
                    </p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {formatCurrency(analytics.summary.revenue)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-100 p-3">
                    <TrendingUp size={22} className="text-green-700" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Based on matching paid orders
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Orders</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {formatNumber(analytics.summary.orders)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-100 p-3">
                    <ShoppingCart size={22} className="text-purple-700" />
                  </div>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  Matching paid orders
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <CustomDropdown
                label="Period"
                value={period}
                options={periodOptions}
                onChange={(value) => setPeriod(value as Period)}
                icon={<CalendarDays size={17} />}
              />
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Sales Trend
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Revenue and units sold over the selected period.
                </p>
              </div>

              {analytics.timeline.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
                  No sales data available for this period.
                </div>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div
                    className="flex min-w-max items-end gap-3"
                    style={{ minHeight: "280px" }}
                  >
                    {analytics.timeline.map((item, index) => {
                      const revenue = item.revenue;
                      const height =
                        maxTimelineRevenue > 0
                          ? Math.max(
                              (revenue / maxTimelineRevenue) * 190,
                              revenue > 0 ? 8 : 0
                            )
                          : 0;

                      return (
                        <div
                          key={`${item.period}-${index}`}
                          className="flex w-20 flex-shrink-0 flex-col items-center justify-end"
                        >
                          <div className="mb-2 text-center">
                            <p className="text-[11px] font-semibold text-gray-700">
                              {formatCurrency(revenue)}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {formatNumber(item.parts_sold)} sold
                            </p>
                          </div>
                          <div
                            className="w-10 rounded-t-md bg-blue-600"
                            style={{ height: `${height}px` }}
                          />
                          <div className="mt-3 w-full text-center text-[11px] text-gray-500">
                            {formatPeriodLabel(item.period, displayedPeriod)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {!displayedVehicleType && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Vehicle Type Performance
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Select a vehicle type to view its spareparts.
                  </p>
                </div>

                {sortedVehicleTypes.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
                    No vehicle type data available.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {sortedVehicleTypes.map((item, index) => {
                      const vehicle = normalizeVehicleType(item.vehicle_type);
                      if (!vehicle) return null;

                      const percentage =
                        maxVehicleRevenue > 0
                          ? (item.revenue / maxVehicleRevenue) * 100
                          : 0;

                      return (
                        <button
                          type="button"
                          key={`${item.vehicle_type}-${index}`}
                          onClick={() => handleVehicleSelect(vehicle)}
                          className="group cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between">
                            <div className="rounded-xl bg-blue-100 p-4 text-blue-700 transition group-hover:bg-blue-200">
                              {getVehicleIcon(vehicle, 34)}
                            </div>
                            <ChevronRight
                              size={21}
                              className="mt-2 text-gray-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                            />
                          </div>
                          <h3 className="mt-5 text-lg font-bold text-gray-900">
                            {getVehicleTypeLabel(vehicle)}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {formatNumber(item.parts_sold)} spareparts sold
                          </p>
                          <p className="mt-4 text-base font-semibold text-gray-800">
                            {formatCurrency(item.revenue)}
                          </p>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {displayedVehicleType && !displayedCategory && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBackToVehicles}
                      aria-label="Back to vehicle types"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ArrowLeft size={19} />
                    </button>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {getVehicleTypeLabel(displayedVehicleType)}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Select a sparepart category.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                    Vehicle Type
                  </span>
                </div>

                {sortedCategories.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
                    No sparepart categories available for this vehicle.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {sortedCategories.map((item, index) => {
                      const category = normalizeCategory(item.category);
                      if (!category) return null;

                      const percentage =
                        maxCategoryRevenue > 0
                          ? (item.revenue / maxCategoryRevenue) * 100
                          : 0;

                      return (
                        <button
                          type="button"
                          key={`${item.category}-${index}`}
                          onClick={() => handleCategorySelect(category)}
                          className="group cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-6 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-lg font-bold text-gray-900 transition group-hover:text-blue-700">
                              {getCategoryLabel(category)}
                            </h3>
                            <ChevronRight
                              size={21}
                              className="mt-1 flex-shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                            />
                          </div>
                          <p className="mt-3 text-sm text-gray-500">
                            {formatNumber(item.parts_sold)} sold
                          </p>
                          <p className="mt-4 text-base font-semibold text-gray-800">
                            {formatCurrency(item.revenue)}
                          </p>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {displayedVehicleType && displayedCategory && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleBackToCategories}
                      aria-label="Back to sparepart categories"
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ArrowLeft size={19} />
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">
                          {getVehicleTypeLabel(displayedVehicleType)}
                        </span>
                        <ChevronRight size={16} className="text-gray-400" />
                        <h2 className="text-lg font-semibold text-gray-900">
                          {getCategoryLabel(displayedCategory)}
                        </h2>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Brand sales performance for this vehicle and sparepart.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                      {getVehicleTypeLabel(displayedVehicleType)}
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
                      {getCategoryLabel(displayedCategory)}
                    </span>
                  </div>
                </div>

                <BrandComparisonChart
                  title="Total Brand Sales"
                  description="All-time sales from paid orders. This graph is independent of the selected time period."
                  brands={sortedAllTimeBrands}
                  maxRevenue={maxAllTimeBrandRevenue}
                />

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <BrandTimelineComparisonChart
                    title={`Brand Sales — ${
                      displayedPeriod.charAt(0).toUpperCase() +
                      displayedPeriod.slice(1)
                    }`}
                    description="Compare brand revenue and units sold across each date in the selected timeline."
                    items={analytics.brand_timeline}
                    maxRevenue={maxBrandTimelineRevenue}
                    period={displayedPeriod}
                    footerLabel={getSelectedPeriodLabel(displayedPeriod)}
                  />
                </div>
              </div>
            )}

            {(displayedVehicleType || displayedCategory) && (
              <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-blue-700">
                    Current selection:
                  </span>

                  {displayedVehicleType && (
                    <span className="rounded-full bg-white px-3 py-1 font-medium text-blue-700">
                      {getVehicleTypeLabel(displayedVehicleType)}
                    </span>
                  )}

                  {displayedCategory && (
                    <>
                      <ChevronRight size={15} className="text-blue-400" />
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-blue-700">
                        {getCategoryLabel(displayedCategory)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface BrandComparisonChartProps {
  title: string;
  description: string;
  brands: BrandItem[];
  maxRevenue: number;
  footerLabel?: string;
}

function BrandComparisonChart({
  title,
  description,
  brands,
  maxRevenue,
  footerLabel,
}: BrandComparisonChartProps) {
  return (
    <section>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      {brands.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center text-center text-sm text-gray-500">
          No brand sales data available for this comparison.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto pb-4">
            <div className="flex min-w-max items-end justify-start gap-5 px-2 sm:gap-7">
              {brands.map((item, index) => {
                const revenue = Number(item.revenue) || 0;
                const partsSold = Number(item.parts_sold) || 0;

                const barHeight =
                  maxRevenue > 0 && revenue > 0
                    ? Math.max((revenue / maxRevenue) * 220, 12)
                    : 0;

                return (
                  <div
                    key={`${item.brand}-${index}`}
                    className="flex w-24 flex-shrink-0 flex-col items-center"
                  >
                    <div className="mb-2 w-full text-center">
                      <p className="whitespace-nowrap text-xs font-semibold text-gray-700">
                        {formatCurrency(revenue)}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-400">
                        {formatNumber(partsSold)} sold
                      </p>
                    </div>

                    <div className="flex h-[220px] w-full items-end justify-center">
                      <div
                        className="w-12 rounded-t-md bg-blue-600 transition-colors hover:bg-blue-700"
                        style={{ height: `${barHeight}px` }}
                        title={`${item.brand || "Unknown brand"}: ${formatCurrency(revenue)}; ${formatNumber(partsSold)} sold`}
                      />
                    </div>

                    <div className="mt-3 w-full text-center">
                      <p className="break-words text-xs font-semibold text-gray-800">
                        {item.brand || "Unknown brand"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {footerLabel && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs font-medium text-gray-500">
              {footerLabel}
            </p>
          )}
        </>
      )}
    </section>
  );
}


interface BrandTimelineComparisonChartProps {
  title: string;
  description: string;
  items: BrandTimelineItem[];
  maxRevenue: number;
  period: Period;
  footerLabel?: string;
}

function BrandTimelineComparisonChart({
  title,
  description,
  items,
  maxRevenue,
  period,
}: BrandTimelineComparisonChartProps) {
  const chartData = useMemo(() => {
    const grouped = new Map<string, Map<string, BrandTimelineItem>>();

    for (const item of items) {
      if (!item.period) continue;

      const brand = item.brand.trim() || "Unknown brand";

      if (!grouped.has(item.period)) {
        grouped.set(item.period, new Map());
      }

      const brandMap = grouped.get(item.period)!;
      const existing = brandMap.get(brand);

      if (existing) {
        existing.parts_sold += item.parts_sold;
        existing.revenue += item.revenue;
      } else {
        brandMap.set(brand, {
          ...item,
          brand,
        });
      }
    }

    return Array.from(grouped.entries())
      .map(([date, brandMap]) => ({
        date,
        brands: Array.from(brandMap.values())
          .filter((item) => item.revenue > 0 || item.parts_sold > 0)
          .sort((a, b) => b.revenue - a.revenue),
      }))
      .filter((group) => group.brands.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items]);

  return (
    <section>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      {chartData.length === 0 ? (
        <div className="flex min-h-[180px] items-center justify-center text-center text-sm text-gray-500">
          No brand sales data available for this comparison.
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max items-stretch gap-60 px-2">
            {chartData.map((group) => (
              <div
                key={group.date}
                className="flex w-max flex-shrink-0 flex-col"
              >
                <div className="flex min-h-[310px] items-end gap-3 border-b border-gray-200 pb-2">
                  {group.brands.map((item) => {
                    const revenue = Number(item.revenue) || 0;
                    const partsSold = Number(item.parts_sold) || 0;

                    const barHeight =
                      maxRevenue > 0 && revenue > 0
                        ? Math.max((revenue / maxRevenue) * 190, 8)
                        : 0;

                    return (
                      <div
                        key={`${group.date}-${item.brand}`}
                        className="flex w-24 flex-shrink-0 flex-col items-center"
                      >
                        <div className="mb-2 min-h-[42px] w-full text-center">
                          <p className="whitespace-nowrap text-[11px] font-semibold text-gray-700">
                            {formatCurrency(revenue)}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-500">
                            {formatNumber(partsSold)} sold
                          </p>
                        </div>

                        <div className="flex h-[190px] w-full items-end justify-center">
                          <div
                            className="w-10 rounded-t-md bg-blue-600 transition-colors hover:bg-blue-700"
                            style={{ height: `${barHeight}px` }}
                            title={`${item.brand}: ${formatCurrency(revenue)}, ${formatNumber(partsSold)} sold on ${formatPeriodLabel(group.date, period)}`}
                          />
                        </div>

                        <div className="mt-2 min-h-[36px] w-full text-center">
                          <p className="break-words text-[11px] font-medium text-gray-700">
                            {item.brand}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-center text-xs font-semibold text-gray-600">
                  {formatPeriodLabel(group.date, period)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
 }
