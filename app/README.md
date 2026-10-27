# Wasorty for Android and iOS (Expo)

The native app. It shares the game's plain JavaScript with the website: `../src/game` (rules,
levels, solver) is bundled as it is (see `metro.config.js`). The screens are React Native.

```bash
cd app
npm install
npx expo export --platform android   # checks that everything bundles
eas login                            # once, with a free expo.dev account
eas build -p android --profile preview   # an APK to install on a phone
```

`preview` builds an APK, `production` an app bundle for Google Play. Keys, `google-services.json`
and other secrets never go into the repository (see ../SECURITY.md).
