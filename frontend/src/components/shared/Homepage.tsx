import { useAuth } from "../../contexts/AuthContext";
import BuyerHomepage from "../buyer/BuyerHomepage";
import ItemsManagement from "../admin/ItemsManagement";

const Homepage = () => {
  const { user } = useAuth();

  if (user?.role === "admin" || user?.role === "super_admin") return <ItemsManagement />;

  return <BuyerHomepage />;

};

export default Homepage;