/**
 * Excel template helpers
 */

import { exportSectionedToExcel } from './excelExporter';

export const generateSectionedExcel = (sections, sheetName, fileName) =>
  exportSectionedToExcel(sections, sheetName, fileName);

const normalizeRows = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.entries(data);
};

export const addSummarySection = (summaryRows, options = {}) => {
  const {
    title = 'ÖZET',
    headers = ['Metrik', 'Değer']
  } = options;

  const rows = normalizeRows(summaryRows);
  return {
    title,
    headers,
    rows: rows.length > 0 ? rows : [['Veri yok']]
  };
};

export const addFilterInfo = (filters, options = {}) => {
  const {
    title = 'FİLTRE BİLGİSİ',
    headers = ['Filtre', 'Değer']
  } = options;

  const rows = normalizeRows(filters);
  return {
    title,
    headers,
    rows: rows.length > 0 ? rows : [['Veri yok']]
  };
};
