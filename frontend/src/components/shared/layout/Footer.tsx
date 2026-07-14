import "../../../styles/shared/footer.css";
import { FaInstagram, FaFacebook } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="columns">
        <div className="socials">
          <p>Social Media</p>

          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaInstagram size={24} />
          </a>

          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaFacebook size={24} />
          </a>
        </div>

        <div className="contacts">
          <h5>Contact</h5>
          <li>Email: customerservice@torquetitanspares.com</li>
          <li>Phone: +254 123 458399</li>
        </div>

        <div className="policies">
          <p>Privacy Policy</p>
          <p>About Us</p>
          <p>Cookies</p>
          <p>Terms of Service</p>
        </div>
      </div>

      <div className="bottomBar">
        <p>
          &copy; {new Date().getFullYear()} Torque Titan Spare Parts. All
          rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;