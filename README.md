# Wasorty

Renkli suları tüplere ayırdığın bulmaca oyunu. Tarayıcıda çalışır, kurulum ya da hesap gerektirmez.

**Oyna:** https://mifarosa.com/wasorty/

## Nasıl oynanır

- Bir tüpe dokun, tüp kalkar. Sonra başka bir tüpe dokun, üstteki renk oraya dökülür.
- Sıvı yalnızca boş bir tüpe ya da aynı rengin üstüne dökülebilir. Her tüp 4 birim alır.
- Tek renkle dolan tüpün kapağı kapanır. Her tüp kapanınca ya da boş kalınca seviye biter.

## Özellikler

- Kademeli öğrenme: sekiz aşama, her biri bir kural öğretir; ardından 40 Karışık seviye; oyun 300. seviyede biter ve bitirene özel bir kutlama sayfası açılır.
  Her aşama kuralı önce tek başına tanıtır, sonra önceki aşamaların kurallarıyla karıştırır:

  | Aşama       | Seviyeler | Kural                                  | Karışım                                             | Geri alma |
  | ----------- | --------- | -------------------------------------- | --------------------------------------------------- | --------- |
  | Kolay       | 1–15      | Düz tüpler, 3–5 renk                   | —                                                   | sınırsız  |
  | Tek Yönlü   | 16–35     | İçine dökülür, dışına dökülmez         | 31–35: 9–10 renkli final                            | 4         |
  | Uzun Tüp    | 36–60     | Her tüp 5 birim alır                   | 41–60: tek yönlü tüple                              | 4         |
  | Gizli Renk  | 61–90     | Alttaki renkler gizli                  | 66–75: uzun ya da tek yönlü; 76–90: ikisi birden    | 3         |
  | Çatlak Tüp  | 91–125    | İçine yalnızca 3 kez dökülür           | 96–110: uzun/gizli; 111–125: önceki 2–3 kural       | 3         |
  | Kilitli Tüp | 126–165   | Anahtar renk tamamlanınca buzu çözülür | 131–145: çatlak ya da tek yönlü; 146–165: iki kilit | 3         |
  | Yarım Tüp   | 166–210   | Yalnızca 2 birim alır, boş kalmalı     | 171–190: uzun tüple; 191–210: kilit/çatlak/gizli    | 3         |
  | Yağ         | 211–260   | Suyun üstünde durur                    | 216–235: tek yönlü ya da yarım; 236–260: 2–3 kural  | 3         |
  | Karışık     | 261–300   | Her seviyede rastgele 3–4 kural        | Son 40 seviye; oyun burada biter                    | 3         |

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
- Günün bulmacası: herkes aynı gün aynı bulmacayı oynar; her gün tarihe göre 1-2 özel kural (tek yön, uzun tüp, gizli renk, çatlak, kilitli, yarım tüp, yağ) çıkar
- Her seviye üretilirken çözücüyle denenir; çözülemeyen seviye çıkmaz
- **Yıldızlar:** her bulmacanın en az hamlesi arka planda (Web Worker) A\* aramasıyla bulunur.
  En az hamleyle (10 ve üzeri hamlelik bulmacalarda bir fazlasıyla) çözen 3, birkaç hamle fazlasıyla (en az + beşte biri, en az 2) çözen 2, daha
  fazlasıyla çözen 1 yıldız alır. Geri alınan hamleler sayılmaz. Bitiş ekranında yıldızlar, hamle
  sayın, en az hamle, kazandıkların ve seviyedeki son 5 denemen görünür; "Tekrar et" ve "Sonraki
  seviye" butonları vardır. Seviyeler ekranında her seviyenin en iyi yıldızları görünür
- **En az hamle nasıl bulunur:** seviyelerin (1–300) sayıları önceden hesaplanıp oyuna gömülüdür
  (`npm run bake`, `src/game/fewestTable.js`), herkeste aynıdır ve beklemeden görünür; seviyeler
  değişirse bir test tabloyu yeniletene kadar kırmızı kalır. Günlük bulmaca ve
  atölye bulmacaları oyun içinde aranır: önce kesin en kısa çözüm; bulmaca çok büyükse sabit
  hedefe acele eden ağırlıklı A\* aramalarının ve sabit tohumlu denemelerin en kısası (genelde en azdan
  en fazla birkaç hamle fazla; herkeste aynı sonuç, "bulunan en kısa" diye işaretlenir)
