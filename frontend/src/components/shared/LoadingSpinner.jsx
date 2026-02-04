import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full min-h-[400px] no-print">
    <div className="flex flex-col items-center gap-4">
      <Loader2 size={48} className="text-blue-500 animate-spin" />
      <span className="text-gray-400 text-sm font-medium animate-pulse">Veriler Yükleniyor...</span>
    </div>
  </div>
);

export default LoadingSpinner;
