# suloop

Renkli suları tüplere ayırdığın bulmaca oyunu. Tarayıcıda çalışır, kurulum ya da hesap gerektirmez.

**Oyna:** https://mifarosa.com/suloop/

## Nasıl oynanır

- Bir tüpe dokun, tüp kalkar. Sonra başka bir tüpe dokun, üstteki renk oraya dökülür.
- Sıvı yalnızca boş bir tüpe ya da aynı rengin üstüne dökülebilir. Her tüp 4 birim alır.
- Her tüpte tek renk kalınca seviye biter.

## Özellikler

- Kolaydan zora dört bölüm, ardından bitmeyen Usta seviyeleri:

  | Bölüm | Seviyeler | Tahta                                                         |
  | ----- | --------- | ------------------------------------------------------------- |
  | Kolay | 1–15      | 3–5 renk, 2 boş tüp                                           |
  | Orta  | 16–30     | 6–8 renk, 2 boş tüp                                           |
  | Zor   | 31–45     | 9–10 renk, 2 boş tüp                                          |
  | Uzman | 46–60     | 6–7 renk, yalnızca 1 boş tüp                                  |
  | Usta  | 61 ve öte | 6–10 renk; sırayla tek boş tüp, gizli renk, uzun ve yarım tüp |

  Usta seviyeleri artık zorlaşmaz ama hep zordur. Her seviye numarası herkeste aynı tahtayı verir.
  **Gizli renkler:** her tüpte başta yalnızca en üstteki renk görünür; alttakiler, üstündekiler
  döküldükçe açılır ve bir kez görüleni geri al ya da baştan başla tekrar gizlemez. İpucu gerçek
  renkleri bilir. **Uzun tüpler:** her tüp 4 yerine 5 birim alır. **Yarım tüp:** boş tüplerden
  biri yalnızca 2 birim alır ve sonunda boş kalmalıdır. **Sınırlı geri alma:** Usta seviyelerinde
  3 geri alma hakkı vardır; baştan başlayınca yenilenir. Her kural ilk çıktığı seviyede kısaca
  anlatılır.

- Seviyeler ekranı: çözülen seviyeler bölümün rengiyle dolar, sıradaki seviye açık, ötesi kilitli.
  Çözülmüş bir seviyeye dönüp tekrar oynanabilir
- Günün bulmacası: herkes aynı gün aynı bulmacayı oynar
- Her seviye üretilirken çözücüyle denenir; çözülemeyen seviye çıkmaz
- Geri al, baştan başla ve ipucu ("2. tüpten 5. tüpe dök")
- Kaldığın seviye tarayıcıda saklanır. "İlerlemeyi taşı" ile kısa bir kod ya da bağlantı alıp
  başka bir cihazda (ya da tarayıcı verisi silindikten sonra) kaldığın yerden devam edersin.
  Yükleme ilerlemeyi hiç geri götürmez: eski bir kod hiçbir şeyi silmez
- Canvas 2D ile çizilen cam tüpler, döküm animasyonu, açık/koyu tema; ek kütüphane yok, oyun 28 KB

## Proje yapısı

```text
src/
  game/           Oyun kuralları. Saf JavaScript: DOM ya da çizim bilmez, testlerle korunur
    rules.js      Tüp kuralları: dökme, tamamlanma, çözülme
    solver.js     Derinlik öncelikli çözücü (seviye doğrulama ve ipucu)
    generator.js  Tohumlu, çözülebilir bulmaca üretimi
    levels.js     Bölümler, zorluk eğrisi, seviye ve günlük bulmaca
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
    levelMenu.js  Seviyeler ekranı
    progress.js   İlerlemenin kaydı
    progressCode.js İlerleme kodu ve bağlantısı
    transferDialog.js "İlerlemeyi taşı" penceresi
    overlay.js    Pencerelerin açılıp kapanması
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
