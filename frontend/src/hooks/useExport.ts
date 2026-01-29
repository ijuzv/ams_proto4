import { useState } from 'react';
import axios from 'axios';

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async (url: string, params: any, filename: string) => {
    try {
      setIsExporting(true);
      const response = await axios.get(url, {
        params,
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const href = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = href;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(href);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportGlobal = async (params: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsExporting(true);
      axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/export/global`, params, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      .then((response) => {
        const href = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('download', params.fileName + (params.fileType === 'csv' ? '.csv' : '.xlsx'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(href);
        setIsExporting(false);
        resolve();
      })
      .catch((error) => {
        console.error('Global export failed:', error);
        alert('Export failed. Please try again.');
        setIsExporting(false);
        reject(error);
      });
    });
  }

  return {
    isExporting,
    exportData,
    exportGlobal
  };
}
