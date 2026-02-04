/**
 * Excel formatter helpers
 */

export const formatDateForExcel = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('tr-TR');
};

export const formatCurrencyForExcel = (amount) => {
  if (amount === null || amount === undefined) return '0 ₺';
  return `${amount.toLocaleString('tr-TR')} ₺`;
};
