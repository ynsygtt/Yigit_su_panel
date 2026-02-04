import * as XLSX from 'xlsx';
import { formatDateForExcel, formatCurrencyForExcel } from './formatters';

// ============== HELPER FONKSIYONLAR ==============

/**
 * Kolon genişliklerini otomatik hesapla
 */
const calculateColumnWidths = (data) => {
  const columnWidths = [];
  if (data.length > 0) {
    Object.keys(data[0]).forEach(key => {
      const maxLength = Math.max(
        key.length,
        ...data.map(row => String(row[key] || '').length)
      );
      columnWidths.push({ wch: Math.min(maxLength + 2, 50) });
    });
  }
  return columnWidths;
};

/**
 * Dosya indir
 */
const downloadFile = (blob, fileName) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

/**
 * Excel buffer'ını blob'a çevir
 */
const createExcelBlob = (buffer) => {
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
};

// ============== EXCEL EXPORT FONKSİYONLARI ==============

/**
 * Excel dosyası oluştur ve indir
 * @param {Array} data - Tablo verisi (array of objects)
 * @param {String} sheetName - Sheet adı
 * @param {String} fileName - Dosya adı (.xlsx otomatik eklenir)
 * @param {Object} summary - Özet verileri (opsiyonel)
 */
export const exportToExcel = (data, sheetName, fileName, summary = null) => {
    try {
        const workbook = XLSX.utils.book_new();
        const dateRange = summary?.['Tarih Aralığı'];
        const worksheet = XLSX.utils.aoa_to_sheet([]);
        let dataOrigin = 'A1';

        if (dateRange) {
            XLSX.utils.sheet_add_aoa(worksheet, [['Tarih Aralığı', dateRange]], { origin: 'A1' });
            XLSX.utils.sheet_add_aoa(worksheet, [[]], { origin: -1 });
            dataOrigin = 'A3';
        }

        XLSX.utils.sheet_add_json(worksheet, data, { origin: dataOrigin, skipHeader: false });
        
        if (summary) {
            const summaryEntries = Object.entries(summary).filter(([key]) => key !== 'Tarih Aralığı');
            if (summaryEntries.length > 0) {
                XLSX.utils.sheet_add_aoa(worksheet, [[]], { origin: -1 });
                XLSX.utils.sheet_add_aoa(worksheet, [[]], { origin: -1 });
                XLSX.utils.sheet_add_aoa(worksheet, [['ÖZET BİLGİLER', '']], { origin: -1 });
                summaryEntries.forEach(([key, value]) => {
                    XLSX.utils.sheet_add_aoa(worksheet, [[key, value]], { origin: -1 });
                });
            }
        }
        
        worksheet['!cols'] = calculateColumnWidths(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        
        const blob = createExcelBlob(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));
        downloadFile(blob, fileName);
        
        return true;
    } catch (error) {
        console.error('Excel export hatası:', error);
        return false;
    }
};

/**
 * Çoklu sheet'li Excel dosyası oluştur
 * @param {Array} sheets - [{name: 'Sheet1', data: [...]}]
 * @param {String} fileName - Dosya adı
 */
export const exportMultiSheet = (sheets, fileName) => {
    try {
        const workbook = XLSX.utils.book_new();

        sheets.forEach(({ name, data, summary }) => {
            if (summary) {
                const summaryData = Object.entries(summary).map(([key, value]) => ({
                    'Metrik': key,
                    'Değer': value
                }));
                const summarySheet = XLSX.utils.json_to_sheet(summaryData);
                summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(workbook, summarySheet, `${name} - Özet`);
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            worksheet['!cols'] = calculateColumnWidths(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, name);
        });

        const blob = createExcelBlob(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));
        downloadFile(blob, fileName);
        
        return true;
    } catch (error) {
        console.error('Excel export hatası:', error);
        return false;
    }
};

/**
 * Tek sheet içinde bölümlemeli tablolar oluştur
 * @param {Array} sections - [{ title: 'Bölüm', headers: [...], rows: [[...]] }]
 * @param {String} sheetName - Sheet adı
 * @param {String} fileName - Dosya adı
 */
export const exportSectionedToExcel = (sections, sheetName, fileName) => {
    try {
        const allRows = [];
        sections.forEach((section, index) => {
            if (section.title) allRows.push([section.title]);
            if (section.headers?.length > 0) allRows.push(section.headers);
            if (section.rows?.length > 0) {
                section.rows.forEach((row) => allRows.push(row));
            } else {
                allRows.push(['Veri yok']);
            }
            if (index < sections.length - 1) allRows.push([]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(allRows);
        const colWidths = [];
        
        allRows.forEach((row) => {
            row.forEach((cell, colIndex) => {
                const cellLength = String(cell ?? '').length;
                colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, cellLength);
            });
        });
        
        worksheet['!cols'] = colWidths.map((wch) => ({ wch: Math.min(wch + 2, 60) }));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        
        const blob = createExcelBlob(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));
        downloadFile(blob, fileName);
        
        return true;
    } catch (error) {
        console.error('Excel export hatası:', error);
        return false;
    }
};

/**
 * Tarih formatla (Excel için)
 */
export { formatDateForExcel, formatCurrencyForExcel };
