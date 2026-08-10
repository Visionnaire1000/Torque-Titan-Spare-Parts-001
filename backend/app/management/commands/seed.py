import os
from dotenv import load_dotenv
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.hashers import make_password

from app.models import (
    Users,
    SpareParts,
    Orders,
    OrderItems,
    Reviews,
    ReviewReactions,
)

load_dotenv()


class Command(BaseCommand):
    help = "Clear the database and seed initial application data"

    def clear_all_data(self):
        """
        Delete data in dependency order to avoid foreign-key problems.
        """

        self.stdout.write("Clearing all tables...")

        OrderItems.objects.all().delete()
        Orders.objects.all().delete()
        ReviewReactions.objects.all().delete()
        Reviews.objects.all().delete()
        SpareParts.objects.all().delete()
        Users.objects.all().delete()

        self.stdout.write(
            self.style.SUCCESS("All existing data cleared")
        )

    def seed_super_admin(self):
        """
        Create the default super admin without OTP verification.
        """

        email = os.getenv("SUPER_ADMIN_EMAIL")
        password = os.getenv("SUPER_ADMIN_PASSWORD")

        if not email or not password:
            raise ValueError(
                "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD "
                "must be set in .env"
            )

        existing_admin = Users.objects.filter(
            email=email
        ).first()

        if existing_admin:
            self.stdout.write(
                self.style.WARNING(
                    "Super admin already exists"
                )
            )
            return

        super_admin = Users(
            email=email,
            password_hash=make_password(password),
            role="super_admin",
            email_verified=True,
            otp_resend_count=0,
            otp_attempts=0,
            otp_last_sent=None,
            email_otp_hash=None,
            email_otp_expires=None,
        )

        super_admin.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Super admin '{email}' created successfully"
            )
        )

    def seed_buyer(self):
        """
        Create the default buyer without OTP verification.
        """

        email = os.getenv("USER_EMAIL")
        password = os.getenv("USER_PASSWORD")

        if not email or not password:
            raise ValueError(
                "USER_EMAIL and USER_PASSWORD "
                "must be set in .env"
            )

        existing_buyer = Users.objects.filter(
            email=email
        ).first()

        if existing_buyer:
            self.stdout.write(
                self.style.WARNING(
                    "Default buyer already exists"
                )
            )
            return

        buyer = Users(
            email=email,
            password_hash=make_password(password),
            role="buyer",
            email_verified=True,
            otp_resend_count=0,
            otp_attempts=0,
            otp_last_sent=None,
            email_otp_hash=None,
            email_otp_expires=None,
        )

        buyer.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Default buyer '{email}' created successfully"
            )
        )

    def seed_spareparts(self):
        """
        Create the hardcoded spare parts.
        """

        spareparts_data = [

            # ====================================================
            # SEDAN TYRES
            # ====================================================

            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 15000.00,
                "marked_price": 22000.00,
                "description": "Durable Bridgestone tyre for sedans",
                "image": "https://i.imgur.com/OWmFnr1.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 14000.00,
                "marked_price": 21000.00,
                "description": "Reliable Michelin tyre for sedans",
                "image": "https://i.imgur.com/IyMCFSS.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 25000.00,
                "marked_price": 36000.00,
                "description": "Heavy-duty Goodyear tyre for sedans",
                "image": "https://i.imgur.com/OcGN49A.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 27000.00,
                "marked_price": 39000.00,
                "description": "Long-lasting Continental tyre for sedans",
                "image": "https://i.imgur.com/0S5xlog.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 18000.00,
                "marked_price": 26000.00,
                "description": "High-performance Pirelli sedan tyre",
                "image": "https://i.imgur.com/3x0JpHd.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Yokohama",
                "colour": "black",
                "buying_price": 16000.00,
                "marked_price": 24000.00,
                "description": "Economical Yokohama sedan tyre",
                "image": "https://i.imgur.com/ptA76KB.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Dunlop",
                "colour": "black",
                "buying_price": 28000.00,
                "marked_price": 40000.00,
                "description": "Durable Dunlop sedan tyre",
                "image": "https://i.imgur.com/mg1WIOo.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 45000.00,
                "description": "Reliable Bridgestone sedan tyre",
                "image": "https://i.imgur.com/sQ5KARh.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 14500.00,
                "marked_price": 21000.00,
                "description": "Comfortable Michelin sedan tyre",
                "image": "https://i.imgur.com/QoKjmP7.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 20000.00,
                "marked_price": 30000.00,
                "description": "All-terrain Goodyear sedan tyre",
                "image": "https://i.imgur.com/J4By0FY.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 32000.00,
                "marked_price": 46000.00,
                "description": "Heavy-duty Pirelli sedan tyre",
                "image": "https://i.imgur.com/nxNqhll.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "sedan",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 31000.00,
                "marked_price": 44000.00,
                "description": "Long-distance Continental sedan tyre",
                "image": "https://i.imgur.com/p3F6z4f.jpeg",
            },

            # ====================================================
            # SUV TYRES
            # ====================================================

            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 20000.00,
                "marked_price": 30000.00,
                "description": "Durable Bridgestone tyre for suvs",
                "image": "https://i.imgur.com/QXg417r.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 24000.00,
                "marked_price": 31000.00,
                "description": "Reliable Michelin tyre for suvs",
                "image": "https://i.imgur.com/jljR7Tc.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 35000.00,
                "marked_price": 46000.00,
                "description": "Heavy-duty Goodyear tyre for suvs",
                "image": "https://i.imgur.com/X0dXwpq.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 37000.00,
                "marked_price": 49000.00,
                "description": "Long-lasting Continental tyre for suvs",
                "image": "https://i.imgur.com/a6nWICU.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 28000.00,
                "marked_price": 36000.00,
                "description": "High-performance Pirelli suv tyre",
                "image": "https://i.imgur.com/mnIf0Yj.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Yokohama",
                "colour": "black",
                "buying_price": 26000.00,
                "marked_price": 34000.00,
                "description": "Economical Yokohama suv tyre",
                "image": "https://i.imgur.com/Kn2SPIJ.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Dunlop",
                "colour": "black",
                "buying_price": 38000.00,
                "marked_price": 50000.00,
                "description": "Durable Dunlop suv tyre",
                "image": "https://i.imgur.com/j20DzHe.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 40000.00,
                "marked_price": 55000.00,
                "description": "Reliable Bridgestone suv tyre",
                "image": "https://i.imgur.com/4pcKZ7v.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 24500.00,
                "marked_price": 31000.00,
                "description": "Comfortable Michelin suv tyre",
                "image": "https://i.imgur.com/irTbPpA.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 40000.00,
                "description": "All-terrain Goodyear suv tyre",
                "image": "https://i.imgur.com/Rf3pXZR.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 42000.00,
                "marked_price": 56000.00,
                "description": "Heavy-duty Pirelli suv tyre",
                "image": "https://i.imgur.com/AHlNcTi.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "suv",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 41000.00,
                "marked_price": 54000.00,
                "description": "Long-distance Continental suv tyre",
                "image": "https://i.imgur.com/0S5xlog.jpeg",
            },

            # ====================================================
            # TRUCK TYRES
            # ====================================================

            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 40000.00,
                "description": "Durable Bridgestone tyre for trucks",
                "image": "https://i.imgur.com/OybN5BB.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 34000.00,
                "marked_price": 41000.00,
                "description": "Reliable Michelin tyre for trucks",
                "image": "https://i.imgur.com/sd0QLvm.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 45000.00,
                "marked_price": 56000.00,
                "description": "Heavy-duty Goodyear tyre for trucks",
                "image": "https://i.imgur.com/4pS5b0J.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 47000.00,
                "marked_price": 59000.00,
                "description": "Long-lasting Continental tyre for trucks",
                "image": "https://i.imgur.com/fVVVr01.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 38000.00,
                "marked_price": 46000.00,
                "description": "High-performance Pirelli truck tyre",
                "image": "https://i.imgur.com/PTDAQgZ.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Yokohama",
                "colour": "black",
                "buying_price": 46000.00,
                "marked_price": 54000.00,
                "description": "Economical Yokohama truck tyre",
                "image": "https://i.imgur.com/oABGSI1.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Dunlop",
                "colour": "black",
                "buying_price": 48000.00,
                "marked_price": 60000.00,
                "description": "Durable Dunlop truck tyre",
                "image": "https://i.imgur.com/YDOoPPx.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 50000.00,
                "marked_price": 65000.00,
                "description": "Reliable Bridgestone truck tyre",
                "image": "https://i.imgur.com/sQEAWYR.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 34500.00,
                "marked_price": 41000.00,
                "description": "Comfortable Michelin truck tyre",
                "image": "https://i.imgur.com/FzVYZo1.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 40000.00,
                "marked_price": 50000.00,
                "description": "All-terrain Goodyear truck tyre",
                "image": "https://i.imgur.com/7VZspOL.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 52000.00,
                "marked_price": 66000.00,
                "description": "Heavy-duty Pirelli truck tyre",
                "image": "https://i.imgur.com/rApR8hU.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "truck",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 51000.00,
                "marked_price": 64000.00,
                "description": "Long-distance Continental truck tyre",
                "image": "https://i.imgur.com/VK4jogs.png",
            },

            # ====================================================
            # BUS TYRES
            # ====================================================

            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 20000.00,
                "marked_price": 30000.00,
                "description": "Durable Bridgestone tyre for buses",
                "image": "https://i.imgur.com/qFGFy5t.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 24000.00,
                "marked_price": 31000.00,
                "description": "Reliable Michelin tyre for buses",
                "image": "https://i.imgur.com/tqLmLKN.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 35000.00,
                "marked_price": 46000.00,
                "description": "Heavy-duty Goodyear tyre for buses",
                "image": "https://i.imgur.com/OLIa6vU.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 37000.00,
                "marked_price": 49000.00,
                "description": "Long-lasting Continental tyre for buses",
                "image": "https://i.imgur.com/Gz5YsWP.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 28000.00,
                "marked_price": 36000.00,
                "description": "High-performance Pirelli bus tyre",
                "image": "https://i.imgur.com/yOxOnLE.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Yokohama",
                "colour": "black",
                "buying_price": 26000.00,
                "marked_price": 34000.00,
                "description": "Economical Yokohama bus tyre",
                "image": "https://i.imgur.com/KOPPR6O.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Dunlop",
                "colour": "black",
                "buying_price": 28000.00,
                "marked_price": 30000.00,
                "description": "Durable Dunlop bus tyre",
                "image": "https://i.imgur.com/Tntk7vA.png",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Bridgestone",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 45000.00,
                "description": "Reliable Bridgestone bus tyre",
                "image": "https://i.imgur.com/6LY94gy.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Michelin",
                "colour": "black",
                "buying_price": 24500.00,
                "marked_price": 41000.00,
                "description": "Comfortable Michelin bus tyre",
                "image": "https://i.imgur.com/1bc25ZX.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Goodyear",
                "colour": "black",
                "buying_price": 40000.00,
                "marked_price": 60000.00,
                "description": "All-terrain Goodyear bus tyre",
                "image": "https://i.imgur.com/mY6xECq.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Pirelli",
                "colour": "black",
                "buying_price": 42000.00,
                "marked_price": 56000.00,
                "description": "Heavy-duty Pirelli bus tyre",
                "image": "https://i.imgur.com/x2ccGta.jpeg",
            },
            {
                "category": "tyre",
                "vehicle_type": "bus",
                "brand": "Continental",
                "colour": "black",
                "buying_price": 31000.00,
                "marked_price": 44000.00,
                "description": "Long-distance Continental bus tyre",
                "image": "https://i.imgur.com/HW5YltA.png",
            },

            # ====================================================
            # SEDAN RIMS
            # ====================================================

            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Enkei",
                "colour": "silver",
                "buying_price": 20000.00,
                "marked_price": 28000.00,
                "description": "Stylish Enkei rim for sedans",
                "image": "https://i.imgur.com/H8B2Gr8.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "BBS",
                "colour": "silver",
                "buying_price": 25000.00,
                "marked_price": 34000.00,
                "description": "Elegant BBS rim for sedans",
                "image": "https://i.imgur.com/KZUeDTP.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "OZ Racing",
                "colour": "silver",
                "buying_price": 22000.00,
                "marked_price": 31000.00,
                "description": "Strong OZ Racing rim for sedans",
                "image": "https://i.imgur.com/iRfGjXZ.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Konig",
                "colour": "silver",
                "buying_price": 30000.00,
                "marked_price": 40000.00,
                "description": "Premium Konig rim for sedans",
                "image": "https://i.imgur.com/oADOskt.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "HRE",
                "colour": "black",
                "buying_price": 19000.00,
                "marked_price": 27000.00,
                "description": "Durable HRE rim for sedans",
                "image": "https://i.imgur.com/4QfMKGP.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Vossen",
                "colour": "black",
                "buying_price": 21000.00,
                "marked_price": 29000.00,
                "description": "Reliable Vossen rim for sedans",
                "image": "https://i.imgur.com/NkPSc3P.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Advan",
                "colour": "black",
                "buying_price": 23000.00,
                "marked_price": 32000.00,
                "description": "Sturdy Advan sedan rim",
                "image": "https://i.imgur.com/SwYe0m5.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "BBS",
                "colour": "black",
                "buying_price": 31000.00,
                "marked_price": 42000.00,
                "description": "Premium BBS rim for sedans",
                "image": "https://i.imgur.com/KQPmgFl.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Enkei",
                "colour": "gold",
                "buying_price": 18500.00,
                "marked_price": 26000.00,
                "description": "Sporty Enkei sedan rim",
                "image": "https://i.imgur.com/D8LOVH7.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Konig",
                "colour": "gold",
                "buying_price": 20500.00,
                "marked_price": 28500.00,
                "description": "Sleek Konig sedan rim",
                "image": "https://i.imgur.com/WKkFlk0.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "HRE",
                "colour": "gold",
                "buying_price": 24000.00,
                "marked_price": 33000.00,
                "description": "Reliable HRE sedan rim",
                "image": "https://i.imgur.com/ockHoFJ.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "sedan",
                "brand": "Vossen",
                "colour": "gold",
                "buying_price": 32000.00,
                "marked_price": 43000.00,
                "description": "Premium Vossen sedan rim",
                "image": "https://i.imgur.com/SMFBJCQ.jpeg",
            },

            # ====================================================
            # SUV RIMS
            # ====================================================

            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Enkei",
                "colour": "silver",
                "buying_price": 30000.00,
                "marked_price": 35000.00,
                "description": "Stylish Enkei rim for suvs",
                "image": "https://i.imgur.com/5AKdFm3.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "BBS",
                "colour": "silver",
                "buying_price": 33000.00,
                "marked_price": 44000.00,
                "description": "Elegant BBS rim for suvs",
                "image": "https://i.imgur.com/0yu77k8.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "OZ Racing",
                "colour": "silver",
                "buying_price": 35000.00,
                "marked_price": 45000.00,
                "description": "Strong OZ Racing rim for suvs",
                "image": "https://i.imgur.com/9MmTlv0.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Konig",
                "colour": "silver",
                "buying_price": 28000.00,
                "marked_price": 39000.00,
                "description": "Premium Konig rim for suvs",
                "image": "https://i.imgur.com/GJaiIn5.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "HRE",
                "colour": "black",
                "buying_price": 29000.00,
                "marked_price": 33000.00,
                "description": "Durable HRE rim for suvs",
                "image": "https://i.imgur.com/hOUEePY.png",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Vossen",
                "colour": "black",
                "buying_price": 21000.00,
                "marked_price": 29000.00,
                "description": "Reliable Vossen rim for suvs",
                "image": "https://i.imgur.com/jKbfF94.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Advan",
                "colour": "black",
                "buying_price": 23000.00,
                "marked_price": 28000.00,
                "description": "Sturdy Advan suv rim",
                "image": "https://i.imgur.com/wfSoRch.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "BBS",
                "colour": "black",
                "buying_price": 40000.00,
                "marked_price": 42000.00,
                "description": "Premium BBS rim for suvs",
                "image": "https://i.imgur.com/WlwLEu7.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Enkei",
                "colour": "gold",
                "buying_price": 18500.00,
                "marked_price": 20000.00,
                "description": "Sporty Enkei suv rim",
                "image": "https://i.imgur.com/QuR5Ajn.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Konig",
                "colour": "gold",
                "buying_price": 20500.00,
                "marked_price": 24500.00,
                "description": "Sleek Konig suv rim",
                "image": "https://i.imgur.com/NVV2AUC.png",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "HRE",
                "colour": "gold",
                "buying_price": 24000.00,
                "marked_price": 30000.00,
                "description": "Reliable HRE suv rim",
                "image": "https://i.imgur.com/ZmavZOl.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "suv",
                "brand": "Vossen",
                "colour": "gold",
                "buying_price": 32500.00,
                "marked_price": 36400.00,
                "description": "Premium Vossen suv rim",
                "image": "https://i.imgur.com/q0k6UtF.jpeg",
            },

            # ====================================================
            # TRUCK RIMS
            # ====================================================

            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Enkei",
                "colour": "silver",
                "buying_price": 35000.00,
                "marked_price": 40000.00,
                "description": "Stylish Enkei rim for trucks",
                "image": "https://i.imgur.com/gGieBHX.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "BBS",
                "colour": "silver",
                "buying_price": 36000.00,
                "marked_price": 44000.00,
                "description": "Elegant BBS rim for trucks",
                "image": "https://i.imgur.com/3iIqU4M.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "OZ Racing",
                "colour": "silver",
                "buying_price": 38000.00,
                "marked_price": 45000.00,
                "description": "Strong OZ Racing rim for trucks",
                "image": "https://i.imgur.com/XccLzHN.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Konig",
                "colour": "silver",
                "buying_price": 30000.00,
                "marked_price": 39000.00,
                "description": "Premium Konig rim for trucks",
                "image": "https://i.imgur.com/REbZeCZ.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "HRE",
                "colour": "black",
                "buying_price": 32000.00,
                "marked_price": 43000.00,
                "description": "Durable HRE rim for trucks",
                "image": "https://i.imgur.com/bTR0nAZ.png",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Vossen",
                "colour": "black",
                "buying_price": 22000.00,
                "marked_price": 29000.00,
                "description": "Reliable Vossen rim for trucks",
                "image": "https://i.imgur.com/rd8Jk4D.png",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Advan",
                "colour": "black",
                "buying_price": 33000.00,
                "marked_price": 38000.00,
                "description": "Sturdy Advan truck rim",
                "image": "https://i.imgur.com/plaRYsN.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "BBS",
                "colour": "black",
                "buying_price": 40000.00,
                "marked_price": 45000.00,
                "description": "Premium BBS rim for trucks",
                "image": "https://i.imgur.com/QwQu2wx.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Enkei",
                "colour": "gold",
                "buying_price": 38500.00,
                "marked_price": 40000.00,
                "description": "Sporty Enkei truck rim",
                "image": "https://i.imgur.com/sGSAV7i.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Konig",
                "colour": "gold",
                "buying_price": 30500.00,
                "marked_price": 34500.00,
                "description": "Sleek Konig truck rim",
                "image": "https://i.imgur.com/RaCIOuL.png",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "HRE",
                "colour": "gold",
                "buying_price": 34000.00,
                "marked_price": 40500.00,
                "description": "Reliable HRE truck rim",
                "image": "https://i.imgur.com/BIP72q8.png",
            },
            {
                "category": "rim",
                "vehicle_type": "truck",
                "brand": "Vossen",
                "colour": "gold",
                "buying_price": 35500.00,
                "marked_price": 38500.00,
                "description": "Premium Vossen truck rim",
                "image": "https://i.imgur.com/HaYNDv9.png",
            },

            # ====================================================
            # BUS RIMS
            # ====================================================

            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Enkei",
                "colour": "silver",
                "buying_price": 25000.00,
                "marked_price": 36000.00,
                "description": "Stylish Enkei rim for buses",
                "image": "https://i.imgur.com/zWRrOEx.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "BBS",
                "colour": "silver",
                "buying_price": 37000.00,
                "marked_price": 46000.00,
                "description": "Elegant BBS rim for buses",
                "image": "https://i.imgur.com/hDxXnxp.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "OZ Racing",
                "colour": "silver",
                "buying_price": 28000.00,
                "marked_price": 35000.00,
                "description": "Strong OZ Racing rim for buses",
                "image": "https://i.imgur.com/tYwKiyN.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Konig",
                "colour": "silver",
                "buying_price": 20000.00,
                "marked_price": 29000.00,
                "description": "Premium Konig rim for buses",
                "image": "https://i.imgur.com/jRkwlCf.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "HRE",
                "colour": "black",
                "buying_price": 22000.00,
                "marked_price": 33000.00,
                "description": "Durable HRE rim for buses",
                "image": "https://i.imgur.com/Z2ELaSx.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Vossen",
                "colour": "black",
                "buying_price": 20000.00,
                "marked_price": 29000.00,
                "description": "Reliable Vossen rim for buses",
                "image": "https://i.imgur.com/BO5BXmv.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Advan",
                "colour": "black",
                "buying_price": 43000.00,
                "marked_price": 48500.00,
                "description": "Sturdy Advan bus rim",
                "image": "https://i.imgur.com/ZT2TRb5.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "BBS",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 37000.00,
                "description": "Premium BBS rim for buses",
                "image": "https://i.imgur.com/sMZSU1O.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Enkei",
                "colour": "gold",
                "buying_price": 36500.00,
                "marked_price": 40700.00,
                "description": "Sporty Enkei bus rim",
                "image": "https://i.imgur.com/rQmwbAq.png",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Konig",
                "colour": "gold",
                "buying_price": 30400.00,
                "marked_price": 34500.00,
                "description": "Sleek Konig bus rim",
                "image": "https://i.imgur.com/dJF7x3i.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "HRE",
                "colour": "gold",
                "buying_price": 33000.00,
                "marked_price": 37500.00,
                "description": "Reliable HRE bus rim",
                "image": "https://i.imgur.com/izzTfjp.jpeg",
            },
            {
                "category": "rim",
                "vehicle_type": "bus",
                "brand": "Vossen",
                "colour": "gold",
                "buying_price": 35500.00,
                "marked_price": 39500.00,
                "description": "Premium Vossen bus rim",
                "image": "https://i.imgur.com/DztFd2K.jpeg",
            },

            # ====================================================
            # SEDAN BATTERIES
            # ====================================================

            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Exide",
                "colour": "black",
                "buying_price": 18000.00,
                "marked_price": 25000.00,
                "description": "Reliable Exide battery for sedans",
                "image": "https://i.imgur.com/jTiFG8H.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Amaron",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 42000.00,
                "description": "Heavy-duty Amaron battery for sedans",
                "image": "https://i.imgur.com/n0OLZas.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 35000.00,
                "marked_price": 48000.00,
                "description": "Premium Bosch battery for sedans",
                "image": "https://i.imgur.com/jm8DyLn.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Optima",
                "colour": "black",
                "buying_price": 20000.00,
                "marked_price": 28000.00,
                "description": "Durable Optima battery for sedans",
                "image": "https://i.imgur.com/eNAfwtm.png",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Interstate",
                "colour": "white",
                "buying_price": 19000.00,
                "marked_price": 27000.00,
                "description": "Efficient Interstate sedan battery",
                "image": "https://i.imgur.com/R5Ksj1q.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Duracell",
                "colour": "white",
                "buying_price": 31000.00,
                "marked_price": 43000.00,
                "description": "Duracell heavy-duty sedan battery",
                "image": "https://i.imgur.com/TazRJkC.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Yuasa",
                "colour": "white",
                "buying_price": 36000.00,
                "marked_price": 49000.00,
                "description": "Long-lasting Yuasa sedan battery",
                "image": "https://i.imgur.com/qlDOI22.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Bosch",
                "colour": "white",
                "buying_price": 21000.00,
                "marked_price": 29000.00,
                "description": "Bosch Sedan battery",
                "image": "https://i.imgur.com/8BsHz0b.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 33000.00,
                "marked_price": 45000.00,
                "description": "Exide sedan battery",
                "image": "https://i.imgur.com/OmtFdbv.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 18500.00,
                "marked_price": 26000.00,
                "description": "Compact Amaron battery for sedans",
                "image": "https://i.imgur.com/SvCSil6.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 33000.00,
                "marked_price": 45000.00,
                "description": "Exide sedan battery",
                "image": "https://i.imgur.com/gbX65bS.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "sedan",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 18500.00,
                "marked_price": 26000.00,
                "description": "Compact Amaron battery for sedans",
                "image": "https://i.imgur.com/aE0nyCl.jpeg",
            },

            # ====================================================
            # SUV BATTERIES
            # ====================================================

            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Exide",
                "colour": "black",
                "buying_price": 25000.00,
                "marked_price": 28000.00,
                "description": "Reliable Exide battery for suvs",
                "image": "https://i.imgur.com/suMiZGm.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Amaron",
                "colour": "black",
                "buying_price": 36000.00,
                "marked_price": 39000.00,
                "description": "Heavy-duty Amaron battery for suvs",
                "image": "https://i.imgur.com/AubQrcY.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 35000.00,
                "marked_price": 44000.00,
                "description": "Premium Bosch battery for suvs",
                "image": "https://i.imgur.com/HdAaSul.png",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Optima",
                "colour": "black",
                "buying_price": 30000.00,
                "marked_price": 38000.00,
                "description": "Durable Optima battery for suvs",
                "image": "https://i.imgur.com/ioF3GWQ.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Interstate",
                "colour": "white",
                "buying_price": 39000.00,
                "marked_price": 47000.00,
                "description": "Efficient Interstate suv battery",
                "image": "https://i.imgur.com/duSgkHM.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Duracell",
                "colour": "white",
                "buying_price": 35000.00,
                "marked_price": 43000.00,
                "description": "Duracell heavy-duty suv battery",
                "image": "https://i.imgur.com/HaAuDmt.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Yuasa",
                "colour": "white",
                "buying_price": 46000.00,
                "marked_price": 49000.00,
                "description": "Long-lasting Yuasa suv battery",
                "image": "https://i.imgur.com/u51QVmR.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Bosch",
                "colour": "white",
                "buying_price": 31000.00,
                "marked_price": 39000.00,
                "description": "Bosch suv battery",
                "image": "https://i.imgur.com/U8yazSk.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 43000.00,
                "marked_price": 46500.00,
                "description": "Exide suv battery",
                "image": "https://i.imgur.com/GXRjPS5.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 28500.00,
                "marked_price": 33000.00,
                "description": "Compact Amaron battery for suvs",
                "image": "https://i.imgur.com/AhUsPh2.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 37000.00,
                "marked_price": 45000.00,
                "description": "Exide suv battery",
                "image": "https://i.imgur.com/AhUsPh2.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "suv",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 28500.00,
                "marked_price": 36000.00,
                "description": "Compact Amaron battery for suvs",
                "image": "https://i.imgur.com/Xkdks8i.png",
            },

            # ====================================================
            # TRUCK BATTERIES
            # ====================================================

            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Exide",
                "colour": "black",
                "buying_price": 35400.00,
                "marked_price": 38000.00,
                "description": "Reliable Exide battery for trucks",
                "image": "https://i.imgur.com/tYFuXtJ.png",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Amaron",
                "colour": "black",
                "buying_price": 34000.00,
                "marked_price": 39000.00,
                "description": "Heavy-duty Amaron battery for trucks",
                "image": "https://i.imgur.com/vJwheNT.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 35600.00,
                "marked_price": 44400.00,
                "description": "Premium Bosch battery for trucks",
                "image": "https://i.imgur.com/ygbpXVj.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Optima",
                "colour": "black",
                "buying_price": 32300.00,
                "marked_price": 38500.00,
                "description": "Durable Optima battery for trucks",
                "image": "https://i.imgur.com/ulKLzZ4.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Duracell",
                "colour": "white",
                "buying_price": 35300.00,
                "marked_price": 42600.00,
                "description": "Duracell heavy-duty truck battery",
                "image": "https://i.imgur.com/uxxoMKl.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Yuasa",
                "colour": "white",
                "buying_price": 46200.00,
                "marked_price": 49000.00,
                "description": "Long-lasting Yuasa truck battery",
                "image": "https://i.imgur.com/4wiu6US.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Bosch",
                "colour": "white",
                "buying_price": 32000.00,
                "marked_price": 35400.00,
                "description": "Bosch truck battery",
                "image": "https://i.imgur.com/aNU7bKW.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 43400.00,
                "marked_price": 46300.00,
                "description": "Exide truck battery",
                "image": "https://i.imgur.com/augUCTd.png",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 29500.00,
                "marked_price": 33000.00,
                "description": "Compact Amaron battery for trucks",
                "image": "https://i.imgur.com/NIfp9sM.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 37200.00,
                "marked_price": 45600.00,
                "description": "Exide truck battery",
                "image": "https://i.imgur.com/UIcdhCx.png",
            },
            {
                "category": "battery",
                "vehicle_type": "truck",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 25300.00,
                "marked_price": 27700.00,
                "description": "Compact Amaron battery for trucks",
                "image": "https://i.imgur.com/mbVzhGS.png",
            },

            # ====================================================
            # BUS BATTERIES
            # ====================================================

            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Exide",
                "colour": "black",
                "buying_price": 39400.00,
                "marked_price": 48000.00,
                "description": "Reliable Exide battery for buses",
                "image": "https://i.imgur.com/XW9PvU9.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Amaron",
                "colour": "black",
                "buying_price": 37000.00,
                "marked_price": 49000.00,
                "description": "Heavy-duty Amaron battery for buses",
                "image": "https://i.imgur.com/wBlYUrX.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 38600.00,
                "marked_price": 44800.00,
                "description": "Premium Bosch battery for buses",
                "image": "https://i.imgur.com/ngTs3nA.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Optima",
                "colour": "black",
                "buying_price": 35300.00,
                "marked_price": 39500.00,
                "description": "Durable Optima battery for buses",
                "image": "https://i.imgur.com/jJBTTxZ.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Duracell",
                "colour": "white",
                "buying_price": 35800.00,
                "marked_price": 42700.00,
                "description": "Duracell heavy-duty bus battery",
                "image": "https://i.imgur.com/caJZLWG.png",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Yuasa",
                "colour": "white",
                "buying_price": 46500.00,
                "marked_price": 49600.00,
                "description": "Long-lasting Yuasa bus battery",
                "image": "https://i.imgur.com/1eZpRv9.png",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Bosch",
                "colour": "white",
                "buying_price": 32450.00,
                "marked_price": 35550.00,
                "description": "Bosch bus battery",
                "image": "https://i.imgur.com/OyGU4Cw.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 43400.00,
                "marked_price": 48500.00,
                "description": "Exide bus battery",
                "image": "https://i.imgur.com/4umTjhP.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 39500.00,
                "marked_price": 47000.00,
                "description": "Compact Amaron battery for buses",
                "image": "https://i.imgur.com/gQFg6a7.jpeg",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Exide",
                "colour": "blue",
                "buying_price": 37500.00,
                "marked_price": 45600.00,
                "description": "Exide bus battery",
                "image": "https://i.imgur.com/S8V1acT.png",
            },
            {
                "category": "battery",
                "vehicle_type": "bus",
                "brand": "Amaron",
                "colour": "blue",
                "buying_price": 37300.00,
                "marked_price": 39700.00,
                "description": "Compact Amaron battery for buses",
                "image": "https://i.imgur.com/pDNryOp.jpeg",
            },

            # ====================================================
            # SEDAN OIL FILTERS
            # ====================================================

            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 7000.00,
                "marked_price": 12000.00,
                "description": "Efficient Bosch oil filter for sedans",
                "image": "https://i.imgur.com/C0gm3SB.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "K&N",
                "colour": "black",
                "buying_price": 7500.00,
                "marked_price": 12500.00,
                "description": "Durable K&N oil filter for sedans",
                "image": "https://i.imgur.com/lrO8VEs.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Fram",
                "colour": "black",
                "buying_price": 8500.00,
                "marked_price": 14000.00,
                "description": "Reliable Fram oil filter for sedans",
                "image": "https://i.imgur.com/PJD7W6J.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Mann",
                "colour": "black",
                "buying_price": 9000.00,
                "marked_price": 15000.00,
                "description": "High-performance Mann oil filter for sedans",
                "image": "https://i.imgur.com/WxusMFt.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "AC Delco",
                "colour": "silver",
                "buying_price": 7200.00,
                "marked_price": 11800.00,
                "description": "High-performance AC Delco truck oil filter",
                "image": "https://i.imgur.com/DkZmdBG.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Motorcraft",
                "colour": "silver",
                "buying_price": 7400.00,
                "marked_price": 12200.00,
                "description": "Durable Motorcraft oil filter for trucks",
                "image": "https://i.imgur.com/eaxrjmF.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Purolator",
                "colour": "silver",
                "buying_price": 8800.00,
                "marked_price": 14500.00,
                "description": "Purolator suv oil filter",
                "image": "https://i.imgur.com/UfI96Go.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Bosch",
                "colour": "silver",
                "buying_price": 9200.00,
                "marked_price": 15500.00,
                "description": "Bosch oil filter for sedans",
                "image": "https://i.imgur.com/9pYr9TD.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7800.00,
                "marked_price": 12800.00,
                "description": "Fram sedan oil filter",
                "image": "https://i.imgur.com/wKSzA7G.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7600.00,
                "marked_price": 12400.00,
                "description": "Mann sedan oil filter",
                "image": "https://i.imgur.com/NXEJ5Z1.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7800.00,
                "marked_price": 12800.00,
                "description": "Fram sedan oil filter",
                "image": "https://i.imgur.com/s0y9Kdy.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "sedan",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7600.00,
                "marked_price": 12400.00,
                "description": "Mann sedan oil filter",
                "image": "https://i.imgur.com/PgmSfZH.jpeg",
            },

            # ====================================================
            # SUV OIL FILTERS
            # ====================================================

            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 7200.00,
                "marked_price": 9300.00,
                "description": "Efficient Bosch oil filter for SUVs",
                "image": "https://i.imgur.com/vEwFBVW.png",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "K&N",
                "colour": "black",
                "buying_price": 7600.00,
                "marked_price": 11400.00,
                "description": "Durable K&N oil filter for suvs",
                "image": "https://i.imgur.com/EnKPaUk.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Fram",
                "colour": "black",
                "buying_price": 8000.00,
                "marked_price": 13500.00,
                "description": "Reliable Fram oil filter for suvs",
                "image": "https://i.imgur.com/jCvr5Yl.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Mann",
                "colour": "black",
                "buying_price": 9500.00,
                "marked_price": 15999.00,
                "description": "High-performance Mann oil filter for suvs",
                "image": "https://i.imgur.com/IOj4cnU.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "AC Delco",
                "colour": "silver",
                "buying_price": 7350.00,
                "marked_price": 11850.00,
                "description": "High-performance AC Delco truck oil filter",
                "image": "https://i.imgur.com/s7OB3i0.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Motorcraft",
                "colour": "silver",
                "buying_price": 7450.00,
                "marked_price": 8550.00,
                "description": "Durable Motorcraft oil filter for trucks",
                "image": "https://i.imgur.com/7vymLXH.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Purolator",
                "colour": "silver",
                "buying_price": 8820.00,
                "marked_price": 12350.00,
                "description": "Purolator suv oil filter",
                "image": "https://i.imgur.com/VOYHWch.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Bosch",
                "colour": "silver",
                "buying_price": 9200.00,
                "marked_price": 11000.00,
                "description": "Bosch oil filter for suvs",
                "image": "https://i.imgur.com/zY9hfMo.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7800.00,
                "marked_price": 13450.00,
                "description": "Fram SUV oil filter",
                "image": "https://i.imgur.com/5aq6tYE.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7640.00,
                "marked_price": 10000.00,
                "description": "Mann suv oil filter",
                "image": "https://i.imgur.com/V5ML9g9.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7800.00,
                "marked_price": 12800.00,
                "description": "Fram SUV oil filter",
                "image": "https://i.imgur.com/W0dJnoQ.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "suv",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7600.00,
                "marked_price": 12400.00,
                "description": "Mann suv oil filter",
                "image": "https://i.imgur.com/apBVYo1.jpeg",
            },

            # ====================================================
            # TRUCK OIL FILTERS
            # ====================================================

            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 8300.00,
                "marked_price": 12000.00,
                "description": "Efficient Bosch oil filter for trucks",
                "image": "https://i.imgur.com/1KQrWg0.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "K&N",
                "colour": "black",
                "buying_price": 8500.00,
                "marked_price": 13500.00,
                "description": "Durable K&N oil filter for trucks",
                "image": "https://i.imgur.com/X2srlSY.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Fram",
                "colour": "black",
                "buying_price": 8000.00,
                "marked_price": 14350.00,
                "description": "Reliable Fram oil filter for trucks",
                "image": "https://i.imgur.com/160Y4yd.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Mann",
                "colour": "black",
                "buying_price": 9000.00,
                "marked_price": 15000.00,
                "description": "High-performance Mann oil filter for trucks",
                "image": "https://i.imgur.com/enabDgH.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "AC Delco",
                "colour": "silver",
                "buying_price": 7200.00,
                "marked_price": 14800.00,
                "description": "High-performance AC Delco truck oil filter",
                "image": "https://i.imgur.com/k81kIyP.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Motorcraft",
                "colour": "silver",
                "buying_price": 7400.00,
                "marked_price": 12250.00,
                "description": "Durable Motorcraft oil filter for trucks",
                "image": "https://i.imgur.com/jBhKW0D.png",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Purolator",
                "colour": "silver",
                "buying_price": 8860.00,
                "marked_price": 14570.00,
                "description": "Efficient Purolator truck oil filter",
                "image": "https://i.imgur.com/yfOSkpu.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Bosch",
                "colour": "silver",
                "buying_price": 9700.00,
                "marked_price": 15700.00,
                "description": "Reliable Bosch oil filter for trucks",
                "image": "https://i.imgur.com/QuK0c4S.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7850.00,
                "marked_price": 12850.00,
                "description": "Long lasting Fram truck oil filter",
                "image": "https://i.imgur.com/W6vZPSH.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7650.00,
                "marked_price": 12440.00,
                "description": "One of the best Mann truck oil filter",
                "image": "https://i.imgur.com/hy86fJp.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7860.00,
                "marked_price": 12860.00,
                "description": "Latest Fram truck oil filter",
                "image": "https://i.imgur.com/sgih5zI.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "truck",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 8200.00,
                "marked_price": 15450.00,
                "description": "Most affordable Mann truck oil filter",
                "image": "https://i.imgur.com/aqdEJrM.jpeg",
            },

            # ====================================================
            # BUS OIL FILTERS
            # ====================================================

            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Bosch",
                "colour": "black",
                "buying_price": 8500.00,
                "marked_price": 12350.00,
                "description": "Efficient Bosch oil filter for buses",
                "image": "https://i.imgur.com/OQrnsNp.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "K&N",
                "colour": "black",
                "buying_price": 7550.00,
                "marked_price": 12530.00,
                "description": "Durable K&N oil filter for buses",
                "image": "https://i.imgur.com/symW4Vq.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Fram",
                "colour": "black",
                "buying_price": 8530.00,
                "marked_price": 14000.00,
                "description": "Reliable Fram oil filter for buses",
                "image": "https://i.imgur.com/AG0TIkA.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Mann",
                "colour": "black",
                "buying_price": 9500.00,
                "marked_price": 11500.00,
                "description": "High-performance Mann oil filter for buses",
                "image": "https://i.imgur.com/u70LSGV.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "AC Delco",
                "colour": "silver",
                "buying_price": 7240.00,
                "marked_price": 11400.00,
                "description": "High-performance AC Delco truck oil filter",
                "image": "https://i.imgur.com/P5Chj6R.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Motorcraft",
                "colour": "silver",
                "buying_price": 7100.00,
                "marked_price": 12200.00,
                "description": "Motorcraft oil filter for buses",
                "image": "https://i.imgur.com/Si3bLAV.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Purolator",
                "colour": "silver",
                "buying_price": 9000.00,
                "marked_price": 12340.00,
                "description": "Purolator bus oil filter",
                "image": "https://i.imgur.com/skz6l2x.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Bosch",
                "colour": "silver",
                "buying_price": 9240.00,
                "marked_price": 12400.00,
                "description": "Bosch oil filter for buses",
                "image": "https://i.imgur.com/lUYX29x.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7850.00,
                "marked_price": 9850.00,
                "description": "Fram bus oil filter",
                "image": "https://i.imgur.com/6bfjSSM.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7600.00,
                "marked_price": 9950.00,
                "description": "Mann bus oil filter",
                "image": "https://i.imgur.com/LpJPiBf.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Fram",
                "colour": "gold",
                "buying_price": 7850.00,
                "marked_price": 12500.00,
                "description": "Fram bus oil filter",
                "image": "https://i.imgur.com/yRhz9pO.jpeg",
            },
            {
                "category": "oil filter",
                "vehicle_type": "bus",
                "brand": "Mann",
                "colour": "gold",
                "buying_price": 7650.00,
                "marked_price": 12440.00,
                "description": "Mann bus oil filter",
                "image": "https://i.imgur.com/tVNZKOw.jpeg",
            },
        ]

        spareparts = []

        for data in spareparts_data:
            buying_price = data.get("buying_price")
            marked_price = data.get("marked_price")

            discount_amount = 0.0
            discount_percentage = 0.0

            if buying_price and marked_price:
                discount_amount = round(
                    marked_price - buying_price,
                    2,
                )

                if marked_price > 0:
                    discount_percentage = round(
                        (discount_amount / marked_price) * 100,
                        2,
                    )

            data["discount_amount"] = discount_amount
            data["discount_percentage"] = discount_percentage

            spareparts.append(
                SpareParts(**data)
            )

        SpareParts.objects.bulk_create(spareparts)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(spareparts)} spare parts."
            )
        )

    def handle(self, *args, **options):

        self.stdout.write(
            self.style.WARNING(
                "Starting database seeding..."
            )
        )

        with transaction.atomic():

            self.clear_all_data()

            self.seed_super_admin()

            self.seed_buyer()

            self.seed_spareparts()

        self.stdout.write(
            self.style.SUCCESS(
                "Database seeding completed successfully."
            )
        )