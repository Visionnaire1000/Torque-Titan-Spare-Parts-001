import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/accountManagement.css";

const AccountManagement = () => {
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

  // toggling visibility
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  // ------------------ Change password state ------------------
  const [step, setStep] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);

  // ------------------ Delete account state ------------------
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // ------------------ Single regex validation ------------------
  const passwordPattern =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const allRequirementsMet = passwordPattern.test(newPassword);

  const requirementMessage =
    "Password must be at least 8 characters and include one uppercase letter, one number, and one special character.";

  // ------------------ Request OTP ------------------
  const handleRequestOtp = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (!allRequirementsMet) {
      setPasswordError("Password does not meet requirements.");
      return;
    }

    setPasswordError("");
    const success = await sendChangePasswordOtp(currentPassword);
    if (success) setStep(2);
  };

  // ------------------ Verify OTP & Change Password ------------------
  const handleCompleteChangePassword = async (e) => {
    e.preventDefault();
    if (!otp) return;

    const success = await completeChangePassword(currentPassword, newPassword, otp);

    if (success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setOtp("");
      setStep(1);
    }
  };

  // ------------------ Resend OTP ------------------
  const handleResendOtp = async () => {
    await resendOtp();
  };

  // ------------------ Delete account ------------------
  const handleDeleteAccount = () => {
    if (!deletePassword) return;
    deleteAccount(deletePassword);
  };

  return (
    <div className="account-management">
      <h2>Hello {user.display_name}</h2>

      {/* ================= Change Password ================= */}
      <section>
        <h3>Change Password</h3>

        <form
          onSubmit={step === 1 ? handleRequestOtp : handleCompleteChangePassword}
        >
          {step === 1 && (
            <>
              <input
                type={showChangePassword ? "text" : "password"}
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />

              <input
                type={showChangePassword ? "text" : "password"}
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => {
                  if (allRequirementsMet) setPasswordFocused(false);
                }}
                required
              />

              {passwordFocused && !allRequirementsMet && (
                <div className="password-requirements-inline">
                  {requirementMessage}
                </div>
              )}

              <input
                type={showChangePassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
              />
            </>
          )}

          {step === 2 && (
            <>
              <p>Enter the OTP sent to your email</p>
              <input
                type="text"
                placeholder="OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />

              <div className="otp-info">
                {otpSent && otpCountdown > 0 && (
                  <span>Resend OTP in {otpCountdown}s</span>
                )}

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpCountdown > 0 || resendLoading}
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
            onClick={() => setShowChangePassword((p) => !p)}
            className="toggle-password"
          >
            {showChangePassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          <button type="submit" disabled={changePasswordLoading}>
            {changePasswordLoading
              ? step === 1
                ? "Sending OTP..."
                : "Verifying OTP..."
              : step === 1
              ? "Change Password"
              : "Verify OTP"}
          </button>

          {passwordError && <p className="password-error">{passwordError}</p>}
        </form>
      </section>

      {/* ================= Delete Account ================= */}
      <section className="danger-zone">
        <h3>Danger Zone</h3>

        {!showDeleteConfirm ? (
          <button className="danger" onClick={() => setShowDeleteConfirm(true)}>
            Delete Account
          </button>
        ) : (
          <div className="delete-confirm">
            <p>This action is permanent. Enter your password to continue.</p>

            <input
              type={showDeletePassword ? "text" : "password"}
              placeholder="Confirm password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setShowDeletePassword((p) => !p)}
              className="toggle-btn"
            >
              {showDeletePassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>

            <div className="actions">
              <button
                className="danger"
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading}
              >
                {deleteAccountLoading ? "Deleting Account..." : "Delete Account"}
              </button>

              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountManagement;