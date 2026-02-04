const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Models
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Expense = require('./models/Expense');
const BulkSale = require('./models/BulkSale');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/su_takip_db';

async function backupDatabase() {
    try {
        console.log('💾 Veritabanı Yedekleme Işlemi Başlanıyor...\n');
        
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB Bağlantısı Başarılı\n');

        // Yedekleme klasörü oluştur
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
            console.log(`📁 Yedekleme klasörü oluşturuldu: ${backupDir}\n`);
        }

        // Tarih formatı: YYYY-MM-DD_HH-mm-ss
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const backupFile = path.join(backupDir, `backup_${dateStr}.json`);

        const backup = {
            timestamp: new Date().toISOString(),
            mongoUri: MONGO_URI.replace(/mongodb:\/\/.*@/, 'mongodb://***:***@'),
            collections: {}
        };

        // Her koleksiyondan veri çek
        console.log('📤 Veriler yedekleniyor...\n');

        const collections = {
            products: Product,
            customers: Customer,
            orders: Order,
            payments: Payment,
            expenses: Expense,
            bulkSales: BulkSale
        };

        for (const [name, model] of Object.entries(collections)) {
            const data = await model.find();
            backup.collections[name] = {
                count: data.length,
                data: data
            };
            console.log(`✓ ${name}: ${data.length} kayıt yedeklendi`);
        }

        // JSON dosyasına yaz
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
        
        const fileSize = (fs.statSync(backupFile).size / 1024).toFixed(2);
        console.log(`\n💾 Yedekleme dosyası: ${backupFile}`);
        console.log(`📊 Dosya boyutu: ${fileSize} KB`);

        // Son 5 yedeklemeyi koru, eski olanları sil
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
            .sort()
            .reverse();

        if (backups.length > 5) {
            console.log(`\n🗑️  Eski yedeklemeler temizleniyor (5'ten fazla saklanmayacak)...`);
            for (let i = 5; i < backups.length; i++) {
                const oldFile = path.join(backupDir, backups[i]);
                fs.unlinkSync(oldFile);
                console.log(`   ✓ Silindi: ${backups[i]}`);
            }
        }

        console.log('\n✅ Yedekleme başarıyla tamamlandı!');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        if (error.message.includes('connect ECONNREFUSED')) {
            console.error('\n📝 MongoDB çalışmıyor. Lütfen MongoDB servisini başlatın.');
        }
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

backupDatabase();
