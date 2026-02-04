import { useState, useEffect } from 'react';
import axios from 'axios';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Search, FileDown, Banknote, FileText, Trash2, X, History, CreditCard } from 'lucide-react';
import { LoadingSpinner, ConfirmationModal, Toast, PrintHeader } from '../components/shared';
import { API_URL } from '../config';
import { formatCurrencyForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection } from '../utils/excelTemplates';
import { getLocalDateString } from '../utils/appHelpers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const Debts = () => {
    const [debtors, setDebtors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('Nakit');
    const [toast, setToast] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [debtDetails, setDebtDetails] = useState([]);
    const [showManualDebtModal, setShowManualDebtModal] = useState(false);
    const [serverDate, setServerDate] = useState(getLocalDateString());
    const [manualDebtData, setManualDebtData] = useState({ customerId: '', customerName: '', phone: '', amount: '', date: getLocalDateString(), description: '' });
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);
    const [filteredCustomerSearch, setFilteredCustomerSearch] = useState([]);
    const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, paymentId: null });
    const [deleteDebtConfirmation, setDeleteDebtConfirmation] = useState({ isOpen: false, debtor: null });
    const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);

    const showToastMessage = (message, type) => setToast({ message, type });

    const handleExportDebtorsToExcel = () => {
      const debtRows = debtors.map((d, index) => ([
        index + 1,
        d.name || '-',
        d.phone || '-',
        formatCurrencyForExcel(d.totalDebt || 0)
      ]));

      const summaryRows = [
        ['Toplam Borçlu Müşteri', debtors.length],
        ['Toplam Alacak', formatCurrencyForExcel(totalReceivable)],
        ['Tarih Aralığı', 'Tüm Zamanlar']
      ];

            const sections = [
                {
                    title: 'BORÇLU MÜŞTERİLER',
                    headers: ['Sıra', 'Müşteri Adı', 'Telefon', 'Kalan Borç'],
                    rows: debtRows
                },
                addSummarySection(summaryRows)
            ];

            const success = generateSectionedExcel(sections, 'Borçlular', 'borcular');
      if (success) {
        setTimeout(() => showToastMessage('Excel dosyası indirildi', 'success'), 500);
      } else {
        showToastMessage('Excel indirme başarısız', 'error');
      }
    };

    const fetchDebts = async () => { 
        setIsLoading(true); 
        try { 
            const [debtRes] = await Promise.all([
              axios.get(`${API_URL}/api/debts`)
            ]);
            setDebtors(debtRes.data);
        } catch(err) { console.error(err); } finally { setIsLoading(false); } 
    };
    useEffect(() => { fetchDebts(); }, []);

    useEffect(() => {
        const initServerTime = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/system/time`);
                const serverDateValue = res.data.date || getLocalDateString(new Date(res.data.now));
                setServerDate(serverDateValue);
            } catch (err) {
                console.error(err);
            }
        };

        initServerTime();
    }, []);

    useEffect(() => {
        setManualDebtData((prev) => ({ ...prev, date: serverDate }));
    }, [serverDate]);

    const openPayModal = (debtor) => { setSelectedDebtor(debtor); setPayAmount(''); setShowPayModal(true); };
    
    const handlePayment = async () => {
        if (!payAmount || !selectedDebtor) { showToastMessage("Lütfen tutar giriniz.", "error"); return; }
        try { 
            await axios.post(`${API_URL}/api/payments`, { customerId: selectedDebtor._id, amount: parseFloat(payAmount), method: payMethod }); 
            setShowPayModal(false); 
            fetchDebts(); 
            showToastMessage("Tahsilat girişi başarılı", 'success'); 
        } catch { 
            showToastMessage("Tahsilat girişi başarısız", 'error'); 
        }
    };

    const handleExportDebtDetailsToExcel = () => {
      if (!selectedDebtor || !debtDetails.length) return;

      const detailRows = debtDetails.map((item, index) => ([
        index + 1,
        new Date(item.date).toLocaleDateString('tr-TR') + ' ' + new Date(item.date).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'}),
        item.type,
        item.description,
        formatCurrencyForExcel(item.amount || 0),
        item.isDebt ? 'Borç' : 'Ödeme'
      ]));

      const summaryRows = [
        ['Müşteri Adı', selectedDebtor.name],
        ['Telefon', selectedDebtor.phone || '-'],
        ['Toplam İşlem Sayısı', debtDetails.length],
        ['Toplam Kalan Borç', formatCurrencyForExcel(selectedDebtor.totalDebt || 0)],
        ['Rapor Tarihi', new Date().toLocaleDateString('tr-TR')]
      ];

            const sections = [
                {
                    title: 'MÜŞTERİ BİLGİSİ',
                    headers: ['Bilgi', 'Değer'],
                    rows: [['Müşteri', selectedDebtor.name], ['Telefon', selectedDebtor.phone || '-']]
                },
                {
                    title: 'HESAP EKSTRESİ',
                    headers: ['Sıra', 'Tarih', 'İşlem', 'Açıklama', 'Tutar', 'Tip'],
                    rows: detailRows
                },
                addSummarySection(summaryRows)
            ];

            const success = generateSectionedExcel(sections, 'Hesap Ekstresi', `hesap_ekstresi_${selectedDebtor.name.replace(/\s+/g, '_')}`);
      if (success) {
        setTimeout(() => showToastMessage('Excel dosyası indirildi', 'success'), 500);
      } else {
        showToastMessage('Excel indirme başarısız', 'error');
      }
    };

    const openDetailModal = async (debtor) => {
        setSelectedDebtor(debtor);
        try { 
            const res = await axios.get(`${API_URL}/api/debts/detail/${debtor._id}`); 
            setDebtDetails(res.data); 
            setShowDetailModal(true); 
        } catch (err) { 
            console.error(err); 
        }
    };

    const handleDeletePayment = async (paymentId) => {
        setDeleteConfirmation({ isOpen: true, paymentId });
    };

    const confirmDelete = async () => {
        try {
            await axios.delete(`${API_URL}/api/payments/${deleteConfirmation.paymentId}`);
            setDebtDetails(debtDetails.filter(d => d._id !== deleteConfirmation.paymentId));
            fetchDebts();
            showToastMessage("Tahsilat kaydı başarıyla silindi", "success");
        } catch (err) {
            showToastMessage(err.response?.data?.error || "Tahsilat silme başarısız", "error");
        } finally {
            setDeleteConfirmation({ isOpen: false, paymentId: null });
        }
    };

    const handleDeleteDebt = (debtor) => {
        setDeleteDebtConfirmation({ isOpen: true, debtor });
    };

    const confirmDeleteDebt = async () => {
        try {
            const debtor = deleteDebtConfirmation.debtor;
            await axios.post(`${API_URL}/api/expenses`, {
                title: `${debtor.name} - Silinen Borç`,
                amount: debtor.totalDebt,
                category: 'Zayi/Fire'
            });
            
            await axios.delete(`${API_URL}/api/debts/${debtor._id}`);
            
            fetchDebts();
            showToastMessage(`${debtor.name} müşterisinin borcu silindi ve ${debtor.totalDebt} ₺ gider olarak eklendi`, "success");
        } catch (err) {
            showToastMessage(err.response?.data?.error || "Borç silme başarısız", "error");
        } finally {
            setDeleteDebtConfirmation({ isOpen: false, debtor: null });
        }
    };

    const handleSaveManualDebt = async () => {
        if(!manualDebtData.customerId || !manualDebtData.amount) { showToastMessage("Lütfen müşteri seçin ve tutar girin", "error"); return; }
        try {
            await axios.post(`${API_URL}/api/debts/manual`, {
                customerId: manualDebtData.customerId, customerName: manualDebtData.customerName, amount: parseFloat(manualDebtData.amount), date: manualDebtData.date, description: manualDebtData.description
            });
            setShowManualDebtModal(false); 
            setManualDebtData({ customerId: '', customerName: '', phone: '', amount: '', date: serverDate, description: '' }); 
            setCustomerSearch(''); 
            fetchDebts(); 
            showToastMessage("Geçmiş borç kaydı eklendi", "success");
        } catch { 
            showToastMessage("İşlem başarısız", "error"); 
        }
    };

    const selectCustomerForDebt = (customer) => {
        setManualDebtData({ ...manualDebtData, customerId: customer._id, customerName: customer.name, phone: customer.phone }); 
        setCustomerSearch(customer.name); 
        setShowCustomerResults(false);
    };

    const filteredDebtors = debtors.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    
    useEffect(() => {
        const searchCustomers = async () => {
            if (!debouncedCustomerSearch) {
                setFilteredCustomerSearch([]);
                return;
            }
            try {
                const res = await axios.get(`${API_URL}/api/customers?search=${debouncedCustomerSearch}`);
                const term = debouncedCustomerSearch.toLowerCase();
                setFilteredCustomerSearch(
                    res.data.filter(c => (c.name || '').toLowerCase().includes(term) || (c.phone || '').toLowerCase().includes(term))
                );
            } catch (err) {
                console.error(err);
            }
        };
        searchCustomers();
    }, [debouncedCustomerSearch]);
    
    const totalReceivable = debtors.reduce((acc, curr) => acc + curr.totalDebt, 0);

    const renderDebtorRow = ({ index, style }) => {
        const debtor = filteredDebtors[index];
        if (!debtor) return null;
        return (
            <div style={style} className="grid grid-cols-[2fr_1.5fr_1fr_2fr] items-center gap-4 px-4 border-b border-gray-700 hover:bg-gray-750">
                <div className="font-bold text-white truncate">{debtor.name}</div>
                <div className="text-gray-400 truncate">{debtor.phone}</div>
                <div className="text-right text-red-400 font-bold text-lg">{debtor.totalDebt} ₺</div>
                <div className="flex justify-end gap-2">
                    <button onClick={() => openDetailModal(debtor)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"><FileText size={14}/> Detay</button>
                    <button onClick={() => openPayModal(debtor)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"><Banknote size={14}/> Tahsilat</button>
                    <button onClick={() => handleDeleteDebt(debtor)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2" title="Borcu sil ve gider olarak kaydet"><Trash2 size={14}/> Sil</button>
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="ml-64 bg-gray-900 min-h-screen"><LoadingSpinner /></div>;

    return (
        <div className="p-8 ml-64 min-h-screen bg-gray-900 text-white print:ml-0 print:p-0 print:bg-white print:text-black">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <PrintHeader title="ALACAK (BORÇLULAR) LİSTESİ" />
            <div className="flex justify-between items-center mb-6 no-print">
                <h1 className="text-3xl font-bold flex items-center gap-3"><CreditCard className="text-red-400"/> Borç Takip Listesi</h1>
                <div className="flex items-center gap-4">
                     <button onClick={() => setShowManualDebtModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-lg transition-colors"><History size={20}/> Geçmişe Yönelik Borç Ekle</button>
                 <button onClick={handleExportDebtorsToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><FileDown size={20}/> Excel İndir</button>
                    <div className="bg-red-900/30 border border-red-500/50 px-6 py-3 rounded-xl flex flex-col items-end">
                        <span className="text-red-300 text-xs font-bold uppercase tracking-wider">Piyasadaki Toplam Alacak</span>
                        <span className="text-2xl font-bold text-white">{totalReceivable} ₺</span>
                    </div>
                </div>
            </div>
            <div className="mb-6 relative no-print">
                <Search className="absolute left-3 top-3 text-gray-500" size={20}/>
                <input type="text" className="w-full md:w-1/3 bg-gray-800 border border-gray-700 text-white p-3 pl-10 rounded-lg outline-none" placeholder="Borçlu müşteri ara..." value={search} onChange={(e) => setSearch(e.target.value)}/>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden no-print">
                <div className="bg-gray-900 text-gray-400 text-sm uppercase grid grid-cols-[2fr_1.5fr_1fr_2fr] gap-4 px-4 py-3 border-b border-gray-700">
                    <div>Müşteri Adı</div>
                    <div>Telefon</div>
                    <div className="text-right">Kalan Borç</div>
                    <div className="text-right">İşlem</div>
                </div>
                <div className="h-[520px]">
                    {filteredDebtors.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">Borçlu müşteri bulunamadı.</div>
                    ) : (
                        <AutoSizer>
                            {({ height, width }) => (
                                <List height={height} width={width} itemCount={filteredDebtors.length} itemSize={64}>
                                    {renderDebtorRow}
                                </List>
                            )}
                        </AutoSizer>
                    )}
                </div>
            </div>
            <div className="hidden print:block bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden print:bg-white print:border-none print:shadow-none">
                <table className="w-full text-left border-collapse print:border print:border-black">
                    <thead><tr className="bg-gray-900 text-gray-400 text-sm uppercase print:bg-gray-200 print:text-black print:border-b print:border-black"><th className="p-4 print:p-2 print:border-r print:border-black">Müşteri Adı</th><th className="p-4 print:p-2 print:border-r print:border-black">Telefon</th><th className="p-4 text-right print:p-2 print:border-r print:border-black">Kalan Borç</th><th className="p-4 text-center">İşlem</th></tr></thead>
                    <tbody className="divide-y divide-gray-700 print:divide-black">
                        {filteredDebtors.length === 0 ? <tr><td colSpan="4" className="p-6 text-center text-gray-500 print:text-black">Borçlu müşteri bulunamadı.</td></tr> : filteredDebtors.map(debtor => (
                            <tr key={debtor._id} className="hover:bg-gray-750 print:hover:bg-transparent">
                                <td className="p-4 font-bold print:text-black print:p-2">{debtor.name}</td>
                                <td className="p-4 text-gray-400 print:text-black print:p-2">{debtor.phone}</td>
                                <td className="p-4 text-right text-red-400 font-bold text-lg print:text-black print:p-2">{debtor.totalDebt} ₺</td>
                                <td className="p-4 text-right">-</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showManualDebtModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print">
                    <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 w-[500px] shadow-2xl animate-fade-in-down" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><History className="text-orange-400"/> Geçmişe Yönelik Borç Ekle</h3>
                            <button onClick={() => setShowManualDebtModal(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
                        </div>
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="block text-xs text-gray-400 mb-1 font-bold uppercase">Müşteri Seçimi</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-gray-500" size={18}/>
                                    <input type="text" placeholder="Müşteri adı yazın..." className="w-full bg-gray-700 border border-gray-600 text-white p-2.5 pl-10 rounded-lg focus:border-blue-500 outline-none" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerResults(true); }} onFocus={() => setShowCustomerResults(true)}/>
                                </div>
                                {showCustomerResults && customerSearch && (
                                    <div className="absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded-b-lg max-h-48 overflow-y-auto z-50 shadow-xl mt-1">
                                        {filteredCustomerSearch.map(c => (<div key={c._id} className="p-3 cursor-pointer hover:bg-blue-600 border-b border-gray-600 last:border-0 transition-colors" onClick={() => selectCustomerForDebt(c)}><div className="font-bold text-white">{c.name}</div><div className="text-xs text-gray-400">{c.phone}</div></div>))}
                                        {filteredCustomerSearch.length === 0 && <div className="p-3 text-gray-400 text-sm">Müşteri bulunamadı.</div>}
                                    </div>
                                )}
                            </div>
                            <div><label className="block text-xs text-gray-400 mb-1 font-bold uppercase">Telefon (Otomatik)</label><input type="text" disabled className="w-full bg-gray-900/50 border border-gray-700 text-gray-400 p-2.5 rounded-lg cursor-not-allowed" value={manualDebtData.phone || '-'} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs text-gray-400 mb-1 font-bold uppercase">Tarih</label><input type="date" className="w-full bg-gray-700 border border-gray-600 text-white p-2.5 rounded-lg outline-none focus:border-blue-500" value={manualDebtData.date} onChange={e => setManualDebtData({...manualDebtData, date: e.target.value})} /></div>
                                <div><label className="block text-xs text-gray-400 mb-1 font-bold uppercase">Tutar (TL)</label><input type="number" placeholder="0.00" className="w-full bg-gray-700 border border-gray-600 text-white p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-lg" value={manualDebtData.amount} onChange={e => setManualDebtData({...manualDebtData, amount: e.target.value})} /></div>
                            </div>
                            <div><label className="block text-xs text-gray-400 mb-1 font-bold uppercase">Açıklama (Opsiyonel)</label><input type="text" placeholder="Örn: 2025 Devir Bakiyesi, Elden Borç vb." className="w-full bg-gray-700 border border-gray-600 text-white p-2.5 rounded-lg outline-none focus:border-blue-500" value={manualDebtData.description} onChange={e => setManualDebtData({...manualDebtData, description: e.target.value})} /></div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={handleSaveManualDebt} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95">TAMAM (KAYDET)</button>
                            <button onClick={() => setShowManualDebtModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors">İptal</button>
                        </div>
                    </div>
                </div>
            )}

            {showPayModal && selectedDebtor && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print">
                    <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 w-96 shadow-2xl">
                        <h3 className="text-xl font-bold mb-2 text-white">Tahsilat Girişi</h3>
                        <p className="text-gray-400 mb-6 text-sm">Müşteri: <span className="text-blue-400 font-bold">{selectedDebtor.name}</span></p>
                        <div className="mb-4"><label className="block text-xs text-gray-500 mb-1">Ödenen Tutar (TL)</label><input type="number" autoFocus className="w-full bg-gray-700 border border-gray-500 text-white p-3 rounded text-xl font-bold focus:border-green-500 outline-none" placeholder="0.00" value={payAmount} onChange={e => setPayAmount(e.target.value)}/></div>
                        <div className="mb-6"><label className="block text-xs text-gray-500 mb-1">Ödeme Yöntemi</label><select className="w-full bg-gray-700 border border-gray-500 text-white p-3 rounded outline-none" value={payMethod} onChange={e => setPayMethod(e.target.value)}><option value="Nakit">💵 Nakit</option><option value="IBAN">🏦 IBAN / Havale</option><option value="K.Kartı">💳 Kredi Kartı</option></select></div>
                        <div className="flex gap-3"><button onClick={handlePayment} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">ONAYLA</button><button onClick={() => setShowPayModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg">İptal</button></div>
                    </div>
                </div>
            )}

            {showDetailModal && selectedDebtor && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print" onClick={() => setShowDetailModal(false)}>
                    <div className="bg-gray-800 w-[800px] max-h-[80vh] rounded-xl border border-gray-600 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                            <div><h3 className="text-2xl font-bold text-white">Hesap Ekstresi</h3><p className="text-blue-400 text-sm mt-1">{selectedDebtor.name}</p></div>
                            <div className="flex gap-2">
                                <button onClick={handleExportDebtDetailsToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><FileDown size={18}/> Excel İndir</button>
                                <button onClick={() => setShowDetailModal(false)} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead><tr className="text-gray-500 uppercase border-b border-gray-700"><th className="pb-3">Tarih</th><th className="pb-3">İşlem</th><th className="pb-3">Açıklama</th><th className="pb-3 text-right">Tutar</th><th className="pb-3 w-12"></th></tr></thead>
                                <tbody className="divide-y divide-gray-700">
                                    {debtDetails.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-750 group">
                                            <td className="py-3 align-top text-gray-300">{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                                            <td className="py-3 align-top"><span className={`px-2 py-1 rounded text-xs font-bold ${item.isDebt ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>{item.type}</span></td>
                                            <td className="py-3 align-top text-gray-300">{item.description}</td>
                                            <td className={`py-3 align-top text-right font-bold ${item.isDebt ? 'text-red-400' : 'text-green-400'}`}>{item.isDebt ? '+' : '-'}{item.amount} ₺</td>
                                            <td className="py-3 text-center">
                                                {!item.isDebt && item._id && (
                                                    <button onClick={() => handleDeletePayment(item._id)} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded text-xs font-bold transition-colors" title="Tahsilat kaydını sil">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t border-gray-700 bg-gray-850 flex justify-end">
                            <div className="text-xl font-bold text-white">Toplam Kalan Borç: <span className="text-red-400 ml-2">{selectedDebtor.totalDebt} ₺</span></div>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={deleteConfirmation.isOpen}
                message="⚠️ Bu tahsilat kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmation({ isOpen: false, paymentId: null })}
            />
            <ConfirmationModal
                isOpen={deleteDebtConfirmation.isOpen}
                message={`⚠️ ${deleteDebtConfirmation.debtor?.name} müşterisinin ${deleteDebtConfirmation.debtor?.totalDebt} ₺ borcunu silmek istediğinize emin misiniz?\n\n• Borç silinecek\n• Ürün stoğa eklenmeyecek\n• Tutar gider olarak kaydedilecek\n\nBu işlem geri alınamaz!`}
                onConfirm={confirmDeleteDebt}
                onCancel={() => setDeleteDebtConfirmation({ isOpen: false, debtor: null })}
            />
        </div>
    );
};

export default Debts;
