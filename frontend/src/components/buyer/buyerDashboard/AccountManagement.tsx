import { useState, type ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

const AccountManagement = (): React.JSX.Element => {
  const {
    user,
    sendChangePasswordOtp,
    completeChangePassword,
    sendDeleteAccountOtp,
    completeDeleteAccount,
    resendOtp,
    otpSent,
    otpCountdown,
    changePasswordLoading,
    resendLoading,
    deleteAccountLoading,
  } = useAuth();

  if (!user) {
    return <></>;
  }

  // ---------------- Visibility ----------------
  const [
    showChangePassword,
    setShowChangePassword,
  ] = useState<boolean>(false);

  // ---------------- Change Password ----------------
  const [step, setStep] =
    useState<number>(1);

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState<string>("");

  const [
    newPassword,
    setNewPassword,
  ] = useState<string>("");

  const [
    confirmNewPassword,
    setConfirmNewPassword,
  ] = useState<string>("");

  const [otp, setOtp] =
    useState<string>("");

  const [
    passwordError,
    setPasswordError,
  ] = useState<string>("");

  const [
    passwordFocused,
    setPasswordFocused,
  ] = useState<boolean>(false);

  // ---------------- Delete Account ----------------
  const [
    showDeleteConfirm,
    setShowDeleteConfirm,
  ] = useState<boolean>(false);

  const [
    deleteStep,
    setDeleteStep,
  ] = useState<number>(1);

  const [
    deleteOtp,
    setDeleteOtp,
  ] = useState<string>("");

  // ---------------- Password Validation ----------------
  const passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const allRequirementsMet =
    passwordPattern.test(newPassword);

  const requirementMessage =
    "Password must be at least 8 characters and include one uppercase letter, one number, and one special character.";

  // ---------------- Request Change Password OTP ----------------
  const handleRequestOtp = async (
    e: {
      preventDefault: () => void;
    }
  ): Promise<void> => {
    e.preventDefault();

    if (
      newPassword !==
      confirmNewPassword
    ) {
      setPasswordError(
        "New passwords do not match"
      );
      return;
    }

    if (!allRequirementsMet) {
      setPasswordError(
        "Password does not meet requirements."
      );
      return;
    }

    setPasswordError("");

    const success =
      await sendChangePasswordOtp(
        currentPassword
      );

    if (success) {
      setStep(2);
    }
  };

  // ---------------- Complete Password Change ----------------
  const handleCompleteChangePassword =
    async (
      e: {
        preventDefault: () => void;
      }
    ): Promise<void> => {
      e.preventDefault();

      if (!otp) return;

      const success =
        await completeChangePassword(
          currentPassword,
          newPassword,
          otp
        );

      if (success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setOtp("");
        setStep(1);
      }
    };

  // ---------------- Resend OTP ----------------
  const handleResendOtp =
    async (): Promise<void> => {
      if (!user) return;

      await resendOtp(user.email);
    };

  // ---------------- Start Delete Account ----------------
  const handleStartDeleteAccount =
    (): void => {
      setShowDeleteConfirm(true);
      setDeleteStep(1);
      setDeleteOtp("");
    };

  // ---------------- Request Delete Account OTP ----------------
  const handleRequestDeleteOtp =
    async (): Promise<void> => {
      const success =
        await sendDeleteAccountOtp();

      if (success) {
        setDeleteStep(2);
      }
    };

  // ---------------- Complete Delete Account ----------------
  const handleCompleteDeleteAccount =
    async (): Promise<void> => {
      if (!deleteOtp) {
        return;
      }

      const success =
        await completeDeleteAccount(
          deleteOtp
        );

      if (success) {
        setDeleteOtp("");
        setDeleteStep(1);
        setShowDeleteConfirm(false);
      }
    };

  // ---------------- Cancel Delete ----------------
  const handleCancelDelete =
    (): void => {
      setShowDeleteConfirm(false);
      setDeleteStep(1);
      setDeleteOtp("");
    };

  return (
    <div
      className="
        mx-auto
        mt-[50px]
        mb-[40px]
        w-full
        max-w-[520px]
        rounded-2xl
        bg-white
        p-6
        shadow-[0_10px_30px_rgba(0,0,0,0.08)]
        font-sans
        max-[480px]:mt-10
        max-[480px]:max-w-[480px]
      "
    >
      <h2
        className="
          mt-[50px]
          mb-6
          text-[1.6rem]
          font-bold
          text-[rgb(0,64,128)]
        "
      >
        Hello {user.display_name}
      </h2>

      {/* ================= Change Password ================= */}
      <section className="mb-8">
        <h3
          className="
            mt-4
            mb-4
            text-[1.1rem]
            font-semibold
            text-red-600
          "
        >
          Change Password
        </h3>

        <form
          onSubmit={
            step === 1
              ? handleRequestOtp
              : handleCompleteChangePassword
          }
          className="
            relative
            flex
            flex-col
            gap-[14px]
          "
        >
          {step === 1 && (
            <>
              <input
                type={
                  showChangePassword
                    ? "text"
                    : "password"
                }
                placeholder="Current password"
                value={currentPassword}
                onChange={(
                  e: ChangeEvent<HTMLInputElement>
                ) =>
                  setCurrentPassword(
                    e.target.value
                  )
                }
                required
                className="
                  w-full
                  rounded-[10px]
                  border
                  border-gray-200
                  bg-gray-50
                  px-[14px]
                  py-3
                  text-[0.95rem]
                  transition-all
                  duration-200
                  focus:border-indigo-500
                  focus:bg-white
                  focus:outline-none
                  focus:ring-4
                  focus:ring-indigo-500/15
                "
              />

              <input
                type={
                  showChangePassword
                    ? "text"
                    : "password"
                }
                placeholder="New password"
                value={newPassword}
                onChange={(
                  e: ChangeEvent<HTMLInputElement>
                ) =>
                  setNewPassword(
                    e.target.value
                  )
                }
                onFocus={() =>
                  setPasswordFocused(true)
                }
                onBlur={() => {
                  if (
                    allRequirementsMet
                  ) {
                    setPasswordFocused(
                      false
                    );
                  }
                }}
                required
                className="
                  w-full
                  rounded-[10px]
                  border
                  border-gray-200
                  bg-gray-50
                  px-[14px]
                  py-3
                  text-[0.95rem]
                  transition-all
                  duration-200
                  focus:border-indigo-500
                  focus:bg-white
                  focus:outline-none
                  focus:ring-4
                  focus:ring-indigo-500/15
                "
              />

              {passwordFocused &&
                !allRequirementsMet && (
                  <div
                    className="
                      mt-[5px]
                      rounded-[5px]
                      border
                      border-[#f5c2c7]
                      bg-[#f8d7da]
                      px-[10px]
                      py-[5px]
                      text-[0.9rem]
                      font-medium
                      text-[#d9534f]
                    "
                  >
                    {requirementMessage}
                  </div>
                )}

              <input
                type={
                  showChangePassword
                    ? "text"
                    : "password"
                }
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(
                  e: ChangeEvent<HTMLInputElement>
                ) =>
                  setConfirmNewPassword(
                    e.target.value
                  )
                }
                required
                className="
                  w-full
                  rounded-[10px]
                  border
                  border-gray-200
                  bg-gray-50
                  px-[14px]
                  py-3
                  text-[0.95rem]
                  transition-all
                  duration-200
                  focus:border-indigo-500
                  focus:bg-white
                  focus:outline-none
                  focus:ring-4
                  focus:ring-indigo-500/15
                "
              />
            </>
          )}

          {step === 2 && (
            <>
              <p>
                Enter the OTP sent to your
                email
              </p>

              <input
                type="text"
                placeholder="OTP"
                value={otp}
                onChange={(
                  e: ChangeEvent<HTMLInputElement>
                ) =>
                  setOtp(e.target.value)
                }
                required
                className="
                  w-full
                  rounded-[10px]
                  border
                  border-gray-200
                  bg-gray-50
                  px-[14px]
                  py-3
                  text-[0.95rem]
                  transition-all
                  duration-200
                  focus:border-indigo-500
                  focus:bg-white
                  focus:outline-none
                  focus:ring-4
                  focus:ring-indigo-500/15
                "
              />

              <div
                className="
                  mt-2
                  flex
                  items-center
                  gap-4
                  text-[0.9rem]
                "
              >
                {otpSent &&
                  otpCountdown > 0 && (
                    <span
                      className="
                        rounded-md
                        bg-[#ffe6e6]
                        px-2
                        py-1
                        font-bold
                        text-[#e53935]
                      "
                    >
                      Resend OTP in{" "}
                      {otpCountdown}s
                    </span>
                  )}

                <button
                  type="button"
                  onClick={
                    handleResendOtp
                  }
                  disabled={
                    otpCountdown > 0 ||
                    resendLoading
                  }
                  className="
                    rounded-md
                    bg-[#1976d2]
                    px-3
                    py-2
                    font-medium
                    text-white
                    transition-colors
                    duration-200
                    hover:bg-[#115293]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                  "
                >
                  {resendLoading
                    ? "Resending OTP..."
                    : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() =>
              setShowChangePassword(
                (previous) =>
                  !previous
              )
            }
            className="
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-[10px]
              bg-[rgb(0,64,128)]
              px-4
              py-3
              text-[0.95rem]
              font-semibold
              text-white
              transition-colors
              duration-200
              hover:bg-[rgba(0,58,115,0.466)]
            "
          >
            {showChangePassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

          <button
            type="submit"
            disabled={
              changePasswordLoading
            }
            className="
              rounded-[10px]
              bg-[rgb(0,64,128)]
              px-4
              py-3
              text-[0.95rem]
              font-semibold
              text-white
              transition-colors
              duration-200
              hover:bg-[rgba(0,58,115,0.466)]
              disabled:cursor-not-allowed
              disabled:bg-gray-300
            "
          >
            {changePasswordLoading
              ? step === 1
                ? "Sending OTP..."
                : "Verifying OTP..."
              : step === 1
              ? "Change Password"
              : "Verify OTP"}
          </button>

          {passwordError && (
            <p
              className="
                -mt-[6px]
                mb-[6px]
                text-[0.85rem]
                text-[#b91c1c]
              "
            >
              {passwordError}
            </p>
          )}
        </form>
      </section>

      {/* ================= Delete Account ================= */}
      <section
        className="
          border-t
          border-gray-200
          pt-6
        "
      >
        <h3
          className="
            mb-4
            text-[1.1rem]
            font-semibold
            text-[#b91c1c]
          "
        >
          Danger Zone
        </h3>

        {!showDeleteConfirm ? (
          <button
            type="button"
            className="
              rounded-[10px]
              bg-[#dc2626]
              px-4
              py-3
              text-[0.95rem]
              font-semibold
              text-white
              transition-colors
              duration-200
              hover:bg-[#b91c1c]
            "
            onClick={
              handleStartDeleteAccount
            }
          >
            Delete Account
          </button>
        ) : (
          <div
            className="
              relative
              mt-4
              rounded-xl
              border
              border-[#fecaca]
              bg-[#fef2f2]
              p-4
            "
          >
            {/* ================= Confirmation Step ================= */}
            {deleteStep === 1 && (
              <>
                <div className="mb-5">
                  <h4
                    className="
                      mb-2
                      text-[1rem]
                      font-bold
                      text-[#991b1b]
                    "
                  >
                    Are you sure you want to
                    delete your account?
                  </h4>

                  <p
                    className="
                      text-[0.9rem]
                      leading-relaxed
                      text-[#7f1d1d]
                    "
                  >
                    This action is permanent
                    and cannot be undone. Your
                    account and associated data
                    will be deleted.
                  </p>
                </div>

                <div
                  className="
                    flex
                    gap-3
                  "
                >
                  <button
                    type="button"
                    onClick={
                      handleRequestDeleteOtp
                    }
                    disabled={
                      deleteAccountLoading
                    }
                    className="
                      flex-1
                      rounded-[10px]
                      bg-[#dc2626]
                      px-4
                      py-3
                      text-[0.95rem]
                      font-semibold
                      text-white
                      transition-colors
                      duration-200
                      hover:bg-[#b91c1c]
                      disabled:cursor-not-allowed
                      disabled:bg-gray-300
                    "
                  >
                    {deleteAccountLoading
                      ? "Sending OTP..."
                      : "Yes, Continue"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleCancelDelete
                    }
                    className="
                      flex-1
                      rounded-[10px]
                      bg-gray-200
                      px-4
                      py-3
                      text-[0.95rem]
                      font-semibold
                      text-gray-900
                      transition-colors
                      duration-200
                      hover:bg-gray-300
                    "
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* ================= OTP Step ================= */}
            {deleteStep === 2 && (
              <>
                <h4
                  className="
                    mb-2
                    text-[1rem]
                    font-bold
                    text-[#991b1b]
                  "
                >
                  Confirm Account Deletion
                </h4>

                <p
                  className="
                    mb-3
                    text-[0.9rem]
                    text-[#7f1d1d]
                  "
                >
                  Enter the OTP sent to your
                  email to permanently delete
                  your account.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter OTP"
                  value={deleteOtp}
                  onChange={(
                    e: ChangeEvent<HTMLInputElement>
                  ) =>
                    setDeleteOtp(
                      e.target.value
                    )
                  }
                  required
                  className="
                    w-full
                    rounded-[10px]
                    border
                    border-gray-200
                    bg-gray-50
                    px-[14px]
                    py-3
                    text-[0.95rem]
                    transition-all
                    duration-200
                    focus:border-indigo-500
                    focus:bg-white
                    focus:outline-none
                    focus:ring-4
                    focus:ring-indigo-500/15
                  "
                />

                <div
                  className="
                    mt-3
                    flex
                    items-center
                    gap-3
                    text-[0.9rem]
                  "
                >
                  {otpSent &&
                    otpCountdown > 0 && (
                      <span
                        className="
                          rounded-md
                          bg-[#ffe6e6]
                          px-2
                          py-1
                          font-bold
                          text-[#e53935]
                        "
                      >
                        Resend OTP in{" "}
                        {otpCountdown}s
                      </span>
                    )}

                  <button
                    type="button"
                    onClick={
                      handleResendOtp
                    }
                    disabled={
                      otpCountdown > 0 ||
                      resendLoading
                    }
                    className="
                      rounded-md
                      bg-[#1976d2]
                      px-3
                      py-2
                      font-medium
                      text-white
                      transition-colors
                      duration-200
                      hover:bg-[#115293]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {resendLoading
                      ? "Resending OTP..."
                      : "Resend OTP"}
                  </button>
                </div>

                <div
                  className="
                    mt-4
                    flex
                    gap-3
                  "
                >
                  <button
                    type="button"
                    onClick={
                      handleCompleteDeleteAccount
                    }
                    disabled={
                      deleteAccountLoading ||
                      !deleteOtp
                    }
                    className="
                      flex-1
                      rounded-[10px]
                      bg-[#dc2626]
                      px-4
                      py-3
                      text-[0.95rem]
                      font-semibold
                      text-white
                      transition-colors
                      duration-200
                      hover:bg-[#b91c1c]
                      disabled:cursor-not-allowed
                      disabled:bg-gray-300
                    "
                  >
                    {deleteAccountLoading
                      ? "Deleting Account..."
                      : "Permanently Delete"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleCancelDelete
                    }
                    className="
                      flex-1
                      rounded-[10px]
                      bg-gray-200
                      px-4
                      py-3
                      text-[0.95rem]
                      font-semibold
                      text-gray-900
                      transition-colors
                      duration-200
                      hover:bg-gray-300
                    "
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountManagement;