# Yiğit Ticaret - Su Takip Sistemi

Yerel ticari işlemler için geliştirilmiş tam stack web uygulaması. Ürün yönetimi, siparış takibi, müşteri yönetimi ve finansal raporlama özellikleri sunar.

## ✨ Özellikler

- 📦 **Ürün Yönetimi** - Stok, birim fiyat ve satış fiyatı takibi
- 🛒 **Sipariş Yönetimi** - Hızlı sipariş girişi ve takibi
- 👥 **Müşteri Yönetimi** - Müşteri bilgileri ve iletişim
- 💳 **Borç Takibi** - Müşteri borçları ve tahsilat kaydı
- 💰 **Finansal Durum** - Gelir, gider ve kâr hesaplamaları
- 📊 **Raporlar** - Yazdırılabilir detaylı raporlar

## 🚀 Hızlı Başlangıç

### Ön Koşullar

- **Node.js** (v14 veya üzeri)
- **MongoDB** (v5.0 veya üzeri) - [İndir](https://www.mongodb.com/try/download/community)
- **npm** (Node.js ile birlikte gelir)

### 1. MongoDB'yi Kurun ve PATH'e Ekleyin

#### Windows

1. [MongoDB Community Server](https://www.mongodb.com/try/download/community) indir ve kur
2. Kurulum sırasında "Install as a Service" seçeneğini işaretle

**PATH'e Eklemek İçin (3 Yöntem):**

**🟢 Yöntem 1: Otomatik Script (Önerilen)**

Proje klasöründe:
```powershell
# PowerShell'i Yönetici olarak aç, sonra:
.\setup-mongodb-path.ps1
```

**🟡 Yöntem 2: PowerShell Komutu**

```powershell
# PowerShell'i Yönetici olarak aç
$mongoPath = "C:\Program Files\MongoDB\Server\8.0\bin"
$currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($currentPath -notlike "*$mongoPath*") {
    [Environment]::SetEnvironmentVariable('PATH', "$currentPath;$mongoPath", 'User')
    Write-Host "✅ MongoDB PATH'e eklendi! Lütfen PowerShell'i yeniden başlat."
}
```

**🔵 Yöntem 3: El ile (GUI)**

1. Windows başlat menüsünde `ortam değişkenleri` yaz
2. "Sistem ortam değişkenlerini düzenle" tıkla
3. "Ortam Değişkenleri..." butonuna tıkla
4. **Kullanıcı değişkenleri** → PATH → Düzenle
5. "Yeni" tıkla ve şu yolu ekle: `C:\Program Files\MongoDB\Server\8.0\bin`
6. Tamam tıkla

**Versiyon Farklıysa:**

PowerShell'de şu komutu çalıştır:
```powershell
Get-ChildItem "C:\Program Files\MongoDB\Server" | Select-Object Name
```

Çıkan version'u (8.0, 7.0, vs.) PATH yoluna yerleştir.

**PATH Eklendimi Test Et:**

PowerShell'i yeniden aç ve:
```powershell
mongod --version
```

Version numarası çıkarsa ✅ başarılı!

#### Mac/Linux

```bash
# Homebrew kullanarak (Mac)
brew install mongodb-community

# Kurulduktan sonra test et
mongod --version
```

### 2. Bağımlılıkları Yükleyin

Proje klasöründe şu komutu çalıştırın:

```bash
npm install
```

Bu komut root, backend ve frontend klasörlerindeki `node_modules`'ü yükleyecektir.

### 3. Uygulamayı Başlatın

```bash
npm run dev
```

**Bu komut:**
- ✅ MongoDB'yi otomatik olarak başlatır
- ✅ Backend sunucusunu başlatır (`http://localhost:5000`)
- ✅ Frontend geliştirme sunucusunu başlatır (tarayıcıda otomatik açılır)

**Not:** MongoDB'nin kurulu ve PATH'de olması gerekir. Eğer `mongod` komutu çalışmazsa, [MongoDB Community Server](https://www.mongodb.com/try/download/community) kurulumunu kontrol edin.

## 📁 Proje Yapısı

```
su-takip-sistemi/
├── backend/                 # Express.js sunucusu
│   ├── server.js           # Ana sunucu dosyası
│   ├── .env                # Yapılandırma (MONGO_URI, PORT)
│   ├── .env.example        # Örnek yapılandırma
│   └── package.json
├── frontend/               # React + Vite uygulaması
│   ├── src/
│   │   ├── App.jsx        # Ana uygulama bileşeni
│   │   └── main.jsx       # Giriş noktası
│   ├── .env               # Frontend yapılandırması (VITE_API_URL)
│   ├── .env.example       # Örnek yapılandırma
│   └── package.json
├── package.json            # Root paket (dev script'i için)
├── .gitignore             # Git yoksayma kuralları
└── README.md              # Bu dosya
```

## ⚙️ Yapılandırma

### Backend Yapılandırması (`.env`)

```
MONGO_URI=mongodb://localhost:27017/su_takip_db
PORT=5000
```

### Frontend Yapılandırması (`.env`)

```
VITE_API_URL=http://localhost:5000
```

## 🛑 Sorunda Karşılaşıyorsanız

### MongoDB bağlantısı başarısız

```
❌ Veritabanı Hatası: connect ECONNREFUSED
```

**Çözüm:** MongoDB servisi başlatılmış mı kontrol edin:
```bash
# Windows: MongoDB'nin kurulup kurulmadığını kontrol edin
mongod
```

### Port 5000 zaten kullanımda

```
Error: listen EADDRINUSE :::5000
```

**Çözüm:** `.env` dosyasındaki PORT'u değiştirin:
```
PORT=5001
```

Sonra frontend `.env` dosyasını da güncelleyin:
```
VITE_API_URL=http://localhost:5001
```

### Frontend bağlantı hatası

```
Network Error: Could not connect to http://localhost:5000
```

**Çözüm:** 
1. Backend'in çalışıp çalışmadığını kontrol edin
2. `.env` dosyasında doğru API URL'si olduğunu kontrol edin
3. Browser konsolda hata mesajını kontrol edin

## 🎯 Günlük Kullanım

### Her Defasında Çalıştırılacak Komut

```bash
npm run dev
```

Bu komut otomatik olarak:
- MongoDB'yi başlatır
- Backend API sunucusunu başlatır
- Frontend geliştirme sunucusunu başlatır

**CTRL+C** tuşlarına basarak tüm hizmetleri kapatabilirsiniz.
1. Sol menüden **Ürünler** seçin
2. "Yeni Ürün Ekle" butonuna tıklayın
3. Ürün bilgilerini girin ve kaydedin

### Sipariş Girme
1. Sol menüden **Siparişler** seçin
2. "Sipariş Gir" butonuna tıklayın
3. Müşteri seçin, ürünleri ekleyin
4. Sepeti onaylayın

### Borç Tahsilatı
1. Sol menüden **Borçlar** seçin
2. İlgili müşteriyi bulun
3. "Tahsilat Al" butonuna tıklayın
4. Tutar ve ödeme yöntemini seçin

### Raporlar
- Sayfaların sağ üstündeki **"Yazdır"** butonuyla detaylı PDF raporları alabilirsiniz

## 📝 Notlar

- Uygulamada tüm veriler MongoDB veritabanında saklanır
- Browser's localStorage kullanıcının oturum durumunu hatırlar
- Raporlar tarayıcının baskı işlevini kullanarak yazdırılır

## 🔐 Güvenlik Önerileri (Üretim için)

- Şifreleri bcrypt ile şifreleme ekleyin
- CORS ayarlarını kısıtlayın
- HTTPS kullanın
- Environment variable'ları güvenli saklayın
- Veritabanı yedeklerini düzenli olarak alın

## 📞 Destek

Sorunlar veya öneriler için lütfen server.js dosyasında açıklanan API routes'ları kontrol edin.

---

**Son Güncelleme:** Ocak 2026 | **Sürüm:** 1.0.0
