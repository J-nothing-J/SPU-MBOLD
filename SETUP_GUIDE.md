# SPU Medbay Setup Guide

This guide covers:
- Local setup (Windows PowerShell)
- Basic run/test commands
- Deploying to Heroku with GitHub

Important:
- The `.OLD_REF/` folder is reference-only.
- Do not modify `.OLD_REF/` unless explicitly needed.

## 1. Prerequisites

- Python 3.11+
- Git
- Heroku account
- Heroku CLI (optional but useful)

## 2. Local Setup (Windows PowerShell)

From project root:

1. Create virtual environment
   - `python -m venv .venv`

2. Activate virtual environment
   - `.\.venv\Scripts\Activate.ps1`

3. Install dependencies
   - `pip install -r requirements.txt`

4. Run database migrations
   - `python manage.py migrate`

5. Seed sample data (admin + nurses + sample records)
   - `python manage.py seed_initial_data`

6. Start development server
   - `python manage.py runserver`

7. Open browser
   - `http://127.0.0.1:8000/`

## 3. Default Login Info

- Admin login:
  - Username: `admin`
  - Password: `admin1234`

- Nurse login:
  - Kiosk-style login from nurse list on login page
  - No password required

## 4. Useful Development Commands

- Django checks:
  - `python manage.py check`

- Run tests:
  - `python manage.py test`

- Create a superuser manually (optional):
  - `python manage.py createsuperuser`

## 5. Environment Variables

The project supports these environment variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG` (`True` or `False`)
- `ALLOWED_HOSTS` (comma-separated)
- `CSRF_TRUSTED_ORIGINS` (comma-separated, include protocol)
- `DATABASE_URL` (used in production, provided by Heroku Postgres)
- `JAWSDB_URL` (optional, used when deploying with JawsDB MySQL)
- `DJANGO_SECURE_SSL_REDIRECT` (`True` or `False`, default True in production)

Example local values (optional):

- `DJANGO_DEBUG=True`
- `ALLOWED_HOSTS=127.0.0.1,localhost`

## 6. Deploy to Heroku Using GitHub

### 6.1 Push latest code to GitHub

1. `git add .`
2. `git commit -m "Prepare deployment"`
3. `git push origin main`

### 6.2 Create Heroku app and database

In Heroku Dashboard:

1. Create New App
2. Go to Resources
3. Choose one database add-on:
  - Heroku Postgres (recommended)
  - JawsDB MySQL (if you prefer MySQL)

### 6.3 Connect GitHub repo

In Heroku app:

1. Open Deploy tab
2. Choose Deployment method: GitHub
3. Connect your GitHub account
4. Select repository: `SPU-MD_Django`
5. Select branch: `main`
6. Click Deploy Branch
7. Optional: Enable Automatic Deploys

### 6.4 Set Heroku Config Vars

In Settings -> Reveal Config Vars, set:

- `DJANGO_SECRET_KEY=<your-strong-random-secret>`
- `DJANGO_DEBUG=False`
- `ALLOWED_HOSTS=<your-app-name>.herokuapp.com,.herokuapp.com`
- `CSRF_TRUSTED_ORIGINS=https://<your-app-name>.herokuapp.com`

Notes:
- `DATABASE_URL` is automatically added by Heroku Postgres.
- `JAWSDB_URL` is automatically added by JawsDB MySQL.
- The app supports both `DATABASE_URL` and `JAWSDB_URL`.
- Migrations run automatically on deploy because `Procfile` contains:
  - `release: python manage.py migrate`

### 6.5 Open and verify

1. Open app from Heroku Dashboard
2. Log in as admin
3. Confirm dashboard loads and static files are visible

Optional: Seed data on Heroku after first deploy:

- `heroku run python manage.py seed_initial_data --app <your-app-name>`

## 7. Optional CLI-Only Heroku Flow

If you prefer terminal deployment:

1. `heroku login`
2. `heroku create <your-app-name>`
3. Add one database add-on:
  - Postgres: `heroku addons:create heroku-postgresql:essential-0 --app <your-app-name>`
  - MySQL: add JawsDB from Heroku Dashboard Resources tab
4. `git push heroku main`

Then set config vars:

- `heroku config:set DJANGO_SECRET_KEY=<secret> DJANGO_DEBUG=False ALLOWED_HOSTS=<your-app-name>.herokuapp.com,.herokuapp.com CSRF_TRUSTED_ORIGINS=https://<your-app-name>.herokuapp.com --app <your-app-name>`

## 8. Troubleshooting

- Error: Invalid HTTP_HOST header
  - Check `ALLOWED_HOSTS` value.

- CSRF verification failed on login
  - Check `CSRF_TRUSTED_ORIGINS` includes full `https://` URL.

- Static files missing in production
  - Ensure deploy used current `requirements.txt` and `Procfile`.
  - Re-deploy and check build logs.
