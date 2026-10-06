import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

//  Toast Container import
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; 

//contexts
import { CartProvider } from "./contexts/CartContext";

//protected routes component
import RoleProtectedRoutes from "./components/shared/auth/RoleProtectedRoutes"; 

//pages
import Navbar from "./components/shared/layout/Navbar";
import Registration from "./components/shared/auth/Registration";
import Login from "./components/shared/auth/Login";
import ForgotPassword from "./components/shared/auth/ForgotPassword";
import AccountManagement from "./components/shared/auth/AccountManagement"; 
import Homepage from "./components/shared/Homepage";
import Cart from "./components/buyer/Cart";
import SearchBar from "./components/buyer/search/SearchBar"; 
import SearchResults from "./components/buyer/search/SearchResults";
import ItemDetails from "./components/shared/ItemDetails";
import BuyerAddress from "./components/buyer/buyerDashboard/BuyerAddress";
import BuyerOrders from "./components/buyer/buyerDashboard/BuyerOrders";
import BuyerReviews from "./components/buyer/buyerDashboard/BuyerReviews";
import Checkout from "./components/buyer/checkout/Checkout";
import PaymentSuccess from "./components/buyer/checkout/PaymentSuccess"; 
import PaymentCancel from "./components/buyer/checkout/PaymentCancel"; 

// pages(admin)
import AdminReviews from "./components/admin/adminDashboard/AdminReviews";
import AdminOrders from "./components/admin/adminDashboard/AdminOrders";
import RevenueAnalytics from "./components/admin/adminDashboard/RevenueAnalytics";
import AdminManagement from "./components/admin/auth/AdminManagement";


//pages(categories)
import SedanTyres from "./components/buyer/categories/tyres/SedanTyres";
import SUVTyres from "./components/buyer/categories/tyres/SUVTyres";
import TruckTyres from "./components/buyer/categories/tyres/TruckTyres";
import BusTyres from "./components/buyer/categories/tyres/BusTyres";
import SedanRims from "./components/buyer/categories/rims/SedanRims";
import SUVRims from "./components/buyer/categories/rims/SUVRims";
import TruckRims from "./components/buyer/categories/rims/TruckRims";
import BusRims from "./components/buyer/categories/rims/BusRims";
import SedanBatteries from "./components/buyer/categories/batteries/SedanBatteries";
import SUVBatteries from "./components/buyer/categories/batteries/SUVBatteries";
import TruckBatteries from "./components/buyer/categories/batteries/TruckBatteries";
import BusBatteries from "./components/buyer/categories/batteries/BusBatteries";
import SedanFilters from "./components/buyer/categories/filters/SedanFilters";
import SUVFilters from "./components/buyer/categories/filters/SUVFilters";
import TruckFilters from "./components/buyer/categories/filters/TruckFilters";
import BusFilters from "./components/buyer/categories/filters/BusFilters";  


function App() {
  return (
    <CartProvider>
        <Router>
           <Navbar />
           <div>
            <main>
             <Routes>
                <Route path="/register" element={<Registration />} /> 
                <Route path="/login" element={<Login />} /> 
                <Route path="/forgot-password" element={<ForgotPassword />} /> 
                <Route path="/" element={<Homepage />} /> ,
                 <Route 
                  path="/account-management" 
                  element={
                     <RoleProtectedRoutes allowedRoles={['buyer','admin','super_admin']}>
                        <AccountManagement />
                    </RoleProtectedRoutes>
                  } 
               />
                <Route 
                  path="/cart" 
                  element={
                     <RoleProtectedRoutes allowedRoles={['buyer']}>
                        <Cart />
                    </RoleProtectedRoutes>
                  } 
              />
             <Route path="/search" element={<SearchBar />} />
             <Route path="/search-results" element={<SearchResults />} />
             <Route path="/items/:id" element={<ItemDetails />} /> 
             <Route 
               path="/address" 
               element={
                 <RoleProtectedRoutes allowedRoles={['buyer']}>
                   <BuyerAddress />
                 </RoleProtectedRoutes>
               } 
             />
             <Route 
               path="/orders" 
               element={
                 <RoleProtectedRoutes allowedRoles={['buyer']}>
                   <BuyerOrders />
                 </RoleProtectedRoutes>
               } 
             />
             <Route 
               path="/buyer-reviews" 
               element={
                 <RoleProtectedRoutes allowedRoles={['buyer']}>
                   <BuyerReviews />
                 </RoleProtectedRoutes>
               } 
             />
             <Route 
                  path="/checkout" 
                  element={
                     <RoleProtectedRoutes allowedRoles={['buyer']}>
                        <Checkout />
                    </RoleProtectedRoutes>
                  } 
              />
              <Route 
                  path="/payment-success" 
                  element={<PaymentSuccess />}
              />
               <Route 
                  path="/payment-cancel" 
                  element={ <PaymentCancel /> }
              /> 
             
              {/*categories */}
              <Route path="/sedan-tyres" element={<SedanTyres />} />
              <Route path="/suv-tyres" element={<SUVTyres />} />
              <Route path="/truck-tyres" element={<TruckTyres />} />
              <Route path="/bus-tyres" element={<BusTyres />} />
              <Route path="/sedan-rims" element={<SedanRims />} />
              <Route path="/suv-rims" element={<SUVRims />} />
              <Route path="/truck-rims" element={<TruckRims />} />
              <Route path="/bus-rims" element={<BusRims />} />
              <Route path="/sedan-batteries" element={<SedanBatteries />} />
              <Route path="/suv-batteries" element={<SUVBatteries />} />
              <Route path="/truck-batteries" element={<TruckBatteries />} />
              <Route path="/bus-batteries" element={<BusBatteries />} />
              <Route path="/sedan-filters" element={<SedanFilters />} />
              <Route path="/suv-filters" element={<SUVFilters />} />
              <Route path="/truck-filters" element={<TruckFilters />} />
              <Route path="/bus-filters" element={<BusFilters />} />  

              {/*admin/super_admin*/}
              <Route 
                  path="/admin-orders" 
                  element={
                    <RoleProtectedRoutes allowedRoles={['admin','super_admin']}>
                        <AdminOrders />
                    </RoleProtectedRoutes>
                  } 
              />
              <Route 
                  path="/analytics" 
                  element={
                     <RoleProtectedRoutes allowedRoles={['admin','super_admin']}>
                        <RevenueAnalytics />
                    </RoleProtectedRoutes>
                  } 
              />
              <Route 
                  path="/admin-reviews" 
                  element={
                    <RoleProtectedRoutes allowedRoles={['admin','super_admin']}>
                        <AdminReviews />
                    </RoleProtectedRoutes>
                  } 
              />
              <Route 
                  path="/admin-management"
                  element={
                    <RoleProtectedRoutes allowedRoles={['super_admin']}>
                        <AdminManagement />
                    </RoleProtectedRoutes>
                  } 
              />
             </Routes>
            </main>
           </div>
        </Router>
        <ToastContainer
           position="top-right"
           autoClose={2000}
           hideProgressBar={false}
           newestOnTop={false}
           closeOnClick
           pauseOnHover
           draggable
           theme="colored"
        />
    </CartProvider>
    )
}

export default App
