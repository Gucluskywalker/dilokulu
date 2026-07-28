# Deutsch, wieder… — Uygulama Kurulumu

Bu klasör bir **uygulama**. iPhone ve iPad'de ana ekrandan, kendi ikonuyla,
tam ekran açılır. Çevrimdışı çalışır, ilerlemenizi hatırlar.

---

## ⚠ GitHub "Commit failed" hatası aldıysanız

Sebebi belli: görseller 2K PNG olarak indi, toplam **151 MB**. GitHub'ın
tarayıcı yükleyicisi bunu kaldırmıyor.

Zaten bu boyut bir telefon uygulaması için gereksiz. Çözüm aşağıdaki
**Adım 1**: görselleri telefon boyutuna küçültüyoruz.

> **151 MB → 5,6 MB.** Depo toplamı 14 MB'a iner, GitHub'a rahat sığar,
> telefonda çok daha hızlı açılır. Gözle fark edilir bir kalite kaybı olmaz —
> zaten hiçbir ekran 2752 piksel genişliğinde göstermiyor.

**Acele ediyorsanız:** `media` klasörünü *hiç yüklemeden* diğer her şeyi
yükleyin. Uygulama görselleri ve sesleri internetten çeker, tamamen çalışır.
Sadece çevrimdışı kullanım için `media` gerekiyor. Sonra sakin sakin
küçültüp eklersiniz.

---

## ADIM 1 — Medyayı hazırlayın (3–5 dk)

1. `tools` klasörünü açın
2. **`medya-hazirla.command`** dosyasına çift tıklayın
3. Terminal açılır; elinizdeki PNG'leri küçültüp JPEG'e çevirir, eksikleri indirir
4. Bitince "Hazır" der ve toplam boyutu gösterir — **~13 MB** görmelisiniz

> macOS "geliştirici doğrulanamadı" derse: dosyaya **sağ tık → Aç**, sonra
> çıkan uyarıda yine **Aç**. Bir kez yeterli.

Betik akıllıdır: indirilmiş PNG varsa yeniden indirmez, onu kullanır.
Yarıda kalırsa tekrar çalıştırın — hazır olanları atlar.

*(Eski `medya-indir.command` artık kullanılmıyor, silebilirsiniz.)*

---

## ADIM 2 — Mac'te deneyin (2 dk)

Bu uygulama **bir web sunucusundan** açılmalı. `index.html` dosyasına çift
tıklamak çalışmaz — tarayıcı güvenlik kuralı.

1. `tools` klasöründe **`yerel-sunucu.command`** dosyasına çift tıklayın
2. Tarayıcı kendiliğinden açılır
3. Dört üniteyi de görmelisiniz. Birine girip alıştırma çözün, ses çalın.
4. Bitince Terminal penceresinde **Ctrl + C**

Buraya kadar çalışıyorsa geri kalanı kesin çalışır.

---

## ADIM 3 — Yayınlayın ve telefona kurun (10 dk)

### 3a · GitHub hesabı

