# suloop

Renkli suları tüplere ayırdığın bulmaca oyunu. Tarayıcıda çalışır, kurulum ya da hesap gerektirmez.

**Oyna:** https://mifarosa.com/suloop/

## Nasıl oynanır

- Bir tüpe dokun, tüp kalkar. Sonra başka bir tüpe dokun, üstteki renk oraya dökülür.
- Sıvı yalnızca boş bir tüpe ya da aynı rengin üstüne dökülebilir. Her tüp 4 birim alır.
- Her tüpte tek renk kalınca seviye biter.

## Özellikler

- Sonsuz seviye: 3 renkle başlar, her iki seviyede bir renk eklenir (en fazla 10)
- Günün bulmacası: herkes aynı gün aynı bulmacayı oynar
- Her seviye üretilirken çözücüyle denenir; çözülemeyen seviye çıkmaz
- Geri al, baştan başla ve ipucu ("2. tüpten 5. tüpe dök")
- Kaldığın seviye tarayıcıda saklanır
- Canvas 2D ile çizilen cam tüpler, döküm animasyonu, açık/koyu tema; ek kütüphane yok, oyun 16 KB

## Proje yapısı

```text
src/
  game/           Oyun kuralları. Saf JavaScript: DOM ya da çizim bilmez, testlerle korunur
    rules.js      Tüp kuralları: dökme, tamamlanma, çözülme
    solver.js     Derinlik öncelikli çözücü (seviye doğrulama ve ipucu)
    generator.js  Tohumlu, çözülebilir bulmaca üretimi
    levels.js     Zorluk eğrisi, seviye ve günlük bulmaca
    random.js     Tohumlu rastgele sayı üretici ve metin hash'i
    session.js    Bir oyunun durumu: seçim, hamle geçmişi, geri alma
  scene/          Görünüm (Canvas 2D). Oyun kurallarını bilmez
    tubeScene.js  Tuval, ekrana sığdırma, dokunma algılama, kare çizim döngüsü
    renderer.js   Tüplerin ve döküm akıntısının çizimi
    tubeView.js   Tek bir tüpün o anki görünümü (konum, eğim, sıvı seviyeleri)
    pour.js       Döküm animasyonu
    motions.js    Kaldırma, sallama, zıplama, parlama
    layout.js     Tüplerin dizilişi ve ekrana ölçeklenmesi
    animator.js   Zamana bağlı animasyon altyapısı
    dimensions.js, palette.js
  app/            Parçaları birleştiren katman
    controller.js Oyuncu hareketlerini oyuna ve animasyonlara bağlar
    hud.js        Başlık, butonlar, bildirim ve tebrik penceresi
    progress.js   İlerlemenin kaydı
    texts.js      Oyuncunun gördüğü tüm metinler
  main.js         Giriş noktası
tests/            Birim testleri
```

Katmanlar tek yönlü bağımlıdır: `app` → `game` ve `scene`. `game` hiçbir şeye bağlı değildir.
Seviyeler seviye numarasından üretilir. Bu yüzden bir seviye her cihazda ve her sürümde aynıdır.
Testler de bunu korur.

## Geliştirme

Gereksinim: Node.js 22.13+

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # birim testleri
npm run lint      # ESLint
npm run format    # Prettier ile biçimlendirme
npm run build     # dist/ altına üretim derlemesi
npm run preview   # derlemeyi yerelde sunar
```

`main` dalına her push'ta GitHub Actions testleri çalıştırır ve oyunu GitHub Pages'e yayınlar.
