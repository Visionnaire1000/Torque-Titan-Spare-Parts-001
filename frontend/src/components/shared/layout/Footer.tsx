import { FaInstagram, FaFacebook } from "react-icons/fa";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();

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
        {/* Social Media */}
        <div>
          <p className="mb-[5px] text-[medium] font-bold max-[480px]:text-[0.9rem]">
            {t("footer.socialMedia")}
          </p>

          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("footer.instagram")}
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
            aria-label={t("footer.facebook")}
            className="mr-[2px] text-white hover:text-[rgb(0,255,80)]"
          >
            <FaFacebook
              size={18}
              className="mr-5 max-[480px]:mr-[10px] max-[480px]:text-base"
            />
          </a>
        </div>

        {/* Contact */}
        <div>
          <h5 className="text-[medium] max-[480px]:text-[0.9rem]">
            {t("footer.contact")}
          </h5>

          <p>
            {t("footer.email")}: customerservice@torquetitanspares.com
          </p>

          <p>
            {t("footer.phone")}: +254 123 458399
          </p>
        </div>

        {/* Policies and Information */}
        <div>
          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            {t("footer.privacyPolicy")}
          </p>

          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            {t("footer.aboutUs")}
          </p>

          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            {t("footer.cookies")}
          </p>

          <p className="cursor-pointer hover:text-[rgb(0,255,80)]">
            {t("footer.termsOfService")}
          </p>
        </div>
      </div>

      {/* Copyright */}
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
          {t("footer.copyright", {
            year: new Date().getFullYear(),
          })}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
