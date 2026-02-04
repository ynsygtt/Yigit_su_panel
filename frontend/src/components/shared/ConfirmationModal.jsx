import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] animate-fade-in no-print">
      <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 shadow-2xl max-w-sm w-full text-center transform transition-all scale-100">
        <div className="flex justify-center mb-6">
          <div className="bg-red-900/30 p-4 rounded-full border border-red-500/30">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Emin misiniz?</h3>
        <p className="text-gray-400 mb-8 text-sm">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">Hayır, İptal</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors shadow-lg hover:shadow-red-900/50">Evet, Sil</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
