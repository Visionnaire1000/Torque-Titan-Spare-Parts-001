import { FaInstagram, FaFacebook } from "react-icons/fa";

const Footer = () => {
  return (
    <footer
      className="
        flex justify-between items-start
        bg-[rgb(0,64,128)]
        px-6 py-[0.8rem]
        text-white
        z-[1000]
        box-border
        transition-transform duration-300 ease-in-out
        translate-y-full
        bottom-0
        -mx-5
        max-[480px]:min-w-[100vw]
        max-[480px]:-mx-[15px]
      "
    >
      <div
        className="
          flex flex-wrap justify-between
          gap-[100px]
          max-[480px]:gap-5
        "
      >
        <div>
          <p className="mb-[5px] text-[medium] font-bold max-[480px]:text-[0.9rem]">
            Social Media
          </p>

          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mr-[2px] text-white hover:text-[rgb(0,255,80)]"
          >
            <FaInstagram
              size={18}
              className="mr-5 max-[480px]:mr-[10px] max-[480px]:text-base"
            />
          </a>

          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mr-[2px] text-white hover:text-[rgb(0,255,80)]"
          >
            <FaFacebook
              size={18}
              className="mr-5 max-[480px]:mr-[10px] max-[480px]:text-base"
            />
          </a>
        </div>

        <div>
          <h5 className="text-[medium] max-[480px]:text-[0.9rem]">
            Contact
          </h5>

          <li className="list-none">
            Email: customerservice@torquetitanspares.com
          </li>

          <li className="list-none">
            Phone: +254 123 458399
          </li>
        </div>

        <div>
          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            Privacy Policy
          </p>

          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            About Us
          </p>

          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            Cookies
          </p>

          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            Terms of Service
          </p>
        </div>
      </div>

      <div
        className="
          mt-8
          border-t border-t-[rgba(255,255,255,0.2)]
          pt-4
          text-center
          text-[0.9rem]
          text-[#e0e0e0]
          max-[480px]:text-[0.8rem]
        "
      >
        <p>
          &copy; {new Date().getFullYear()} Torque Titan Spare Parts. All
          rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;