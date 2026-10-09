# SAMANVI — Render Cloud Deployment & Mobile APK Publishing Guide

This guide walks you through deploying the **SAMANVI Backend API** and the **SAMANVI Landing Website** to **Render's Free Cloud Tier**, plus publishing the **Mobile APK via Expo EAS** so the app can be used by anyone, anywhere over the internet.

---

## Part 1: Deploy Both Backend & Website with Render Blueprints (Recommended)

Render provides native Blueprints (`render.yaml`) that can spin up **both** services automatically in one click:
1. **`samanvi-backend`**: Python Flask REST API running Gunicorn on Python 3.12.
2. **`samanvi-web`**: Vite + React static landing page on Render's global CDN (100% Free forever).

### Steps:
1. **Push your code to GitHub** (public or private repository).
2. Go to **[dashboard.render.com](https://dashboard.render.com)** and log in with GitHub.
3. Click **"New +"** in the top right and select **"Blueprint"**.
4. Select your SAMANVI repository (`nithishdabbara/samanvi`).
5. Render will automatically parse `render.yaml` and show:
   * **`samanvi-backend`** (Web Service)
   * **`samanvi-web`** (Static Site)
6. Under `samanvi-backend`, provide the environment variables:
   | Key | Value | Notes |
   |---|---|---|
   | `APP_ENV` | `production` | Enforces production security guards |
   | `DB_SSLMODE` | `require` | Enforces encrypted SSL connection |
   | `DATABASE_URL` | `postgresql://postgres.fqtomhfurpcyprznhpox:Nithish%402005.@aws-1-ap-south-1.pooler.supabase.com:6543/postgres` | Live Supabase database |
   | `JWT_SECRET_KEY` | *(Auto-generated or custom string)* | JWT authentication signing key |
   | `MESSAGE_ENCRYPTION_KEY` | `K3d4d3M4ZTNkNHI1dDZnN2g4ajlrMGw5cTh3N2U2cjQ=` | Fernet message encryption key |
   | `ENABLE_LIVE_SMS` | `false` | Set to true if live SMS gateway enabled |
   | `SANDBOX_SECRET` | `secret_live_58223106cd9a4e74a9ee4e0669086e5f` | OKYC Aadhaar secret |
7. Click **"Apply"**.
8. Both services will deploy:
   * Backend: `https://samanvi-backend.onrender.com` (health check at `/health`)
   * Website: `https://samanvi-web.onrender.com`

---

## Part 2: Manual Setup (If Deploying Services Individually)

### A. Deploy Backend Web Service
1. In Render Dashboard, click **"New +"** -> **"Web Service"**.
2. Connect your Git repository.
3. Configure settings:
   * **Name:** `samanvi-backend`
   * **Root Directory:** `backend`
   * **Runtime:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120`
   * **Instance Type:** `Free`
   * **Health Check Path:** `/health`
4. Add the environment variables from the table above and click **"Create Web Service"**.

### B. Deploy Website Static Site
1. In Render Dashboard, click **"New +"** -> **"Static Site"**.
2. Connect your Git repository.
3. Configure settings:
   * **Name:** `samanvi-web`
   * **Root Directory:** `website`
   * **Build Command:** `npm install && npm run build`
   * **Publish Directory:** `dist`
4. Under **"Redirects/Rewrites"**, add:
   * **Type:** `Rewrite`
   * **Source:** `/*`
   * **Destination:** `/index.html`
5. Click **"Create Static Site"**.
   * Render compiles Vite and serves your landing page on global fast CDN with free SSL.

---

## Part 3: Connect Mobile App & Build the Android APK

Once your Render backend is live:

### 1. Update the Mobile API URL
Open `app1/.env` and set your Render backend URL (include `/api`):
```dotenv
EXPO_PUBLIC_API_URL=https://samanvi-backend.onrender.com/api
```

*(Replace `samanvi-backend.onrender.com` with your exact backend domain from Render).*

### 2. Build the Standalone Android APK
Open PowerShell in `app1` and run:

```powershell
cd E:\SAMANVI\app1
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

### 3. Install and Test on Physical Devices
* When EAS finishes, it outputs a download link and QR code in your terminal.
* Scan the QR code with any Android phone (or open the link in Chrome on your phone) to download the `.apk`.
* Install the APK and launch **SAMANVI**.
* Because the backend is hosted on Render, the app works seamlessly across any cellular network (4G/5G) or Wi-Fi without needing your computer to stay on!
