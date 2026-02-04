import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Edit, FileDown, Search, X, 
  ShoppingCart, Truck, CheckCircle, Clock, AlertCircle,
  RotateCcw, ChevronRight, Tag, Banknote, Filter
} from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { formatCurrencyForExcel, formatDateForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection, addFilterInfo } from '../utils/excelTemplates';
import { getLocalDateString, getLocalDayRange, getServerDayRange } from '../utils/appHelpers';
import { Toast, LoadingSpinner, ConfirmationModal, PrintHeader } from '../components/shared';
import { API_URL } from '../config';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit] = useState(50);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const [startDate, setStartDate] = useState(getLocalDateString());
  const [endDate, setEndDate] = useState(getLocalDateString());

  const showToastMessage = (message, type) => setToast({ message, type });

  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(''); 
  const [customerSearch, setCustomerSearch] = useState(''); 
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [filteredCustomerSearch, setFilteredCustomerSearch] = useState([]);
  const [lastOrderSuggestion, setLastOrderSuggestion] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(''); 
  const [customPrice, setCustomPrice] = useState(''); 
  const [isPriceFromHistory, setIsPriceFromHistory] = useState(false);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [serverTimezoneOffsetMinutes, setServerTimezoneOffsetMinutes] = useState(null);
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 300);

  const fetchData = useCallback(async (page = 1, append = false) => {
    setIsLoading(true);
    try {
      const [ordRes, prodRes, custRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders`, { params: { page, limit: ordersLimit } }),
        axios.get(`${API_URL}/api/products`),
        axios.get(`${API_URL}/api/customers`)
      ]);
      const orderPayload = ordRes.data;
      const orderList = Array.isArray(orderPayload) ? orderPayload : (orderPayload.data || []);
      const pagination = Array.isArray(orderPayload) ? null : orderPayload.pagination;
      setOrders(prev => (append ? [...prev, ...orderList] : orderList));
      setProducts(prodRes.data);
      setCustomers(custRes.data);
      if (pagination) {
        setOrdersPage(pagination.page);
        setOrdersHasMore(pagination.page < pagination.totalPages);
      } else {
        setOrdersHasMore(orderList.length >= ordersLimit);
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [ordersLimit]);
  useEffect(() => { fetchData(1, false); }, [fetchData]);

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
      } catch (err) {
        console.error(err);
      }
    };

    initServerTime();
  }, []);

    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.date);
      const { start, end } = serverTimezoneOffsetMinutes === null
        ? getLocalDayRange(startDate, endDate)
        : getServerDayRange(startDate, endDate, serverTimezoneOffsetMinutes);
      return orderDate >= start && orderDate <= end;
    });

  const activeOrders = filteredOrders.filter(o => o.status !== 'Teslim Edildi');
  const completedOrders = filteredOrders.filter(o => o.status === 'Teslim Edildi');

  const handleExportOrdersToExcel = () => {
    const activeRows = activeOrders.map((o, index) => ([
      index + 1,
      o.customerName,
      (o.items || []).map(item => `${item.quantity}x ${item.productName}`).join(', '),
      formatCurrencyForExcel(o.totalAmount || 0),
      o.paymentMethod || '-',
      formatDateForExcel(o.date)
    ]));

    const completedRows = completedOrders.map((o, index) => ([
      index + 1,
      o.customerName,
      (o.items || []).map(item => `${item.quantity}x ${item.productName}`).join(', '),
      formatCurrencyForExcel(o.totalAmount || 0),
      o.paymentMethod || '-',
      formatDateForExcel(o.date)
    ]));

    const totalAmount = [...activeOrders, ...completedOrders].reduce((sum, o) => sum + o.totalAmount, 0);

    const summaryRows = [
      ['Tarih Aralığı', `${formatDateForExcel(startDate)} - ${formatDateForExcel(endDate)}`],
      ['Toplam Sipariş', activeOrders.length + completedOrders.length],
      ['Aktif Sipariş', activeOrders.length],
      ['Tamamlanan Sipariş', completedOrders.length],
      ['Toplam Tutar', formatCurrencyForExcel(totalAmount)]
    ];

    const sections = [
      addFilterInfo(
        { 'Tarih Aralığı': `${formatDateForExcel(startDate)} - ${formatDateForExcel(endDate)}` },
        { title: 'TARİH ARALIĞI', headers: ['Bilgi', 'Değer'] }
      ),
      {
        title: 'AKTİF SİPARİŞLER (HAZIRLANAN)',
        headers: ['Sıra', 'Müşteri', 'İçerik', 'Tutar', 'Ödeme', 'Tarih'],
        rows: activeRows.length > 0 ? activeRows : [['Veri yok', '', '', '', '', '']]
      },
      {
        title: 'TESLİM EDİLEN SİPARİŞLER',
        headers: ['Sıra', 'Müşteri', 'İçerik', 'Tutar', 'Ödeme', 'Tarih'],
        rows: completedRows.length > 0 ? completedRows : [['Veri yok', '', '', '', '', '']]
      },
      addSummarySection(summaryRows)
    ];

    generateSectionedExcel(sections, 'Siparişler', 'siparisler');
    setTimeout(() => showToastMessage('Excel dosyası indirildi', 'success'), 500);
  };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') handleCloseModal(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
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
        fetchData(1, false);
        scheduleMidnightReset();
      }, msUntilMidnight + 50);
    };

    scheduleMidnightReset();
    return () => clearTimeout(timerId);
  }, [serverOffsetMs, fetchData]);

  useEffect(() => {
      if (selectedProduct) {
          const product = products.find(p => p._id === selectedProduct);
          let priceToSet = product.salePrice;
          let fromHistory = false;
          if (lastOrderSuggestion) {
              const pastItem = lastOrderSuggestion.items.find(i => i.productId === selectedProduct);
              if (pastItem) { priceToSet = pastItem.price; fromHistory = true; }
          }
          setCustomPrice(priceToSet); setIsPriceFromHistory(fromHistory);
      } else { setCustomPrice(''); setIsPriceFromHistory(false); }
  }, [selectedProduct, products, lastOrderSuggestion]);

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

  const handleSearchKeyDown = (e) => {
    if (!showCustomerResults) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(prev => prev < filteredCustomerSearch.length - 1 ? prev + 1 : prev); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < filteredCustomerSearch.length) { selectCustomer(filteredCustomerSearch[highlightedIndex]); } }
    else if (e.key === 'Escape') { setShowCustomerResults(false); }
  };

  const selectCustomer = async (customer) => {
    setSelectedCustomer(customer._id); setCustomerSearch(customer.name); setShowCustomerResults(false); setHighlightedIndex(-1);
    try { const res = await axios.get(`${API_URL}/api/orders/last/${customer._id}`); setLastOrderSuggestion(res.data || null); } catch (err) { console.error(err); }
  };

  const applyLastOrder = () => {
      if(!lastOrderSuggestion) return;
      const suggestionItems = lastOrderSuggestion.items.map(item => ({ ...item, total: item.price * item.quantity }));
      setCart(suggestionItems); setLastOrderSuggestion(null);
  };

  const addToCart = () => {
    if (!selectedProduct || !quantity || quantity <= 0) { showToastMessage("Lütfen ürün ve geçerli bir adet giriniz.", "error"); return; }
    const productDetails = products.find(p => p._id === selectedProduct);
    const finalPrice = customPrice ? parseFloat(customPrice) : productDetails.salePrice;
    const newItem = { productName: productDetails.name, productId: productDetails._id, quantity: parseInt(quantity), price: finalPrice, total: finalPrice * parseInt(quantity) };
    setCart([...cart, newItem]); setSelectedProduct(''); setQuantity(''); setCustomPrice(''); setIsPriceFromHistory(false);
  };

  const removeFromCart = (index) => { const newCart = [...cart]; newCart.splice(index, 1); setCart(newCart); };
  const calculateTotal = () => cart.reduce((acc, item) => acc + item.total, 0);

  const handleCloseModal = () => { setShowModal(false); setCart([]); setSelectedCustomer(''); setCustomerSearch(''); setSelectedProduct(''); setQuantity(''); setCustomPrice(''); setLastOrderSuggestion(null); setEditingOrderId(null); setHighlightedIndex(-1); };

  const handleSaveOrder = async () => {
    if (!selectedCustomer) { showToastMessage("Lütfen bir müşteri seçiniz.", "error"); return; }
    if (cart.length === 0) { showToastMessage("Sepetiniz boş. Lütfen ürün ekleyiniz.", "error"); return; }
    const customerDetails = customers.find(c => c._id === selectedCustomer);
    if(editingOrderId) await axios.delete(`${API_URL}/api/orders/${editingOrderId}`);
    const newOrder = { customerName: customerDetails.name, customerId: customerDetails._id, items: cart, totalAmount: calculateTotal() };
    try { await axios.post(`${API_URL}/api/orders`, newOrder); handleCloseModal(); fetchData(1, false); showToastMessage('Sipariş girme başarılı', 'success'); } 
    catch { showToastMessage("Sipariş girme başarısız", 'error'); }
  };

  const handleEditOrder = (order) => {
      setSelectedCustomer(order.customerId); setCustomerSearch(order.customerName);
      const loadedCart = order.items.map(item => ({ ...item, total: item.price * item.quantity }));
      setCart(loadedCart); setEditingOrderId(order._id); setShowModal(true);
  };

  const requestDeleteOrder = (id) => { 
    const order = orders.find(o => o._id === id);
    if (order?.status === 'Teslim Edildi' && order?.paymentMethod === 'Borç') {
      showToastMessage("⚠️ Borç siparişi silmeniz bu borcu sileceği anlamına gelir!", "error");
      return;
    }
    setDeleteModal({ show: true, id }); 
  };

  const confirmDeleteOrder = async () => { if(!deleteModal.id) return; try { await axios.delete(`${API_URL}/api/orders/${deleteModal.id}`); fetchData(1, false); showToastMessage('Sipariş silindi', 'success');} catch { showToastMessage("İşlem başarısız", 'error'); } finally { cancelDeleteOrder(); } };
  
  const openPaymentModal = (id) => { setSelectedOrderId(id); setShowPaymentModal(true); };
  
  const handleDeliver = async (method) => {
    if (method === 'Borç') {
      try {
        await axios.put(`${API_URL}/api/orders/${selectedOrderId}/status`, { status: 'Teslim Edildi', paymentMethod: 'Borç' });
        setShowPaymentModal(false);
        fetchData(1, false);
        showToastMessage('Borç kaydedildi. Borçlar sekmesine yönlendiriliyor...', 'success');
        setTimeout(() => {
          window.location.href = '/#/debts';
        }, 1000);
      } catch {
        showToastMessage("İşlem başarısız", 'error');
      }
    } else {
      try {
        await axios.put(`${API_URL}/api/orders/${selectedOrderId}/status`, { status: 'Teslim Edildi', paymentMethod: method });
        setShowPaymentModal(false);
        fetchData(1, false);
        showToastMessage('Sipariş teslim edildi', 'success');
      } catch {
        showToastMessage("İşlem başarısız", 'error');
      }
    }
  };

  const getPaymentColor = (method) => { switch(method) { case 'Borç': return 'text-red-500 font-bold'; case 'Nakit': return 'text-green-400'; case 'K.Kartı': return 'text-purple-400'; case 'IBAN': return 'text-blue-400'; default: return 'text-gray-400'; } };

  const cancelDeleteOrder = () => { setDeleteModal({ show: false, id: null }); };

  const handleLoadMore = () => {
    if (!ordersHasMore) return;
    fetchData(ordersPage + 1, true);
  };

  if (isLoading) return <div className="ml-64 bg-gray-900 min-h-screen"><LoadingSpinner /></div>;

  return (
    <div className="p-8 ml-64 min-h-screen bg-gray-900 text-white print:ml-0 print:p-0 print:bg-white print:text-black">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PrintHeader title="SİPARİŞ DÖKÜMÜ & CİRO RAPORU" />
      <ConfirmationModal isOpen={deleteModal.show} message="Bu siparişi silmek istediğinize emin misiniz?" onConfirm={confirmDeleteOrder} onCancel={cancelDeleteOrder}/>
      
      <div className="flex justify-between items-center mb-8 no-print">
        <div><h1 className="text-3xl font-bold">Sipariş Yönetimi</h1></div>
        <div className="flex gap-2">
          <button onClick={handleExportOrdersToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><FileDown size={20}/> Excel İndir</button>
          <div className="flex items-center gap-2 bg-gray-800 p-1.5 rounded-lg border border-gray-700">
            <input type="date" className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none border border-gray-600" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
            <span className="text-gray-400">-</span>
            <input type="date" className="bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none border border-gray-600" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />
          </div>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg font-bold"><Plus size={24} /> Sipariş Gir</button>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2 print:text-black">
          <Clock className="no-print"/>
          Hazırlanan / Aktif Siparişler
          <span className="ml-2 text-base font-semibold text-yellow-300 print:text-black">
            ( {activeOrders.length} )
          </span>
        </h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden print:bg-white print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse print:border print:border-black">
                <thead><tr className="bg-gray-900 text-gray-400 text-sm uppercase print:bg-gray-200 print:text-black print:border-b print:border-black"><th className="p-4 print:p-2 print:border-r print:border-black">Müşteri</th><th className="p-4 print:p-2 print:border-r print:border-black">İçerik</th><th className="p-4 print:p-2 print:border-r print:border-black">Tutar</th><th className="p-4 text-center print:p-2 print:border-r print:border-black">Saat</th><th className="p-4 text-right no-print">İşlemler</th></tr></thead>
                <tbody className="divide-y divide-gray-700 print:divide-black">
                    {activeOrders.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-gray-500 print:text-black">Bekleyen sipariş yok.</td></tr> : activeOrders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-750 print:hover:bg-transparent">
                            <td className="p-4 font-bold print:text-black print:p-2">{order.customerName}</td>
                            <td className="p-4 text-sm text-gray-300 print:text-black print:p-2">{order.items.map((item, i) => <div key={i}>{item.quantity}x {item.productName} ({item.price} ₺)</div>)}</td>
                            <td className="p-4 text-blue-400 font-bold print:text-black print:p-2">{order.totalAmount} ₺</td>
                            <td className="p-4 text-center print:text-black print:p-2"><span className="text-gray-300 font-mono text-base font-bold tracking-widest print:text-black">{new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                            <td className="p-4 text-right flex justify-end gap-2 no-print">
                                <button onClick={() => openPaymentModal(order._id)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><Truck size={16}/> Teslim Et</button>
                                <button onClick={() => handleEditOrder(order)} className="bg-yellow-600 p-2 rounded"><Edit size={16}/></button>
                                <button onClick={() => requestDeleteOrder(order._id)} className="bg-red-600/20 text-red-500 hover:text-white p-2 rounded"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2 print:text-black">
          <CheckCircle className="no-print"/>
          Teslim Edilen Geçmiş Siparişler
          <span className="ml-2 text-base font-semibold text-green-300 print:text-black">
            ( {completedOrders.length} )
          </span>
        </h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden opacity-80 hover:opacity-100 transition-opacity print:bg-white print:opacity-100 print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse print:border print:border-black">
                <thead><tr className="bg-gray-900 text-gray-400 text-sm uppercase print:bg-gray-200 print:text-black print:border-b print:border-black"><th className="p-4 print:p-2 print:border-r print:border-black">Müşteri</th><th className="p-4 print:p-2 print:border-r print:border-black">İçerik</th><th className="p-4 print:p-2 print:border-r print:border-black">Tutar</th><th className="p-4 print:p-2 print:border-r print:border-black">Ödeme</th><th className="p-4 print:p-2">Tarih</th></tr></thead>
                <tbody className="divide-y divide-gray-700 print:divide-black">
                    {completedOrders.length === 0 ? <tr><td colSpan="5" className="p-6 text-center text-gray-500 print:text-black">Bu aralıkta geçmiş sipariş yok.</td></tr> : completedOrders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-750 print:hover:bg-transparent">
                            <td className="p-4 font-bold print:text-black print:p-2">{order.customerName}</td>
                            <td className="p-4 text-sm text-gray-300 print:text-black print:p-2">{order.items.length > 0 ? order.items.map((item, i) => <div key={i}>{item.quantity}x {item.productName}</div>) : <span className="italic text-gray-500">{order.note || 'Manuel Borç'}</span>}</td>
                            <td className={`p-4 font-bold ${getPaymentColor(order.paymentMethod)} print:text-black print:p-2`}>{order.totalAmount} ₺</td>
                            <td className={`p-4 ${getPaymentColor(order.paymentMethod)} print:text-black print:p-2`}>{order.paymentMethod}</td>
                            <td className="p-4 text-gray-500 text-sm print:text-black print:p-2">{new Date(order.date).toLocaleDateString()} {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {ordersHasMore && (
          <div className="mt-4 flex justify-center no-print">
            <button onClick={handleLoadMore} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold">
              Daha Fazla Yükle
            </button>
          </div>
        )}
      </div>
      
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 no-print" onClick={handleCloseModal}>
            <div className="bg-gray-800 w-[1100px] h-[750px] rounded-2xl shadow-2xl flex border border-gray-600 overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleCloseModal} className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-red-600/80 p-2 rounded-full transition-all z-20"><X size={24} /></button>
                <div className="w-1/2 p-8 border-r border-gray-700 flex flex-col gap-6 bg-gray-850 overflow-y-auto">
                    <div className="relative">
                        <label className="text-sm text-gray-400 mb-1 block">Müşteri Ara</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-500" size={18}/>
                            <input type="text" placeholder="Müşteri adı yazın..." className="w-full bg-gray-700 border border-gray-600 text-white p-2 pl-10 rounded focus:border-blue-500 outline-none text-sm" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerResults(true); setHighlightedIndex(-1); }} onFocus={() => setShowCustomerResults(true)} onKeyDown={handleSearchKeyDown} />
                        </div>
                        {showCustomerResults && customerSearch && (
                            <div className="absolute top-full left-0 w-full bg-gray-700 border border-gray-600 rounded-b max-h-40 overflow-y-auto z-50 shadow-xl">
                                {filteredCustomerSearch.map((c, index) => (<div key={c._id} className={`p-3 cursor-pointer border-b border-gray-600 last:border-0 ${index === highlightedIndex ? 'bg-blue-600' : 'hover:bg-blue-600'}`} onClick={() => selectCustomer(c)}>{c.name}</div>))}
                                {filteredCustomerSearch.length === 0 && <div className="p-3 text-gray-400 text-sm">Bulunamadı.</div>}
                            </div>
                        )}
                    </div>
                    {lastOrderSuggestion && (
                        <div className="bg-purple-900/40 border border-purple-500/50 p-4 rounded-lg animate-fade-in-down">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><RotateCcw size={14}/> Son Sipariş ({new Date(lastOrderSuggestion.date).toLocaleDateString()})</span>
                                <span className="text-white font-bold text-sm bg-purple-600/50 px-2 py-1 rounded">{lastOrderSuggestion.totalAmount} ₺</span>
                            </div>
                            <div className="space-y-2 mb-4">
                                {lastOrderSuggestion.items.map((item, idx) => (<div key={idx} className="flex justify-between text-sm text-gray-300 border-b border-purple-500/20 pb-1 last:border-0"><span>{item.quantity}x {item.productName}</span><span className="text-purple-200">{item.price} ₺</span></div>))}
                            </div>
                            <button onClick={applyLastOrder} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-colors"><ChevronRight size={16}/> Siparişi Kopyala</button>
                        </div>
                    )}
                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">Ürün Seçin</label>
                        <select className="w-full bg-gray-700 border border-gray-600 text-white p-2 rounded focus:border-blue-500 outline-none text-sm" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}><option value="">Ürün Seç...</option>{products.map(p => (<option key={p._id} value={p._id}>{p.name}</option>))}</select>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1"><label className="text-sm text-gray-400 mb-1 block">Adet</label><input type="number" min="1" placeholder="Adet" className="w-full bg-gray-700 border border-gray-600 text-white p-2 rounded focus:border-blue-500 outline-none text-sm" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToCart()}/></div>
                        <div className="flex-1 relative"><label className="text-sm text-gray-400 mb-1 flex justify-between items-center">Birim Fiyat (TL) {isPriceFromHistory && <span className="text-[10px] text-green-400 flex items-center gap-1"><Tag size={10}/> Özel Fiyat</span>}</label><input type="number" placeholder="Fiyat" className={`w-full bg-gray-700 border text-white p-2 rounded focus:border-blue-500 outline-none font-bold text-sm ${isPriceFromHistory ? 'border-green-500/50 text-green-300' : 'border-gray-600'}`} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToCart()}/></div>
                    </div>
                    <button onClick={addToCart} className="mt-auto bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg transition-colors">SEPETE EKLE ➡️</button>
                </div>
                <div className="w-1/2 p-8 bg-gray-800 flex flex-col relative">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><ShoppingCart /> Sepetim</h2>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-20">{cart.length === 0 ? (<div className="text-gray-500 text-center mt-20">Sepetiniz boş.</div>) : (cart.map((item, idx) => (<div key={idx} className="bg-gray-700 p-4 rounded flex justify-between items-center animate-fade-in-down"><div><div className="font-bold text-white">{item.productName}</div><div className="text-sm text-gray-400">{item.quantity} Adet x {item.price} ₺</div></div><div className="flex items-center gap-4"><span className="font-bold text-blue-300">{item.total} ₺</span><button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-200"><Trash2 size={18}/></button></div></div>)))}</div>
                    <div className="absolute bottom-0 left-0 w-full p-8 border-t border-gray-700 bg-gray-800"><div className="flex justify-between items-center mb-4 text-xl"><span className="text-gray-400">Genel Toplam:</span><span className="font-bold text-green-400">{calculateTotal()} ₺</span></div><button onClick={handleSaveOrder} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-xl shadow-lg transition-transform active:scale-95">{editingOrderId ? 'GÜNCELLE' : '✅ SEPETİ ONAYLA'}</button></div>
                </div>
            </div>
        </div>
      )}
      
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 text-center w-96">
                <h3 className="text-xl font-bold mb-6">Ödeme Yöntemi Seçiniz</h3>
                <div className="grid grid-cols-2 gap-4"><button onClick={() => handleDeliver('Nakit')} className="bg-green-600 p-4 rounded hover:bg-green-700 font-bold">💵 Nakit</button><button onClick={() => handleDeliver('K.Kartı')} className="bg-purple-600 p-4 rounded hover:bg-purple-700 font-bold">💳 K.Kartı</button><button onClick={() => handleDeliver('IBAN')} className="bg-blue-600 p-4 rounded hover:bg-blue-700 font-bold">🏦 IBAN</button><button onClick={() => handleDeliver('Borç')} className="bg-red-600 p-4 rounded hover:bg-red-700 font-bold">📒 Borç</button></div>
                <button onClick={() => setShowPaymentModal(false)} className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-bold">❌ İptal Et</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
