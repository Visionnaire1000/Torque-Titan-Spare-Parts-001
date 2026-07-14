import { HashRouter as Router, Routes } from "react-router-dom";

//  Toast Container import
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; 

//contexts
import { CartProvider } from "./contexts/CartContext";

//pages
import Navbar from "./components/shared/layout/Navbar";
import Footer from "./components/shared/layout/Footer";


function App() {
  return (
    <CartProvider>
        <Router>
           <Navbar />
             <Routes>
             </Routes>
           <Footer />
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
