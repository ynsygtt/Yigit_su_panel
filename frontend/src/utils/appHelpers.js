/**
 * App.jsx Yardımcı Fonksiyonları
 * Tekrarlanan kod yapılarını minimize etmek için merkezi utility'ler
 */

// ======================== FORM VALIDASYONU ========================
/**
 * Form alanlarını valide et
 * @param {object} data - Form verileri
 * @param {array} requiredFields - Zorunlu alanlar
 * @returns {boolean}
 */
export const validateRequired = (data, requiredFields) => {
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      return false;
    }
  }
  return true;
};

/**
 * Sayısal değeri valide et
 * @param {number} value - Kontrol edilecek değer
 * @param {number} min - Minimum değer (varsayılan: 0)
 * @returns {boolean}
 */
export const validateAmount = (value, min = 0) => {
  const num = parseFloat(value);
  return !isNaN(num) && num > min;
};

/**
 * Tarih aralığını valide et
 * @param {string} startDate - Başlangıç tarihi
 * @param {string} endDate - Bitiş tarihi
 * @returns {boolean}
 */
export const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end;
};

// ======================== TARİH FİLTRESİ ========================
/**
 * Yerel tarih string'i üret (YYYY-MM-DD)
 * @param {Date} date - Tarih (varsayılan: şimdi)
 * @returns {string}
 */
export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Yerel tarih oluştur (YYYY-MM-DD)
 * @param {string} dateStr - Tarih string'i
 * @param {boolean} endOfDay - Gün sonu mu?
 * @returns {Date}
 */
export const parseLocalDate = (dateStr, endOfDay = false) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
};

/**
 * Yerel gün aralığını oluştur
 * @param {string} startDate - Başlangıç tarihi
 * @param {string} endDate - Bitiş tarihi
 * @returns {{start: Date, end: Date}}
 */
export const getLocalDayRange = (startDate, endDate) => {
  const start = parseLocalDate(startDate, false);
  const end = parseLocalDate(endDate, true);
  return { start, end };
};

/**
 * Sunucu zaman dilimine göre gün başlangıcı oluştur
 * @param {string} dateStr - Tarih string'i
 * @param {number} timezoneOffsetMinutes - Sunucu timezone offset (dakika)
 * @returns {Date}
 */
export const parseServerDate = (dateStr, timezoneOffsetMinutes) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const offsetMinutes = timezoneOffsetMinutes ?? new Date().getTimezoneOffset();
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(utcMidnight + offsetMinutes * 60 * 1000);
};

/**
 * Sunucu zaman dilimine göre gün aralığını oluştur
 * @param {string} startDate - Başlangıç tarihi
 * @param {string} endDate - Bitiş tarihi
 * @param {number} timezoneOffsetMinutes - Sunucu timezone offset (dakika)
 * @returns {{start: Date, end: Date}}
 */
export const getServerDayRange = (startDate, endDate, timezoneOffsetMinutes) => {
  const start = parseServerDate(startDate, timezoneOffsetMinutes);
  const endStart = parseServerDate(endDate, timezoneOffsetMinutes);
  const end = endStart ? new Date(endStart.getTime() + 24 * 60 * 60 * 1000 - 1) : null;
  return { start, end };
};

/**
 * Tarih aralığına göre öğeleri filtrele
 * @param {array} items - Filtelenecek öğeler
 * @param {string} startDate - Başlangıç tarihi
 * @param {string} endDate - Bitiş tarihi
 * @param {string} dateField - Tarih alanı adı
 * @returns {array}
 */
export const filterByDateRange = (items, startDate, endDate, dateField = 'date') => {
  if (!startDate || !endDate) return items;

  const { start, end } = getLocalDayRange(startDate, endDate);
  
  return items.filter(item => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= start && itemDate <= end;
  });
};

// ======================== RENK VE DURUM HELPER'LARı ========================
/**
 * Durum etiketi için renkleri döndür
 * @param {string} status - Durum değeri
 * @returns {string} - Tailwind class'ları
 */
