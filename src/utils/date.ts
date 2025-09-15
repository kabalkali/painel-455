// Utilitário de parsing de datas flexível para formatos brasileiros e ISO
// Retorna null quando não conseguir parsear
export function parseFlexibleDate(input: any): Date | null {
  if (!input) return null;
  const str = String(input).trim();

  // Ex: 31/12/2024 ou 31/12/2024 14:35
  if (str.includes('/')) {
    const [datePart, timePart] = str.split(' ');
    const [dd, mm, yyyy] = datePart.split('/').map((v) => parseInt(v, 10));
    if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
      if (timePart) {
        const [hh = '0', mi = '0', ss = '0'] = timePart.split(':');
        const d = new Date(yyyy, mm - 1, dd, parseInt(hh, 10) || 0, parseInt(mi, 10) || 0, parseInt(ss, 10) || 0);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(yyyy, mm - 1, dd);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // Ex: 31-12-2024 ou 31-12-2024 14:35
  if (str.includes('-') && !str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [datePart, timePart] = str.split(' ');
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts.map((v) => parseInt(v, 10));
      if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
        if (timePart) {
          const [hh = '0', mi = '0', ss = '0'] = timePart.split(':');
          const d = new Date(yyyy, mm - 1, dd, parseInt(hh, 10) || 0, parseInt(mi, 10) || 0, parseInt(ss, 10) || 0);
          return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(yyyy, mm - 1, dd);
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }

  // Handle Excel serial dates (numbers like 45200)
  const num = parseFloat(str);
  if (!isNaN(num) && num > 1000 && num < 100000) {
    // Excel epoch starts on 1900-01-01, but has a leap year bug
    const excelEpoch = new Date(1900, 0, 1);
    const daysToAdd = num - 2; // Adjust for Excel's leap year bug
    const d = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: tentar Date nativo (ISO, etc.)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
