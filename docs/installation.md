# Installation

Deux méthodes : **Docker (recommandée)** pour l'API, plus Node.js pour l'interface.

## Prérequis

| Outil | Version | Vérifier |
|---|---|---|
| Docker Desktop (avec Compose v2) | récente | `docker compose version` |
| Node.js | 20 ou plus | `node -v` |
| Git | n'importe | `git --version` |

## 1. Récupérer le projet

```bash
git clone https://github.com/chaimaaelaffas1/stockflow-erp.git
cd stockflow-erp
```

## 2. Configurer l'environnement

```bash
cp .env.example .env              # PowerShell : Copy-Item .env.example .env
```

Générez ensuite une vraie clé secrète et collez-la dans `SECRET_KEY` :

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

| Variable | Rôle |
|---|---|
| `SECRET_KEY` | Clé secrète Django (obligatoire) |
| `DEBUG` | `True` en local, `False` en production |
| `ALLOWED_HOSTS` | Hôtes autorisés, séparés par des virgules |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Identifiants de la base créée par Docker |
| `DATABASE_URL` | Connexion à la base (recalculée par Docker Compose vers l'hôte `db`) |
| `CORS_ALLOWED_ORIGINS` | Origines front autorisées (inutile avec le proxy Vite) |
| `LOG_LEVEL` | Niveau de logs |

## 3. Lancer l'API et la base

```bash
docker compose up -d --build
docker compose exec api python manage.py migrate
```

Vérification : http://localhost:8000/api/v1/health/ doit répondre.

## 4. Charger les données de démonstration

```bash
# Catalogue, entrepôts, clients, fournisseurs, stock initial (idempotent)
docker compose exec api python manage.py seed_demo

# Jeu complet : 5 utilisateurs (un par rôle) + commandes dans tous les statuts
docker compose exec api python manage.py seed_demo --full --password "MotDePasse#2026"

# Tout effacer puis recréer (attention : vide la base)
docker compose exec api python manage.py seed_demo --reset --password "MotDePasse#2026"
```

Les commandes passent par les vrais services métier : stock, mouvements et audit sont cohérents.

## 5. Lancer l'interface

```bash
cd frontend
npm install
npm run dev
```

Ouvrez http://localhost:5173. Le proxy Vite relaie `/api` vers `http://localhost:8000`, donc pas de souci CORS.

Variables front (facultatif, voir `frontend/.env.example`) : `VITE_API_BASE_URL`, `VITE_DEV_PROXY_TARGET`.

## Créer un administrateur sans données de démo

```bash
docker compose exec api python manage.py createsuperuser
```

## Lancement local sans Docker (avancé)

1. Installer PostgreSQL 16 et créer la base, puis adapter `DATABASE_URL` (hôte `localhost`).
2. `python -m venv .venv` puis activer l'environnement.
3. `pip install -r requirements/dev.txt`
4. `python manage.py migrate` puis `python manage.py runserver`

## Dépannage

| Problème | Solution |
|---|---|
| `SECRET_KEY` manquante | Vérifiez que `.env` existe à la racine du projet |
| Port 8000, 5432 ou 5173 occupé | Arrêtez le programme concerné ou changez le port dans `docker-compose.yml` |
| L'API ne démarre pas | `docker compose logs api` |
| Connexion refusée à la base | Attendez que `db` soit *healthy* : `docker compose ps` |
| Écran de connexion : identifiants refusés | Avez-vous lancé `seed_demo --full --password ...` ? |
| Repartir de zéro | `docker compose down -v` (supprime aussi la base) |
| `npm install` échoue | Vérifiez Node 20+ |
