import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Eye, X, FileDown, Truck, Clock, CheckCircle } from 'lucide-react';
import { LoadingSpinner, ConfirmationModal, Toast, PrintHeader } from '../components/shared';
import { API_URL } from '../config';
import { formatCurrencyForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection } from '../utils/excelTemplates';

const BulkSales = () => {
  const [bulkSales, setBulkSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBulkSale, setSelectedBulkSale] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null });
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Nakit');
  const [notes, setNotes] = useState('');
  const [deliveredInputs, setDeliveredInputs] = useState({});
  const [newDeliveryInputs, setNewDeliveryInputs] = useState({});
  const [deliveryLogs, setDeliveryLogs] = useState({});

  const getDeliveryLogKey = (bulkSaleId) => `bulkSaleDeliveryLogs:${bulkSaleId}`;
  const loadDeliveryLogs = (bulkSaleId) => {
    try {
      const raw = localStorage.getItem(getDeliveryLogKey(bulkSaleId));
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Teslimat geçmişi okunamadı', err);
      return {};
    }
  };

  const saveDeliveryLogs = (bulkSaleId, logs) => {
    try {
      localStorage.setItem(getDeliveryLogKey(bulkSaleId), JSON.stringify(logs));
    } catch (err) {
      console.error('Teslimat geçmişi kaydedilemedi', err);
    }
  };

  const showToastMessage = (message, type) => setToast({ message, type });

  const handleExportBulkSalesToExcel = () => {
    const bulkRows = bulkSales.map((bs, index) => ([
      index + 1,
      bs.customer?.name || '-',
      (bs.items || []).map(item => {
        const productName = item.productName || item.product?.name || item.name || 'Bilinmeyen Ürün';
        return `${item.quantity}x ${productName}`;
      }).join(', '),
      (bs.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0),
      (bs.items || []).reduce((sum, item) => sum + (item.delivered || 0), 0),
      (bs.items || []).reduce((sum, item) => sum + ((item.quantity || 0) - (item.delivered || 0)), 0),
      formatCurrencyForExcel(bs.totalAmount || 0),
      bs.paymentMethod || '-',
      bs.status || '-'
    ]));

    const totalAmount = bulkSales.reduce((sum, bs) => sum + (bs.totalAmount || 0), 0);
    const totalItems = bulkSales.reduce((sum, bs) => sum + (bs.items || []).reduce((s, item) => s + (item.quantity || 0), 0), 0);

    const summaryRows = [
      ['Toplam Toplu Satış', bulkSales.length],
      ['Toplam Adet', totalItems],
      ['Toplam Tutar', formatCurrencyForExcel(totalAmount)],
      ['Tarih Aralığı', 'Tüm Zamanlar']
    ];

    const sections = [
      {
        title: 'TOPLU SATIŞLAR',
        headers: ['Sıra', 'Müşteri', 'Ürün Detayları', 'Toplam', 'Teslim', 'Kalan', 'Tutar', 'Ödeme', 'Durum'],
        rows: bulkRows
      },
      addSummarySection(summaryRows)
    ];

    const success = generateSectionedExcel(sections, 'Toplu Satışlar', 'toplu_satislar');
    if (success) {
      setTimeout(() => showToastMessage('Excel dosyası indirildi', 'success'), 500);
    } else {
      showToastMessage('Excel indirme başarısız', 'error');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [bulkRes, custRes, prodRes] = await Promise.all([
        axios.get(`${API_URL}/api/bulk-sales`),
        axios.get(`${API_URL}/api/customers`),
        axios.get(`${API_URL}/api/products`)
      ]);
      setBulkSales(bulkRes.data);
      setCustomers(custRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
      showToastMessage('Veriler yüklenmedi', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!customerSearch) {
      setFilteredCustomers([]);
      return;
    }
    const filtered = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    setFilteredCustomers(filtered);
  }, [customerSearch, customers]);

  const handleAddToCart = () => {
    if (!selectedProduct || !quantity || !unitPrice) {
      showToastMessage('Ürün, Adet ve Birim Fiyat zorunlu!', 'error');
      return;
    }
    const product = products.find(p => p._id === selectedProduct);
    const item = {
      product: { _id: product._id, name: product.name, category: product.category, salePrice: product.salePrice },
      quantity: parseInt(quantity),
      unitPrice: parseFloat(unitPrice),
      totalPrice: parseInt(quantity) * parseFloat(unitPrice),
      delivered: 0
    };
    setCart([...cart, item]);
    setSelectedProduct('');
    setQuantity('');
    setUnitPrice('');
  };

  const handleRemoveFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleConfirmBulkSale = async () => {
    if (!selectedCustomer || cart.length === 0) {
      showToastMessage('Müşteri ve ürün seçiniz!', 'error');
      return;
    }
    const customer = customers.find(c => c._id === selectedCustomer);
    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    try {
      await axios.post(`${API_URL}/api/bulk-sales`, {
        customer: { _id: customer._id, name: customer.name, contact: customer.phone },
        items: cart,
        totalAmount,
        paymentMethod,
        notes
      });
      showToastMessage('Toplu satış oluşturuldu!', 'success');
      fetchData();
      setShowModal(false);
      setSelectedCustomer('');
      setCart([]);
      setPaymentMethod('Nakit');
      setNotes('');
    } catch (err) {
      console.error(err);
      showToastMessage('Hata oluştu', 'error');
    }
  };

  const handleDeleteBulkSale = async () => {
    try {
      const response = await axios.delete(`${API_URL}/api/bulk-sales/${deleteModal.id}`);
      const { undeliveredValue, undeliveredItems } = response.data;
      if (undeliveredValue > 0) {
        const itemsText = undeliveredItems.map(i => `${i.remaining}x ${i.name}`).join(', ');
        showToastMessage(`Toplu satış silindi. Teslim edilmeyen mal (${itemsText}) için ${undeliveredValue} ₺ gider kaydedildi.`, 'success');
      } else {
        showToastMessage('Toplu satış silindi (Tüm ürünler teslim edilmişti)', 'success');
      }
      fetchData();
      setDeleteModal({ show: false, id: null });
    } catch (err) {
      console.error(err);
      showToastMessage('Hata oluştu', 'error');
    }
  };

  const handleDeliverProduct = async (itemIndex, newQty) => {
    try {
      const item = selectedBulkSale.items[itemIndex];
      const currentDelivered = deliveredInputs[itemIndex] || item.delivered || 0;
      const totalDelivered = currentDelivered + parseInt(newQty);
      await axios.patch(`${API_URL}/api/bulk-sales/${selectedBulkSale._id}/deliver`, {
        itemIndex,
        deliveredQuantity: totalDelivered
      });
      showToastMessage(`${newQty} adet teslim edildi`, 'success');
      const remaining = item.quantity - totalDelivered;
      setSelectedBulkSale(prev => {
        if (!prev) return prev;
        const updatedItems = prev.items.map((it, idx) => idx === itemIndex ? { ...it, delivered: totalDelivered } : it);
        return { ...prev, items: updatedItems };
      });
      setDeliveredInputs(prev => ({ ...prev, [itemIndex]: totalDelivered }));
      setNewDeliveryInputs(prev => ({ ...prev, [itemIndex]: 0 }));
      setDeliveryLogs(prev => {
        const list = prev[itemIndex] ? [...prev[itemIndex]] : [];
        list.unshift({ date: new Date().toLocaleString('tr-TR'), delivered: parseInt(newQty), remaining });
        const updated = { ...prev, [itemIndex]: list };
        if (selectedBulkSale?._id) saveDeliveryLogs(selectedBulkSale._id, updated);
        return updated;
      });
      fetchData();
    } catch (err) {
      console.error(err);
      showToastMessage('Hata oluştu', 'error');
    }
  };

  return (
    <div className="p-8 ml-64 min-h-screen">
      <PrintHeader title="TOPLU SATIŞLAR" />
      <div className="flex justify-between items-center mb-8 no-print">
        <h1 className="text-3xl font-bold">Toplu Satışlar</h1>
        <div className="flex gap-2">
          <button onClick={handleExportBulkSalesToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><FileDown size={20}/> Excel İndir</button>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Plus size={20}/> Toplu satış gir</button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="grid gap-4">
          {bulkSales.length === 0 ? (
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 text-center">
              <Truck size={48} className="mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">Henüz toplu satış kaydı yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-gray-800 rounded-xl border border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left w-1/6">Müşteri</th>
                    <th className="px-4 py-3 text-right w-1/6">Toplam Tutar</th>
                    <th className="px-4 py-3 text-left w-1/6">Durum</th>
                    <th className="px-4 py-3 text-left w-1/6">Ödeme Yöntemi</th>
                    <th className="px-4 py-3 text-center w-2/6">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkSales.map(bs => (
                    <tr key={bs._id} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-semibold text-gray-100">{bs.customer.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-400">{bs.totalAmount.toLocaleString('tr-TR')} ₺</td>
                      <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-bold ${bs.status === 'Tamamlandı' ? 'bg-green-900/30 text-green-400' : bs.status === 'Kısmi Teslim' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-blue-900/30 text-blue-400'}`}>{bs.status}</span></td>
                      <td className="px-4 py-3 text-gray-200">{bs.paymentMethod}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setSelectedBulkSale(bs); setDeliveredInputs(bs.items.reduce((acc, it, idx) => ({ ...acc, [idx]: it.delivered || 0 }), {})); setNewDeliveryInputs({}); setDeliveryLogs(loadDeliveryLogs(bs._id)); setShowDetailModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-xs font-bold flex flex-col items-center min-w-[130px] shadow-md"><div className="flex items-center gap-1"><Eye size={14}/> Detay</div></button>
                          <button onClick={() => setDeleteModal({ show: true, id: bs._id })} className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-xs font-bold flex flex-col items-center min-w-[130px] shadow-md"><div className="flex items-center gap-1"><Trash2 size={14}/> Sil</div></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print" onClick={() => setShowModal(false)}>
          <div className="bg-gray-800 w-[900px] max-h-[90vh] rounded-xl border border-gray-600 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Toplu Satış Gir</h3>
              <button onClick={() => setShowModal(false)} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Müşteri Seç</label>
                <div className="relative">
                  <input type="text" placeholder="Müşteri ara..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerResults(true); }} onFocus={() => setShowCustomerResults(true)} className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none" />
                  {showCustomerResults && filteredCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-gray-700 border border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto z-10">
                      {filteredCustomers.map(c => (
                        <button key={c._id} onClick={() => { setSelectedCustomer(c._id); setCustomerSearch(c.name); setShowCustomerResults(false); }} className="w-full px-4 py-2 hover:bg-gray-600 text-left text-white border-b border-gray-600 last:border-0">{c.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {selectedCustomer && (
                <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                  <p className="text-sm text-gray-300">Seçili Müşteri: <span className="font-bold text-white">{customers.find(c => c._id === selectedCustomer)?.name}</span></p>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-sm font-bold mb-2">Ürün Seç</label><select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none text-sm"><option value="">Ürün seç...</option>{products.map(p => (<option key={p._id} value={p._id}>{p.name}</option>))}</select></div>
                <div><label className="block text-sm font-bold mb-2">Adet</label><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none text-sm" /></div>
                <div><label className="block text-sm font-bold mb-2">Birim Fiyat</label><input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0" className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none text-sm" /></div>
                <div><label className="block text-sm font-bold mb-2">İşlem</label><button onClick={handleAddToCart} className="w-full h-[42px] bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-green-900/50 transition-all"><Plus size={18}/> Ekle</button></div>
              </div>
              {cart.length > 0 && (
                <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600">
                  <h4 className="font-bold mb-3">Seçilen Ürünler</h4>
                  <div className="space-y-2">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-700/50 p-3 rounded border border-gray-600">
                        <div><p className="font-bold">{item.product.name}</p><p className="text-xs text-gray-400">{item.quantity} adet × {item.unitPrice} ₺</p></div>
                        <div className="text-right"><p className="font-bold">{item.totalPrice.toLocaleString('tr-TR')} ₺</p><button onClick={() => handleRemoveFromCart(idx)} className="text-red-400 hover:text-red-300 text-xs mt-1"><Trash2 size={14}/> Kaldır</button></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-600">
                    <p className="text-right font-bold text-lg">Toplam: {cart.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString('tr-TR')} ₺</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold mb-2">Ödeme Yöntemi</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none"><option>Nakit</option><option>Kredi Kartı</option><option>Çek</option><option>Havale</option><option>Diğer</option></select></div>
                <div><label className="block text-sm font-bold mb-2">Notlar</label><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ek notlar..." className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none" /></div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">İptal</button>
              <button onClick={handleConfirmBulkSale} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2"><CheckCircle size={18}/> Onayla</button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedBulkSale && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 no-print" onClick={() => setShowDetailModal(false)}>
          <div className="bg-gray-900 w-[900px] max-h-[90vh] rounded-2xl border-2 border-gray-700 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b-2 border-gray-700 flex justify-between items-center bg-gray-800/50">
              <h3 className="text-2xl font-bold text-white">Toplu Satış Detayı</h3>
              <button onClick={() => setShowDetailModal(false)} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition-colors"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {selectedBulkSale.items.map((item, idx) => {
                const deliveredQty = deliveredInputs[idx] ?? item.delivered ?? 0;
                const remainingQty = item.quantity - deliveredQty;
                const newQty = newDeliveryInputs[idx] || 0;
                return (
                  <div key={idx} className="mb-6 last:mb-0">
                    <div className="bg-white rounded-2xl p-4 mb-3 border-2 border-gray-300 shadow-sm">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-gray-800">
                        <div><p className="text-xs font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Müşteri adı</p><p className="text-sm font-bold text-gray-900">{selectedBulkSale.customer.name}</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Ürün detayları</p><p className="text-sm font-bold text-gray-900">{item.product.name} - {item.quantity} adet</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Toplam tutar</p><p className="text-base font-black text-red-600">{item.totalPrice.toLocaleString('tr-TR')} ₺</p></div>
                        <div><p className="text-xs font-semibold text-gray-500 mb-0.5 uppercase tracking-wide">Ödeme yöntemi</p><p className="text-sm font-bold text-gray-900">{selectedBulkSale.paymentMethod}</p></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2"><p className="text-xs font-semibold text-green-600 mb-0.5">Teslim Edilen</p><p className="text-xl font-black text-green-700">{deliveredQty} <span className="text-xs">adet</span></p></div>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2"><p className="text-xs font-semibold text-orange-600 mb-0.5">Kalan Miktar</p><p className="text-xl font-black text-orange-700">{remainingQty} <span className="text-xs">adet</span></p></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 mb-3 border-2 border-gray-300 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Teslim edilecek miktar</p>
                      <div className="flex items-center gap-3">
                        <input type="number" value={newQty || ''} onChange={(e) => setNewDeliveryInputs(prev => ({ ...prev, [idx]: parseInt(e.target.value || 0) }))} max={remainingQty} min="0" className="flex-1 bg-gray-50 border-2 border-gray-300 text-gray-900 px-4 py-3 rounded-xl text-base font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all" placeholder="0" />
                        <button onClick={() => { const newDelivery = newDeliveryInputs[idx] || 0; if (newDelivery === 0) { showToastMessage('Lütfen teslim edilecek miktarı girin!', 'error'); return; } if (newDelivery > remainingQty) { showToastMessage('Kalan miktardan fazla teslim edemezsiniz!', 'error'); return; } handleDeliverProduct(idx, newDelivery); }} className="bg-green-600 hover:bg-green-700 border-2 border-green-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all text-sm">Teslim et</button>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 border-2 border-gray-300 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">İşlem geçmişi</p>
                      {deliveryLogs[idx]?.length > 0 ? (
                        <div className="space-y-0">
                          <div className="grid grid-cols-3 gap-3 pb-2 border-b-2 border-gray-300 bg-gray-50 -mx-4 px-4 -mt-1 pt-1">
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Tarih</p>
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Teslim edilen</p>
                            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Kalan</p>
                          </div>
                          {[...deliveryLogs[idx]].reverse().map((log, logIdx) => (
                            <div key={logIdx} className="grid grid-cols-3 gap-3 py-2 border-b border-gray-200 last:border-0 hover:bg-gray-50 -mx-4 px-4 text-xs">
                              <p className="text-gray-700">{log.date}</p>
                              <p className="font-bold text-green-700">+{log.delivered} adet</p>
                              <p className="font-bold text-orange-700">{log.remaining} adet</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center">
                          <Clock size={32} className="mx-auto mb-2 text-gray-400"/>
                          <p className="text-xs text-gray-500">Henüz işlem kaydı bulunmuyor</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-6 border-t-2 border-gray-700 bg-gray-800/50">
              <button onClick={() => setShowDetailModal(false)} className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors">Kapat</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal isOpen={deleteModal.show} message="Bu toplu satış kaydı silinecek. Emin misiniz?" onConfirm={handleDeleteBulkSale} onCancel={() => setDeleteModal({ show: false, id: null })} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default BulkSales;
