import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, FileDown, AlertOctagon } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import { validateRequired, validateAmount } from '../utils/appHelpers';
import { formatCurrencyForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection } from '../utils/excelTemplates';
import { Toast, LoadingSpinner, ConfirmationModal, PrintHeader } from '../components/shared';
import ProductCard from '../components/ProductCard';
import { API_URL } from '../config';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newProduct, setNewProduct] = useState({ name: '', stock: '', unitPrice: '', salePrice: '' });
  const [showForm, setShowForm] = useState(false);
  const { toast, show: showToast } = useToast();
  const { confirmation: deleteModal, request: requestDelete, confirm: confirmDelete, cancel: cancelDelete } = useConfirmation();
  const [wasteModal, setWasteModal] = useState({ show: false, product: null });
  const [wasteData, setWasteData] = useState({ quantity: '', reason: 'Bozuk/Kırık' });

  const fetchProducts = useCallback(async () => { 
    setIsLoading(true); 
    try { 
      const res = await axios.get(`${API_URL}/api/products`); 
      setProducts(res.data); 
    } catch (error) { 
      console.error("Hata:", error);
      showToast("Ürünler yüklenemedi", 'error');
    } finally { 
      setIsLoading(false); 
    } 
  }, [showToast]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  
  const handleUpdateProduct = async (id, updatedData, successMsg = "Güncelleme başarılı") => { 
    try { 
      await axios.put(`${API_URL}/api/products/${id}`, updatedData); 
      fetchProducts(); 
      showToast(successMsg, 'success'); 
    } catch { 
      showToast("İşlem başarısız", 'error'); 
    } 
  };
  
  const handleDeleteProduct = async () => {
    if (!deleteModal.id) return;
    try { 
      await axios.delete(`${API_URL}/api/products/${deleteModal.id}`); 
      fetchProducts(); 
      showToast("Ürün silindi", 'success'); 
    } catch { 
      showToast("Silme işlemi başarısız!", 'error'); 
    } finally { 
      cancelDelete(); 
    }
  };
  
  const handleAddProduct = async (e) => { 
    e.preventDefault();
    const name = newProduct.name.trim();
    const salePrice = parseFloat(newProduct.salePrice);
    const unitPrice = parseFloat(newProduct.unitPrice || 0);
    
    if (!validateRequired(newProduct, ['name', 'salePrice'])) { 
      showToast("Lütfen zorunlu alanları doldurunuz", 'error'); 
      return; 
    }
    if (!validateAmount(salePrice)) { 
      showToast("Satış fiyatı geçerli olmalıdır", 'error'); 
      return; 
    }
    if (!validateAmount(unitPrice, -1)) { 
      showToast("Birim fiyat geçerli olmalıdır", 'error'); 
      return; 
    }
    
    try { 
      await axios.post(`${API_URL}/api/products`, { ...newProduct, name, salePrice, unitPrice }); 
      setShowForm(false); 
      setNewProduct({ name: '', stock: '', unitPrice: '', salePrice: '' }); 
      fetchProducts(); 
      showToast("Ürün ekleme başarılı", 'success'); 
    } catch (error) { 
      showToast(error.response?.data?.error || "Ürün ekleme başarısız", 'error'); 
    } 
  };

  const handleReportWaste = (product) => { 
    setWasteModal({ show: true, product }); 
    setWasteData({ quantity: '', reason: 'Bozuk/Kırık' }); 
  };
  
  const submitWasteReport = async () => {
    if (!validateAmount(wasteData.quantity, 0)) { 
      showToast("Geçerli bir adet giriniz", "error"); 
      return; 
    }
    try { 
      await axios.post(`${API_URL}/api/products/waste`, { 
        productId: wasteModal.product._id, 
        quantity: parseInt(wasteData.quantity), 
        reason: wasteData.reason 
      }); 
      setWasteModal({ show: false, product: null }); 
      fetchProducts(); 
      showToast("Zayi bildirimi ve gider kaydı yapıldı", "success"); 
    } catch (err) { 
      showToast(err.response?.data?.error || "İşlem başarısız", "error"); 
    }
  };

  const handleExportToExcel = () => {
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.stock * p.unitPrice), 0);

    const productRows = products.map((p, index) => ([
      index + 1,
      p.name,
      p.category || 'Su',
      p.stock,
      formatCurrencyForExcel(p.unitPrice || 0),
      formatCurrencyForExcel(p.salePrice || 0),
      formatCurrencyForExcel((p.stock || 0) * (p.unitPrice || 0))
    ]));

    const summaryRows = [
      ['Toplam Ürün Sayısı', products.length],
      ['Toplam Stok Adedi', totalStock],
      ['Toplam Stok Değeri', formatCurrencyForExcel(totalValue)],
      ['Tarih Aralığı', 'Tüm Zamanlar']
    ];

    const sections = [
      {
        title: 'ÜRÜN LİSTESİ',
        headers: ['Sıra', 'Ürün', 'Kategori', 'Stok', 'Birim ₺', 'Satış ₺', 'Stok ₺'],
        rows: productRows
      },
      addSummarySection(summaryRows)
    ];

    const success = generateSectionedExcel(sections, 'Ürünler', 'urunler');
    if (success) {
      setTimeout(() => showToast('Excel dosyası indirildi', 'success'), 500);
    } else {
      showToast('Excel indirme başarısız', 'error');
    }
  };

  if (isLoading) return <div className="ml-64 bg-gray-900 min-h-screen"><LoadingSpinner /></div>;

  return (
    <div className="p-8 ml-64 min-h-screen bg-gray-900 text-white print:ml-0 print:p-0 print:bg-white print:text-black">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => showToast(null)} />}
      <PrintHeader title="STOK DURUM RAPORU" />
      <ConfirmationModal isOpen={deleteModal.show} message="Bu ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz." onConfirm={() => confirmDelete(handleDeleteProduct)} onCancel={cancelDelete}/>
      
      <div className="flex justify-between items-center mb-8 no-print">
        <div><h1 className="text-3xl font-bold">Ürün Yönetimi</h1></div>
        <div className="flex gap-2">
          <button onClick={handleExportToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><FileDown size={20}/> Excel İndir</button>
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"><Plus size={20} /> Yeni Ürün Ekle</button>
        </div>
      </div>
      {showForm && (
        <div className="bg-gray-800 p-6 rounded-xl mb-8 border border-gray-600 shadow-2xl animate-fade-in-down no-print">
          <form onSubmit={handleAddProduct} className="flex gap-4 items-end flex-wrap">
            <div className="flex-grow min-w-[200px]"><label className="text-xs text-gray-400 block mb-1">Ürün Adı</label><input type="text" required className="bg-gray-700 text-white p-2 rounded w-full border border-gray-600 outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} /></div>
            <div className="w-28"><label className="text-xs text-gray-400 block mb-1">Stok</label><input type="number" required className="bg-gray-700 text-white p-2 rounded w-full border border-gray-600 outline-none" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} /></div>
            <div className="w-32"><label className="text-xs text-gray-400 block mb-1">Birim Fiyat</label><input type="number" required className="bg-gray-700 text-white p-2 rounded w-full border border-gray-600 outline-none" value={newProduct.unitPrice} onChange={e => setNewProduct({...newProduct, unitPrice: e.target.value})} /></div>
            <div className="w-32"><label className="text-xs text-blue-300 block mb-1 font-bold">Satış Fiyatı</label><input type="number" required className="bg-gray-700 text-white p-2 rounded w-full border border-blue-500/50 outline-none font-bold" value={newProduct.salePrice} onChange={e => setNewProduct({...newProduct, salePrice: e.target.value})} /></div>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded h-[42px] font-medium flex-grow md:flex-grow-0">Kaydet</button>
          </form>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">
        {products.map((product) => (<ProductCard key={product._id} product={product} onUpdateProduct={handleUpdateProduct} onDeleteProduct={requestDelete} onReportWaste={handleReportWaste} />))}
      </div>
      {wasteModal.show && wasteModal.product && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] animate-fade-in no-print">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 shadow-2xl max-w-sm w-full text-center">
              <div className="flex justify-center mb-4"><div className="bg-orange-900/30 p-3 rounded-full border border-orange-500/30"><AlertOctagon size={40} className="text-orange-500" /></div></div>
              <h3 className="text-xl font-bold text-white mb-1">Zayi (Fire) Bildirimi</h3>
              <p className="text-gray-400 text-sm mb-4">{wasteModal.product.name}</p>
              <div className="space-y-4 text-left">
                  <div><label className="text-xs text-gray-400 block mb-1">Zayi Adedi</label><input type="number" autoFocus className="w-full bg-gray-700 border border-gray-500 text-white p-2 rounded" placeholder="0" value={wasteData.quantity} onChange={(e) => setWasteData({...wasteData, quantity: e.target.value})} /></div>
                  <div><label className="text-xs text-gray-400 block mb-1">Sebep</label><select className="w-full bg-gray-700 border border-gray-500 text-white p-2 rounded" value={wasteData.reason} onChange={(e) => setWasteData({...wasteData, reason: e.target.value})}><option value="Bozuk/Kırık">Bozuk/Kırık</option><option value="Son Kullanma Tarihi">Son Kullanma Tarihi</option><option value="Kaybolma">Kaybolma</option><option value="Hatalı Üretim">Hatalı Üretim</option><option value="Diğer">Diğer</option></select></div>
              </div>
              <div className="flex gap-3 justify-center mt-6">
                <button onClick={() => setWasteModal({ show: false, product: null })} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium">İptal</button>
                <button onClick={submitWasteReport} className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold">Kaydet</button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default Products;
