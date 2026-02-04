# Veritabanı Yönetim Araçları

Bu dosya, Yiğit Ticaret Su Takip Sistemi'nin veritabanı yönetim araçlarını açıklamaktadır.

## Veritabanı Durumu (Son Kontrol: 01.02.2026)

### İstatistikler
- **Ürünler (Products)**: 6
- **Müşteriler (Customers)**: 13
- **Siparişler (Orders)**: 13
- **Ödemeler (Payments)**: 2
- **Giderler (Expenses)**: 2
- **Finansal Veriler (Finance)**: 1
- **Toplu Satışlar (BulkSales)**: 1

### Finansal Özet
- **Toplam Gelir**: ₺56.350
- **Toplam Giderler**: ₺20.500
- **Ödenmemiş Tutar**: ₺55.990
- **Stok Değeri**: ₺68.329
- **Net Kar**: ₺35.850

## Mevcut Ürünler

| # | Ürün Adı | Kategori | Stok | Maliyet | Satış |
|---|----------|----------|------|---------|-------|
| 1 | 0.5 Lt Pet Su | Su | 50 | ₺28,75 | ₺45 |
| 2 | 1.5 Lt Pet Su | Su | 542 | ₺29 | ₺45 |
| 3 | 19 Lt Damacana | Su | 390 | ₺32 | ₺100 |
| 4 | 200cc Bardak Su | Su | 155 | ₺65 | ₺100 |
| 5 | 5 Lt Pet Su | Su | 361 | ₺58,5 | ₺90 |
| 6 | Pompa | Ekipman | 100 | ₺75 | ₺150 |

## Yönetim Scriptleri

### 1. Veritabanı Senkronizasyonu
```bash
npm run db:sync
# veya
node sync-database.js
```
**Açıklama**: Veritabanı bağlantısını kontrol eder ve temel tutarlılık kontrollerini yapar.

**Ne Yapar**:
- MongoDB bağlantısını doğrular
- Mevcut koleksiyonları listeler
- Veri sayılarını gösterir
- Temel tutarlılık problemlerini tespit eder

**Çıktı Örneği**:
```
✅ MongoDB Bağlantısı Başarılı

📊 Mevcut Koleksiyonlar:
  - expenses
  - payments
  - orders
  - customers
  - finances
  - bulksales
  - products
```

---

### 2. Veritabanı Düzeltme
```bash
npm run db:fix
# veya
node fix-database.js
```
**Açıklama**: Veritabanında bulunan veri hatalarını otomatik olarak düzeltir.

**Ne Yapıyor**:
- ✅ Sipariş referansı olmayan ödemeleri ilgili siparişlerle eşleştir
- ✅ Eksik ürün kategorilerini otomatik doldur
- ✅ Siparişlerdeki eksik ürün detaylarını güncelle
- ✅ Finansal verileri doğrula ve güncelle
- ✅ Müşteri-Sipariş tutarlılığını kontrol et
- ✅ Toplu satış verilerini doğrula

**Son Düzeltmeler** (01.02.2026):
- 2 ödeme sipariş referansı ile eşleştirildi
- Finansal gelir verileri güncellendi
- Tüm tutarlılık kontrolleri geçti

---

### 3. Veritabanı Raporu
```bash
npm run db:report
# veya
node database-report.js
```
**Açıklama**: Veritabanının detaylı bir raporunu oluşturur.

**Ne Gösteriyor**:
- 📦 **Ürünler**: Stok durumu, fiyatlar, kategoriler
- 👥 **Müşteriler**: Sipariş sayısı, toplam harcama
- 📋 **Siparişler**: Detaylar, tutar, durum
- 💰 **Ödemeler**: Ödeme listesi, tutar, yöntem
- 💸 **Giderler**: Gider detayları, kategoriler
- 📊 **Finansal Özet**: Gelir, gider, kar, ödenmemiş tutar
- 📦 **Toplu Satışlar**: Satış detayları
- ⚠️ **Bozuk Veri Kontrolü**: Hata raporu

---

## Model Şemaları

