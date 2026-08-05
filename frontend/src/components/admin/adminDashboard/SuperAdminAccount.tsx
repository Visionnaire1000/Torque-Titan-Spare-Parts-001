import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";

const SuperAdminAccount = (): React.JSX.Element => {
  const {
    user,
    sendChangePasswordOtp,
    completeChangePassword,
    resendOtp,
    otpSent,
    otpCountdown,
    deleteAccount,
    changePasswordLoading,
    resendLoading,
    deleteAccountLoading,
  } = useAuth();

  if (!user) {
  return <></>
 }

  // ---------------- Visibility ----------------
  const [showChangePassword, setShowChangePassword] =
    useState<boolean>(false);

  const [showDeletePassword, setShowDeletePassword] =
    useState<boolean>(false);

  // ---------------- Change Password ----------------
  const [step, setStep] =
    useState<number>(1);

  const [currentPassword, setCurrentPassword] =
    useState<string>("");

  const [newPassword, setNewPassword] =
    useState<string>("");

  const [confirmNewPassword, setConfirmNewPassword] =
    useState<string>("");

  const [otp, setOtp] =
    useState<string>("");

  const [passwordError, setPasswordError] =
    useState<string>("");

  const [passwordFocused, setPasswordFocused] =
    useState<boolean>(false);

  // ---------------- Delete Account ----------------
  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState<boolean>(false);

  const [deletePassword, setDeletePassword] =
    useState<string>("");

  // ---------------- Password Validation ----------------
  const passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const allRequirementsMet =
    passwordPattern.test(newPassword);

  const requirementMessage =
    "Password must be at least 8 characters and include one uppercase letter, one number, and one special character.";

  // ---------------- Request OTP ----------------
  const handleRequestOtp = async (
    e: { preventDefault: () => void }
  ): Promise<void> => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
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
  const handleCompleteChangePassword = async (
    e: { preventDefault: () => void }
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
 const handleResendOtp = async (): Promise<void> => {
  if (!user) return;

  await resendOtp(user.email);
};

  // ---------------- Delete Account ----------------
  const handleDeleteAccount =
    (): void => {
      if (!deletePassword) return;

      deleteAccount(deletePassword);
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
        className="relative flex flex-col gap-[14px]"
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
                setCurrentPassword(e.target.value)
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
                setNewPassword(e.target.value)
              }
              onFocus={() =>
                setPasswordFocused(true)
              }
              onBlur={() => {
                if (allRequirementsMet) {
                  setPasswordFocused(false);
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
              Enter the OTP sent to your email
            </p>

            <input
              type="text"
              placeholder="OTP"
              value={otp}
              onChange={(
                e: ChangeEvent<HTMLInputElement>
              ) => setOtp(e.target.value)}
              required
              className="
                w-full
                rounded-[10px]
                border
                border-gray-200
                bg-gray-50
                px-[14px]
                py-3
                pr-[90px]
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
                    Resend OTP in {otpCountdown}s
                  </span>
                )}

              <button
                type="button"
                onClick={handleResendOtp}
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
                  ? "Resending..."
                  : otpCountdown > 0
                  ? `Resend in ${otpCountdown}s`
                  : "Resend OTP"}
              </button>
            </div>
          </>
        )}
    <button
      type="button"
      onClick={() =>
     setShowChangePassword(
      (previous) => !previous
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
    <>
      <EyeOff size={20} />
    </>
   ) : (
    <>
      <Eye size={20} />

    </>
   )}
   </button>

        <button
          type="submit"
          disabled={changePasswordLoading}
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
          onClick={() =>
            setShowDeleteConfirm(true)
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
          <p
            className="
              mb-3
              text-[0.9rem]
              text-[#7f1d1d]
            "
          >
            This action is permanent. Enter your password to continue.
          </p>

          <input
            type={
              showDeletePassword
                ? "text"
                : "password"
            }
            placeholder="Confirm password"
            value={deletePassword}
            onChange={(
              e: ChangeEvent<HTMLInputElement>
            ) =>
              setDeletePassword(
                e.target.value
              )
            }
            className="
              w-full
              rounded-[10px]
              border
              border-gray-200
              bg-gray-50
              px-[14px]
              py-3
              mb-[10px]
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

          <button
            type="button"
            onClick={() =>
              setShowDeletePassword(
                (previous) => !previous
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
            {showDeletePassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

          <div
            className="
              mt-4
              flex
              gap-3
              mb- [40px]
            "
          >
            <button
              type="button"
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
              onClick={handleDeleteAccount}
              disabled={deleteAccountLoading}
            >
              {deleteAccountLoading
                ? "Deleting Account..."
                : "Delete Account"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletePassword("");
              }}
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
        </div>
      )}
    </section>

    {/* ----------------------Link to Admin Management------------------- */}
   
   {user?.role === "super_admin" && (
   <section
     className="
      mt-6
      rounded-xl
      border
      border-gray-200
      bg-gradient-to-br
      from-blue-50
      to-gray-50
      p-5
      text-center
    "
   >
    <h3
      className="
        mb-2
        text-base
        font-semibold
        text-gray-800
      "
    >
      Admin Management
    </h3>

    <p
      className="
        mb-4
        text-sm
        text-gray-500
      "
    >
      Create, manage and remove administrator accounts.
    </p>

    <Link
      to="/admin-management"
      className="
        inline-flex
        items-center
        justify-center
        rounded-full
        bg-[rgb(0,64,128)]
        px-5
        py-2.5
        text-sm
        font-medium
        text-white
        transition-all
        duration-200
        hover:opacity-90
        active:scale-95
      "
    >
      Manage Admin Accounts →
    </Link>
   </section>
   )}
 </div>
 );
};

export default SuperAdminAccount;

