# Firebase: accounts and progress in the cloud

The game keeps accounts, usernames and each player's progress in a Firebase project
(`suloop-8ee05`). Playing needs none of it: without a network, or without signing in, the game
works as before and progress stays on the device.

## What lives where

| Collection          | Holds                                                                                              | Who can touch it                                   |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `usernames/{lower}` | which player has a username (one owner per name)                                                   | anyone can look a name up; the owner can delete it |
| `profiles/{uid}`    | the player's public username                                                                       | anyone can read; only the owner writes             |
| `progress/{uid}`    | solved levels, best stars and last 5 solutions per level, hints, spare undos, recent daily results | only the owner                                     |

The rules are in `firestore.rules`. Progress only grows when two devices meet (see
`src/app/cloudProgress.js`): solved levels, best stars and daily results are never lowered.

## One-time setup (already done for `suloop-8ee05`)

1. Firebase console → create a project, add a **Web** app.
2. Authentication → Sign-in method → **Google** → enable.
3. Authentication → Settings → **Authorized domains** → add `mifarosa.com` (`localhost` is there).
4. Firestore Database → create (production mode, region `eur3`).
5. The web config sits in `src/cloud/config.js`. It only names the project and is not secret;
   the rules protect the data. Another project can be used with `VITE_FIREBASE_*` variables.

## Deploying the rules

Either paste `firestore.rules` into Firebase console → Firestore Database → **Rules** → Publish,
or with the CLI:

```sh
npm install -g firebase-tools
firebase login
firebase deploy --only firestore --project suloop-8ee05
```

Do this again whenever `firestore.rules` changes.

## Trying it locally

`npm run dev`, open Settings → Account → **Sign in with Google**. The sign-in pop-up works on
`localhost` because it is an authorized domain by default.

## Sonra: skor ve bulmaca doğrulaması

Günlük sıralama ve topluluk bulmacaları geldiğinde, hileyi önlemek için evdeki bir Docker
sunucusu (`server/`, Dozi'nin hatırlatma sunucusu gibi) Firebase'e **kendisi bağlanıp** gönderilen
skorları ve bulmacaları doğrulayacak. Dışarıdan ona bağlanılmaz; kapalıyken oyun, giriş ve
ilerleme çalışmaya devam eder. Bunun için o aşamada bir servis hesabı anahtarı gerekecek.

## Günlük sıralama

Günün bulmacasının sonuçları `daily/{gün}/scores/{uid}` altında tutulur (herkes okur, yalnızca
sahibi bir kez yazar); hamle kaydı `dailyMoves/{gün}_{uid}` altında ileride denetlenmek üzere
saklanır. Sıralama için indeks gerekmez: `rank` alanı tek başına puan ve süreyi taşır. `firestore.rules`
değişince Firebase konsolunda Firestore → Rules'tan yeniden yayınla.