export const getStatusColor = (status) => {
  const statusMap = {
    'Ödendi': 'bg-green-900/30 text-green-400 border border-green-500/30',
    'Ödenmedi': 'bg-red-900/30 text-red-400 border border-red-500/30',
    'Kısmen Ödendi': 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30',
    'Bekleniyor': 'bg-blue-900/30 text-blue-400 border border-blue-500/30',
    'Teslim Edildi': 'bg-green-900/30 text-green-400',
    'Hazırlanan': 'bg-yellow-900/30 text-yellow-400',
    'Borç': 'text-red-500 font-bold',
    'Aktif': 'bg-green-900/30 text-green-400',
    'Pasif': 'bg-gray-900/30 text-gray-400',
  };
  return statusMap[status] || 'text-gray-400';
};

/**
 * Kategori badge rengi
 * @param {string} category - Kategori adı
 * @returns {string} - Tailwind class'ları
 */
export const getCategoryColor = (category) => {
  const categoryMap = {
    'Ürün Alımı': 'bg-blue-900/30 text-blue-400',
    'Kira': 'bg-purple-900/30 text-purple-400',
    'Nakliye': 'bg-orange-900/30 text-orange-400',
    'Yakıt': 'bg-red-900/30 text-red-400',
    'Personel': 'bg-green-900/30 text-green-400',
    'Muhasebe': 'bg-cyan-900/30 text-cyan-400',
    'Faturalar': 'bg-indigo-900/30 text-indigo-400',
    'Araç Bakım': 'bg-pink-900/30 text-pink-400',
    'Zayi/Fire': 'bg-red-900/30 text-red-400',
    'Diğer': 'bg-gray-900/30 text-gray-400',
  };
  return categoryMap[category] || 'bg-gray-900/30 text-gray-400';
};

// ======================== SAYISAL FORMATLAMA ========================
/**
 * Türk para birimi olarak formatla
 * @param {number} amount - Tutarı
 * @returns {string}
 */
export const formatTRCurrency = (amount) => {
  if (!amount && amount !== 0) return '₺0,00';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Ondalık sayıyı formatla
 * @param {number} value - Sayı
 * @param {number} decimals - Ondalık basamak
 * @returns {string}
 */
export const formatDecimal = (value, decimals = 2) => {
  if (!value && value !== 0) return '0';
  return parseFloat(value).toFixed(decimals);
};

/**
 * Tarih formatla
 * @param {string|Date} date - Tarih
 * @param {boolean} includeTime - Saati dahil et
 * @returns {string}
 */
export const formatDate = (date, includeTime = false) => {
  if (!date) return '';
  const d = new Date(date);
  if (includeTime) {
    return d.toLocaleString('tr-TR');
  }
  return d.toLocaleDateString('tr-TR');
};

// ======================== ARAMA VE FİLTRELEME ========================
/**
 * Basit metin araması
 * @param {array} items - Aranacak öğeler
 * @param {string} searchTerm - Arama terimi
 * @param {array} searchFields - Aranacak alanlar
 * @returns {array}
 */
export const searchItems = (items, searchTerm, searchFields = ['name']) => {
  if (!searchTerm) return items;
  const term = searchTerm.toLowerCase();
  return items.filter(item =>
    searchFields.some(field => {
      const value = item[field];
      return value && value.toString().toLowerCase().includes(term);
    })
  );
};

// ======================== HESAPLAYICI FONKSİYONLAR ========================
/**
 * Siparişin toplam tutarını hesapla
 * @param {array} items - Sipariş öğeleri
 * @returns {number}
 */
export const calculateOrderTotal = (items) => {
  return items.reduce((sum, item) => sum + (item.quantity * item.salePrice), 0);
};

/**
 * Gider toplamını hesapla
 * @param {array} expenses - Gider listesi
 * @returns {number}
 */
export const calculateExpenseTotal = (expenses) => {
  return expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
};

export default {
  validateRequired,
  validateAmount,
  validateDateRange,
  filterByDateRange,
  getStatusColor,
  getCategoryColor,
  formatTRCurrency,
  formatDecimal,
  formatDate,
  searchItems,
  calculateOrderTotal,
  calculateExpenseTotal,
  getLocalDateString,
  parseLocalDate,
  getLocalDayRange,
  parseServerDate,
  getServerDayRange,
};
