import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, FileDown, Wallet, Filter, TrendingUp, TrendingDown, CreditCard, Tag, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { LoadingSpinner, Toast, PrintHeader, ConfirmationModal } from '../components/shared';
import { API_URL } from '../config';
import { formatCurrencyForExcel, formatDateForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection } from '../utils/excelTemplates';
import { getLocalDateString } from '../utils/appHelpers';

const EXPENSE_CATEGORIES = [
  'Ürün Alımı',
  'Kira',
  'Nakliye',
  'Elektrik/Su/Doğalgaz',
  'Çalışan Maaşı',
  'Vergi/Harç',
  'Bakım/Onarım',
  'Sigortalar',
  'Zayi/Fire',
  'Diğer'
];

const Finance = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ 
        totalSales: 0, 
        totalExpense: 0, 
        totalOutstandingDebt: 0, 
        netProfit: 0, 
        currentCash: 0, 
        transactions: [], 
        filteredTotal: 0,
        totalCost: 0,
        unitCost: 0,
        totalQuantity: 0
    });
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [endDate, setEndDate] = useState(getLocalDateString());
    const [categoryFilter, setCategoryFilter] = useState('all'); 
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Genel' });
    const [toast, setToast] = useState(null);
    const [serverOffsetMs, setServerOffsetMs] = useState(0);
    const [editModal, setEditModal] = useState({ show: false, transaction: null });
    const [editData, setEditData] = useState({ title: '', amount: '', category: 'Genel', method: 'Nakit', description: '', date: '' });
    const [deleteModal, setDeleteModal] = useState({ show: false, transaction: null });

    const showToastMessage = (message, type) => setToast({ message, type });

    const fetchStats = useCallback(async ({ startDate: rangeStart, endDate: rangeEnd, category, cacheBuster } = {}) => {
        setIsLoading(true);
        try { 
            let url = `${API_URL}/api/finance/stats?category=${category}`;
            if (rangeStart && rangeEnd) { url += `&startDate=${rangeStart}&endDate=${rangeEnd}`; }
            if (cacheBuster) { url += `&_=${cacheBuster}`; }
            const res = await axios.get(url); 
            setStats(res.data); 
        } catch(err) { 
            console.error(err); 
        } finally { 
            setIsLoading(false); 
        }
    }, []);
    
        useEffect(() => { fetchStats({ startDate, endDate, category: categoryFilter }); }, [fetchStats, startDate, endDate, categoryFilter]);

        useEffect(() => {
            const initServerTime = async () => {
                try {
                    const res = await axios.get(`${API_URL}/api/system/time`);
                    const serverNow = new Date(res.data.now);
                    const clientNow = new Date();
                    const offset = serverNow.getTime() - clientNow.getTime();
                    setServerOffsetMs(offset);
                    const serverDate = res.data.date || getLocalDateString(serverNow);
                    setStartDate(serverDate);
                    setEndDate(serverDate);
                    fetchStats({ startDate: serverDate, endDate: serverDate, category: 'all' });
                } catch (err) {
                    console.error(err);
                }
            };

            initServerTime();
        }, [fetchStats]);

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
                    fetchStats({ startDate: today, endDate: today, category: categoryFilter });
                    scheduleMidnightReset();
                }, msUntilMidnight + 50);
            };

            scheduleMidnightReset();
            return () => clearTimeout(timerId);
        }, [serverOffsetMs, categoryFilter, fetchStats]);

        useEffect(() => {
            let timerId;
            const scheduleMidnightReset = () => {
                const now = new Date();
                const nextMidnight = new Date(now);
                nextMidnight.setHours(24, 0, 0, 0);
                const msUntilMidnight = nextMidnight - now;
                timerId = setTimeout(() => {
                    const today = getLocalDateString();
                    setStartDate(today);
                    setEndDate(today);
                    fetchStats({ startDate: today, endDate: today, category: categoryFilter });
                    scheduleMidnightReset();
                }, msUntilMidnight + 50);
            };

            scheduleMidnightReset();
            return () => clearTimeout(timerId);
        }, [categoryFilter, fetchStats]);

    const handleFilter = () => { 
        if (!startDate || !endDate) { showToastMessage("Lütfen başlangıç ve bitiş tarihlerini seçiniz.", "error"); return; }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) { showToastMessage("Başlangıç tarihi bitiş tarihinden sonra olamaz.", "error"); return; }
        fetchStats({ startDate, endDate, category: categoryFilter, cacheBuster: Date.now() }); 
    };
    
    const handleAddExpense = async () => {
        const title = newExpense.title.trim();
        const amount = parseFloat(newExpense.amount);
        if(!title || !newExpense.amount || isNaN(amount) || amount <= 0) { showToastMessage("Lütfen geçerli gider bilgileri giriniz", "error"); return; }
        try { 
            await axios.post(`${API_URL}/api/expenses`, { ...newExpense, title }); 
            setShowExpenseModal(false); 
            setNewExpense({ title: '', amount: '', category: 'Genel' }); 
            fetchStats({ startDate, endDate, category: categoryFilter, cacheBuster: Date.now() }); 
            showToastMessage("Gider ekleme başarılı", 'success'); 
        } catch(err) { 
            showToastMessage(err.response?.data?.error || "Gider ekleme başarısız", 'error'); 
        }
    };

    const isEditableTransaction = (t) => ['expense', 'payment', 'manual-debt'].includes(t?.sourceType);

    const openEditModal = (t) => {
        const dateValue = t?.date ? new Date(t.date).toISOString().split('T')[0] : '';
        setEditData({
            title: t?.sourceType === 'expense' ? t.desc : '',
            amount: t?.amount || '',
            category: t?.sourceType === 'expense' ? (t.category || 'Genel') : 'Genel',
            method: t?.sourceType === 'payment' ? (t.method || 'Nakit') : 'Nakit',
            description: t?.sourceType === 'manual-debt' ? (t.note || '') : '',
            date: t?.sourceType === 'manual-debt' ? dateValue : ''
        });
        setEditModal({ show: true, transaction: t });
    };

    const closeEditModal = () => {
        setEditModal({ show: false, transaction: null });
        setEditData({ title: '', amount: '', category: 'Genel', method: 'Nakit', description: '', date: '' });
    };

    const handleEditSave = async () => {
        const t = editModal.transaction;
        if (!t) return;
        const amount = parseFloat(editData.amount);
        if (isNaN(amount) || amount <= 0) { showToastMessage('Lütfen geçerli bir tutar giriniz', 'error'); return; }

        try {
            if (t.sourceType === 'expense') {
                const title = editData.title.trim();
                if (!title) { showToastMessage('Gider açıklaması zorunludur', 'error'); return; }
                await axios.put(`${API_URL}/api/expenses/${t.sourceId}`, {
                    title,
                    amount,
                    category: editData.category
                });
            } else if (t.sourceType === 'payment') {
                await axios.put(`${API_URL}/api/payments/${t.sourceId}`, {
                    amount,
                    method: editData.method
                });
            } else if (t.sourceType === 'manual-debt') {
                await axios.put(`${API_URL}/api/debts/manual/${t.sourceId}`, {
                    amount,
                    description: editData.description,
                    date: editData.date
                });
            }
            closeEditModal();
            fetchStats({ startDate, endDate, category: categoryFilter, cacheBuster: Date.now() });
            showToastMessage('İşlem güncellendi', 'success');
        } catch (err) {
            showToastMessage(err.response?.data?.error || 'İşlem güncellenemedi', 'error');
        }
    };

    const confirmDeleteTransaction = async () => {
        const t = deleteModal.transaction;
        if (!t) return;
        try {
            if (t.sourceType === 'expense') {
                await axios.delete(`${API_URL}/api/expenses/${t.sourceId}`);
            } else if (t.sourceType === 'payment') {
                await axios.delete(`${API_URL}/api/payments/${t.sourceId}`);
            } else if (t.sourceType === 'manual-debt') {
                await axios.delete(`${API_URL}/api/debts/manual/${t.sourceId}`);
            }
            setDeleteModal({ show: false, transaction: null });
            fetchStats({ startDate, endDate, category: categoryFilter, cacheBuster: Date.now() });
            showToastMessage('İşlem silindi', 'success');
        } catch (err) {
            if (err.response?.status === 404) {
                setDeleteModal({ show: false, transaction: null });
                fetchStats({ startDate, endDate, category: categoryFilter, cacheBuster: Date.now() });
                showToastMessage('Kayıt zaten silinmiş olabilir', 'warning');
                return;
            }
            showToastMessage(err.response?.data?.error || 'İşlem silinemedi', 'error');
        }
    };

    const handleExportFinanceToExcel = () => {
      const transactionRows = stats.transactions.map((t, index) => ([
        index + 1,
        t.type,
        t.desc,
        t.category,
        t.method,
        formatCurrencyForExcel(t.amount || 0),
        new Date(t.date).toLocaleString('tr-TR')
      ]));

      const karMarji = stats.netProfit > 0 && stats.totalSales > 0 ? Math.round((stats.netProfit/stats.totalSales)*100) + '%' : (stats.netProfit > 0 ? 'Kâr Var ✓' : 'Zarar ⚠️');
      const gelirYuzdesi = Math.min((stats.totalSales / (stats.totalSales + stats.totalExpense || 1)) * 100, 100).toFixed(1);
      const giderYuzdesi = Math.min((stats.totalExpense / (stats.totalSales + stats.totalExpense || 1)) * 100, 100).toFixed(1);
      
      const dateRange = (startDate && endDate) 
        ? `${formatDateForExcel(startDate)} - ${formatDateForExcel(endDate)}`
        : 'Tüm Zamanlar';

      const summaryRows = [
        ['Tarih Aralığı', dateRange],
        ['Toplam Gelir', formatCurrencyForExcel(stats.totalSales || 0)],
        ['Toplam Gider', formatCurrencyForExcel(stats.totalExpense || 0)],
        ['Açık Alacak', formatCurrencyForExcel(stats.totalOutstandingDebt || 0)],
        ['Nakit Durum', formatCurrencyForExcel(stats.currentCash || 0)],
        ['Net Kar', formatCurrencyForExcel(stats.netProfit || 0)],
        ['Toplam Maliyet', formatCurrencyForExcel(stats.totalCost || 0)],
        ['Gelir Oranı', gelirYuzdesi + '%'],
        ['Gider Oranı', giderYuzdesi + '%'],
        ['Finansal Sağlık (Kâr Marjı)', karMarji]
      ];

            const sections = [
                {
                    title: 'FİNANS İŞLEMLERİ',
                    headers: ['Sıra', 'Tip', 'Açıklama', 'Kategori', 'Ödeme', 'Tutar', 'Tarih'],
                    rows: transactionRows
                },
                addSummarySection(summaryRows, { title: 'FİNANSAL ÖZET' })
            ];

            const success = generateSectionedExcel(sections, 'Finans', 'finans');
      if (success) {
        setTimeout(() => showToastMessage('Excel dosyası indirildi', 'success'), 500);
      } else {
        showToastMessage('Excel indirme başarısız', 'error');
      }
    };

    if (isLoading) return <div className="ml-64 bg-gray-900 min-h-screen"><LoadingSpinner /></div>;

    return (
        <div className="p-8 ml-64 min-h-screen bg-gray-900 text-white print:ml-0 print:p-0 print:bg-white print:text-black">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <ConfirmationModal
                isOpen={deleteModal.show}
                message="Bu işlemi silmek istediğinize emin misiniz?"
                onConfirm={confirmDeleteTransaction}
                onCancel={() => setDeleteModal({ show: false, transaction: null })}
            />
            <PrintHeader title="FİNANSAL DURUM & GELİR/GİDER RAPORU" />
            <div className="flex justify-between items-end mb-8 no-print">
                <h1 className="text-3xl font-bold flex items-center gap-3"><Wallet className="text-blue-400"/> Finansal Durum</h1>
                <div className="flex items-center gap-2">
                <button onClick={handleExportFinanceToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 h-[42px] font-medium"><FileDown size={20}/> Excel İndir</button>
                    <div className="flex items-center gap-4 bg-gray-800 p-2 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-2"><input type="date" className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none border border-gray-600 focus:border-blue-500" value={startDate} onChange={(e)=>setStartDate(e.target.value)} /><span className="text-gray-400">-</span><input type="date" className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none border border-gray-600 focus:border-blue-500" value={endDate} onChange={(e)=>setEndDate(e.target.value)} /><div className="w-px h-8 bg-gray-600 mx-2"></div><select className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none border border-gray-600 focus:border-blue-500" value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="all">Tüm Kategoriler</option><option value="Sipariş Gelirleri">Sipariş Gelirleri (+)</option><option value="Borç Tahsilatları">Borç Tahsilatları (+)</option><option value="Toplu Satış Geliri">Toplu Satış Geliri (+)</option>{EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat} (-)</option>)}</select><button onClick={handleFilter} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold ml-2">Filtrele</button></div>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                <div className="bg-blue-900/20 p-5 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] print:bg-white print:border-black print:shadow-none print:text-black"><div className="flex justify-between items-start mb-2"><span className="text-blue-100 text-sm font-extrabold uppercase tracking-wide print:text-black">Toplam Gelir</span><div className="p-1.5 bg-blue-500/20 rounded-lg text-blue-400 no-print"><TrendingUp size={18}/></div></div><div className="text-2xl font-bold text-white print:text-black">{stats.totalSales} ₺</div><div className="text-xs text-blue-200 mt-1">(Nakit Satış + Tahsilat)</div></div>
                <div className="bg-red-900/20 p-5 rounded-xl border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] print:bg-white print:border-black print:shadow-none print:text-black"><div className="flex justify-between items-start mb-2"><span className="text-red-100 text-sm font-extrabold uppercase tracking-wide print:text-black">Toplam Gider</span><div className="p-1.5 bg-red-500/20 rounded-lg text-red-400 no-print"><TrendingDown size={18}/></div></div><div className="text-2xl font-bold text-white print:text-black">{stats.totalExpense} ₺</div></div>
                <div className="bg-orange-900/20 p-5 rounded-xl border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] print:bg-white print:border-black print:shadow-none print:text-black"><div className="flex justify-between items-start mb-2"><span className="text-orange-100 text-sm font-extrabold uppercase tracking-wide print:text-black">Açık Alacak</span><div className="p-1.5 bg-orange-500/20 rounded-lg text-orange-400 no-print"><CreditCard size={18}/></div></div><div className="text-2xl font-bold text-white print:text-black">{stats.totalOutstandingDebt} ₺</div><div className="text-xs text-orange-200 mt-1">(Kalan Borç)</div></div>
                <div className="bg-purple-900/20 p-5 rounded-xl border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] relative overflow-hidden print:bg-white print:border-black print:shadow-none print:text-black"><div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4 no-print"></div><div className="flex justify-between items-start mb-2"><span className="text-purple-100 text-sm font-extrabold uppercase tracking-wide print:text-black">Nakit Durum</span><div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-300 no-print"><Wallet size={18}/></div></div><div className="text-2xl font-bold text-white print:text-black">{stats.currentCash} ₺</div><div className="text-xs text-purple-200 mt-1">(Kasa Net)</div></div>
                <div className="bg-emerald-900/20 p-5 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] print:bg-white print:border-black print:shadow-none print:text-black"><div className="flex justify-between items-start mb-2"><span className="text-emerald-100 text-sm font-extrabold uppercase tracking-wide print:text-black">Net Kâr</span><div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 no-print"><Tag size={18}/></div></div><div className={`text-2xl font-bold ${stats.netProfit>=0 ? 'text-emerald-400':'text-red-400'} print:text-black`}>{stats.netProfit} ₺</div></div>
                <div className="bg-cyan-900/20 p-5 rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] print:bg-white print:border-black print:shadow-none print:text-black"><div className="flex justify-between items-start mb-2"><span className="text-cyan-100 text-sm font-extrabold uppercase tracking-wide print:text-black">Toplam Maliyet</span><div className="p-1.5 bg-cyan-500/20 rounded-lg text-cyan-400 no-print"><DollarSign size={18}/></div></div><div className="text-2xl font-bold text-white print:text-black">{stats.totalCost || 0} ₺</div><div className="text-xs text-cyan-200 mt-1">({stats.totalQuantity || 0} Adet Satış)</div></div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 shadow-lg flex flex-col h-[calc(100vh-350px)] min-h-[500px] print:h-auto print:bg-white print:border-none print:shadow-none">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center print:border-black"><h2 className="text-xl font-bold text-white print:text-black">İşlem Hareketleri</h2><button onClick={()=>setShowExpenseModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 no-print"><Plus size={16}/> Gider Ekle</button></div>
                    {categoryFilter !== 'all' && (<div className="bg-blue-900/40 border-b border-blue-500/30 p-3 flex justify-between items-center px-6 print:bg-gray-100 print:text-black print:border-black"><span className="text-blue-200 text-sm font-medium flex items-center gap-2 print:text-black"><Filter size={14}/> Şu an filtreleniyor: <span className="font-bold text-white print:text-black">{categoryFilter}</span></span><span className="text-white font-bold text-lg print:text-black">Toplam: {stats.filteredTotal} ₺</span></div>)}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent print:overflow-visible print:space-y-0">
                        {stats.transactions.length === 0 ? (<div className="text-center text-gray-500 mt-10 print:text-black">Bu kriterlere uygun işlem bulunamadı.</div>) : (stats.transactions.map((t, idx) => {
                            let bgColor = 'bg-gray-750';
                            let iconBg = 'bg-gray-700/50 text-gray-400';
                            let textColor = 'text-green-400';
                            let icon = '📦';
                            
                            if (t.type === 'Tahsilat') {
                                bgColor = 'bg-green-900/20 hover:bg-green-900/30 border-green-700/50';
                                iconBg = 'bg-green-900/50 text-green-400';
                                textColor = 'text-green-400';
                                icon = '💵';
                            } else if (t.type === 'Gider') {
                                bgColor = 'bg-red-900/20 hover:bg-red-900/30 border-red-700/50';
                                iconBg = 'bg-red-900/50 text-red-400';
                                textColor = 'text-red-400';
                                icon = '📉';
                            } else if (t.type === 'Borç Kaydı') {
                                bgColor = 'bg-orange-900/20 hover:bg-orange-900/30 border-orange-700/50';
                                iconBg = 'bg-orange-900/50 text-orange-400';
                                textColor = 'text-orange-400';
                                icon = '💳';
                            } else if (t.type === 'Gelir') {
                                bgColor = 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700/50';
                                iconBg = 'bg-blue-900/50 text-blue-400';
                                textColor = 'text-green-400';
                                icon = '📦';
                            }
                            
                            const canEdit = isEditableTransaction(t);
                            return (
                                <div key={idx} className={`flex justify-between items-center p-3 ${bgColor} rounded-lg transition-colors border border-gray-700/50 print:bg-white print:border-b print:border-gray-300 print:rounded-none`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full no-print text-lg ${iconBg}`}>{icon}</div>
                                        <div>
                                            <div className="text-white font-medium print:text-black">{t.desc}</div>
                                            <div className="text-xs text-gray-500 print:text-black">{new Date(t.date).toLocaleString()} • {t.category} • {t.method}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`font-bold ${textColor} print:text-black`}>{t.type==='Gider'?'-':'+'}{t.amount} ₺</div>
                                        {canEdit && (
                                            <div className="flex items-center gap-1 no-print">
                                                <button onClick={() => openEditModal(t)} className="p-1.5 rounded bg-gray-700/60 hover:bg-gray-600 text-white" title="Düzenle">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => setDeleteModal({ show: true, transaction: t })} className="p-1.5 rounded bg-red-600/70 hover:bg-red-600 text-white" title="Sil">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        }))}
                    </div>
                </div>
                <div className="w-full lg:w-1/4 bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-4 flex flex-col h-fit no-print">
                    <h2 className="text-lg font-bold text-white mb-3">Gelir / Gider Dengesi</h2>
                    <div className="flex flex-col gap-3"><div className="space-y-1"><div className="flex justify-between text-sm text-gray-400"><span>Gelir</span><span>{stats.totalSales} ₺</span></div><div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden"><div className="bg-green-500 h-full rounded-full" style={{width: `${Math.min((stats.totalSales / (stats.totalSales+stats.totalExpense || 1))*100, 100)}%`}}></div></div></div><div className="space-y-1"><div className="flex justify-between text-sm text-gray-400"><span>Gider</span><span>{stats.totalExpense} ₺</span></div><div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden"><div className="bg-red-500 h-full rounded-full" style={{width: `${Math.min((stats.totalExpense / (stats.totalSales+stats.totalExpense || 1))*100, 100)}%`}}></div></div></div></div>
                    <div className="mt-3 pt-3 border-t border-gray-700"><div className="text-center text-gray-400 text-xs">Finansal Sağlık</div><div className={`text-center text-lg font-bold mt-1 ${stats.netProfit>0?'text-green-400':'text-red-400'}`}>{stats.netProfit > 0 && stats.totalSales > 0 ? '%'+Math.round((stats.netProfit/stats.totalSales)*100)+' Kâr Marjı' : stats.netProfit > 0 ? 'Kâr Var ✓' : 'Zarar ⚠️'}</div></div>
                </div>
            </div>
            {editModal.show && editModal.transaction && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print">
                    <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 w-[520px] shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">İşlemi Düzenle</h3>
                        {editModal.transaction.sourceType === 'expense' && (
                            <div className="space-y-3">
                                <input type="text" className="w-full bg-gray-700 text-white p-3 rounded outline-none" placeholder="Gider açıklaması" value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} />
                                <input type="number" className="w-full bg-gray-700 text-white p-3 rounded outline-none" placeholder="Tutar (TL)" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} />
                                <select className="w-full bg-gray-700 text-white p-3 rounded outline-none" value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })}>
                                    <option value="Genel">Genel</option>
                                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                        )}
                        {editModal.transaction.sourceType === 'payment' && (
                            <div className="space-y-3">
                                <input type="number" className="w-full bg-gray-700 text-white p-3 rounded outline-none" placeholder="Tutar (TL)" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} />
                                <select className="w-full bg-gray-700 text-white p-3 rounded outline-none" value={editData.method} onChange={e => setEditData({ ...editData, method: e.target.value })}>
                                    <option value="Nakit">Nakit</option>
                                    <option value="IBAN">IBAN</option>
                                    <option value="K.Kartı">K.Kartı</option>
                                </select>
                            </div>
                        )}
                        {editModal.transaction.sourceType === 'manual-debt' && (
                            <div className="space-y-3">
                                <input type="number" className="w-full bg-gray-700 text-white p-3 rounded outline-none" placeholder="Tutar (TL)" value={editData.amount} onChange={e => setEditData({ ...editData, amount: e.target.value })} />
                                <input type="date" className="w-full bg-gray-700 text-white p-3 rounded outline-none" value={editData.date} onChange={e => setEditData({ ...editData, date: e.target.value })} />
                                <input type="text" className="w-full bg-gray-700 text-white p-3 rounded outline-none" placeholder="Açıklama" value={editData.description} onChange={e => setEditData({ ...editData, description: e.target.value })} />
                            </div>
                        )}
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleEditSave} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded font-bold">Kaydet</button>
                            <button onClick={closeEditModal} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded">İptal</button>
                        </div>
                    </div>
                </div>
            )}
            {showExpenseModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print"><div className="bg-gray-800 p-8 rounded-xl border border-gray-600 w-96"><h3 className="text-xl font-bold text-white mb-4">Yeni Gider Ekle</h3><input type="text" placeholder="Gider Açıklaması (Örn: Benzin)" className="w-full bg-gray-700 text-white p-3 rounded mb-3 outline-none" value={newExpense.title} onChange={e=>setNewExpense({...newExpense, title:e.target.value})}/><input type="number" placeholder="Tutar (TL)" className="w-full bg-gray-700 text-white p-3 rounded mb-3 outline-none" value={newExpense.amount} onChange={e=>setNewExpense({...newExpense, amount:e.target.value})}/><select className="w-full bg-gray-700 text-white p-3 rounded mb-6 outline-none" value={newExpense.category} onChange={e=>setNewExpense({...newExpense, category:e.target.value})}><option value="Genel">Genel</option>{EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><div className="flex gap-2"><button onClick={handleAddExpense} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold">Kaydet</button><button onClick={()=>setShowExpenseModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded">İptal</button></div></div></div>)}
        </div>
    );
};

export default Finance;
