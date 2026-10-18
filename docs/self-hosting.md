# Kendi sunucunda çalıştırma (Windows + Docker Desktop)

suloop'un hesap özelliği için küçük bir sunucu gerekir (`server/`). Oyun statik bir sayfa olarak
GitHub Pages'te durur; sunucuyu Pages barındıramaz, o yüzden sunucu ayrı bir Docker konteyneri
olarak çalışır. Kurulum [Dozi](https://github.com/mifarosa/dozi)'nin sunucusuyla aynı düzende:
`server/Dockerfile`, `server/docker-compose.yml`, `server/.env`, veri için adlandırılmış volume.

## Giriş: Firebase (senin yapacağın bir şey yok)

Oyuncular Google ile **Firebase Authentication** üzerinden girer; Firebase yalnız "bu kim?"
sorusunu cevaplar, veri bu sunucuda durur. Sunucu Firebase'in verdiği kimlik jetonunu herkese
açık anahtarlarla doğrular, bir gizli anahtar ya da servis hesabı gerekmez. Proje
(`suloop-8ee05`) açık, Google girişi etkin ve `localhost` yetkili alan; yerelde denemek için
Google Cloud'da ya da Firebase'de **hiçbir şey ayarlaman gerekmez**.

Canlıya açarken tek ekleme: Firebase console → Authentication → Settings → **Authorized
domains** → `mifarosa.com`.

## Sunucuyu aç

PowerShell'de, depo klasöründe:

```powershell
Copy-Item server\.env.example server\.env     # içindekiler yerelde olduğu gibi çalışır
docker compose -f server/docker-compose.yml up -d --build
curl http://localhost:3000/healthz
```

`server/.env` satır sonları **LF** kalmalı (`server/.gitattributes` bunu korur; dosyayı bir
düzenleyicide CRLF olarak kaydedersen değerlerin sonuna görünmez bir karakter girer).

Oyunu yerelde aç: depo kökünde `.env.local` dosyası yap

```
VITE_API_URL=http://localhost:3000
```

ve `npm run dev` ile `http://localhost:5173`'ü aç. **Ayarlar → Hesap** görünür.

## Günlük kullanım

| İş              | Komut (depo kökünden)                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| Günlükler       | `docker compose -f server/docker-compose.yml logs -f`                         |
| Durdur / başlat | `docker compose -f server/docker-compose.yml stop` / `start`                  |
| Güncelle        | `git pull`, sonra `docker compose -f server/docker-compose.yml up -d --build` |
| Kaldır          | `docker compose -f server/docker-compose.yml down` (veri volume'da kalır)     |

`restart: always` sayesinde Docker Desktop açıldığında sunucu kendiliğinden kalkar.

## Yedek

Veri `suloop-data` adlı volume'daki tek bir SQLite dosyasıdır (`/data/suloop.db`).

```powershell
# Tutarlı bir kopya al (sunucu çalışırken de olur); son 14 kopya /data/backups altında kalır
docker compose -f server/docker-compose.yml exec suloop-api node --disable-warning=ExperimentalWarning src/backup.js

# Kopyaları Windows'a çıkar
docker compose -f server/docker-compose.yml cp suloop-api:/data/backups ./suloop-yedek
```

Geri yüklemek için sunucuyu durdur, yedeği `/data/suloop.db` olarak geri kopyala
(`docker compose cp ./suloop-yedek/<dosya>.db suloop-api:/data/suloop.db`) ve başlat. Bir kez
denemeni öneririm.

## Başka oyuncuların bağlanması (sonra)

`http://localhost:3000` yalnız bu bilgisayardan erişilir. Canlı oyun `https://mifarosa.com`
üstünde durduğu için tarayıcı `http://` bir adrese istek atamaz; başkalarının hesap açabilmesi
için sunucunun **HTTPS bir adresten** erişilebilir olması gerekir. Seçenekler:

- bir tünel (örneğin Cloudflare Tunnel) ile bu bilgisayardaki sunucuyu bir alan adına bağlamak,
- sunucuyu küçük bir VPS'e koymak (aynı Docker kurulumu orada da çalışır),
- Caddy gibi bir ters vekil + modemde port yönlendirme.

Hangisi olursa olsun yapılacaklar aynı: adresin `mifarosa.com`'un alt alan adı olması (çerez
`SameSite=Lax` ile gidebilsin; örn. `suloop-api.mifarosa.com`), `server/.env`'de
`ALLOWED_ORIGIN=https://mifarosa.com` ve `COOKIE_SECURE=true`, Firebase'de `mifarosa.com`
yetkili alan, GitHub'da `API_URL` repo değişkeni (Settings → Secrets and variables → Actions →
Variables). O zamana kadar canlı oyunda hesap
bölümü görünmez.
