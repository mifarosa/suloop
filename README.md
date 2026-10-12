# suloop

Renkli suları tüplere ayırdığın bulmaca oyunu. Tarayıcıda çalışır, kurulum ya da hesap gerektirmez.

**Oyna:** https://mifarosa.com/suloop/

## Nasıl oynanır

- Bir tüpe dokun, tüp kalkar. Sonra başka bir tüpe dokun, üstteki renk oraya dökülür.
- Sıvı yalnızca boş bir tüpe ya da aynı rengin üstüne dökülebilir. Her tüp 4 birim alır.
- Her tüpte tek renk kalınca seviye biter.

## Özellikler

- Kademeli öğrenme: sekiz aşama, her biri bir kural öğretir; ardından bitmeyen Usta seviyeleri.
  Her aşama kuralı önce tek başına tanıtır, sonra önceki aşamaların kurallarıyla karıştırır:

  | Aşama       | Seviyeler  | Kural                                  | Karışım                                             | Geri alma |
  | ----------- | ---------- | -------------------------------------- | --------------------------------------------------- | --------- |
  | Kolay       | 1–15       | Düz tüpler, 3–5 renk                   | —                                                   | sınırsız  |
  | Tek Yönlü   | 16–35      | İçine dökülür, dışına dökülmez         | 31–35: 9–10 renkli final                            | 4         |
  | Uzun Tüp    | 36–60      | Her tüp 5 birim alır                   | 41–60: tek yönlü tüple                              | 4         |
  | Gizli Renk  | 61–90      | Alttaki renkler gizli                  | 66–75: uzun ya da tek yönlü; 76–90: ikisi birden    | 3         |
  | Çatlak Tüp  | 91–125     | İçine yalnızca 3 kez dökülür           | 96–110: uzun/gizli; 111–125: önceki 2–3 kural       | 3         |
  | Kilitli Tüp | 126–165    | Anahtar renk tamamlanınca buzu çözülür | 131–145: çatlak ya da tek yönlü; 146–165: iki kilit | 3         |
  | Yarım Tüp   | 166–210    | Yalnızca 2 birim alır, boş kalmalı     | 171–190: uzun tüple; 191–210: kilit/çatlak/gizli    | 3         |
  | Yağ         | 211–260    | Suyun üstünde durur                    | 216–235: tek yönlü ya da yarım; 236–260: 2–3 kural  | 3         |
  | Usta        | 261 ve öte | Her seviyede rastgele 3–4 kural        | Bitmez, hep zordur                                  | 3         |

  Her aşama biraz daha kolay başlar ve sonuna doğru zorlaşır. Her seviye numarası herkeste aynı
  tahtayı verir. Geri alma hakkı baştan başlayınca yenilenir.

  - **Gizli renkler:** başta her tüpün yalnızca en üstü görünür; alttakiler, üstündekiler döküldükçe
    açılır. Bir kez görülen geri alınca ya da baştan başlayınca tekrar gizlenmez. İpucu gerçek
    renkleri bilir. Yağ hep görünür.
  - **Uzun tüp:** her tüp 5 birim alır. **Yarım tüp:** yalnızca 2 birim alır, sonunda boş kalmalı.
  - **Tek yönlü tüp:** içine dökülür, dışına dökülmez.
  - **Çatlak tüp:** içine yalnızca 3 kez dökülebilir, dışına her zaman.
  - **Kilitli tüp:** kilidindeki renkte bir tüp tamamlanana kadar buzla kaplıdır.
  - **Yağ:** suyun üstünde durur. Su yağın altına geçer; yağ kalkmadan altındaki su dökülmez.

  Her kural ve her yeni geri alma hakkı ilk çıktığı seviyede kısaca anlatılır.

- Seviyeler ekranı: çözülen seviyeler aşamanın rengiyle dolar, sıradaki seviye açık, ötesi kilitli.
  Çözülmüş bir seviyeye dönüp tekrar oynanabilir
- Günün bulmacası: herkes aynı gün aynı bulmacayı oynar
- Her seviye üretilirken çözücüyle denenir; çözülemeyen seviye çıkmaz
- Geri al, baştan başla ve ipucu ("2. tüpten 5. tüpe dök")
- Kaldığın seviye tarayıcıda saklanır. "İlerlemeyi taşı" ile kısa bir kod ya da bağlantı alıp
  başka bir cihazda (ya da tarayıcı verisi silindikten sonra) kaldığın yerden devam edersin.
  Yükleme ilerlemeyi hiç geri götürmez: eski bir kod hiçbir şeyi silmez
- Gerçekçi döküm: tüp, sıvı ağzına ulaşana kadar eğilir ve boşaldıkça daha çok eğilir; sıvının
  yüzeyi hep yatay kalır, akıntı tüpün dudağından düşer. Bir döküm sürerken sonraki hamle
  yapılabilir
- Kazanınca iki köşeden konfeti patlar (cihazda "hareketi azalt" açıksa çıkmaz)
- Seviyeler ekranında "Kahve ısmarla" butonu: oyunu beğenen
  [Buy Me a Coffee](https://buymeacoffee.com/mifarosa) üzerinden destek olabilir
- Canvas 2D ile çizilen cam tüpler, açık/koyu tema; ek kütüphane yok, oyun 42 KB

## Proje yapısı

```text
src/
  game/           Oyun kuralları. Saf JavaScript: DOM ya da çizim bilmez, testlerle korunur
    rules.js      Tahtanın kuralları (Board): dökme, yağ, özel tüpler, çözülme
    solver.js     Derinlik öncelikli çözücü (seviye doğrulama ve ipucu)
    generator.js  Tohumlu, çözülebilir bulmaca üretimi
    levels.js     Aşamalar, kuralların karışımı, seviye ve günlük bulmaca
    random.js     Tohumlu rastgele sayı üretici ve metin hash'i
    session.js    Bir oyunun durumu: seçim, hamle geçmişi, geri alma
  scene/          Görünüm (Canvas 2D). Oyun kurallarını bilmez
    tubeScene.js  Tuval, ekrana sığdırma, dokunma algılama, kare çizim döngüsü
    renderer.js   Tüplerin ve döküm akıntısının çizimi
    liquid.js     Eğik tüpteki sıvının şekli (yüzey hep yatay)
    tubeView.js   Tek bir tüpün o anki görünümü (konum, eğim, sıvı seviyeleri)
    pour.js       Döküm animasyonu
    motions.js    Kaldırma, sallama, zıplama, parlama
    confetti.js   Kazanınca patlayan konfeti (kendi tuvalinde, her şeyin üstünde)
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
