# Wasorty'yi kendi server'ından dağıtmak (APK ve iPhone)

Derlemeyi EAS (Expo bulutu) yapar; bu klasör, bitmiş derlemenin APK/IPA dosyalarını kendi
server'ına çekip telefonda açılan bir kurulum sayfası yayınlar.

## Gerekenler

- Docker olan bir Linux server, `jq` ve Node 22 (`publish.sh` `eas-cli`'yi `npx` ile çalıştırır).
- Bir alan adı: DNS A kaydı server'ı göstersin, router'da **80 ve 443** portları server'a yönlensin.
  iPhone kurulumu **geçerli bir HTTPS sertifikası** ister; Caddy bunu Let's Encrypt'ten kendisi alır.
  Yalnız yerel ağda ve alan adı olmadan sadece Android çalışır.
- expo.dev'de Access Token (Account settings → Access tokens).
- iPhone için: Apple Developer hesabı, `eas device:create` ile kayıtlı cihaz ve iOS derlemesi
  (`cd app && npx eas-cli build -p ios --profile preview`). Android: `-p android --profile preview`.
  `preview` derlemesi kendi içinde çalışır (development derlemesi gibi geliştirme sunucusu istemez).

## Kurulum

```bash
cd distribution
cp .env.example .env      # DOMAIN ve EXPO_TOKEN'ı doldur (.env repoya girmez)
docker compose up -d      # sayfa https://<alan adı>/ adresinde açılır
./publish.sh              # son bitmiş derlemeleri çeker, sayfayı yazar
```

Telefondan adresi aç. iPhone'da **Safari** ile aç → "Install on iPhone". İlk seferde:
Ayarlar → Gizlilik ve Güvenlik → **Geliştirici Modu**, sonra Ayarlar → Genel → **VPN ve Aygıt
Yönetimi** → profile güven. Android'de "Download for Android" → indirilen APK'yı aç
(tarayıcıya yükleme izni ver).

## Yeni sürüm

Yeni bir EAS derlemesi bitince yalnızca `./publish.sh` çalıştır. Otomatik olsun istersen:

```
0 * * * * cd /srv/wasorty/distribution && ./publish.sh >> publish.log 2>&1
```

## Notlar

- IPA, yalnız EAS'a kayıtlı iPhone'lara kurulur (en fazla 100 cihaz). Yeni telefon eklersen
  `eas device:create` yapıp iOS'u yeniden derle.
- `EXPO_TOKEN` sadece server'daki `.env` dosyasında durur; repoya ya da sohbete koyma (bkz.
  ../SECURITY.md).
