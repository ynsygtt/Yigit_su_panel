import React, { useState } from 'react';
import { Edit, Trash2, Save, X } from 'lucide-react';

const CustomerRow = ({ customer, index, onUpdateCustomer, onDeleteCustomer }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: customer.name, phone: customer.phone, address: customer.address, note: customer.note });
  const handleSave = () => { onUpdateCustomer(customer._id, editData); setIsEditing(false); };
  const handleCancel = () => { setIsEditing(false); setEditData({ name: customer.name, phone: customer.phone, address: customer.address, note: customer.note }); };

  if (isEditing) {
    return (
      <tr className="bg-gray-800 border-b border-gray-700 hover:bg-gray-750">
        <td className="p-3 font-bold text-gray-500">{index}</td>
        <td className="p-3"><input type="text" className="bg-gray-900 border border-gray-600 text-white rounded p-1 w-full text-sm" value={editData.name} onChange={(e)=>setEditData({...editData, name:e.target.value})}/></td>
        <td className="p-3"><input type="text" className="bg-gray-900 border border-gray-600 text-white rounded p-1 w-full text-sm" value={editData.phone} onChange={(e)=>setEditData({...editData, phone:e.target.value})}/></td>
        <td className="p-3"><input type="text" className="bg-gray-900 border border-gray-600 text-white rounded p-1 w-full text-sm" value={editData.address} onChange={(e)=>setEditData({...editData, address:e.target.value})}/></td>
        <td className="p-3"><input type="text" className="bg-gray-900 border border-gray-600 text-white rounded p-1 w-full text-sm" value={editData.note} onChange={(e)=>setEditData({...editData, note:e.target.value})}/></td>
        <td className="p-3 flex gap-2 justify-end"><button onClick={handleSave} className="p-1.5 bg-green-600 text-white rounded"><Save size={16}/></button><button onClick={handleCancel} className="p-1.5 bg-gray-600 text-white rounded"><X size={16}/></button></td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-gray-700 hover:bg-gray-750 transition-colors group print:border-gray-300 print:hover:bg-transparent">
      <td className="p-4 font-bold text-gray-500 print:text-black">{index}</td>
      <td className="p-4 font-medium text-white print:text-black">{customer.name}</td>
      <td className="p-4 text-gray-300 font-mono text-sm print:text-black">{customer.phone}</td>
      <td className="p-4 text-gray-400 text-sm max-w-xs truncate print:text-black print:whitespace-normal">{customer.address || '-'}</td>
      <td className="p-4 text-gray-400 text-sm italic max-w-xs truncate print:text-black print:whitespace-normal">{customer.note || '-'}</td>
      <td className="p-4 text-right no-print">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setIsEditing(true)} className="p-1.5 text-blue-400 hover:bg-blue-900/50 rounded"><Edit size={18} /></button>
            <button onClick={() => onDeleteCustomer(customer._id)} className="p-1.5 text-red-400 hover:bg-red-900/50 rounded"><Trash2 size={18} /></button>
        </div>
      </td>
    </tr>
  );
};

export default CustomerRow;
