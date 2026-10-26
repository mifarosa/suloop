# Secrets and personal data

This repository is public. These never go into it:

- Firebase service account keys (`serviceAccount*.json`, `*-service-account*.json`), also for
  the checking server planned later; they live as files on the machine that runs it.
- Signing keys and certificates: Android keystores (`*.jks`, `*.keystore`), Apple keys and
  profiles (`*.p8`, `*.p12`, `*.mobileprovision`). EAS keeps them on its servers.
- `.env` files, passwords, tokens, and the accounts of the App Store, Google Play, AdMob or
  Expo. Values the builds need go into EAS secrets or the CI settings of the repository.
- `google-services.json` and `GoogleService-Info.plist`: given to EAS as file variables.

The Firebase web config in `src/cloud/config.js` and ad app ids are public by design; the
data is protected by `firestore.rules`.

To report a problem, open a private security advisory on GitHub.
