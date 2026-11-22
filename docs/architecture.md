# Architecture

## Vue d'ensemble

```
┌──────────────┐   HTTP/JSON + JWT   ┌─────────────────────┐      ┌──────────────┐
│ React + TS   │ ──────────────────► │ Django REST API     │ ───► │ PostgreSQL 16│
│ (Vite, :5173)│   proxy /api        │ (:8000)             │      └──────────────┘
└──────────────┘                     │ views → services    │
                                     │ → models            │
                                     └─────────────────────┘
```

## Backend (`apps/`)

| App | Responsabilité |
|---|---|
| `accounts` | Utilisateur personnalisé avec rôle, JWT, gestion des utilisateurs |
| `catalog` | Catégories et produits (SKU unique insensible à la casse, seuil de réappro) |
| `inventory` | Entrepôts, niveaux de stock, mouvements, ajustements |
| `partners` | Clients et fournisseurs |
| `sales` | Commandes de vente et leurs lignes |
| `purchasing` | Commandes d'achat, réceptions |
| `core` | Journal d'audit, synthèse du tableau de bord, gestion d'erreurs, pagination, commande `seed_demo` |

### Principe : la logique métier est dans les services

Les vues valident la requête et appellent un service ; les services (`services.py`) portent les règles et les transactions. Exemples : `confirm_sales_order`, `ship_sales_order`, `cancel_sales_order`, `place_purchase_order`, `receive_purchase_order`, `apply_stock_change`, `adjust_stock`.

## Règles métier

### Stock

Chaque couple (produit, entrepôt) a un niveau de stock : **en main**, **réservé**, **disponible**. Toute modification passe par `apply_stock_change` qui verrouille la ligne (`select_for_update`) et crée un **mouvement** (`RECEIPT`, `SHIPMENT`, `RESERVE`, `RELEASE`, `ADJUSTMENT`).

### Commande de vente

```
Brouillon ──confirmer──► Confirmée ──expédier──► Expédiée
    │                        │
    └────────annuler─────────┴──► Annulée
```

- **Confirmer** : réserve le stock. S'il est insuffisant, l'API répond `409 insufficient_stock`.
- **Expédier** : diminue le stock en main et libère la réservation.
- **Annuler** : libère la réservation si la commande était confirmée.

### Commande d'achat

```
Brouillon ──passer──► Commandée ──réceptionner──► Partiellement reçue ──► Reçue
    └──────────────annuler──────────────► Annulée
```

- **Réception** : incrémente le stock, partielle ou totale.
- **Idempotence** : chaque réception porte une `idempotency_key`. Rejouer le même contenu renvoie le même résultat sans doubler le stock ; réutiliser la clé avec un contenu différent renvoie `409 idempotency_conflict`.
- **Sur-réception** : refusée (`409 over_receipt`).

### Audit

Chaque action métier écrit une entrée (acteur, action, objet, charge utile). Consultation en lecture seule, réservée aux administrateurs.

## Sécurité

- JWT : access 15 minutes, refresh 1 jour, rotation et blacklist après rotation.
- Permissions par rôle côté API (source de vérité) et côté interface (confort d'usage).
- Production : HTTPS forcé, cookies sécurisés, HSTS configurable, utilisateur non-root dans Docker.
- Aucun secret dans le dépôt : tout passe par les variables d'environnement.

## Format d'erreur unique

```json
{ "error": { "code": "insufficient_stock", "message": "Not enough available stock.", "details": { } } }
```

## Frontend (`frontend/src/`)

| Dossier | Contenu |
|---|---|
| `features/` | Une page ou un groupe de pages par domaine (auth, catalog, sales, ...) |
| `api/` | Client axios et appels typés par domaine |
| `components/` | UI réutilisable (`ui/`), mise en page, éléments communs |
| `hooks/` | Mutations API, données de référence, debounce |
| `lib/` | Permissions, validation (Zod), format, décimaux, gestion d'erreurs |
| `routes/` | Gardes de routes (authentification, permission) |
| `test/` | Configuration Vitest, serveur MSW |

## Décisions techniques

| Décision | Raison |
|---|---|
| Services transactionnels et verrous de ligne | Éviter les ventes concurrentes au-delà du stock disponible |
| Idempotency key sur les réceptions | Rejeu réseau sans doubler le stock |
| Quantités en `Decimal` (3 décimales) | Pas d'erreurs d'arrondi sur les quantités et montants |
| Proxy Vite en développement | Pas de CORS à configurer |
| Réglages `base / dev / test / prod` | Comportement adapté à chaque environnement |
