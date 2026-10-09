# Building the SAMANVI Android APK

## 1. Configure the backend URL first

Set `EXPO_PUBLIC_API_URL` to the reachable backend base URL, including `/api`. Do not use `localhost` or the example URL in a standalone APK. For an online backend, use its HTTPS URL. For a same-Wi-Fi demo, use the laptop LAN address and ensure the phone can reach port 5000.

For an EAS cloud build, configure `EXPO_PUBLIC_API_URL` as an EAS environment variable for the environment used by the `preview` profile. Do not commit a real `.env` file.

## 2. Install and validate dependencies

From `app1/`, use the package manager matching the lockfile in the project. Then run `npx expo-doctor`. Resolve reported compatibility issues before building.

## 3. Build an installable APK

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile is configured to produce an APK. Install the resulting artifact on a physical Android device and test login, locality verification, problem creation/viewing, offers, chat, and profile screens.

## 4. Local Docker Compose

Copy `.env.compose.example` to the project-root `.env` and replace every placeholder with generated values. Generate the JWT secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"` and the Fernet key with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Keep `.env` private and out of ZIPs and version control. This Compose configuration is for local development only; it is not a production deployment configuration.
