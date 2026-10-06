import { useEffect, useState, type ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import PhoneInput, { isValidPhoneNumber, type Value } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useAuth } from "../../../contexts/AuthContext";


const inputClassName = `
  w-full
  rounded-[10px]
  border
  border-gray-200
  bg-gray-50
  px-[14px]
  py-3
  text-[0.95rem]
  outline-none
  transition-all
  duration-200
  focus:border-[rgb(0,64,128)]
  focus:bg-white
  focus:ring-4
  focus:ring-[rgb(0,64,128)]/10
`;

const readOnlyInputClassName = `
  w-full
  rounded-[10px]
  border
  border-gray-200
  bg-gray-100
  px-[14px]
  py-3
  text-[0.95rem]
  text-gray-700
  outline-none
`;

const labelClassName = `
  mb-1
  block
  text-[0.85rem]
  font-semibold
  text-gray-600
`;

const AccountManagement = (): React.JSX.Element => {
  const {
    user,
    logout,
    updateProfile,
    sendChangePasswordOtp,
    completeChangePassword,
    sendDeleteAccountOtp,
    completeDeleteAccount,
    resendOtp,
    otpSent,
    otpCountdowns,
    changePasswordLoading,
    resendLoading,
    deleteAccountLoading,
  } = useAuth();

  const isBuyer = user?.role === "buyer";
  const isSuperAdmin = user?.role === "super_admin";
  const isGoogleOAuth = user?.auth_provider === "google";
  const hasProfile = Boolean(user?.profile);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<Value | undefined>(
    undefined
  );
  const [editingPhone, setEditingPhone] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changePasswordStep, setChangePasswordStep] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordOtp, setChangePasswordOtp] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteOtp, setDeleteOtp] = useState("");

  const nationalIdPattern =
    /^[A-Za-z0-9][A-Za-z0-9\s\-/]{3,49}$/;

  const passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const requirementMessage =
    "Password must be at least 8 characters and include one uppercase letter, one number, and one special character.";

  const allRequirementsMet = passwordPattern.test(newPassword);

  const changePasswordCountdown =
    otpCountdowns.change_password;

  const deleteAccountCountdown =
    otpCountdowns.delete_account;

  const normalizedPhone = phoneNumber?.trim() ?? "";

  const validPhone =
    Boolean(normalizedPhone) &&
    isValidPhoneNumber(normalizedPhone);

  const validNationalId =
    nationalIdPattern.test(nationalId.trim());

  useEffect(() => {
    if (!user) {
      return;
    }

    setFirstName(user.profile?.first_name ?? "");
    setLastName(user.profile?.last_name ?? "");
    setPhoneNumber(user.profile?.phone_number ?? undefined);
    setNationalId(user.profile?.national_id ?? "");
    setEditingPhone(false);
    setProfileError("");
  }, [user]);

  const handleUpdateProfile = async (): Promise<void> => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedNationalId = nationalId.trim();

    setProfileError("");

    if (!hasProfile) {
      if (
        !trimmedFirstName ||
        !trimmedLastName ||
        !normalizedPhone ||
        !trimmedNationalId
      ) {
        setProfileError("Please fill in all profile fields.");
        return;
      }

      if (!isValidPhoneNumber(normalizedPhone)) {
        setProfileError("Please enter a valid phone number.");
        return;
      }

      if (!nationalIdPattern.test(trimmedNationalId)) {
        setProfileError(
          "National ID must be 4 to 50 characters and contain only letters, numbers, spaces, hyphens, or slashes."
        );
        return;
      }
    } else {
      if (!normalizedPhone) {
        setProfileError("Phone number is required.");
        return;
      }

      if (!isValidPhoneNumber(normalizedPhone)) {
        setProfileError("Please enter a valid phone number.");
        return;
      }
    }

    setProfileLoading(true);

    try {
      const success = hasProfile
        ? await updateProfile({
            phone_number: normalizedPhone,
          })
        : await updateProfile({
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            phone_number: normalizedPhone,
            national_id: trimmedNationalId,
          });

      if (success) {
        setEditingPhone(false);
        setProfileError("");
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCancelPhoneEdit = (): void => {
    setPhoneNumber(user?.profile?.phone_number ?? undefined);
    setProfileError("");
    setEditingPhone(false);
  };

  const handleRequestChangePasswordOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    setPasswordError("");

    if (!currentPassword.trim()) {
      setPasswordError("Current password is required.");
      return;
    }

    if (!newPassword.trim()) {
      setPasswordError("New password is required.");
      return;
    }

    if (!allRequirementsMet) {
      setPasswordError(
        "Password must be at least 8 characters and include one uppercase letter, one number, and one special character."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError(
        "New password must be different from your current password."
      );
      return;
    }

    const success = await sendChangePasswordOtp(
      currentPassword,
      newPassword
    );

    if (success) {
      setChangePasswordOtp("");
      setPasswordError("");
      setPasswordFocused(false);
      setChangePasswordStep(2);
    }
  };

  const handleVerifyChangePasswordOtp = async (
    e: React.SyntheticEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    setPasswordError("");

    const trimmedOtp = changePasswordOtp.trim();

    if (!trimmedOtp) {
      setPasswordError("OTP is required.");
      return;
    }

    if (trimmedOtp.length !== 6) {
      setPasswordError("Please enter the 6-digit OTP.");
      return;
    }

    const success = await completeChangePassword(
      trimmedOtp,
      newPassword
    );

    if (success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setChangePasswordOtp("");
      setChangePasswordStep(1);
      setPasswordError("");
      setPasswordFocused(false);
      setShowChangePassword(false);

      await logout();
    }
  };

  const handleResendChangePasswordOtp =
    async (): Promise<void> => {
      if (changePasswordCountdown > 0 || resendLoading) {
        return;
      }

      setPasswordError("");

      await resendOtp(null, "change_password");
    };

  const handleCancelChangePassword = (): void => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setChangePasswordOtp("");
    setChangePasswordStep(1);
    setPasswordError("");
    setPasswordFocused(false);
    setShowChangePassword(false);
  };

  const handleRequestDeleteOtp = async (): Promise<void> => {
    const success = await sendDeleteAccountOtp();

    if (success) {
      setDeleteStep(2);
    }
  };

  const handleResendDeleteAccountOtp =
    async (): Promise<void> => {
      if (deleteAccountCountdown > 0 || resendLoading) {
        return;
      }

      await resendOtp(null, "delete_account");
    };

  const handleStartDeleteAccount = (): void => {
    setShowDeleteConfirm(true);
    setDeleteStep(1);
    setDeleteOtp("");
  };

  const handleCompleteDeleteAccount =
    async (): Promise<void> => {
      if (!deleteOtp) {
        return;
      }

      const success = await completeDeleteAccount(deleteOtp);

      if (success) {
        setDeleteOtp("");
        setDeleteStep(1);
        setShowDeleteConfirm(false);

        await logout();
      }
    };

  const handleCancelDelete = (): void => {
    setShowDeleteConfirm(false);
    setDeleteStep(1);
    setDeleteOtp("");
  };

  const handlePhoneChange = (value: Value | undefined): void => {
    setPhoneNumber(value);
    setProfileError("");
  };

  const handleOtpChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ): void => {
    setter(e.target.value.replace(/\D/g, "").slice(0, 6));
  };

  if (!user) {
    return <></>;
  }

  return (
    <div
      className="
        mx-auto
        mt-[80px]
        mb-[40px]
        w-full
        max-w-[520px]
        rounded-2xl
        bg-white
        p-6
        font-sans
        shadow-[0_10px_30px_rgba(0,0,0,0.08)]
        max-[480px]:max-w-[480px]
      "
    >
      {isBuyer && (
        <section className="mb-8">
          <h2
            className="
              mb-5
              text-[1.6rem]
              font-bold
              text-[rgb(0,64,128)]
            "
          >
            My Profile
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClassName}>
                First Name
              </label>

              <input
                type="text"
                value={firstName}
                readOnly={hasProfile}
                onChange={(e) => setFirstName(e.target.value)}
                className={
                  hasProfile
                    ? readOnlyInputClassName
                    : inputClassName
                }
              />
            </div>

            <div>
              <label className={labelClassName}>
                Last Name
              </label>

              <input
                type="text"
                value={lastName}
                readOnly={hasProfile}
                onChange={(e) => setLastName(e.target.value)}
                className={
                  hasProfile
                    ? readOnlyInputClassName
                    : inputClassName
                }
              />
            </div>

            <div>
              <label className={labelClassName}>
                Email
              </label>

              <input
                type="email"
                value={user.email}
                readOnly
                className={readOnlyInputClassName}
              />
            </div>

            <div>
              <label className={labelClassName}>
                National ID
              </label>

              <input
                type="text"
                value={nationalId}
                readOnly={hasProfile}
                onChange={(e) => {
                  setNationalId(e.target.value);
                  setProfileError("");
                }}
                className={
                  hasProfile
                    ? readOnlyInputClassName
                    : `${
                        validNationalId || !nationalId
                          ? inputClassName
                          : `
                              ${inputClassName}
                              border-red-500
                              bg-red-50
                              focus:border-red-500
                              focus:ring-red-500/10
                            `
                      }`
                }
              />
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-[430px]">
                <label
                  className="
                    mb-2
                    block
                    text-center
                    text-[0.85rem]
                    font-semibold
                    text-gray-600
                  "
                >
                  Phone Number
                </label>

                <div
                  className={`mx-auto w-full overflow-visible rounded-[10px] border transition-all duration-200 ${
                    hasProfile && !editingPhone
                      ? "border-gray-200 bg-gray-100"
                      : normalizedPhone && !validPhone
                      ? "border-red-500 bg-red-50 focus-within:ring-4 focus-within:ring-red-500/10"
                      : "border-gray-200 bg-gray-50 focus-within:border-[rgb(0,64,128)] focus-within:bg-white focus-within:ring-4 focus-within:ring-[rgb(0,64,128)]/10"
                  }`}
                >
                  <PhoneInput
                    international
                    defaultCountry="KE"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    disabled={hasProfile && !editingPhone}
                    className="
                      !flex
                      !w-full
                      !items-center
                      !border-0
                      !bg-transparent
                      [&_.PhoneInputCountry]:!m-0
                      [&_.PhoneInputCountry]:!flex
                      [&_.PhoneInputCountry]:!items-center
                      [&_.PhoneInputCountry]:!gap-1
                      [&_.PhoneInputCountry]:!border-0
                      [&_.PhoneInputCountry]:!border-r
                      [&_.PhoneInputCountry]:!border-solid
                      [&_.PhoneInputCountry]:!border-gray-200
                      [&_.PhoneInputCountry]:!px-2.5
                      [&_.PhoneInputCountrySelect]:!cursor-pointer
                      [&_.PhoneInputCountrySelect]:!border-0
                      [&_.PhoneInputCountrySelect]:!bg-transparent
                      [&_.PhoneInputCountrySelect]:!outline-none
                      [&_.PhoneInputCountryIcon]:!m-0
                      [&_.PhoneInputCountryIcon]:!h-[16px]
                      [&_.PhoneInputCountryIcon]:!w-[22px]
                      [&_.PhoneInputCountryIcon]:!shadow-none
                      [&_.PhoneInputCountryIconImg]:!block
                      [&_.PhoneInputCountryIconImg]:!h-full
                      [&_.PhoneInputCountryIconImg]:!w-full
                      [&_.PhoneInputCountryIconImg]:!object-cover
                      [&_.PhoneInputCountrySelectArrow]:!m-0
                      [&_.PhoneInputCountrySelectArrow]:!ml-0.5
                      [&_.PhoneInputCountrySelectArrow]:!h-1.5
                      [&_.PhoneInputCountrySelectArrow]:!w-1.5
                      [&_.PhoneInputCountrySelectArrow]:!border-gray-500
                      [&_.PhoneInputInput]:!min-w-0
                      [&_.PhoneInputInput]:!w-full
                      [&_.PhoneInputInput]:!flex-1
                      [&_.PhoneInputInput]:!border-0
                      [&_.PhoneInputInput]:!bg-transparent
                      [&_.PhoneInputInput]:!px-3
                      [&_.PhoneInputInput]:!py-3
                      [&_.PhoneInputInput]:!text-[0.95rem]
                      [&_.PhoneInputInput]:!text-gray-700
                      [&_.PhoneInputInput]:!outline-none
                      [&_.PhoneInputInput]:!shadow-none
                      [&_.PhoneInputInput]:!ring-0
                    "
                  />
                </div>

                {normalizedPhone && !validPhone && (
                  <p className="mt-1.5 text-center text-[0.8rem] font-medium text-red-600">
                    Please enter a valid international phone number.
                  </p>
                )}

                {hasProfile && !editingPhone && (
                  <p className="mt-1.5 text-center text-[0.75rem] text-gray-500">
                    Click “Edit Phone Number” to change your number.
                  </p>
                )}
              </div>
            </div>

            {profileError && (
              <p className="text-center text-[0.85rem] text-red-600">
                {profileError}
              </p>
            )}

            {!hasProfile && (
              <button
                type="button"
                onClick={handleUpdateProfile}
                disabled={profileLoading}
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
                  hover:bg-[rgb(0,58,115)]
                  disabled:cursor-not-allowed
                  disabled:bg-gray-300
                "
              >
                {profileLoading
                  ? "Saving Profile..."
                  : "Save Profile"}
              </button>
            )}

            {hasProfile && !editingPhone && (
              <button
                type="button"
                onClick={() => {
                  setEditingPhone(true);
                  setProfileError("");
                }}
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
                  hover:bg-[rgb(0,58,115)]
                "
              >
                Edit Phone Number
              </button>
            )}

            {hasProfile && editingPhone && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleUpdateProfile}
                  disabled={profileLoading || !validPhone}
                  className="
                    flex-1
                    rounded-[10px]
                    bg-[rgb(0,64,128)]
                    px-4
                    py-3
                    text-[0.95rem]
                    font-semibold
                    text-white
                    transition-colors
                    duration-200
                    hover:bg-[rgb(0,58,115)]
                    disabled:cursor-not-allowed
                    disabled:bg-gray-300
                  "
                >
                  {profileLoading
                    ? "Saving..."
                    : "Save Phone Number"}
                </button>

                <button
                  type="button"
                  onClick={handleCancelPhoneEdit}
                  disabled={profileLoading}
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
                    disabled:cursor-not-allowed
                  "
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {!isBuyer && (
        <h2
          className="
            mb-3
            text-[1.5rem]
            font-bold
            text-[rgb(0,64,128)]
          "
        >
          Hello {user.display_name}
        </h2>
      )}

      {!isGoogleOAuth && (
        <section
          className="
            mb-8
            border-t
            border-gray-200
            pt-6
          "
        >
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

          {changePasswordStep === 1 ? (
            <form
              onSubmit={handleRequestChangePasswordOtp}
              className="flex flex-col gap-[14px]"
            >
              <input
                type={showChangePassword ? "text" : "password"}
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError("");
                }}
                required
                className={inputClassName}
              />

              <input
                type={showChangePassword ? "text" : "password"}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordError("");
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => {
                  if (allRequirementsMet) {
                    setPasswordFocused(false);
                  }
                }}
                required
                className={inputClassName}
              />

              {passwordFocused && !allRequirementsMet && (
                <div
                  className="
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
                type={showChangePassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => {
                  setConfirmNewPassword(e.target.value);
                  setPasswordError("");
                }}
                required
                className={inputClassName}
              />

              {passwordError && (
                <p className="text-[0.85rem] text-[#b91c1c]">
                  {passwordError}
                </p>
              )}

              <button
                type="button"
                onClick={() =>
                  setShowChangePassword((previous) => !previous)
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
                  hover:bg-[rgb(0,58,115)]
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
                  cursor-pointer
                  rounded-[10px]
                  bg-[rgb(0,64,128)]
                  px-4
                  py-3
                  text-[0.95rem]
                  font-semibold
                  text-white
                  transition-colors
                  duration-200
                  hover:bg-[rgb(0,58,115)]
                  disabled:cursor-not-allowed
                  disabled:bg-gray-300
                "
              >
                {changePasswordLoading
                  ? "Sending OTP..."
                  : "Send OTP"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleVerifyChangePasswordOtp}
              className="flex flex-col gap-[14px]"
            >
              <div
                className="
                  rounded-xl
                  border
                  border-blue-100
                  bg-blue-50
                  p-4
                "
              >
                <h4
                  className="
                    mb-1
                    text-[1rem]
                    font-semibold
                    text-[rgb(0,64,128)]
                  "
                >
                  Verify Your Password Change
                </h4>

                <p className="text-[0.9rem] leading-relaxed text-gray-600">
                  We sent a 6-digit OTP to your email. Enter it below
                  to complete your password change.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Enter OTP"
                value={changePasswordOtp}
                onChange={(e) =>
                  handleOtpChange(e, setChangePasswordOtp)
                }
                required
                autoFocus
                className={inputClassName}
              />

              {passwordError && (
                <p className="text-[0.85rem] text-[#b91c1c]">
                  {passwordError}
                </p>
              )}

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-3
                  text-[0.9rem]
                "
              >
                {otpSent && changePasswordCountdown > 0 && (
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
                    Resend OTP in {changePasswordCountdown}s
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResendChangePasswordOtp}
                  disabled={
                    changePasswordCountdown > 0 ||
                    resendLoading
                  }
                  className="
                    cursor-pointer
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

              <button
                type="submit"
                disabled={
                  changePasswordLoading ||
                  changePasswordOtp.length !== 6
                }
                className="
                  cursor-pointer
                  rounded-[10px]
                  bg-[rgb(0,64,128)]
                  px-4
                  py-3
                  text-[0.95rem]
                  font-semibold
                  text-white
                  transition-colors
                  duration-200
                  hover:bg-[rgb(0,58,115)]
                  disabled:cursor-not-allowed
                  disabled:bg-gray-300
                "
              >
                {changePasswordLoading
                  ? "Verifying OTP..."
                  : "Verify OTP"}
              </button>

              <button
                type="button"
                onClick={handleCancelChangePassword}
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
                  hover:bg-[rgb(0,58,115)]
                  cursor-pointer
                  disabled:cursor-not-allowed
                "
              >
                Cancel
              </button>
            </form>
          )}
        </section>
      )}

      <section className="border-t border-gray-200 pt-6">
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
            onClick={handleStartDeleteAccount}
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
                    Are you sure you want to delete your account?
                  </h4>

                  <p
                    className="
                      text-[0.9rem]
                      leading-relaxed
                      text-[#7f1d1d]
                    "
                  >
                    This action is permanent and cannot be undone.
                    Your account and associated data will be deleted.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRequestDeleteOtp}
                    disabled={deleteAccountLoading}
                    className="
                      flex-1
                      cursor-pointer
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
                    onClick={handleCancelDelete}
                    className="
                      flex-1
                      cursor-pointer
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
                  Enter the OTP sent to your email to permanently
                  delete your account.
                </p>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Enter OTP"
                  value={deleteOtp}
                  onChange={(e) =>
                    handleOtpChange(e, setDeleteOtp)
                  }
                  required
                  className={inputClassName}
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
                  {otpSent && deleteAccountCountdown > 0 && (
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
                      Resend OTP in {deleteAccountCountdown}s
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleResendDeleteAccountOtp}
                    disabled={
                      deleteAccountCountdown > 0 ||
                      resendLoading
                    }
                    className="
                      cursor-pointer
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

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={handleCompleteDeleteAccount}
                    disabled={
                      deleteAccountLoading || !deleteOtp
                    }
                    className="
                      flex-1
                      cursor-pointer
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
                    onClick={handleCancelDelete}
                    className="
                      flex-1
                      cursor-pointer
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

      {isSuperAdmin && (
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

          <Link
            to="/admin-management"
            className="
              inline-flex
              cursor-pointer
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

export default AccountManagement;