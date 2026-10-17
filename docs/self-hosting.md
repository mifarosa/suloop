# Kendi sunucunda çalıştırma (Windows + Docker Desktop)

suloop'un hesap özelliği için küçük bir sunucu gerekir (`server/`). Oyun statik bir sayfa olarak
GitHub Pages'te durur; sunucuyu Pages barındıramaz, o yüzden sunucu ayrı bir Docker konteyneri
olarak çalışır. Kurulum [Dozi](https://github.com/mifarosa/dozi)'nin sunucusuyla aynı düzende:
`server/Dockerfile`, `server/docker-compose.yml`, `server/.env`, veri için adlandırılmış volume.

## Google istemci kimliği

Giriş için bir kez OAuth istemci kimliği gerekir (gizli anahtar yok):

1. https://console.cloud.google.com → bir proje seç (ya da aç) → **APIs & Services → OAuth consent screen**:
   uygulama adını (suloop) ve e-postanı gir, kullanıcı türü **External**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized JavaScript origins**: `http://localhost:5173` (yerel deneme). Canlıya açınca
   `https://mifarosa.com` da eklenir. Redirect URI gerekmez.
4. Çıkan `….apps.googleusercontent.com` kimliğini kopyala.

Consent screen "Testing" durumundayken yalnız eklediğin **test kullanıcıları** girebilir; herkes
girsin diye "Publish app" de.

## Sunucuyu aç

PowerShell'de, depo klasöründe:

```powershell
Copy-Item server\.env.example server\.env
notepad server\.env        # GOOGLE_CLIENT_ID değerini yaz
docker compose -f server/docker-compose.yml up -d --build
curl http://localhost:3000/healthz
```

`server/.env` satır sonları **LF** kalmalı (`server/.gitattributes` bunu korur; dosyayı bir
düzenleyicide CRLF olarak kaydedersen kimlik tutmaz).

Oyunu yerelde aç: depo kökünde `.env.local` dosyası yap

```
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_CLIENT_ID=<aynı istemci kimliği>
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
`ALLOWED_ORIGIN=https://mifarosa.com` ve `COOKIE_SECURE=true`, Google istemcisine
`https://mifarosa.com` kaynağı, GitHub'da `API_URL` ve `GOOGLE_CLIENT_ID` repo değişkenleri
(Settings → Secrets and variables → Actions → Variables). O zamana kadar canlı oyunda hesap
bölümü görünmez.
