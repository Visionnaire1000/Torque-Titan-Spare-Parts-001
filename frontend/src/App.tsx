import { HashRouter as Router, Routes, Route } from "react-router-dom";

//  Toast Container import
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; 

//contexts
import { CartProvider } from "./contexts/CartContext";

//protected routes component
//import RoleProtectedRoutes from "./components/shared/auth/RoleProtectedRoutes"; 

//pages
import Navbar from "./components/shared/layout/Navbar";
import Footer from "./components/shared/layout/Footer";
import Registration from "./components/shared/auth/Registration";
import Login from "./components/shared/auth/Login";


function App() {
  return (
    <CartProvider>
        <Router>
           <Navbar />
           <div className="min-h-screen flex flex-col font-sans">
              <main className="flex-1">
             <Routes>
                <Route path="/register" element={<Registration />} /> 
                <Route path="/login" element={<Login />} /> 
             </Routes>
           <Footer />
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
