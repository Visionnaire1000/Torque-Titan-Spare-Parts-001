import { useAuth } from "../../../contexts/AuthContext";
import BuyerNavbar from "../../buyer/buyerDashboard/BuyerNavbar";
import AdminNavbar from "../../admin/adminDashboard/AdminNavbar";

const Navbar = () => {
  const { user } = useAuth();

  if (user?.role === "admin" || user?.role === "super_admin") return <AdminNavbar />;


  return <BuyerNavbar />;
};

export default Navbar;