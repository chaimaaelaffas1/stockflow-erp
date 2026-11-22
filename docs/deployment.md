# Déploiement

Le `Dockerfile` contient deux cibles : `dev` (utilisée par docker compose) et `prod` (Gunicorn + WhiteNoise, utilisateur non-root).

## Construire l'image de production

```bash
docker build --target prod -t stockflow-api .
```

Au démarrage, le conteneur applique les migrations, crée éventuellement le premier administrateur, puis lance Gunicorn sur `$PORT` (8000 par défaut).

## Variables d'environnement

| Variable | Obligatoire | Description |
|---|:-:|---|
| `DJANGO_SETTINGS_MODULE` | oui | `config.settings.prod` |
| `SECRET_KEY` | oui | Clé secrète unique et longue |
| `DATABASE_URL` | oui | URL PostgreSQL |
| `ALLOWED_HOSTS` | oui | Domaine(s) de l'API |
| `CSRF_TRUSTED_ORIGINS` | si domaine | Origines de confiance (avec `https://`) |
| `CORS_ALLOWED_ORIGINS` | si front séparé | URL du front |
| `SECURE_SSL_REDIRECT` | non | `True` par défaut |
| `SECURE_HSTS_SECONDS` | non | `0` par défaut |
| `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD` | non | Créent le premier admin au démarrage |

## Frontend

```bash
cd frontend
VITE_API_BASE_URL=https://api.exemple.com/api/v1 npm run build
```

Déployez le dossier `frontend/dist/` sur un hébergeur statique.

## Contrôle de santé

`GET /api/v1/health/` (exempté de la redirection HTTPS) sert aux sondes de la plateforme.
