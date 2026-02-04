import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, CreditCard, TrendingUp, TrendingDown, FileDown, Printer, Users, Eye, X } from 'lucide-react';
import { LoadingSpinner, PrintHeader } from '../components/shared';
import { API_URL } from '../config';
import { formatCurrencyForExcel, formatDateForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection, addFilterInfo } from '../utils/excelTemplates';
import { getLocalDateString, getLocalDayRange, getServerDayRange } from '../utils/appHelpers';

const Dashboard = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState({ products: [], customers: [] });
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const [serverOffsetMs, setServerOffsetMs] = useState(0);
    const [serverTimezoneOffsetMinutes, setServerTimezoneOffsetMinutes] = useState(null);

    const fetchDashboardData = async (dateRange = {}) => { 
        setIsLoading(true); 
        try { 
        const rangeStart = dateRange.startDate || startDate;
        const rangeEnd = dateRange.endDate || endDate;
        const res = await axios.get(`${API_URL}/api/dashboard/analysis?startDate=${rangeStart}&endDate=${rangeEnd}`); 
            setDashboardData(res.data); 
        } catch (err) { 
            console.error(err); 
        } finally { 
            setIsLoading(false); 
        } 
    };
    
    useEffect(() => { fetchDashboardData(); }, []);

    useEffect(() => {
      const initServerTime = async () => {
        try {
          const res = await axios.get(`${API_URL}/api/system/time`);
          const serverNow = new Date(res.data.now);
          const clientNow = new Date();
          const offset = serverNow.getTime() - clientNow.getTime();
          setServerOffsetMs(offset);
          if (typeof res.data.timezoneOffsetMinutes === 'number') {
            setServerTimezoneOffsetMinutes(res.data.timezoneOffsetMinutes);
          }
          const serverDate = res.data.date || getLocalDateString(serverNow);
          setStartDate(serverDate);
          setEndDate(serverDate);
          fetchDashboardData({ startDate: serverDate, endDate: serverDate });
        } catch (err) {
          console.error(err);
        }
      };

      initServerTime();
    }, []);

    useEffect(() => {
      let timerId;
      const scheduleMidnightReset = () => {
        const serverNow = new Date(Date.now() + serverOffsetMs);
        const nextMidnight = new Date(serverNow);
        nextMidnight.setHours(24, 0, 0, 0);
        const msUntilMidnight = nextMidnight.getTime() - serverNow.getTime();
        timerId = setTimeout(() => {
          const nowServer = new Date(Date.now() + serverOffsetMs);
          const today = getLocalDateString(nowServer);
          setStartDate(today);
          setEndDate(today);
          fetchDashboardData({ startDate: today, endDate: today });
          scheduleMidnightReset();
        }, msUntilMidnight + 50);
      };

      scheduleMidnightReset();
      return () => clearTimeout(timerId);
    }, [serverOffsetMs]);

    const handleCustomerDetail = async (customer) => { 
        setSelectedCustomer(customer); 
        try { 
            const res = await axios.get(`${API_URL}/api/customer/history/${customer._id}`); 
            setHistoryData(res.data); 
        } catch (err) { 
            console.error(err); 
        } 
    };
    
    const handlePrint = () => { window.print(); };
    
    const handleExportCustomerHistoryToExcel = () => {
      if (!selectedCustomer || !historyData) return;
      
      const transactionRows = historyData.map((item, index) => ([
        index + 1,
        new Date(item.date).toLocaleDateString('tr-TR'),
        new Date(item.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        item.description,
        item.type === 'Tahsilat' ? 'Tahsilat' : (item.paymentMethod || item.type || 'Bilinmiyor'),
        formatCurrencyForExcel(item.amount || 0)
      ]));

      const totalAmount = historyData.reduce((sum, item) => sum + item.amount, 0);

      const summaryRows = [
        ['Müşteri Adı', selectedCustomer.name],
        ['Toplam İşlem Sayısı', historyData.length],
        ['Toplam Tutar', formatCurrencyForExcel(totalAmount)],
        ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR')],
        ['Tarih Aralığı', 'Tüm Zamanlar']
      ];

      const sections = [
        {
          title: 'MÜŞTERİ BİLGİSİ',
          headers: ['Bilgi', 'Değer'],
          rows: [['Müşteri Adı', selectedCustomer.name], ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR')]]
        },
        {
          title: 'İŞLEM GEÇMİŞİ',
          headers: ['Sıra', 'Tarih', 'Saat', 'Ürün Bilgisi', 'Ödeme Türü', 'Tutar'],
          rows: transactionRows
        },
        addSummarySection(summaryRows)
      ];

      const success = generateSectionedExcel(sections, 'Hesap Ekstresi', `hesap_ekstresi_${selectedCustomer.name.replace(/\s+/g, '_')}`);
      if (success) {
        setTimeout(() => console.log('Excel dosyası indirildi'), 500);
      }
    };
    
    const handleExportDashboardToExcel = () => {
      const productRows = (dashboardData.products || []).map((p, index) => ([
        index + 1,
        p._id || 'Ürün',
        p.totalQty || 0
      ]));

      const paymentMethods = ['Nakit', 'K.Kartı', 'IBAN', 'Borç'];
      const paymentTotals = {};
      paymentMethods.forEach((method) => { paymentTotals[method] = 0; });

      const allOrders = dashboardData.allOrders || [];
      const { start, end } = serverTimezoneOffsetMinutes === null
        ? getLocalDayRange(startDate, endDate)
        : getServerDayRange(startDate, endDate, serverTimezoneOffsetMinutes);

      allOrders.forEach((order) => {
        if (!order.date) return;
        const orderDate = new Date(order.date);
        if (orderDate >= start && orderDate <= end) {
          const method = order.paymentMethod || 'Nakit';
          const normalized = method === 'Kart' ? 'K.Kartı' : method;
          if (paymentTotals[normalized] === undefined) {
            paymentTotals[normalized] = 0;
          }
          paymentTotals[normalized] += order.totalAmount || 0;
        }
      });

      const paymentStats = dashboardData.payments || [];
      paymentStats.forEach((payment) => {
        const method = payment._id || 'Nakit';
        const normalized = method === 'Kart' ? 'K.Kartı' : method;
        if (normalized !== 'Borç') {
          if (paymentTotals[normalized] === undefined) {
            paymentTotals[normalized] = 0;
          }
          paymentTotals[normalized] += payment.totalAmount || 0;
        }
      });

      const paymentRows = paymentMethods.map((method, index) => ([
        index + 1,
        method,
        paymentTotals[method] || 0
      ]));

      const summaryRows = [
        ['Toplam Satış', dashboardData.summary?.totalSales || 0],
        ['Toplam Gider', dashboardData.totalExpense || 0],
        ['Satılan Adet', dashboardData.summary?.totalItems || 0]
      ];

      const customerRows = (dashboardData.customers || []).map((c, index) => ([
        index + 1,
        c.name || 'Müşteri',
        c.totalAmount || 0,
        c.paidAmount || 0,
        c.debtAmount || 0
      ]));

      const sections = [
        addFilterInfo(
          { 'Tarih Aralığı': `${formatDateForExcel(startDate)} - ${formatDateForExcel(endDate)}` },
          { title: 'TARİH ARALIĞI', headers: ['Bilgi', 'Değer'] }
        ),
        {
          title: 'ÜRÜN SATIŞLARI',
          headers: ['Sıra', 'Ürün', 'Toplam Adet'],
          rows: productRows
        },
        {
          title: 'TAHSİLAT',
          headers: ['Sıra', 'Ödeme Türü', 'Toplam Tutar'],
          rows: paymentRows
        },
        addSummarySection(summaryRows),
        {
          title: 'MÜŞTERİ SIRALAMASI',
          headers: ['Sıra', 'Müşteri', 'Toplam Tutar', 'Ödenen', 'Borç'],
          rows: customerRows
        }
      ];

      generateSectionedExcel(sections, 'Genel Bakış', 'genel_bakis');
    };

    const paymentMethods = ['Nakit', 'K.Kartı', 'IBAN', 'Borç'];
    const paymentTotals = {};
    paymentMethods.forEach((method) => { paymentTotals[method] = 0; });
    
    const allOrders = dashboardData.allOrders || [];
    allOrders.forEach((order) => {
      if (!order.date) return;
      
      const orderDate = new Date(order.date);
      const { start, end } = serverTimezoneOffsetMinutes === null
        ? getLocalDayRange(startDate, endDate)
        : getServerDayRange(startDate, endDate, serverTimezoneOffsetMinutes);
      
      if (orderDate >= start && orderDate <= end) {
        const method = order.paymentMethod || 'Nakit';
        const normalized = method === 'Kart' ? 'K.Kartı' : method;
        
        if (paymentTotals[normalized] === undefined) {
          paymentTotals[normalized] = 0;
        }
        paymentTotals[normalized] += order.totalAmount || 0;
      }
    });

    const paymentStats = dashboardData.payments || [];
    paymentStats.forEach((payment) => {
      const method = payment._id || 'Nakit';
      const normalized = method === 'Kart' ? 'K.Kartı' : method;
      
      if (normalized !== 'Borç') {
        if (paymentTotals[normalized] === undefined) {
          paymentTotals[normalized] = 0;
        }
        paymentTotals[normalized] += payment.totalAmount || 0;
      }
    });
    
    const getPaymentMethodStyles = (method) => {
      switch (method) {
        case 'Nakit':
          return { row: 'bg-emerald-900/15 border-emerald-500/30', badge: 'bg-emerald-600/20 text-emerald-300' };
        case 'Kart':
        case 'K.Kartı':
          return { row: 'bg-purple-900/15 border-purple-500/30', badge: 'bg-purple-600/20 text-purple-300' };
        case 'IBAN':
          return { row: 'bg-cyan-900/15 border-cyan-500/30', badge: 'bg-cyan-600/20 text-cyan-300' };
        case 'Borç':
          return { row: 'bg-orange-900/15 border-orange-500/30', badge: 'bg-orange-600/20 text-orange-300' };
        default:
          return { row: 'bg-gray-700/30 border-gray-700', badge: 'bg-gray-600/20 text-gray-200' };
      }
    };

    if (isLoading) return <div className="ml-64 bg-gray-900 min-h-screen"><LoadingSpinner /></div>;

    return (
        <div className="p-8 ml-64 min-h-screen bg-gray-900 text-white print:ml-0 print:p-0 print:bg-white print:text-black">
            <style>{`@media print { .no-print { display: none !important; } body { background-color: white !important; color: black !important; } .print-container { width: 100%; margin: 0; padding: 20px; } .print-modal { position: static !important; width: 100% !important; height: auto !important; background: white !important; color: black !important; border: none !important; box-shadow: none !important; overflow: visible !important; } .print-text { color: black !important; } .ml-64 { margin-left: 0 !important; } }`}</style>
            <PrintHeader title="GENEL YÖNETİM ÖZETİ" />
            <div className="flex justify-between items-center mb-6 no-print">
                <h1 className="text-3xl font-bold">Genel Bakış</h1>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportDashboardToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"><FileDown size={16}/> Excel İndir</button>
                  <button onClick={handlePrint} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"><Printer size={16}/> Yazdır</button>
                  <div className="flex items-center gap-4 bg-gray-800 p-2 rounded-lg border border-gray-700">
                    <input type="date" className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="text-gray-400">-</span>
                    <input type="date" className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <button onClick={fetchDashboardData} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold">Getir</button>
                  </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-5 print:bg-white print:border-black print:shadow-none">
                    <div className="flex items-center gap-3 mb-4"><Package size={20} className="text-purple-400"/><h2 className="text-lg font-bold print:text-black">Ürün Satışları</h2></div>
                    <div className="space-y-3">
                        {dashboardData.products && dashboardData.products.length > 0 ? (
                            dashboardData.products.slice(0, 5).map((p, i) => (
                                <div key={i} className="flex justify-between items-center p-2 bg-gray-700/30 rounded-lg border border-gray-700 print:bg-white print:border-black print:border-b">
                                    <span className="text-sm font-medium text-gray-200 print:text-black">{p._id}</span>
                                    <span className="font-bold text-white bg-blue-600 px-2 py-1 rounded text-xs print:bg-gray-200 print:text-black">{p.totalQty}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-400 text-sm py-4">Ürün satışı yok</p>
                        )}
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-5 print:bg-white print:border-black print:shadow-none">
                    <div className="flex items-center gap-3 mb-4">
                      <CreditCard size={20} className="text-green-400"/>
                      <h2 className="text-lg font-bold print:text-black">Tahsilat & Alacak</h2>
                    </div>
                    <div className="space-y-3">
                    {paymentMethods.map((method) => {
                      const styles = getPaymentMethodStyles(method);
                      const amount = Number(paymentTotals[method]) || 0;
                      const isBorç = method === 'Borç';
                      return (
                        <div key={method} className={`flex justify-between items-center p-2 rounded-lg border print:bg-white print:border-black print:border-b ${styles.row}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-200 print:text-black">{method}</span>
                            {isBorç && <span className="text-[10px] text-orange-400 font-bold">(Alacak)</span>}
                          </div>
                          <span className={`font-bold px-2 py-1 rounded text-xs min-w-[80px] text-right print:bg-gray-200 print:text-black ${styles.badge}`}>{amount.toLocaleString('tr-TR')} ₺</span>
                        </div>
                      );
                    })}
                    </div>
                </div>
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-5 print:bg-white print:border-black print:shadow-none">
                    <div className="flex items-center gap-3 mb-4"><TrendingUp size={20} className="text-yellow-400"/><h2 className="text-lg font-bold print:text-black">Özet</h2></div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-2 bg-gray-700/30 rounded-lg print:bg-white print:border print:border-black">
                            <span className="text-gray-300 print:text-black">Toplam Satış:</span>
                            <span className="font-bold text-white print:text-black">{dashboardData.summary?.totalSales || 0} ₺</span>
                        </div>
                        <div className="flex justify-between p-2 bg-red-900/20 rounded-lg border border-red-500/30 print:bg-white print:border print:border-black">
                            <span className="text-gray-300 print:text-black flex items-center gap-1">
                              <TrendingDown size={14} className="text-red-400 no-print"/>
                              Toplam Gider:
                            </span>
                            <span className="font-bold text-red-300 print:text-black">{(dashboardData.totalExpense || 0).toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-700/30 rounded-lg print:bg-white print:border print:border-black">
                            <span className="text-gray-300 print:text-black">Satılan Adet:</span>
                            <span className="font-bold text-white print:text-black">{dashboardData.summary?.totalItems || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-[2] bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col h-[calc(100vh-400px)] print:bg-white print:border-black print:h-auto print:shadow-none">
                    <div className="p-5 border-b border-gray-700 bg-gray-850 rounded-t-xl print:bg-white print:border-black"><h2 className="text-lg font-bold flex items-center gap-2 print:text-black"><Users size={20} className="text-blue-400 no-print"/> Müşteri Sıralaması (Ciro)</h2></div>
                    <div className="flex-1 overflow-y-auto p-2 print:overflow-visible">
                        <table className="w-full text-left border-collapse print:border print:border-black">
                            <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase sticky top-0 print:bg-gray-200 print:text-black print:static"><tr><th className="p-3 print:border print:border-black">#</th><th className="p-3 print:border print:border-black">Müşteri</th><th className="p-3 text-right print:border print:border-black">Toplam Tutar</th><th className="p-3 text-right no-print">İşlem</th></tr></thead>
                            <tbody className="divide-y divide-gray-700 print:divide-black">
                                {dashboardData.customers.map((c, i) => {
                                    let amountColor = 'text-green-400';
                                    if (c.debtAmount > 0 && c.paidAmount === 0) {
                                        amountColor = 'text-orange-400';
                                    } else if (c.debtAmount > 0 && c.paidAmount > 0) {
                                        amountColor = 'text-yellow-400';
                                    }
                                    return (
                                        <tr key={c._id} className="hover:bg-gray-700/50 transition-colors print:hover:bg-transparent">
                                            <td className="p-3 text-gray-500 font-mono text-sm print:text-black print:border print:border-black">{i + 1}</td>
                                            <td className="p-3 font-medium print:text-black print:border print:border-black">{c.name}</td>
                                            <td className={`p-3 text-right font-bold print:text-black print:border print:border-black ${amountColor}`}>{c.totalAmount} ₺</td>
                                            <td className="p-3 text-right no-print"><button onClick={() => handleCustomerDetail(c)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ml-auto"><Eye size={14}/> Detay</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                {selectedCustomer && historyData && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 print:p-0 print:bg-white print:absolute print:inset-0">
                        <div className="bg-gray-800 w-[900px] max-h-[90vh] rounded-xl border border-gray-600 shadow-2xl flex flex-col print-modal print:border-none">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-start bg-gray-850 rounded-t-xl print:border-b-2 print:border-black print:bg-white">
                                <div><h2 className="text-2xl font-bold text-white print-text">{selectedCustomer.name}</h2><p className="text-gray-400 text-sm mt-1 print-text">Hesap Ekstresi / Detaylı Rapor</p></div>
                                <div className="flex gap-2 no-print"><button onClick={handleExportCustomerHistoryToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><FileDown size={18}/> Excel İndir</button><button onClick={() => { setSelectedCustomer(null); setHistoryData(null); }} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg"><X size={20}/></button></div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 print:overflow-visible">
                                <table className="w-full text-left text-sm">
                                    <thead><tr className="text-gray-500 uppercase border-b border-gray-700 print:text-black print:border-black"><th className="pb-3">Tarih</th><th className="pb-3">Ürün Bilgisi</th><th className="pb-3">Ödeme Türü</th><th className="pb-3 text-right">Tutar</th></tr></thead>
                                    <tbody className="divide-y divide-gray-700 print:divide-gray-300">
                                        {historyData.map((item, idx) => {
                                            let badgeBg = 'bg-blue-900/50 text-blue-300';
                                            let amountColor = 'text-white';
                                            let rowBg = '';
                                            
                                            if (item.type === 'Tahsilat') {
                                                badgeBg = 'bg-green-900/50 text-green-300';
                                                amountColor = 'text-green-400';
                                                rowBg = 'bg-green-900/10';
                                            } else if (item.paymentMethod === 'Borç' || item.type === 'Manuel Borç') {
                                                badgeBg = 'bg-orange-900/50 text-orange-300';
                                                amountColor = 'text-orange-400';
                                                rowBg = 'bg-orange-900/10';
                                            } else if (item.paymentMethod === 'Kart') {
                                                badgeBg = 'bg-purple-900/50 text-purple-300';
                                                amountColor = 'text-purple-400';
                                            } else if (item.paymentMethod === 'IBAN') {
                                                badgeBg = 'bg-cyan-900/50 text-cyan-300';
                                                amountColor = 'text-cyan-400';
                                            }
                                            
                                            const paymentType = item.type === 'Tahsilat' ? 'Tahsilat' : (item.paymentMethod || item.type || 'Bilinmiyor');
                                            
                                            return (
                                                <tr key={idx} className={`hover:bg-gray-750 print:hover:bg-transparent ${rowBg}`}>
                                                    <td className="py-3 align-top text-gray-300 print-text">{new Date(item.date).toLocaleDateString('tr-TR')} <span className="text-xs text-gray-500 block print-text">{new Date(item.date).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'})}</span></td>
                                                    <td className="py-3 align-top text-gray-300 print-text max-w-md">{item.description}</td>
                                                    <td className="py-3 align-top"><span className={`px-2 py-1 rounded text-xs font-bold print:border print:border-black print:bg-transparent print:text-black ${badgeBg}`}>{paymentType}</span></td>
                                                    <td className={`py-3 align-top text-right font-bold text-lg print-text ${item.isIncome ? 'text-green-400' : amountColor}`}>{item.isIncome ? '-' : ''}{item.amount} ₺</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-6 border-t border-gray-700 bg-gray-850 rounded-b-xl flex justify-between items-center print:bg-white print:border-t-2 print:border-black"><div className="text-xs text-gray-500 print-text">Rapor Tarihi: {new Date().toLocaleString()}</div></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
