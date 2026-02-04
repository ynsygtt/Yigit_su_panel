# Environment Variables Konfigürasyonu

Bu proje Vite kullandığı için environment variable'lar `VITE_` prefix'i ile başlamalıdır.

## 📁 Dosya Yapısı

```
frontend/
├── .env                 # Varsayılan değerler (Git'e eklenir)
├── .env.local          # Yerel geliştirme (Git'e EKLENMEMELİ - .gitignore'da)
├── .env.production     # Production ayarları
└── .env.example        # Örnek şablon
```

## 🔑 Mevcut Environment Variables

### VITE_API_URL
Backend API'nin adresi

**Geliştirme (Development):**
```env
VITE_API_URL=http://localhost:5000
```

**Production:**
```env
VITE_API_URL=https://api.yourdomain.com
```

## 🚀 Kullanım

### Kod İçinde
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

### Fallback Mekanizması
Eğer `.env` dosyası yoksa veya `VITE_API_URL` tanımlı değilse, otomatik olarak `http://localhost:5000` kullanılır.

## 📝 Yeni Variable Ekleme

1. `.env` dosyasına ekleyin:
```env
VITE_YOUR_NEW_VAR=value
```

2. Kod içinde kullanın:
```javascript
const myVar = import.meta.env.VITE_YOUR_NEW_VAR;
```

## ⚠️ Önemli Notlar

- ✅ Tüm Vite environment variable'ları `VITE_` ile başlamalı
- ✅ `.env.local` dosyası `.gitignore`'da (hassas bilgiler için)
- ✅ Değişikliklerden sonra dev server'ı yeniden başlatın
- ❌ Asla API key'leri veya şifreleri Git'e eklemeyin

## 🔄 Dev Server'ı Yeniden Başlatma

```bash
# Frontend klasöründe
npm run dev
```

## 📚 Daha Fazla Bilgi

Vite Environment Variables: https://vitejs.dev/guide/env-and-mode.html