1. [github.com](https://github.com) → **Sign up** (ücretsiz)
2. Kullanıcı adı seçin — adresinizin parçası olacak

### 3b · Depoyu oluşturun

1. Sağ üstteki **+** → **New repository**
2. **Repository name:** `deutsch`
3. **Public** kalsın — Pages ücretsiz sürümde bunu ister
4. **Create repository**

> Public demek adres teknik olarak açık demek. Hiçbir yerde listelenmez,
> arama motoruna düşmesi için birinin bağlantı vermesi gerekir. Kişisel ders
> materyali için sorun değil. Gizlilik şartsa Cloudflare Pages'e geçebiliriz,
> orada şifre koyulabiliyor.

### 3c · Dosyaları yükleyin

1. Yeni depoda **uploading an existing file** bağlantısına tıklayın
2. Finder'da bu klasörün içine girin, **Cmd + A** ile hepsini seçin,
   tarayıcı penceresine sürükleyin
3. Aşağıda **Commit changes**

> Yine takılırsa: önce `media` klasörü **hariç** her şeyi yükleyin, commit edin.
> Sonra ikinci bir yüklemede sadece `media` klasörünü ekleyin. GitHub böyle
> parça parça kabul eder.
>
> Ya da hiç uğraşmadan **GitHub Desktop** uygulamasını kurun
> ([desktop.github.com](https://desktop.github.com)) — orada boyut sınırı yok,
> klasörü sürükleyip *Publish* demeniz yeter.

### 3d · Pages'i açın

1. Depoda üstten **Settings** → sol menüden **Pages**
2. **Source:** `Deploy from a branch`
3. **Branch:** `main` · klasör: `/ (root)` → **Save**
4. 1–2 dakika bekleyin, sayfayı yenileyin

Adresiniz:

```
https://KULLANICIADINIZ.github.io/deutsch/
```

### 3e · iPhone / iPad'e kurun

1. **Safari**'de bu adresi açın (Chrome değil — Safari şart)
2. Alttaki **Paylaş** düğmesi (yukarı oklu kare)
3. **Ana Ekrana Ekle**
4. İsim: `Deutsch` → **Ekle**

Bitti. Ana ekranda kendi ikonu var. Dokununca Safari arayüzü olmadan
tam ekran açılır. İlk açılışta içeriği önbelleğe alır; sonra uçak modunda
da çalışır.

---

## Sonra ne olacak

**Yeni ünite** (A2, B1, B2): Ben `content/de/a2/unit01.html` + `.json` üretirim,
`catalog.json`'a bir satır eklerim. Siz GitHub'a o dosyaları ekleyip
`medya-hazirla.command` çalıştırırsınız. Telefonunuzdaki uygulama kendini
günceller — yeniden kurmanıza gerek yok.

**Yeni dil** (İngilizce, İspanyolca, Fransızca): `content/en/`, `content/es/`,
`content/fr/` klasörleri açılır, ana ekrandaki gri "yakında" sekmeleri
aktifleşir. Motor, tasarım, ses oynatıcı, ilerleme takibi ortak kalır.

**Güncelleme görünmezse:** uygulamayı tamamen kapatıp (kaydırarak) yeniden açın.

---

## Klasör yapısı

```
index.html               uygulama kabuğu
app.css                  tüm tasarım — tek yerde
app.js                   motor: menü, alıştırmalar, ses, ilerleme
manifest.webmanifest     PWA tanımı
sw.js                    çevrimdışı önbellek

content/
  catalog.json           diller, seviyeler, üniteler
  de/a1/unit01.html …    ünite içeriği (12 sayfa)
  de/a1/unit01.json …    başlık, medya haritası, sayfa listesi

media/de/a1/             görseller (.jpg) ve sesler (.mp3)
icons/                   uygulama ikonları
tools/
  medya-hazirla.command  görselleri küçültür, eksikleri indirir
  yerel-sunucu.command   Mac'te test sunucusu
  media-list.tsv         dosya listesi
```

Tasarımı değiştirmek isterseniz tek dosya var: `app.css`.
Dört üniteye birden yansır.

---

## Sorun giderme

**GitHub "Commit failed / file is too large"**
→ `medya-hazirla.command` çalıştırın (151 MB → 13 MB). Ya da media'yı
   ikinci bir yüklemede ayrı gönderin. Ya da GitHub Desktop kullanın.

**"Uygulama yüklenemedi" yazısı**
→ Dosyaya çift tıklayarak açtınız. Sunucudan açın:
   `tools/yerel-sunucu.command` ya da GitHub Pages adresi.

**Görseller boş / çizgili kutu · ses "dosya yok" diyor**
→ Medya hazırlanmamış. `medya-hazirla.command` çalıştırın. İnternet varsa
   uygulama zaten CDN'e düşer, yine de çalışır.

**Ana Ekrana Ekle görünmüyor**
→ Chrome kullanıyorsunuz. iOS'ta bu özellik yalnızca Safari'de var.

**GitHub Pages 404**
→ 1–2 dakika bekleyin. Olmuyorsa Settings → Pages'te branch `main`,
   klasör `/ (root)` mu, kontrol edin.
