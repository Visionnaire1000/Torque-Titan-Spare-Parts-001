import { useAuth } from "../../contexts/AuthContext";
import BuyerItemDetails from "../buyer/BuyerItemDetails";
import AdminItemDetails from "../admin/AdminItemDetails";
import LoggedOutItemDetails from "./LoggedOutItemDetails";

const ItemDetails = () => {
  const { user } = useAuth();

  if (!user) return <LoggedOutItemDetails />; // logged-out users
  if (user.role === "admin" || user.role === "super_admin") return <AdminItemDetails />; // admins
  
  return <BuyerItemDetails />; // regular buyers
};

export default ItemDetails;