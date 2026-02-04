import React, { useState } from 'react';
import { Edit, Trash2, Save, X, AlertOctagon, TrendingUp } from 'lucide-react';

const ProductCard = ({ product, onUpdateProduct, onDeleteProduct, onReportWaste }) => {
  const [addAmount, setAddAmount] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: product.name, unitPrice: product.unitPrice, salePrice: product.salePrice });

  const handleStockUpdate = (e) => {
    e.preventDefault();
    if (!addAmount || addAmount <= 0) return;
    const newStock = product.stock + parseInt(addAmount);
    onUpdateProduct(product._id, { ...product, stock: newStock }, "Stok ekleme başarılı");
    setAddAmount('');
  };
  const handleEditSave = () => { onUpdateProduct(product._id, { ...product, ...editData }, "Ürün güncelleme başarılı"); setIsEditing(false); };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col justify-between shadow-lg relative group h-full print:bg-white print:border-gray-300 print:shadow-none print:break-inside-avoid">
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 no-print">
        {!isEditing ? (
          <>
            <button onClick={() => onReportWaste(product)} className="p-1.5 bg-gray-700 hover:bg-orange-600 text-white rounded-md shadow-md" title="Zayi Bildir"><AlertOctagon size={16} /></button>
            <button onClick={() => setIsEditing(true)} className="p-1.5 bg-gray-700 hover:bg-yellow-600 text-white rounded-md shadow-md"><Edit size={16} /></button>
            <button onClick={() => onDeleteProduct(product._id)} className="p-1.5 bg-gray-700 hover:bg-red-600 text-white rounded-md shadow-md"><Trash2 size={16} /></button>
          </>
        ) : (
          <>
            <button onClick={handleEditSave} className="p-1.5 bg-green-600 text-white rounded-md shadow-md"><Save size={16}/></button>
            <button onClick={() => setIsEditing(false)} className="p-1.5 bg-gray-600 text-white rounded-md shadow-md"><X size={16}/></button>
          </>
        )}
      </div>
      <div className="mb-4">
        <div className="mb-4 pr-16 h-14 flex items-start print:pr-0 print:h-auto"> 
          {isEditing ? (
            <input type="text" className="bg-gray-900 border border-gray-600 text-white rounded p-1 w-full text-sm" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} />
          ) : (
            <div>
              <h3 className="text-xl font-bold text-white line-clamp-2 leading-tight print:text-black" title={product.name}>{product.name}</h3>
              <span className="text-xs text-gray-500 block mt-1">{product.category || 'Genel'}</span>
            </div>
          )}
        </div>
        <div className="bg-gray-900/50 p-3 rounded-lg mb-4 space-y-2 print:bg-white print:border print:border-gray-300 print:p-2">
            <div className="flex justify-between items-center border-b border-gray-700/50 pb-2 print:border-gray-300">
                <div className="text-gray-400 text-xs print:text-gray-600">Birim Fiyat</div>
                {isEditing ? <input type="number" className="bg-gray-700 border border-gray-600 text-white rounded p-1 w-16 text-right text-xs" value={editData.unitPrice} onChange={(e) => setEditData({...editData, unitPrice: e.target.value})} /> : <div className="text-sm font-medium text-gray-300 print:text-black">{product.unitPrice} ₺</div>}
            </div>
            <div className="flex justify-between items-center">
                <div className="text-blue-300 text-sm font-medium flex items-center gap-1 print:text-black"><TrendingUp size={14} className="no-print"/> Satış Fiyatı</div>
                {isEditing ? <input type="number" className="bg-gray-700 border border-blue-500/50 text-white rounded p-1 w-16 text-right text-sm font-bold" value={editData.salePrice} onChange={(e) => setEditData({...editData, salePrice: e.target.value})} /> : <div className="text-xl font-bold text-blue-400 print:text-black">{product.salePrice} ₺</div>}
            </div>
        </div>
        <div className="mb-2">
            <div className="flex justify-between text-sm mb-1"><span className="text-gray-400 print:text-gray-600">Stok</span><span className={`font-bold ${product.stock < 20 ? "text-red-400" : "text-green-400"} print:text-black`}>{product.stock} Adet</span></div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 print:bg-gray-200"><div className={`h-1.5 rounded-full no-print ${product.stock < 20 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(product.stock, 100)}%` }}></div></div>
        </div>
      </div>
      <form onSubmit={handleStockUpdate} className="flex gap-2 mt-auto pt-4 border-t border-gray-700 no-print">
        <input type="number" placeholder="Miktar" className="flex-1 bg-gray-900 border border-gray-600 text-white text-sm rounded px-3 py-2 text-center focus:outline-none focus:border-blue-500 transition-colors" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded transition-colors whitespace-nowrap">Stok Ekle</button>
      </form>
    </div>
  );
};

export default ProductCard;
