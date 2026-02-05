process.env.TZ = process.env.TZ || 'Europe/Istanbul';

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();
const { getLocalDateString, getMsUntilNextMidnight, getMsUntilTime } = require('./utils/dateHelpers');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && body.error && !body.code) {
            const defaultCode = res.statusCode >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST';
            return originalJson({ ...body, code: defaultCode });
        }
        return originalJson(body);
    };
    next();
});

// Basit bellek içi cache (rapor endpoint'leri için)
const REPORT_CACHE_TTL_MS = 60 * 1000;
const reportCache = new Map();

const getReportCacheKey = (req) => `report:${req.originalUrl}`;

const getCachedReport = (key) => {
    const cached = reportCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
        reportCache.delete(key);
        return null;
    }
    return cached.data;
};

const setCachedReport = (key, data) => {
    reportCache.set(key, { data, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
};

const logTimezoneInfo = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    console.log(`🕒 Sunucu Zaman Dilimi: ${tz || 'Bilinmiyor'} (UTC offset: ${-offset / 60} saat)`);
};

// --- VERİTABANI BAĞLANTISI ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/su_takip_db')
  .then(() => console.log('✅ MongoDB Bağlantısı Başarılı (Yiğit Ticaret)'))
  .catch(err => console.log('❌ Veritabanı Hatası:', err));

logTimezoneInfo();

// --- MODELLER (Models klasöründen import) ---
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Expense = require('./models/Expense');
const BulkSale = require('./models/BulkSale');

// --- ROUTER KAYITLARI ---
const productsRoutes = require('./routes/products')({ Product, Expense });
const customersRoutes = require('./routes/customers')({ Customer, Order, Payment, mongoose });
const ordersRoutes = require('./routes/orders')({ Order, Product });
const paymentsRoutes = require('./routes/payments')({ Payment, Order });
const expensesRoutes = require('./routes/expenses')({ Expense });
const bulkSalesRoutes = require('./routes/bulk-sales')({ BulkSale, Product, Expense });
const debtsRoutes = require('./routes/debts')({ Order, Payment, Customer });
const reportsRoutes = require('./routes/reports')({
    Order,
    Product,
    Payment,
    Expense,
    BulkSale,
    getReportCacheKey,
    getCachedReport,
    setCachedReport
});
const financeRoutes = require('./routes/finance')({
    Order,
    Payment,
    Expense,
    Product,
    BulkSale,
    getReportCacheKey,
    getCachedReport,
    setCachedReport
});
const dashboardRoutes = require('./routes/dashboard')({
    Order,
    Payment,
    Expense,
    BulkSale,
    getReportCacheKey,
    getCachedReport,
    setCachedReport
});

app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/bulk-sales', bulkSalesRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api', dashboardRoutes);

app.get('/api/system/time', (req, res) => {
    const now = new Date();
    res.json({
        now: now.toISOString(),
        date: getLocalDateString(now),
        timezoneOffsetMinutes: now.getTimezoneOffset()
    });
});

app.get('/api/health', (req, res) => {
    const now = new Date();
    res.json({
        status: 'ok',
        time: now.toISOString(),
        date: getLocalDateString(now),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Bilinmiyor'
    });
});

const scheduleDailyCacheReset = () => {
    const msUntilMidnight = getMsUntilNextMidnight();
    setTimeout(() => {
        reportCache.clear();
        console.log('🧹 Rapor cache günlük sıfırlandı.');
        scheduleDailyCacheReset();
    }, msUntilMidnight + 50);
};

const scheduleDailyBackup = (hour = 2, minute = 0) => {
    const msUntilRun = getMsUntilTime(hour, minute, 0);
    setTimeout(() => {
        const backupScript = path.join(__dirname, 'backup-database.js');
        console.log('💾 Otomatik yedekleme başlatılıyor...');
        const child = spawn(process.execPath, [backupScript], { stdio: 'inherit' });
        child.on('exit', (code) => {
            if (code === 0) {
                console.log('✅ Otomatik yedekleme tamamlandı.');
            } else {
                console.log(`⚠️ Otomatik yedekleme hata ile çıktı. Kod: ${code}`);
            }
        });
        scheduleDailyBackup(hour, minute);
    }, msUntilRun);
};

scheduleDailyCacheReset();
scheduleDailyBackup();

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor...`));