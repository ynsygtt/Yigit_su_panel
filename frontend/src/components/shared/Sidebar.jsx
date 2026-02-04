import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Wallet, CreditCard, Truck
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const menuItems = [
    { name: 'Genel Bakış', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Ürünler', path: '/products', icon: <Package size={20} /> },
    { name: 'Siparişler', path: '/orders', icon: <ShoppingCart size={20} /> },
    { name: 'Toplu Satış', path: '/bulk-sales', icon: <Truck size={20} /> },
    { name: 'Müşteriler', path: '/customers', icon: <Users size={20} /> },
    { name: 'Finans', path: '/finance', icon: <Wallet size={20} /> },
    { name: 'Borçlar', path: '/debts', icon: <CreditCard size={20} /> },
  ];

  return (
    <div className="w-64 h-screen bg-gray-800 border-r border-gray-700 fixed left-0 top-0 flex flex-col z-20 print:hidden">
      <div className="p-6 text-2xl font-bold text-blue-400 border-b border-gray-700">
        Yiğit Ticaret Panel
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === item.path
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
