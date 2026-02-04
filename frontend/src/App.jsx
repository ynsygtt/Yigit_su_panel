import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import { 
  Dashboard, 
  Products, 
  Customers, 
  Orders, 
  BulkSales, 
  Debts, 
  Finance 
} from './pages';

// Shared Components
import { Sidebar } from './components/shared';

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
