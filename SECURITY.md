# Security notes

## Credentials that were exposed and MUST be rotated
The project archive that was shared for review contained a real `backend/.env`, a Firebase
`google-services.json` and a `cloudflared.exe` binary. Treat everything that was in those files
as compromised, even if the archive was only shared privately:

| Secret | Where to rotate |
|---|---|
| Database password (`DATABASE_URL`) | Supabase dashboard -> Database -> reset password |
| `JWT_SECRET_KEY` | generate a new one (all users are signed out) |
| `MESSAGE_ENCRYPTION_KEY` | generate a new Fernet key; put the old key in `MESSAGE_ENCRYPTION_KEYS_PREVIOUS` so old chats still decrypt |
| Twilio auth token + API key/secret | Twilio console -> Account -> API keys & tokens |
| Twilio Verify service SID (no longer used) | delete/replace if not needed |
| Sandbox.co.in API key + secret | provider dashboard |
| Cloudinary API key + secret | Cloudinary console -> Settings -> Access keys |
| Firebase Android API key in `google-services.json` | restrict the key to the app package + SHA-1 in Google Cloud console |

If the archive was ever pushed to a public repository, also purge it from git history
(`git filter-repo`) - deleting the file in a later commit does not remove it from history.

## Handling secrets
* `.env`, credentials, certificates, keys and binaries are git-ignored and excluded by `package_release.py`.
* `.env.example` documents every variable with placeholder values only.
* The backend refuses to start without a strong `JWT_SECRET_KEY` and `MESSAGE_ENCRYPTION_KEY`.
* Never print secrets or OTP codes to logs.

## OTP / authentication model
* OTPs: 6 digits from a CSPRNG, stored only as HMAC-SHA256, expire after 5 minutes, single use,
  locked after 5 wrong attempts, throttled per phone (25 s cooldown, 5/day) and per IP.
* There is no master code. In production an OTP is never returned by the API.
* Aadhaar OTPs are verified only by the configured provider; without credentials the feature reports "unavailable".
* Access tokens: HS256 JWT with `typ`, `iat`, `exp`, `jti`; checked against a server-side revocation list,
  the account's active flag and `password_changed_at` on every request (fails closed if the DB is down).