- **İpucu hakkı:** 2 ipucuyla başlarsın. Günün bulmacası her açılışta ayrıca 2 ipucuyla gelir; bunlar biriken haklarından düşmez. İpucu en kısa çözümün sonraki hamlesini gösterir ve 1
  hak harcar ve hamle sayına 1 ekler (yıldızı etkiler); geri alınca ikisi de geri gelmez, aynı durumda tekrar sormak ücretsizdir. Çıkmazdaysan hak
  gitmez. Günün bulmacasını çözünce (günde bir kez) 1 ipucu kazanırsın
- **Ekstra geri alma:** geri almanın sınırlı olduğu bir seviyeyi (16. seviyeden itibaren) ilk kez
  3 yıldızla geçince 1 ekstra geri alma kazanırsın; geri almanın sınırsız olduğu Kolay aşamada
  3 yıldız ödülsüz kutlanır.
  En fazla 5 tane birikir. Seviyenin kendi geri alma hakları bitince bunlar kullanılır; butonda "3+2" gibi görünür
- **Kapaklar ve geri alma:** tamamlanan tüpe sıvı inince kapak kapanır. Geri alınca kapak açılır
  ve sıvı geldiği tüpe geri akar; kilitler yeniden donar, çatlak tüpün dolum hakkı geri gelir
- **Yeni kural kartı:** yeni bir kuralın geldiği ilk seviyede (ve oyunun ilk seviyesinde), kural
  oyundaki tüpün aynısıyla çizilmiş bir kartla anlatılır. **(i) butonu** o seviyedeki bütün
  kuralları, yıldız sınırlarını, haklarını ve son 5 denemeni gösterir
- Geri al, ipucu ve baştan butonları başparmağın yetiştiği alt çubukta, kalan haklarıyla
- **Dil:** Türkçe ve İngilizce. İlk açılışta tarayıcının diline bakar, ayarlardan değişir (sayfa yeni
  dille yeniden yüklenir). Metinler `src/app/texts/` altında iki sözlükte durur; bir test anahtarların
  eşleştiğini kontrol eder. Bağlantı önizlemesi (Open Graph) tek dillidir (Türkçe)
- **Renk körlüğü desteği:** ayarlardan "Renklere sembol ekle": her rengin üstüne ayrı bir şekil
  çizilir (tahtada ve atölyede)
- **Sonucu paylaş:** bitiş ekranında; seviye ya da günün bulmacası için "⭐⭐⭐ 21 hamle · 🔥 3 gün"
  gibi bir metin ve bağlantı, destekleyen cihazlarda paylaşma menüsüyle, diğerlerinde kopyalayarak
- **Temalar:** ayarlardan (⚙︎) Klasik Laboratuvar (cihazın açık/koyu ayarını izler), Neon Gece
  (parlayan cam, neon renkler) ve Kokteyl Bar (amber ışık, içki renkleri). Seçilen tema sayfa
  açılırken hemen uygulanır, başka tema hiç görünmez
- **ASMR sesler ve titreşim:** sesler Web Audio API ile anında üretilir (indirilen ses dosyası
  yok): tüpü kaldırma "pop"u, döküm boyunca köpüren ve tüp doldukça inceleşen sıvı sesi, kapağın
  "tok"u, buzun çatırtısı, kazanma çanı. Destekleyen telefonlarda hafif titreşim. İkisi de
  ayarlardan kapatılabilir
