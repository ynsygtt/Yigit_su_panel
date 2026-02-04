const mongoose = require('mongoose');
require('dotenv').config();

// Models
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Expense = require('./models/Expense');
const BulkSale = require('./models/BulkSale');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/su_takip_db';

async function syncDatabase() {
    try {
        console.log('🔄 Veritabanı senkronizasyonu başlanıyor...\n');
        
        // Veritabanına bağlan
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB Bağlantısı Başarılı\n');

        // Koleksiyonları kontrol et
        const db = mongoose.connection;
        const collections = await db.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        console.log('📊 Mevcut Koleksiyonlar:');
        collectionNames.forEach(name => console.log(`  - ${name}`));
        console.log();

        // Her model için veri sayısını kontrol et
        const stats = {
            products: await Product.countDocuments(),
            customers: await Customer.countDocuments(),
            orders: await Order.countDocuments(),
            payments: await Payment.countDocuments(),
            expenses: await Expense.countDocuments(),
            bulkSales: await BulkSale.countDocuments()
        };

        console.log('📈 Veri Sayıları:');
        console.log(`  Ürünler: ${stats.products}`);
        console.log(`  Müşteriler: ${stats.customers}`);
        console.log(`  Siparişler: ${stats.orders}`);
        console.log(`  Ödemeler: ${stats.payments}`);
        console.log(`  Giderler: ${stats.expenses}`);
        console.log(`  Toplu Satışlar: ${stats.bulkSales}`);
        console.log();

        // Tutarlılık kontrolleri
        console.log('🔍 Tutarlılık Kontrolleri:\n');

        // 1. Siparişlerde eksik müşteri kontrolü
        const ordersWithoutCustomer = await Order.find({ customerId: null });
        if (ordersWithoutCustomer.length > 0) {
            console.log(`⚠️  Müşteri Kimliği Olmayan Siparişler: ${ordersWithoutCustomer.length}`);
            console.log('   Düzeltiliyor...');
            for (const order of ordersWithoutCustomer) {
                const customer = await Customer.findOne({ name: order.customerName });
                if (customer) {
                    order.customerId = customer._id;
                    await order.save();
                    console.log(`   ✓ Sipariş #${order._id} müşteri kimliği güncellendi`);
                }
            }
        } else {
            console.log('✅ Tüm siparişlerin müşteri kimliği var');
        }
        console.log();

        // 2. Ödeme referans kontrolü
        const paymentsWithoutOrder = await Payment.find({ orderId: { $exists: false } });
        if (paymentsWithoutOrder.length > 0) {
            console.log(`⚠️  Sipariş Referansı Olmayan Ödemeler: ${paymentsWithoutOrder.length}`);
            console.log('   Bu ödemeler başıboş olabilir.');
        } else {
            console.log('✅ Tüm ödemelerin sipariş referansı var');
        }
        console.log();

        // 3. Stok kontrolleri
        const negativeStockProducts = await Product.find({ stock: { $lt: 0 } });
        if (negativeStockProducts.length > 0) {
            console.log(`⚠️  Negatif Stok Ürünleri: ${negativeStockProducts.length}`);
            negativeStockProducts.forEach(p => {
                console.log(`   - ${p.name}: ${p.stock}`);
            });
            console.log('   Stok değerleri sıfırlanıyor...');
            for (const product of negativeStockProducts) {
                product.stock = 0;
                await product.save();
                console.log(`   ✓ ${product.name} stoku sıfırlandı`);
            }
        } else {
            console.log('✅ Tüm ürün stokları pozitif');
        }
        console.log();

        // 4. Eksik fiyat kontrolleri
        const productsWithoutPrice = await Product.find({
            $or: [
                { unitPrice: { $lte: 0 } },
                { salePrice: { $lte: 0 } }
            ]
        });
        if (productsWithoutPrice.length > 0) {
            console.log(`⚠️  Eksik Fiyat Bilgisi Olan Ürünler: ${productsWithoutPrice.length}`);
            productsWithoutPrice.forEach(p => {
                console.log(`   - ${p.name}: Maliyet:${p.unitPrice}, Satış:${p.salePrice}`);
            });
        } else {
            console.log('✅ Tüm ürünlerin fiyat bilgisi var');
        }
        console.log();

        // İstatistikleri göster
        console.log('📊 Final İstatistikler:');
        const finalStats = {
            products: await Product.countDocuments(),
            customers: await Customer.countDocuments(),
            orders: await Order.countDocuments(),
            payments: await Payment.countDocuments(),
            expenses: await Expense.countDocuments(),
            bulkSales: await BulkSale.countDocuments()
        };

        console.log(`  Ürünler: ${finalStats.products}`);
        console.log(`  Müşteriler: ${finalStats.customers}`);
        console.log(`  Siparişler: ${finalStats.orders}`);
        console.log(`  Ödemeler: ${finalStats.payments}`);
        console.log(`  Giderler: ${finalStats.expenses}`);
        console.log(`  Toplu Satışlar: ${finalStats.bulkSales}`);
        console.log();

        console.log('✅ Veritabanı senkronizasyonu tamamlandı!');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        if (error.message.includes('connect ECONNREFUSED')) {
            console.error('\n📝 MongoDB çalışmıyor. Lütfen MongoDB servisini başlatın:');
            console.error('   Windows: services.msc veya MongoDB Compass kullanın');
            console.error('   Komut satırı: mongod');
        }
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Veritabanı bağlantısı kapatıldı');
        process.exit(0);
    }
}

// Script'i çalıştır
syncDatabase();
