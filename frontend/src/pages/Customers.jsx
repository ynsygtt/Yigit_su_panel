import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Plus, Search, FileDown, Printer } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useConfirmation } from '../hooks/useConfirmation';
import { validateRequired, searchItems } from '../utils/appHelpers';
import { formatCurrencyForExcel, formatDateForExcel } from '../utils/excelExporter';
import { generateSectionedExcel, addSummarySection } from '../utils/excelTemplates';
import { Toast, LoadingSpinner, ConfirmationModal, PrintHeader } from '../components/shared';
import CustomerRow from '../components/CustomerRow';
import { API_URL } from '../config';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', note: '' });
  const [showForm, setShowForm] = useState(false);
  const { toast, show: showToast } = useToast();
  const { confirmation: deleteModal, request: requestDelete, confirm: confirmDelete, cancel: cancelDelete } = useConfirmation();

  const handleExportCustomersToExcel = () => {
    const customerRows = customers.map((c, index) => ([
      index + 1,
      c.name,
      c.phone,
      c.address || '-',
      c.note || '-'
    ]));

    const summaryRows = [
      ['Toplam Müşteri', customers.length],
      ['Tarih Aralığı', 'Tüm Zamanlar']
    ];

    const sections = [
      {
        title: 'MÜŞTERİ LİSTESİ',
        headers: ['Sıra', 'Ad', 'Tel', 'Adres', 'Not'],
        rows: customerRows
      },
      addSummarySection(summaryRows)
    ];

    const success = generateSectionedExcel(sections, 'Müşteriler', 'musteriler');
    if (success) {
      setTimeout(() => showToast('Excel dosyası indirildi', 'success'), 500);
    } else {
      showToast('Excel indirme başarısız', 'error');
    }
  };

  const fetchCustomers = async () => { 
    setIsLoading(true); 
    try { 
      const res = await axios.get(`${API_URL}/api/customers`); 
      setCustomers(res.data); 
    } catch (error) { 
      console.error('❌ Müşteri yükleme hatası:', error);
      showToast('Müşteri yükleme başarısız: ' + (error.response?.data?.error || error.message), 'error');
    } finally { 
      setIsLoading(false); 
    } 
  };
  useEffect(() => { fetchCustomers(); }, []);
  
  const handleAddCustomer = async (e) => { 
    e.preventDefault(); 
    if (!validateRequired(newCustomer, ['name', 'phone'])) {
      showToast('Lütfen ad ve telefon alanını doldurunuz', 'error');
      return;
    }
    try { 
      await axios.post(`${API_URL}/api/customers`, newCustomer); 
      setShowForm(false); 
      setNewCustomer({ name: '', phone: '', address: '', note: '' }); 
      fetchCustomers(); 
      showToast("Müşteri ekleme başarılı", 'success'); 
    } catch { 
      showToast("Müşteri ekleme başarısız", 'error'); 
    } 
  };
  
  const handleUpdateCustomer = async (id, updatedData) => { 
    try { 
      await axios.put(`${API_URL}/api/customers/${id}`, updatedData); 
      fetchCustomers(); 
      showToast("Müşteri güncellendi", 'success'); 
    } catch { 
      showToast('Güncelleme Başarısız', 'error'); 
    } 
  };
  
  const handleDeleteCustomer = async () => { 
    if(!deleteModal.id) return;
    try { 
      await axios.delete(`${API_URL}/api/customers/${deleteModal.id}`); 
      fetchCustomers(); 
      showToast("Müşteri silindi", 'success'); 
    } catch { 
      showToast('Silme Başarısız', 'error'); 
    } finally { 
      cancelDelete(); 
    }
  };
  
  const filteredCustomers = useMemo(() => 
    searchItems(customers, searchTerm, ['name', 'phone']).sort((a, b) => 
      a.name.localeCompare(b.name, 'tr')
    ), 
    [customers, searchTerm]
  );

  if (isLoading) return <div className="ml-64 bg-gray-900 min-h-screen"><LoadingSpinner /></div>;

  return (
    <div className="p-8 ml-64 min-h-screen bg-gray-900 text-white print:ml-0 print:p-0 print:bg-white print:text-black">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => showToast(null)} />}
      <PrintHeader title="MÜŞTERİ İLETİŞİM LİSTESİ" />
      <ConfirmationModal isOpen={deleteModal.show} message="Bu müşteriyi silmek istediğinize emin misiniz?" onConfirm={() => confirmDelete(handleDeleteCustomer)} onCancel={cancelDelete}/>
      <div className="flex justify-between items-center mb-6 no-print">
        <div><h1 className="text-3xl font-bold">Müşteriler</h1></div>
        <div className="flex gap-2">
            <button onClick={handleExportCustomersToExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><FileDown size={20}/> Excel İndir</button>
            <button onClick={() => window.print()} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><Printer size={20}/> Yazdır</button>
            <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"><Plus size={20} /> Müşteri Ekle</button>
        </div>
      </div>
      <div className="mb-6 relative no-print">
        <Search className="absolute left-3 top-3 text-gray-500" size={20}/>
        <input type="text" placeholder="Müşteri ara..." className="w-full md:w-1/3 bg-gray-800 border border-gray-700 text-white p-3 pl-10 rounded-lg outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>
      {showForm && (
        <div className="bg-gray-800 p-6 rounded-xl mb-8 border border-gray-600 no-print">
          <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
            <div className="flex gap-4">
                <input type="text" placeholder="Ad Soyad" required className="bg-gray-700 text-white p-2 rounded flex-1 outline-none" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                <input type="text" placeholder="Telefon" required className="bg-gray-700 text-white p-2 rounded flex-1 outline-none" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
            </div>
            <input type="text" placeholder="Adres" className="bg-gray-700 text-white p-2 rounded outline-none" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
            <input type="text" placeholder="Not" className="bg-gray-700 text-white p-2 rounded outline-none" value={newCustomer.note} onChange={e => setNewCustomer({...newCustomer, note: e.target.value})} />
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded self-end">Kaydet</button>
          </form>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-lg overflow-hidden print:bg-white print:border-none print:shadow-none">
        <table className="w-full text-left border-collapse print:border print:border-black">
            <thead>
                <tr className="bg-gray-900 text-gray-400 text-sm uppercase print:bg-gray-200 print:text-black print:border-b print:border-black">
                    <th className="p-4 print:p-2 print:border-r print:border-black">#</th><th className="p-4 print:p-2 print:border-r print:border-black">Ad</th><th className="p-4 print:p-2 print:border-r print:border-black">Tel</th><th className="p-4 print:p-2 print:border-r print:border-black">Adres</th><th className="p-4 print:p-2">Not</th><th className="p-4 text-right no-print">İşlemler</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 print:divide-black">{filteredCustomers.map((c, index) => <CustomerRow key={c._id} index={index + 1} customer={c} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={requestDelete} />)}</tbody>
        </table>
      </div>
    </div>
  );
};

export default Customers;
