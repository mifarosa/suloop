# suloop sunucusu

Hesaplar için küçük bir sunucu: Google ile giriş, herkese görünen benzersiz kullanıcı adı ve
oyuncunun kendi ilerleme belgesi (seviyeler, yıldızlar, her seviyenin son 5 çözümü, ipuçları,
günlük sonuçlar). Fastify + Node'un yerleşik SQLite'ı; veri tek bir dosyada durur.

Oyunun kendisi bu sunucu olmadan da çalışır; sunucu yoksa ilerleme yalnız cihazda saklanır.

## Docker ile çalıştırma (Windows'ta Docker Desktop)

1. `server/.env.example` dosyasını `server/.env` olarak kopyala ve `GOOGLE_CLIENT_ID` değerini doldur
   ([Google istemci kimliği nasıl açılır](../docs/self-hosting.md#google-istemci-kimliği)).
2. Depo kökünden:

   ```sh
   docker compose -f server/docker-compose.yml up -d --build
   ```

3. `http://localhost:3000/healthz` adresi `{"ok":true}` döner.

Kapatmak için `docker compose -f server/docker-compose.yml down` (veri volume'da kalır).
Günlükler: `docker compose -f server/docker-compose.yml logs -f`.

Ayrıntılar, yedek alma ve güncelleme: [docs/self-hosting.md](../docs/self-hosting.md).

## Docker olmadan (geliştirme)

```sh
cd server
npm ci
cp .env.example .env      # ve doldur
npm start                 # http://localhost:3000
npm test                  # node --test, bellek içi veritabanı
```

Gereksinim: Node.js 22.13+.

## Ayarlar (`.env`)

| Değişken           | Anlamı                                                             |
| ------------------ | ------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID` | Google OAuth istemci kimliği (zorunlu)                             |
| `ALLOWED_ORIGIN`   | Sunucuyu çağırabilecek sayfalar, virgülle ayrılmış                 |
| `COOKIE_SECURE`    | `true`: oturum çerezi yalnız HTTPS'te gider (HTTPS bir adreste aç) |
| `PORT`             | Varsayılan 3000                                                    |
| `DATA_DIR`         | SQLite dosyasının klasörü (Docker'da `/data`, volume)              |
| `LOG_LEVEL`        | `info`, `warn`, `error`…                                           |

## Uçlar

| Uç                               | İş                                                                     |
| -------------------------------- | ---------------------------------------------------------------------- |
| `GET /healthz`                   | Ayakta mı                                                              |
| `POST /auth/google`              | `{ credential }`: Google kimlik jetonunu doğrular, oturum çerezi verir |
| `POST /auth/logout`              | Oturumu kapatır                                                        |
| `GET /me`                        | `{ user: { id, username } }` ya da `{ user: null }`                    |
| `DELETE /me`                     | Hesabı ve verilerini siler                                             |
| `POST /me/username`              | `{ username }`: 3–20 harf/rakam/alt çizgi, benzersiz, bir kez          |
| `GET /progress`, `PUT /progress` | İlerleme belgesi; PUT, hesaptakini asla geri götürmeden birleştirir    |

Kod düzeni: `src/app.js` uçlar, `src/db.js` şema ve göçler, `src/googleAuth.js` Google jetonu
kontrolü, `src/sessions.js` oturumlar, `src/progress.js` birleştirme (oyunun
`src/app/cloudProgress.js` dosyasını kullanır), `src/backup.js` yedek.
