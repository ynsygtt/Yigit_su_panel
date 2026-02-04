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

async function generateDatabaseReport() {
    try {
        console.log('📋 KAPSAMLI VERİTABANI RAPORU OLUŞTURULUYOR...\n');
        
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB Bağlantısı Başarılı\n');

        // ============= ÜRÜNLER =============
        console.log('╔════════════════════════════════════════╗');
        console.log('║         ÜRÜNLER (PRODUCTS)             ║');
        console.log('╚════════════════════════════════════════╝\n');

        const products = await Product.find().sort({ name: 1 });
        console.log(`Toplam Ürün: ${products.length}\n`);
        console.log('Ürün Listesi:');
        console.log('─'.repeat(90));
        
        let totalStockValue = 0;
        products.forEach((p, index) => {
            const stockValue = p.stock * p.unitPrice;
            totalStockValue += stockValue;
            console.log(`${index + 1}. ${p.name.padEnd(25)} | Kategori: ${(p.category || 'N/A').padEnd(10)} | Stok: ${p.stock.toString().padStart(5)} | Maliyet: ₺${p.unitPrice.toLocaleString('tr-TR')} | Satış: ₺${p.salePrice.toLocaleString('tr-TR')}`);
        });
        console.log('─'.repeat(90));
        console.log(`TOPLAM STOK DEĞERİ: ₺${totalStockValue.toLocaleString('tr-TR')}\n`);

        // ============= MÜŞTERİLER =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║       MÜŞTERİLER (CUSTOMERS)           ║');
        console.log('╚════════════════════════════════════════╝\n');

        const customers = await Customer.find().sort({ name: 1 });
        console.log(`Toplam Müşteri: ${customers.length}\n`);
        console.log('Müşteri Listesi:');
        console.log('─'.repeat(100));

        for (const customer of customers) {
            const customerOrders = await Order.find({ customerId: customer._id });
            const orderCount = customerOrders.length;
            const totalSpent = customerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            
            console.log(`${customer.name.padEnd(25)} | Telefon: ${(customer.phone || 'N/A').padEnd(15)} | Siparişler: ${orderCount.toString().padStart(3)} | Harcama: ₺${totalSpent.toLocaleString('tr-TR').padStart(10)}`);
        }
        console.log('─'.repeat(100) + '\n');

        // ============= SİPARİŞLER =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║        SİPARİŞLER (ORDERS)             ║');
        console.log('╚════════════════════════════════════════╝\n');

        const orders = await Order.find().sort({ date: -1 }).limit(20);
        const totalOrders = await Order.countDocuments();
        const totalOrderValue = (await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]))[0]?.total || 0;

        console.log(`Toplam Sipariş: ${totalOrders}`);
        console.log(`Toplam Sipariş Değeri: ₺${totalOrderValue.toLocaleString('tr-TR')}`);
        console.log(`Son 20 Sipariş:\n`);
        console.log('─'.repeat(120));

        orders.forEach((order, index) => {
            const orderDate = new Date(order.date).toLocaleDateString('tr-TR');
            console.log(`${index + 1}. ${order.customerName.padEnd(25)} | Tarih: ${orderDate.padEnd(12)} | Durum: ${(order.status || 'N/A').padEnd(15)} | Tutar: ₺${(order.totalAmount || 0).toLocaleString('tr-TR').padStart(10)} | Ürün: ${order.items?.length || 0}`);
        });
        console.log('─'.repeat(120) + '\n');

        // ============= ÖDEMELER =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║         ÖDEMELER (PAYMENTS)            ║');
        console.log('╚════════════════════════════════════════╝\n');

        const payments = await Payment.find().sort({ date: -1 });
        const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        console.log(`Toplam Ödeme Sayısı: ${payments.length}`);
        console.log(`Toplam Ödeme Tutarı: ₺${totalPayments.toLocaleString('tr-TR')}\n`);
        console.log('Ödeme Listesi:');
        console.log('─'.repeat(90));

        payments.forEach((payment, index) => {
            const paymentDate = new Date(payment.date).toLocaleDateString('tr-TR');
            const customer = customers.find(c => c._id.equals(payment.customerId));
            console.log(`${index + 1}. ${(customer?.name || 'Bilinmiyor').padEnd(25)} | Tarih: ${paymentDate.padEnd(12)} | Yöntem: ${(payment.method || 'N/A').padEnd(10)} | Tutar: ₺${(payment.amount || 0).toLocaleString('tr-TR').padStart(10)}`);
        });
        console.log('─'.repeat(90) + '\n');

        // ============= GİDERLER =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║          GİDERLER (EXPENSES)           ║');
        console.log('╚════════════════════════════════════════╝\n');

        const expenses = await Expense.find().sort({ date: -1 });
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        console.log(`Toplam Gider Sayısı: ${expenses.length}`);
        console.log(`Toplam Gider Tutarı: ₺${totalExpenses.toLocaleString('tr-TR')}\n`);
        console.log('Gider Listesi:');
        console.log('─'.repeat(90));

        expenses.forEach((expense, index) => {
            const expenseDate = new Date(expense.date).toLocaleDateString('tr-TR');
            console.log(`${index + 1}. ${expense.title.padEnd(40)} | Kategorisi: ${(expense.category || 'Genel').padEnd(12)} | Tarih: ${expenseDate.padEnd(12)} | Tutar: ₺${(expense.amount || 0).toLocaleString('tr-TR').padStart(10)}`);
        });
        console.log('─'.repeat(90) + '\n');

        // ============= FİNANSAL ÖZETİ =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║         FİNANSAL ÖZETİ (SUMMARY)       ║');
        console.log('╚════════════════════════════════════════╝\n');

        console.log(`Toplam Gelir (Tamamlanmış Siparişler): ₺${totalOrderValue.toLocaleString('tr-TR')}`);
        console.log(`Toplam Giderler:                        ₺${totalExpenses.toLocaleString('tr-TR')}`);
        console.log(`Toplam Ödemeler Alınan:                 ₺${totalPayments.toLocaleString('tr-TR')}`);
        console.log(`Stok Değeri:                            ₺${totalStockValue.toLocaleString('tr-TR')}`);
        console.log(`Net Kar (Gelir - Gider):                ₺${(totalOrderValue - totalExpenses).toLocaleString('tr-TR')}`);
        console.log(`Ödenmemiş Tutar:                        ₺${(totalOrderValue - totalPayments).toLocaleString('tr-TR')}\n`);

        // ============= TOPLU SATIŞLAR =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║      TOPLU SATIŞLAR (BULK SALES)       ║');
        console.log('╚════════════════════════════════════════╝\n');

        const bulkSales = await BulkSale.find().sort({ createdAt: -1 });
        console.log(`Toplam Toplu Satış: ${bulkSales.length}\n`);

        if (bulkSales.length > 0) {
            console.log('Toplu Satış Listesi:');
            console.log('─'.repeat(100));
            
            bulkSales.forEach((sale, index) => {
                const saleDate = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('tr-TR') : 'N/A';
                const customerName = sale.customer?.name || 'Bilinmiyor';
                const itemCount = sale.items?.length || 0;
                const totalAmount = sale.totalAmount || 0;
                console.log(`${index + 1}. ${customerName.padEnd(25)} | Tarih: ${saleDate.padEnd(12)} | Ürünler: ${itemCount.toString().padStart(2)} | Toplam: ₺${totalAmount.toLocaleString('tr-TR').padStart(10)}`);
            });
            console.log('─'.repeat(100) + '\n');
        }

        // ============= BOZUK VERİ KONTROLÜ =============
        console.log('\n╔════════════════════════════════════════╗');
        console.log('║      BOZUK VERİ KONTROLÜ              ║');
        console.log('╚════════════════════════════════════════╝\n');

        let hasIssues = false;

        // Null/boş kategoriler
        const productsNoCat = await Product.find({ $or: [{ category: null }, { category: '' }] });
        if (productsNoCat.length > 0) {
            console.log(`⚠️  ${productsNoCat.length} ürün kategori bilgisi eksik`);
            hasIssues = true;
        }

        // Negatif stok
        const negStock = await Product.find({ stock: { $lt: 0 } });
        if (negStock.length > 0) {
            console.log(`⚠️  ${negStock.length} ürün negatif stoka sahip`);
            hasIssues = true;
        }

        // Ödeme referansı olmayan ödemeler
        const paymentsNoRef = await Payment.find({ 
            $or: [{ orderId: null }, { orderId: { $exists: false } }]
        });
        if (paymentsNoRef.length > 0) {
            console.log(`⚠️  ${paymentsNoRef.length} ödeme sipariş referansı olmadan`);
            hasIssues = true;
        }

        // 0 fiyatlı ürünler
        const noPrice = await Product.find({ 
            $or: [{ unitPrice: 0 }, { salePrice: 0 }]
        });
        if (noPrice.length > 0) {
            console.log(`⚠️  ${noPrice.length} ürün fiyat bilgisi eksik`);
            hasIssues = true;
        }

        if (!hasIssues) {
            console.log('✅ Hiç bozuk veri bulunmadı!');
        }

        console.log('\n✅ Rapor oluşturma tamamlandı!');

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

generateDatabaseReport();
