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

async function fixDatabaseIssues() {
    try {
        console.log('🔧 Veri Tabanı Düzeltme Işlemi Başlanıyor...\n');
        
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('✅ MongoDB Bağlantısı Başarılı\n');

        let fixedCount = 0;

        // 1. Referansı olmayan ödememeleri düzelt
        console.log('🔍 Sipariş Referansı Olmayan Ödemeler Kontrol Ediliyor...');
        const paymentsWithoutOrderId = await Payment.find({ 
            $or: [
                { orderId: null },
                { orderId: { $exists: false } }
            ]
        });

        if (paymentsWithoutOrderId.length > 0) {
            console.log(`Found ${paymentsWithoutOrderId.length} ödeme(ler) sipariş referansı olmadan\n`);
            
            for (const payment of paymentsWithoutOrderId) {
                // Müşteri tarafından siparişleri bul
                const customer = await Customer.findById(payment.customerId);
                
                if (customer) {
                    const relatedOrders = await Order.find({ 
                        customerId: payment.customerId 
                    }).sort({ date: -1 });

                    if (relatedOrders.length > 0) {
                        // En yakın siparişi eşleştir
                        const closestOrder = relatedOrders[0];
                        payment.orderId = closestOrder._id;
                        await payment.save();
                        console.log(`✓ Ödeme #${payment._id} → Sipariş #${closestOrder._id} ile eşleştirildi (Müşteri: ${customer.name})`);
                        fixedCount++;
                    } else {
                        console.log(`⚠️  Ödeme #${payment._id}: Müşteri (${customer.name}) için sipariş bulunamadı`);
                    }
                } else {
                    console.log(`⚠️  Ödeme #${payment._id}: Müşteri bulunamadı`);
                }
            }
        } else {
            console.log('✅ Tüm ödemeler sipariş referansına sahip\n');
        }

        // 2. Eksik ürün kategorileri düzelt
        console.log('\n🔍 Ürün Kategorileri Kontrol Ediliyor...');
        const productsWithoutCategory = await Product.find({ 
            $or: [
                { category: null },
                { category: '' },
                { category: { $exists: false } }
            ]
        });

        if (productsWithoutCategory.length > 0) {
            console.log(`Found ${productsWithoutCategory.length} ürün kategori olmadan\n`);
            for (const product of productsWithoutCategory) {
                product.category = 'Su';
                await product.save();
                console.log(`✓ ${product.name} kategorisi "Su" olarak ayarlandı`);
                fixedCount++;
            }
        } else {
            console.log('✅ Tüm ürünlerin kategorisi tanımlanmış\n');
        }

        // 3. Siparişlerde eksik ürün detaylarını düzelt
        console.log('\n🔍 Sipariş Ürün Detayları Kontrol Ediliyor...');
        const ordersWithMissingDetails = await Order.find({
            'items': { $exists: true }
        });

        let ordersFixed = 0;
        for (const order of ordersWithMissingDetails) {
            let orderNeedsUpdate = false;
            for (const item of order.items) {
                if (!item.productId || !item.productName) {
                    const product = await Product.findOne({ name: item.productName || item.name });
                    if (product) {
                        item.productId = product._id.toString();
                        item.productName = product.name;
                        item.price = product.salePrice;
                        orderNeedsUpdate = true;
                    }
                }
            }
            if (orderNeedsUpdate) {
                await order.save();
                ordersFixed++;
                console.log(`✓ Sipariş #${order._id} ürün detayları güncellendi`);
            }
        }
        
        if (ordersFixed === 0) {
            console.log('✅ Tüm siparişlerin ürün detayları tam\n');
        }
        fixedCount += ordersFixed;

        // 4. Müşteri adı ve sipariş tutarlılığını kontrol et
        console.log('\n🔍 Müşteri-Sipariş Tutarlılığı Kontrol Ediliyor...');
        const ordersWithInvalidCustomerRef = await Order.find({
            customerId: { $exists: true, $ne: null }
        });

        let customerRefFixed = 0;
        for (const order of ordersWithInvalidCustomerRef) {
            const customer = await Customer.findById(order.customerId);
            if (customer && customer.name !== order.customerName) {
                const oldName = order.customerName;
                order.customerName = customer.name;
                await order.save();
                console.log(`✓ Sipariş #${order._id} müşteri adı güncellendi: "${oldName}" → "${customer.name}"`);
                customerRefFixed++;
            }
        }

        if (customerRefFixed === 0) {
            console.log('✅ Tüm sipariş müşteri isimleri tutarlı\n');
        }
        fixedCount += customerRefFixed;

        // 5. Toplu satış verilerini kontrol et
        console.log('\n🔍 Toplu Satış Verileri Kontrol Ediliyor...');
        const bulkSales = await BulkSale.find();
        
        let bulkSalesFixed = 0;
        for (const sale of bulkSales) {
            let saleNeedsUpdate = false;
            
            if (!sale.totalAmount || sale.totalAmount === 0) {
                let total = 0;
                if (sale.items && Array.isArray(sale.items)) {
                    for (const item of sale.items) {
                        total += (item.totalPrice || 0);
                    }
                }
                sale.totalAmount = total;
                saleNeedsUpdate = true;
            }

            if (saleNeedsUpdate) {
                await sale.save();
                console.log(`✓ Toplu Satış #${sale._id} toplam tutar güncellendi: ${sale.totalAmount}`);
                bulkSalesFixed++;
            }
        }

        if (bulkSalesFixed === 0) {
            console.log('✅ Tüm toplu satış verileri tutarlı\n');
        }
        fixedCount += bulkSalesFixed;

        // Son istatistikler
        console.log('\n' + '='.repeat(50));
        console.log('📊 FINAL İSTATİSTİKLER');
        console.log('='.repeat(50));
        
        const finalStats = {
            products: await Product.countDocuments(),
            customers: await Customer.countDocuments(),
            orders: await Order.countDocuments(),
            payments: await Payment.countDocuments(),
            expenses: await Expense.countDocuments(),
            bulkSales: await BulkSale.countDocuments()
        };

        console.log(`
Ürünler (Products):         ${finalStats.products}
Müşteriler (Customers):     ${finalStats.customers}
Siparişler (Orders):        ${finalStats.orders}
Ödemeler (Payments):        ${finalStats.payments}
Giderler (Expenses):        ${finalStats.expenses}
Toplu Satışlar (BulkSales): ${finalStats.bulkSales}

Toplam Düzeltme Sayısı: ${fixedCount}
        `);

        console.log('✅ Tüm düzeltmeler tamamlandı!');

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

fixDatabaseIssues();
