# ruff: noqa: E501
"""Données de démonstration StockFlow.

Usage :
    python manage.py seed_demo
        Catalogue, entrepôts, clients, fournisseurs et stock initial (idempotent).
    python manage.py seed_demo --full --password "MotDePasse#2026"
        + 5 utilisateurs (un par rôle), commandes de vente et d'achat dans tous les
        statuts, réceptions et ajustements de stock.
    python manage.py seed_demo --reset --password "MotDePasse#2026"
        VIDE toute la base (flush), puis recrée le jeu de données complet.

Les commandes passent par les vrais services métier (confirmer, expédier, passer,
réceptionner...) : stock, mouvements et journal d'audit sont donc cohérents.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Category, Product
from apps.inventory.models import StockLevel, StockMovement, Warehouse
from apps.inventory.services import adjust_stock
from apps.partners.models import Customer, Supplier
from apps.purchasing.models import PurchaseOrder, PurchaseOrderLine, Receipt
from apps.purchasing.services import (
    cancel_purchase_order,
    place_purchase_order,
    receive_purchase_order,
)
from apps.sales.models import SalesOrder, SalesOrderLine
from apps.sales.services import (
    cancel_sales_order,
    confirm_sales_order,
    ship_sales_order,
)

# fmt: off
CATEGORIES = ["Outillage", "Visserie", "Protection", "Électricité", "Plomberie", "Peinture"]

WAREHOUSES = [
    # (code, nom, actif)
    ("CASA-01", "Entrepôt Casablanca", True),
    ("MRK-01", "Entrepôt Marrakech", True),
    ("TNG-01", "Entrepôt Tanger", True),
    ("AGA-01", "Entrepôt Agadir (fermé)", False),
]

# (sku, nom, catégorie, prix, seuil réappro., stock CASA, MRK, TNG, actif)
# Cas volontaires : ruptures (ELE-005, PLO-004), stocks faibles (OUT-005,
# PRO-005, VIS-005), produit inactif (PEI-005).
PRODUCTS = [
    ("OUT-001", "Marteau", "Outillage", "85.00", 10, 60, 40, 20, True),
    ("OUT-002", "Tournevis plat", "Outillage", "25.00", 15, 120, 80, 40, True),
    ("OUT-003", "Tournevis cruciforme", "Outillage", "30.00", 15, 110, 70, 30, True),
    ("OUT-004", "Pince universelle", "Outillage", "65.00", 8, 45, 30, 15, True),
    ("OUT-005", "Clé à molette", "Outillage", "95.00", 10, 6, 3, 0, True),
    ("VIS-001", "Vis acier 20 mm", "Visserie", "0.50", 500, 4000, 2500, 1500, True),
    ("VIS-002", "Vis acier 40 mm", "Visserie", "0.80", 500, 3500, 2000, 1000, True),
    ("VIS-003", "Écrou M6", "Visserie", "0.30", 800, 5000, 3000, 1200, True),
    ("VIS-004", "Boulon M8", "Visserie", "1.20", 300, 1800, 900, 400, True),
    ("VIS-005", "Rondelle M8", "Visserie", "0.20", 800, 300, 200, 100, True),
    ("PRO-001", "Gants de protection", "Protection", "35.00", 20, 200, 150, 60, True),
    ("PRO-002", "Lunettes de sécurité", "Protection", "45.00", 15, 90, 60, 25, True),
    ("PRO-003", "Casque de chantier", "Protection", "120.00", 10, 55, 35, 15, True),
    ("PRO-004", "Masque de protection", "Protection", "15.00", 50, 400, 250, 100, True),
    ("PRO-005", "Chaussures de sécurité", "Protection", "450.00", 8, 5, 2, 0, True),
    ("ELE-001", "Câble électrique 10 m", "Électricité", "75.00", 12, 70, 45, 20, True),
    ("ELE-002", "Interrupteur", "Électricité", "20.00", 30, 260, 180, 90, True),
    ("ELE-003", "Prise électrique", "Électricité", "18.00", 30, 240, 160, 80, True),
    ("ELE-004", "Ampoule LED", "Électricité", "12.00", 60, 500, 300, 150, True),
    ("ELE-005", "Multiprise", "Électricité", "55.00", 12, 0, 0, 0, True),
    ("PLO-001", "Robinet mitigeur", "Plomberie", "180.00", 6, 25, 15, 8, True),
    ("PLO-002", "Tuyau PVC 2 m", "Plomberie", "35.00", 20, 150, 90, 40, True),
    ("PLO-003", "Raccord PVC", "Plomberie", "12.00", 40, 300, 200, 90, True),
    ("PLO-004", "Joint d'étanchéité", "Plomberie", "6.00", 60, 0, 0, 0, True),
    ("PEI-001", "Peinture blanche 10 L", "Peinture", "320.00", 10, 40, 25, 12, True),
    ("PEI-002", "Rouleau de peinture", "Peinture", "28.00", 20, 80, 50, 20, True),
    ("PEI-003", "Pinceau", "Peinture", "15.00", 30, 110, 70, 30, True),
    ("PEI-004", "Ruban de masquage", "Peinture", "9.00", 40, 220, 140, 60, True),
    ("PEI-005", "Ancien rouleau (discontinué)", "Peinture", "18.00", 0, 10, 0, 0, False),
]

CUSTOMERS = [
    # (nom, e-mail, téléphone, adresse, actif)
    ("Atlas Matériaux", "atlas.customer@stockflow.local", "05 22 00 00 01", "12 boulevard Zerktouni, Casablanca", True),
    ("Bâtiment Plus", "batiment.customer@stockflow.local", "05 22 00 00 02", "45 avenue Hassan II, Casablanca", True),
    ("Pro Construction", "pro.customer@stockflow.local", "05 24 00 00 03", "8 rue de la Liberté, Marrakech", True),
    ("Maroc Bricolage", "bricolage.customer@stockflow.local", "05 39 00 00 04", "21 avenue Mohammed V, Tanger", True),
    ("Sahara Équipements", "sahara.customer@stockflow.local", "05 28 00 00 05", "3 zone industrielle, Agadir", True),
    ("Rif Électricité", "rif.customer@stockflow.local", "05 39 00 00 06", "17 rue Tarik Ibn Ziad, Tétouan", True),
    ("Médina Quincaillerie", "medina.customer@stockflow.local", "05 24 00 00 07", "Souk Semmarine, Marrakech", True),
    ("Anfa Chantiers", "anfa.customer@stockflow.local", "05 22 00 00 08", "Quartier Anfa, Casablanca", False),
]

SUPPLIERS = [
    ("Fournitures Atlas", "atlas.supplier@stockflow.local", "05 22 10 00 01", "Zone industrielle Ain Sebaâ, Casablanca", True),
    ("Distribution Pro", "distribution.supplier@stockflow.local", "05 22 10 00 02", "Route de Rabat, Casablanca", True),
    ("Électro Maroc Distribution", "electro.supplier@stockflow.local", "05 37 10 00 03", "Quartier industriel, Salé", True),
    ("Quincaillerie Grossiste Nord", "nord.supplier@stockflow.local", "05 39 10 00 04", "Zone franche, Tanger", True),
    ("Peintures du Sud", "peintures.supplier@stockflow.local", "05 28 10 00 05", "Zone industrielle Tassila, Agadir", True),
]

# (clé, e-mail, prénom, nom, rôle)
USERS = [
    ("admin", "demo.admin@stockflow.local", "Salma", "Benali", "ADMIN"),
    ("stock", "stock@stockflow.local", "Youssef", "Alaoui", "STOCK_MANAGER"),
    ("sales", "sales@stockflow.local", "Amina", "Idrissi", "SALES"),
    ("purchaser", "purchaser@stockflow.local", "Karim", "Tazi", "PURCHASER"),
    ("viewer", "viewer@stockflow.local", "Nadia", "Fassi", "VIEWER"),
]

# (client, entrepôt, [(sku, qté)], statut cible, ancienneté en jours, notes)
SALES_ORDERS = [
    ("Atlas Matériaux", "CASA-01", [("OUT-001", 5), ("VIS-001", 200), ("PRO-001", 10)], "SHIPPED", 28, ""),
    ("Bâtiment Plus", "CASA-01", [("ELE-001", 4), ("ELE-002", 20), ("ELE-004", 50)], "SHIPPED", 24, ""),
    ("Pro Construction", "MRK-01", [("PRO-003", 6), ("PRO-002", 12), ("PRO-004", 40)], "SHIPPED", 19, ""),
    ("Maroc Bricolage", "CASA-01", [("PEI-001", 5), ("PEI-002", 10), ("PEI-003", 12)], "SHIPPED", 15, ""),
    ("Sahara Équipements", "TNG-01", [("PLO-001", 3), ("PLO-002", 10), ("PLO-003", 25)], "SHIPPED", 11, ""),
    ("Rif Électricité", "MRK-01", [("ELE-003", 30), ("ELE-002", 15)], "CONFIRMED", 7, ""),
    ("Médina Quincaillerie", "CASA-01", [("OUT-002", 20), ("OUT-003", 20), ("VIS-002", 300)], "CONFIRMED", 5, "Livraison prévue cette semaine"),
    ("Atlas Matériaux", "MRK-01", [("VIS-003", 500), ("VIS-004", 150)], "CONFIRMED", 4, ""),
    ("Bâtiment Plus", "CASA-01", [("PEI-004", 24), ("PEI-003", 10)], "CONFIRMED", 2, ""),
    ("Pro Construction", "CASA-01", [("OUT-004", 6), ("PRO-001", 20)], "DRAFT", 2, "En attente de validation du devis"),
    ("Maroc Bricolage", "TNG-01", [("PLO-002", 12)], "DRAFT", 1, ""),
    ("Sahara Équipements", "MRK-01", [("PRO-004", 60), ("PRO-002", 10)], "DRAFT", 0, ""),
    ("Rif Électricité", "CASA-01", [("ELE-004", 100)], "CANCELLED_AFTER_CONFIRM", 9, "Annulée à la demande du client"),
    ("Médina Quincaillerie", "TNG-01", [("OUT-001", 3)], "CANCELLED", 6, "Doublon de commande"),
]

# (fournisseur, entrepôt, [(sku, qté, coût)], statut cible, ancienneté en jours)
PURCHASE_ORDERS = [
    ("Fournitures Atlas", "CASA-01", [("VIS-001", 2000, "0.30"), ("VIS-002", 1500, "0.50")], "RECEIVED", 26),
    ("Distribution Pro", "MRK-01", [("PRO-003", 40, "80.00"), ("PRO-001", 100, "22.00")], "RECEIVED", 20),
    ("Électro Maroc Distribution", "CASA-01", [("ELE-001", 60, "48.00"), ("ELE-004", 300, "6.50")], "RECEIVED", 14),
    ("Quincaillerie Grossiste Nord", "TNG-01", [("OUT-004", 40, "40.00"), ("OUT-005", 30, "60.00")], "PARTIALLY_RECEIVED", 8),
    ("Fournitures Atlas", "CASA-01", [("VIS-005", 3000, "0.10"), ("VIS-003", 2000, "0.15")], "ORDERED", 4),
    ("Distribution Pro", "CASA-01", [("PRO-005", 40, "290.00")], "ORDERED", 3),
    ("Peintures du Sud", "MRK-01", [("PEI-001", 60, "210.00"), ("PEI-002", 100, "17.00")], "DRAFT", 1),
    ("Électro Maroc Distribution", "TNG-01", [("ELE-005", 50, "35.00")], "DRAFT", 0),
    ("Quincaillerie Grossiste Nord", "CASA-01", [("PLO-004", 500, "3.00")], "CANCELLED", 12),
]

# (sku, entrepôt, variation, motif)
ADJUSTMENTS = [
    ("VIS-001", "CASA-01", "-12", "Inventaire annuel : écart constaté"),
    ("PRO-004", "MRK-01", "20", "Correction après comptage physique"),
    ("OUT-002", "CASA-01", "-3", "Casse constatée en entrepôt"),
]
# fmt: on


class Command(BaseCommand):
    help = "Crée des données de démonstration StockFlow (voir l'en-tête du fichier)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--full",
            action="store_true",
            help="Ajoute utilisateurs, commandes (tous statuts), réceptions, ajustements.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="VIDE TOUTE LA BASE puis recrée le jeu complet (implique --full).",
        )
        parser.add_argument(
            "--password",
            help="Mot de passe des comptes de démonstration (obligatoire avec --reset).",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Autorise --reset même si DEBUG=False (dangereux).",
        )

    def handle(self, *args, **options):
        full = options["full"] or options["reset"]
        password = options["password"]

        if options["reset"]:
            if not settings.DEBUG and not options["force"]:
                raise CommandError(
                    "--reset efface TOUTE la base : refusé quand DEBUG=False "
                    "(ajoutez --force si c'est vraiment voulu)."
                )
            if not password:
                raise CommandError(
                    "--reset supprime aussi les utilisateurs : indiquez --password "
                    "pour pouvoir vous reconnecter avec les comptes de démonstration."
                )
            self.stdout.write(self.style.WARNING("Réinitialisation de la base..."))
            # flush = TRUNCATE SQL : contourne l'immuabilité de StockMovement
            # (volontairement non supprimable via l'ORM) et remet les IDs à 1.
            call_command("flush", interactive=False, verbosity=0)

        with transaction.atomic():
            users = self._users(password, full)
            catalog = self._catalog_and_stock(users["admin"])
            if full:
                if SalesOrder.objects.exists() or PurchaseOrder.objects.exists():
                    self.stdout.write(
                        self.style.WARNING(
                            "Des commandes existent déjà : commandes non recréées "
                            "(utilisez --reset pour repartir de zéro)."
                        )
                    )
                else:
                    self._sales_orders(users, catalog)
                    self._purchase_orders(users, catalog)
                    self._adjustments(users, catalog)

        self._summary(full)

    # ------------------------------------------------------------------ users

    def _users(self, password, full):
        User = get_user_model()
        wanted = USERS if full else USERS[:1]
        users = {}
        for key, email, first, last, role in wanted:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email.split("@")[0].replace(".", "-"),
                    "first_name": first,
                    "last_name": last,
                    "role": getattr(User.Role, role),
                },
            )
            if password:
                user.set_password(password)
                user.save(update_fields=["password"])
            elif created:
                # Sans --password, les comptes de démo ne permettent pas de se connecter.
                user.set_unusable_password()
                user.save(update_fields=["password"])
            users[key] = user
        return users

    # ---------------------------------------------------- catalogue + stock

    def _catalog_and_stock(self, admin):
        categories = {n: Category.objects.get_or_create(name=n)[0] for n in CATEGORIES}

        warehouses = {}
        for code, name, active in WAREHOUSES:
            warehouses[code] = Warehouse.objects.get_or_create(
                code=code, defaults={"name": name, "is_active": active}
            )[0]

        for model, rows in ((Customer, CUSTOMERS), (Supplier, SUPPLIERS)):
            for name, email, phone, address, active in rows:
                model.objects.get_or_create(
                    name=name,
                    defaults={
                        "email": email,
                        "phone": phone,
                        "address": address,
                        "is_active": active,
                    },
                )

        products = {}
        stock_codes = ["CASA-01", "MRK-01", "TNG-01"]
        for sku, name, cat, price, reorder, *stocks, active in PRODUCTS:
            product, _ = Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name,
                    "category": categories[cat],
                    "unit_price": Decimal(price),
                    "reorder_level": Decimal(reorder),
                    "description": "",
                    "is_active": active,
                },
            )
            products[sku] = product
            for code, qty in zip(stock_codes, stocks, strict=True):
                if qty <= 0:
                    continue
                level, created = StockLevel.objects.get_or_create(
                    product=product,
                    warehouse=warehouses[code],
                    defaults={"on_hand": Decimal("0"), "reserved": Decimal("0")},
                )
                if created:
                    quantity = Decimal(qty)
                    StockMovement.objects.create(
                        product=product,
                        warehouse=warehouses[code],
                        movement_type=StockMovement.MovementType.RECEIPT,
                        on_hand_delta=quantity,
                        reserved_delta=Decimal("0"),
                        reference=f"SEED-{sku}-{code}",
                        reason="",
                        created_by=admin,
                    )
                    level.on_hand = quantity
                    level.save(update_fields=["on_hand", "updated_at"])

        return {
            "products": products,
            "warehouses": warehouses,
            "customers": {c.name: c for c in Customer.objects.all()},
            "suppliers": {s.name: s for s in Supplier.objects.all()},
        }

    # ----------------------------------------------------------------- ventes

    def _sales_orders(self, users, catalog):
        now = timezone.now()
        for customer, wh, lines, target, days_ago, notes in SALES_ORDERS:
            order = SalesOrder.objects.create(
                customer=catalog["customers"][customer],
                warehouse=catalog["warehouses"][wh],
                notes=notes,
                created_by=users["sales"],
            )
            for sku, qty in lines:
                SalesOrderLine.objects.create(
                    order=order,
                    product=catalog["products"][sku],
                    quantity=Decimal(qty),
                )

            if target in ("CONFIRMED", "SHIPPED", "CANCELLED_AFTER_CONFIRM"):
                confirm_sales_order(order.pk, users["sales"])
            if target == "SHIPPED":
                ship_sales_order(order.pk, users["stock"])
            if target in ("CANCELLED", "CANCELLED_AFTER_CONFIRM"):
                cancel_sales_order(order.pk, users["sales"])

            # Dates étalées dans le passé (les services posent « maintenant »).
            created = now - timedelta(days=days_ago, hours=2)
            order.refresh_from_db()
            SalesOrder.objects.filter(pk=order.pk).update(
                created_at=created,
                confirmed_at=(
                    created + timedelta(hours=3) if order.confirmed_at else None
                ),
                shipped_at=created + timedelta(days=1) if order.shipped_at else None,
                cancelled_at=(
                    created + timedelta(hours=6) if order.cancelled_at else None
                ),
            )

    # ----------------------------------------------------------------- achats

    def _purchase_orders(self, users, catalog):
        now = timezone.now()
        for supplier, wh, lines, target, days_ago in PURCHASE_ORDERS:
            po = PurchaseOrder.objects.create(
                supplier=catalog["suppliers"][supplier],
                warehouse=catalog["warehouses"][wh],
                created_by=users["purchaser"],
            )
            po_lines = [
                PurchaseOrderLine.objects.create(
                    purchase_order=po,
                    product=catalog["products"][sku],
                    quantity_ordered=Decimal(qty),
                    unit_cost=Decimal(cost),
                )
                for sku, qty, cost in lines
            ]

            if target in ("ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"):
                place_purchase_order(purchase_order_id=po.pk, user=users["purchaser"])
            if target == "PARTIALLY_RECEIVED":
                first = po_lines[0]
                receive_purchase_order(
                    purchase_order_id=po.pk,
                    idempotency_key=uuid.uuid4(),
                    lines=[
                        {
                            "purchase_order_line_id": first.pk,
                            "quantity": first.quantity_ordered * Decimal("0.4"),
                        }
                    ],
                    user=users["stock"],
                )
            if target == "RECEIVED":
                receive_purchase_order(
                    purchase_order_id=po.pk,
                    idempotency_key=uuid.uuid4(),
                    lines=[
                        {
                            "purchase_order_line_id": line.pk,
                            "quantity": line.quantity_ordered,
                        }
                        for line in po_lines
                    ],
                    user=users["stock"],
                )
            if target == "CANCELLED":
                cancel_purchase_order(purchase_order_id=po.pk, user=users["purchaser"])

            created = now - timedelta(days=days_ago, hours=3)
            po.refresh_from_db()
            ordered = created + timedelta(hours=2) if po.ordered_at else None
            PurchaseOrder.objects.filter(pk=po.pk).update(
                created_at=created, ordered_at=ordered
            )
            if ordered:
                received_at = min(ordered + timedelta(days=2), now)
                Receipt.objects.filter(purchase_order=po).update(created_at=received_at)

    # ------------------------------------------------------------ ajustements

    def _adjustments(self, users, catalog):
        for sku, wh, delta, reason in ADJUSTMENTS:
            adjust_stock(
                product_id=catalog["products"][sku].pk,
                warehouse_id=catalog["warehouses"][wh].pk,
                quantity_delta=Decimal(delta),
                reason=reason,
                user=users["stock"],
            )

    # ----------------------------------------------------------------- bilan

    def _summary(self, full):
        self.stdout.write(self.style.SUCCESS("Données de démonstration prêtes."))
        self.stdout.write(
            f"  Produits : {Product.objects.count()} · "
            f"Entrepôts : {Warehouse.objects.count()} · "
            f"Clients : {Customer.objects.count()} · "
            f"Fournisseurs : {Supplier.objects.count()}"
        )
        self.stdout.write(
            f"  Commandes de vente : {SalesOrder.objects.count()} · "
            f"Commandes d'achat : {PurchaseOrder.objects.count()} · "
            f"Mouvements de stock : {StockMovement.objects.count()}"
        )
        if full:
            self.stdout.write("  Comptes (même mot de passe pour tous) :")
            for _key, email, _first, _last, role in USERS:
                self.stdout.write(f"    - {email}  [{role}]")