### Product (Ürün)
```javascript
{
  name: String,           // Ürün adı
  category: String,       // Kategori (varsayılan: 'Su')
  unitPrice: Number,      // Birim fiyatı (maliyet)
  salePrice: Number,      // Satış fiyatı
  stock: Number,          // Stok miktarı
  unit: String            // Birim (varsayılan: 'Adet')
}
```

### Customer (Müşteri)
```javascript
{
  name: String,           // Müşteri adı
  phone: String,          // Telefon numarası
  address: String,        // Adres
  note: String            // Notlar
}
```

### Order (Sipariş)
```javascript
{
  customerName: String,
  customerId: ObjectId,   // Customer referansı
  items: [{
    productName: String,
    productId: String,
    quantity: Number,
    price: Number,
    total: Number
  }],
  totalAmount: Number,
  status: String,         // 'Hazırlanıyor', 'Teslim Edildi', vb.
  paymentMethod: String,
  note: String,
  date: Date
}
```

### Payment (Ödeme)
```javascript
{
  customerId: ObjectId,   // Customer referansı
  orderId: ObjectId,      // Order referansı
  amount: Number,
  method: String,         // 'Nakit', 'Kredi Kartı', vb.
  date: Date
}
```

### Expense (Gider)
```javascript
{
  title: String,
  amount: Number,
  category: String,       // 'Kira', 'Yakıt', vb.
  date: Date
}
```

### Finance (Finansal)
```javascript
{
  category: String,
  amount: Number,
  description: String,
  date: Date,
  isIncome: Boolean,
  paymentMethod: String,
  relatedOrder: ObjectId  // Order referansı
}
```

### BulkSale (Toplu Satış)
```javascript
{
  customer: {
    _id: ObjectId,
    name: String,
    contact: String
  },
  items: [{
    product: {
      _id: ObjectId,
      name: String,
      category: String,
      salePrice: Number
    },
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    delivered: Number
  }],
  totalAmount: Number,
  paymentMethod: String,
  remainingDelivery: Number,
  status: String
}
```

---

## Günlük Kullanım

### Sunucuyu Başlatma
```bash
npm run dev      # Geliştirme modunda (nodemon ile)
npm run start    # Üretim modunda
```

### Düzenli Bakım
Her gün sonunda şu komutları çalıştırabilirsiniz:
```bash
npm run db:sync     # Veritabanı durumunu kontrol et
npm run db:fix      # Varsa hataları düzelt
npm run db:report   # Günün raporunu oluştur
```

### Sorun Giderme
Eğer ödemelerle ilgili sorun varsa:
```bash
npm run db:fix      # Önce hataları düzelt
npm run db:report   # Sonra raporu kontrol et
```

---

## MongoDB Bağlantısı

**Bağlantı String**: `mongodb://localhost:27017/su_takip_db`

Eğer MongoDB çalışmıyorsa:
- **Windows**: Services (services.msc) aracılığından MongoDB Service'i başlatın
- **Komut Satırı**: `mongod` komutu çalıştırın
- **MongoDB Compass**: GUI uygulamasından bağlantı kurun

---

## Sık Sorulan Sorular

### S: Ödemeler neden siparişle bağlantılı değil?
**C**: `npm run db:fix` komutu ödemeleri otomatik olarak ilgili siparişlerle eşleştirir.

### S: Ürün fiyatlarını nasıl güncelleme?
**C**: `npm run db:report` ile current fiyatları kontrol edip, backend API'sini kullanarak güncelleme yapabilirsiniz.

### S: Veritabanında ne kadar boş yer var?
**C**: MongoDB Compass uygulamasını kullanarak detaylı istatistikleri görebilirsiniz.

### S: Yedekleme nasıl yapılır?
**C**: `mongodump` komutu kullanarak veritabanını yedekleyebilirsiniz.

---

## Son Güncelleme
- **Tarih**: 01.02.2026
- **İşlem**: Ödeme-Sipariş referans eşleştirmesi tamamlandı
- **Durum**: ✅ Tüm veriler tutarlı

---

**Geliştirici**: Yiğit Ticaret Bilişim Sistemi