- **PWA:** ana ekrana uygulama olarak yüklenebilir (Android/masaüstünde ayarlardaki "Uygulama
  olarak yükle", iPhone'da Safari → Paylaş → Ana Ekrana Ekle). İlk ziyaretten sonra internetsiz de
  oynanır; yeni sürüm yayınlanınca bağlantı varken hemen gelir
- **Günün bulmacası serisi:** günün bulmacasında ilk çözümün (hamle, süre, yıldız) ve kaç gün üst
  üste çözdüğün cihazda tutulur; seviyeler ekranındaki günün bulmacası kartında ve bitiş ekranında
  görünür. Google ile giriş yapan oyuncular herkesle günlük sıralamaya girer (aşağıda); Firebase bağlı
  değilken sıralama hiç görünmez
- **Bulmaca atölyesi:** seviyeler ekranındaki karttan. 8 kuralın hepsiyle kendi bulmacanı yaparsın:
  renk koy/al, kilit ve yağ ata, yarım/tek yönlü/çatlak tüp ekle, uzun tüp, gizli renk ve geri
  alma hakkı seç ya da rastgele doldur. Her değişiklikte bulmacanın çözülebildiği ve en az kaç
  hamlede çözüldüğü arka planda bulunur. "Dene" ile oynarsın (ipucu ücretsiz). Bulmaca JSON
  tabanlı bir kodla ya da `#bulmaca=…` bağlantısıyla paylaşılır; kod, bağlantı ya da düz JSON
  geri yüklenebilir. Taslağın cihazda saklanır
- Kaldığın seviye tarayıcıda saklanır. İstersen ayarlardan **Google ile giriş yaparsın**: ilerlemen
  (seviyeler, yıldızlar, her seviyenin son 5 çözümü, ipuçları, ekstra geri almalar, günlük seri)
  hesabında da durur ve başka cihazlarında gelir. Giriş yapmadan oynamaya devam edebilirsin.
  Birleştirme ilerlemeyi hiç geri götürmez. Hesabı Firebase tutar (aşağıda)
- Gerçekçi döküm: tüp, sıvı ağzına ulaşana kadar eğilir ve boşaldıkça daha çok eğilir; sıvının
  yüzeyi hep yatay kalır, akıntı tüpün dudağından düşer. Bir döküm sürerken sonraki hamle
  yapılabilir
- Kazanınca iki köşeden konfeti patlar (cihazda "hareketi azalt" açıksa çıkmaz)
- Seviyeler ekranında "Kahve ısmarla" butonu: oyunu beğenen
  [Buy Me a Coffee](https://buymeacoffee.com/mifarosa) üzerinden destek olabilir
- Telefonlarda akıcılık: tahta iki katman olarak çizilir. Duran tüpler alttaki canvas'a bir kez
  basılır; kalkan ya da dökülen tüp ve akan sıvı üstteki canvas'ta, yalnız kapladıkları alan
  silinip yeniden boyanarak çizilir. Eğilmeyen tüpler bir kez hazır görsele çizilip her karede o
  görsel basılır; neon parlama gölge yerine ince çizgilerle yapılır. Çözünürlük hep tam
  (en çok 2×)
- Canvas 2D ile çizilen cam tüpler, açık/koyu tema; ek kütüphane yok, oyun 86 KB (gzip 31 KB)

## Proje yapısı

```text
src/
  game/           Oyun kuralları. Saf JavaScript: DOM ya da çizim bilmez, testlerle korunur
    rules.js      Tahtanın kuralları (Board): dökme, yağ, özel tüpler, çözülme
    solver.js     Derinlik öncelikli çözücü (seviye doğrulama)
    shortest.js   En kısa çözüm (A*): yıldızlar ve ipucu için
    fewestWorker.js En az hamleyi arka planda bulan Web Worker
    stars.js      Yıldız sınırları
    customPuzzle.js Oyuncu bulmacaları: düzenleme, kontrol, paylaşım kodu
    puzzleFewest.js En az hamle (seviye, günlük ya da oyuncu bulmacası)
    generator.js  Tohumlu, çözülebilir bulmaca üretimi
    levels.js     Aşamalar, kuralların karışımı, seviye ve günlük bulmaca
    random.js     Tohumlu rastgele sayı üretici ve metin hash'i
    session.js    Bir oyunun durumu: seçim, hamle geçmişi, geri alma, ipucu
  scene/          Görünüm (Canvas 2D). Oyun kurallarını bilmez
    tubeScene.js  Tuval, ekrana sığdırma, dokunma algılama, kare çizim döngüsü
    renderer.js   Tüplerin ve döküm akıntısının çizimi
    liquid.js     Eğik tüpteki sıvının şekli (yüzey hep yatay)
    tubeView.js   Tek bir tüpün o anki görünümü (konum, eğim, sıvı seviyeleri)
    pour.js       Döküm animasyonu
    motions.js    Kaldırma, sallama, zıplama, parlama, kapak
    ruleIcon.js   Kural kartlarındaki örnek tüpler
    confetti.js   Kazanınca patlayan konfeti (kendi tuvalinde, her şeyin üstünde)
    layout.js     Tüplerin dizilişi ve ekrana ölçeklenmesi
    animator.js   Zamana bağlı animasyon altyapısı
    dimensions.js, palette.js
  app/            Parçaları birleştiren katman
    controller.js Oyuncu hareketlerini oyuna ve animasyonlara bağlar
    hud.js        Başlık, araç çubuğu, bildirim ve bitiş penceresi
    rulesDialog.js Yeni kural kartı ve (i) bilgi penceresi
    starIcons.js  Yıldız simgeleri
    editorDialog.js Bulmaca atölyesi
    settings.js, settingsDialog.js, theme.js Ayarlar ve temalar
    sound.js      Web Audio ile üretilen sesler
    feedback.js   Ses ve titreşim, oyun anlarına bağlı
    dailyResults.js, dailyBoard.js Günlük sonuçlar, seri ve sıralama
    leaderboardDialog.js Günlük sıralama penceresi
    economy.js    İpucu, ekstra geri alma ve seviye kayıtları
    fewestMoves.js En az hamleyi worker'a sorar, cevapları hatırlar
    levelMenu.js  Seviyeler ekranı
    progress.js   İlerlemenin kaydı
    cloudProgress.js Hesaptaki ilerlemenin belgesi ve cihazla birleşmesi
    accountPanel.js Ayarlardaki Hesap bölümü
    overlay.js    Pencerelerin açılıp kapanması
    texts.js, texts/ Oyuncunun gördüğü tüm metinler (tr.js, en.js), i18n.js, staticTexts.js
  cloud/          Firebase'e dokunan her şey (hesap, eşitleme); oyun mantığı bunu bilmez
    config.js, firebase.js, firebaseBackend.js Proje ayarı, tembel yükleme, Firestore işleri
    account.js    Giriş, kullanıcı adı
    cloudSync.js  İlerlemeyi hesapla eşitler
  main.js         Giriş noktası
tests/            Birim testleri
```

Katmanlar tek yönlü bağımlıdır: `app` → `game` ve `scene`. `game` hiçbir şeye bağlı değildir.
Seviyeler seviye numarasından üretilir. Bu yüzden bir seviye her cihazda ve her sürümde aynıdır.
Testler de bunu korur.

## Hesap ve bulut (Firebase)

Giriş ve ilerleme eşitlemesi bir Firebase projesinde durur: Google ile giriş, herkese görünen
benzersiz kullanıcı adı ve oyuncunun kendi ilerleme belgesi. Oyuncu herhangi bir cihazdan girince
ilerlemesi gelir; giriş yapmadan oynamaya devam edilebilir. Kurulum, kuralların yüklenmesi ve
veri modeli `docs/firebase.md` dosyasında; kurallar `firestore.rules` içindedir. Firebase paketi
yalnız giriş yapılınca (ya da önceki oturum geri yüklenirken) indirilir; hiç giriş yapmayan
oyuncuya hiçbir şey yüklenmez.

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

### Herkesle günlük sıralama

Sıralama Firebase hesabına bağlıdır (`docs/firebase.md`): giriş yapıp kullanıcı adı seçen oyuncunun
günün bulmacasındaki ilk sonucu `daily/{gün}/scores/{uid}` altına yazılır. Puan = en az
hamle / kullanılan hamle oranından en çok 1000 puan, her dolu dakika için 5 puan kesinti (en çok
150). Sıralama puana, eşitlikte süreye göredir. Her oyuncunun günde yalnızca ilk sonucu sayılır ve
kimse başkasınınkini değiştiremez. Güvenlik kuralları (`firestore.rules`) değer aralıklarını
denetler; hamle kaydı (`dailyMoves`) ileride bir doğrulama işçisinin hileli skorları ayıklaması
için ayrıca saklanır. Kuralları değiştirince Firebase konsolunda Firestore → Rules'tan yayınla.
