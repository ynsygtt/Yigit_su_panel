import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => { onClose(); }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] px-8 py-4 rounded-xl shadow-2xl font-bold text-white text-lg flex items-center gap-3 animate-bounce-in transition-all duration-300 no-print ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={28} /> : <AlertCircle size={28} />}
      {message}
    </div>
  );
};

export default Toast;
