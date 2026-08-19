import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext';
import { GoogleOAuthProvider } from "@react-oauth/google";
import './main.css'


const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <GoogleOAuthProvider
      clientId={googleClientId}
    >
      <App />
      </GoogleOAuthProvider>
    </AuthProvider>
  </StrictMode>, 
)  
