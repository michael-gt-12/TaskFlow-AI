export class CSVExporter {
  /**
   * Converts an array of objects to a CSV string.
   * Properly escapes double quotes, commas, and newlines in values.
   */
  static export<T extends Record<string, any>>(data: T[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        let escaped = val === null || val === undefined ? '' : String(val);
        
        // Escape quotes, commas, and newlines
        if (escaped.includes('"') || escaped.includes(',') || escaped.includes('\n') || escaped.includes('\r')) {
          escaped = `"${escaped.replace(/"/g, '""')}"`;
        }
        return escaped;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\r\n');
  }
}
