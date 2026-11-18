import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PaymentCancel = () => {
  const { t } = useTranslation();
  const hasRun = useRef<boolean>(false);

  useEffect(() => {
    if (hasRun.current) return;

    hasRun.current = true;

    toast.error(t("paymentCancel.toastMessage"), {
      autoClose: 3000,
    });
  }, [t]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-5">
      <div
        className="
          w-full
          max-w-[500px]
          text-center
          p-8
          rounded-xl
          bg-white
          shadow-[0_4px_12px_rgba(0,0,0,0.1)]
        "
      >
        <h1 className="mb-3 text-3xl font-bold text-red-600">
          {t("paymentCancel.title")}
        </h1>

        <p className="text-gray-500 leading-relaxed">
          {t("paymentCancel.description")}
        </p>
      </div>
    </div>
  );
};

export default PaymentCancel;