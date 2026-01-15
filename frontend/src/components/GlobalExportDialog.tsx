import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExport } from '@/hooks/useExport';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

export function GlobalExportDialog() {
  const { exportGlobal, isExporting } = useExport();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('export');
  const [fileType, setFileType] = useState('xlsx');
  const [timeFilter, setTimeFilter] = useState('7_days');
  const [specificDate, setSpecificDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['users', 'attendance', 'approved_leaves']);

  const handleExport = async () => {
    try {
      await exportGlobal({
        fileName,
        fileType,
        dataTypes: selectedTypes,
        timeFilter,
        specificDate: timeFilter === 'date_specific' ? specificDate : undefined,
        fromDate: timeFilter === 'custom_range' ? fromDate : undefined,
        toDate: timeFilter === 'custom_range' ? toDate : undefined,
      });
      setOpen(false);
    } catch (error) {
      // Error is already handled in useExport hook
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Overall Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Global Export</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 overflow-y-auto flex-1">
          <div className="grid gap-2">
            <Label htmlFor="filename">File Name</Label>
            <Input id="filename" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>File Type</Label>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Data Types</Label>
            <div className="flex flex-col gap-2">
              {['users', 'attendance', 'approved_leaves', 'leave_summary'].map(type => (
                <div key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={type}
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor={type} className="capitalize">{type.replace('_', ' ')}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Time Filter</Label>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7_days">Last 7 Days</SelectItem>
                <SelectItem value="30_days">Last 30 Days</SelectItem>
                <SelectItem value="3_months">Last 3 Months</SelectItem>
                <SelectItem value="6_months">Last 6 Months</SelectItem>
                <SelectItem value="1_year">Last 1 Year</SelectItem>
                <SelectItem value="date_specific">Specific Date</SelectItem>
                <SelectItem value="custom_range">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timeFilter === 'date_specific' && (
            <div className="grid gap-2">
              <Label>Select Date</Label>
              <Input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} />
            </div>
          )}

          {timeFilter === 'custom_range' && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>From Date</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>To Date</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Exporting...' : 'Download Export'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
