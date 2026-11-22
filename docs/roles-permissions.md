# Rôles et permissions

L'API est l'autorité : une action interdite renvoie `403`. L'interface masque en plus les actions non autorisées.

## Rôles

| Rôle | Valeur API | Profil |
|---|---|---|
| Administrateur | `ADMIN` | Tout, y compris utilisateurs et audit |
| Responsable stock | `STOCK_MANAGER` | Catalogue, entrepôts, ajustements, expédition, réception |
| Commercial | `SALES` | Clients et commandes de vente |
| Acheteur | `PURCHASER` | Fournisseurs et commandes d'achat |
| Lecteur | `VIEWER` | Consultation seule |

## Matrice (côté interface, `frontend/src/lib/permissions.ts`)

| Permission | ADMIN | STOCK_MANAGER | SALES | PURCHASER | VIEWER |
|---|:-:|:-:|:-:|:-:|:-:|
| Gérer les utilisateurs | ✅ | | | | |
| Voir le journal d'audit | ✅ | | | | |
| Créer/modifier clients | ✅ | | ✅ | | |
| Supprimer clients | ✅ | | | | |
| Créer/modifier fournisseurs | ✅ | | | ✅ | |
| Supprimer fournisseurs | ✅ | | | | |
| Créer/modifier produits | ✅ | ✅ | | | |
| Supprimer catégories | ✅ | | | | |
| Gérer entrepôts | ✅ | ✅ | | | |
| Ajuster le stock | ✅ | ✅ | | | |
| Créer/modifier commandes de vente | ✅ | | ✅ | | |
| Expédier une commande de vente | ✅ | ✅ | | | |
| Créer/modifier commandes d'achat | ✅ | | | ✅ | |
| Réceptionner une commande d'achat | ✅ | ✅ | | | |

Tous les rôles authentifiés peuvent consulter le catalogue, le stock et les commandes.

> Les règles exactes côté API sont dans `apps/accounts/permissions.py` et testées dans `tests/accounts/test_permissions_matrix.py`.

## Astuce de démonstration

Connectez-vous successivement avec `sales@stockflow.local` puis `viewer@stockflow.local` : le menu et les boutons changent selon le rôle.
