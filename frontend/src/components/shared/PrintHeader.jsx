import React from 'react';

const PrintHeader = ({ title }) => {
  return (
    <div className="hidden print:flex flex-col border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black text-black tracking-tight uppercase">YİĞİT TİCARET</h1>
                <p className="text-gray-600 text-sm mt-1">Yönetim ve Takip Sistemi</p>
            </div>
            <div className="text-right">
                <h2 className="text-xl font-bold text-black uppercase">{title}</h2>
                <p className="text-gray-500 text-xs mt-1">Rapor Tarihi: {new Date().toLocaleString('tr-TR')}</p>
            </div>
        </div>
    </div>
  );
};

export default PrintHeader;
