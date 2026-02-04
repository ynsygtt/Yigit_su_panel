import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Shared Components
import Sidebar from './components/Sidebar';

// Page Components
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import BulkSales from './pages/BulkSales';
import Debts from './pages/Debts';
import Finance from './pages/Finance';

// ======================= MAIN APPLICATION =======================
function App() {
  return (
    <Router>
      <div className="flex bg-gray-900 min-h-screen font-sans">
        <Sidebar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/bulk-sales" element={<BulkSales />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/debts" element={<Debts />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
