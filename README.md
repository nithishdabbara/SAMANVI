# SAMANVI

SAMANVI is a highly optimized, enterprise-grade community emergency response and task delegation platform. It is built to facilitate rapid aid, emergency coordination, and micro-volunteering within hyper-local communities.

## Repository Structure

The project is structured as a monorepo containing three distinct components:
- `app1/`: The React Native (Expo) mobile application (frontend).
- `backend/`: The Flask REST API and PostgreSQL database schemas.
- `website/`: A marketing and landing page.

## Technologies Used

- **Frontend (Mobile App)**: React Native, Expo, React Navigation
- **Backend (API)**: Python, Flask, Psycopg2 (PostgreSQL)
- **Database**: PostgreSQL (Supabase / Render)
- **Authentication**: JWT, bcrypt, OTP-based verification
- **Deployment**: Render (Backend & Website), Vercel (optional for Website)

---

## Installation & Setup

### 1. Database Configuration
SAMANVI requires a PostgreSQL database. Ensure you have a PostgreSQL instance running.

### 2. Backend Setup
Navigate to the `backend/` directory:
```bash
cd backend
```
Create a virtual environment and install dependencies:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```
Copy the example environment file and fill in your actual credentials (ensure you generate a secure, 32+ character JWT secret and Fernet key):
```bash
cp .env.example .env
```
Run the migrations to create the database schema:
```bash
python init_db.py
```
Start the backend server:
```bash
python app.py
```

### 3. Mobile App (Frontend) Setup
In a new terminal window, navigate to the `app1/` directory:
```bash
cd app1
```
Install Node.js dependencies:
```bash
npm install
```
Configure your environment variables:
```bash
cp .env.example .env
```
Ensure your `EXPO_PUBLIC_API_URL` points to your backend instance.
Start the Expo development server:
```bash
npm run start
```
You can now scan the QR code using the Expo Go app on your phone, or run it on a local emulator.

---

## Security Notice

- **No hardcoded credentials:** The repository strictly enforces configuration via `.env` files.
- **Git Ignore:** A robust `.gitignore` blocks `.env` files, `.key` files, Google Service JSONs, and `.zip` archives from being pushed to version control.
- **Strict Startup Checks:** The backend implements a startup security validator that refuses to launch in production if weak or default secrets are detected.
