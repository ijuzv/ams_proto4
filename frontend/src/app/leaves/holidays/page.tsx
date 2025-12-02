'use client';

import { useState } from 'react';
import { useHolidays, Holiday, CreateHolidayDto } from '@/hooks/useHolidays';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function HolidaysPage() {
  const { holidays, isLoading, createHoliday, updateHoliday, deleteHoliday } = useHolidays();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<CreateHolidayDto>({
    date: '',
    name: '',
    description: '',
    isMandatory: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only admins can modify holidays');
      return;
    }
    try {
      if (editingHoliday) {
        await updateHoliday.mutateAsync({ id: editingHoliday.id, data: formData });
      } else {
        await createHoliday.mutateAsync(formData);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save holiday:', error);
      alert('Failed to save holiday');
    }
  };

  const handleEdit = (holiday: Holiday) => {
    if (!isAdmin) {
      alert('Only admins can edit holidays');
      return;
    }
    setEditingHoliday(holiday);
    setFormData({
      date: new Date(holiday.date).toISOString().split('T')[0],
      name: holiday.name,
      description: holiday.description || '',
      isMandatory: holiday.isMandatory !== false, // default true
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      alert('Only admins can delete holidays');
      return;
    }
    if (confirm('Are you sure you want to delete this holiday?')) {
      try {
        await deleteHoliday.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete holiday:', error);
      }
    }
  };

  const resetForm = () => {
    setEditingHoliday(null);
    setFormData({
      date: '',
      name: '',
      description: '',
      isMandatory: true,
    });
  };

  return (
    <div className="space-y-6 pt-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Company Holidays</h1>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add Holiday
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Holiday Name</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mandatory"
                    checked={formData.isMandatory}
                    onCheckedChange={(checked) => setFormData({ ...formData, isMandatory: checked === true })}
                  />
                  <Label htmlFor="mandatory">Mandatory Holiday</Label>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {editingHoliday ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >

        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : holidays?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-gray-500">No holidays found.</TableCell>
                </TableRow>
              ) : (
                holidays?.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell>{format(new Date(holiday.date), 'PPP')}</TableCell>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${holiday.isMandatory ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {holiday.isMandatory !== false ? 'Mandatory' : 'Optional'}
                      </span>
                    </TableCell>
                    <TableCell>{holiday.description || '-'}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(holiday)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(holiday.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
}
