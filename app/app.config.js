const { readGooglePlist } = require('./googleConfig');

// EAS gives a file variable's path in GOOGLE_SERVICES_PLIST; on a computer the file can sit
// next to this one. Without it the app builds all the same, only without Google sign-in.
const google = readGooglePlist(process.env.GOOGLE_SERVICES_PLIST || './GoogleService-Info.plist');

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ...(google
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: google.urlScheme }]]
      : [])
  ],
  extra: { ...config.extra, googleIosClientId: google?.clientId ?? null }
});
