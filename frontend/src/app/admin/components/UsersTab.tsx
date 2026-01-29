import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { useSearch } from '@/hooks/useSearch';
import { useExport } from '@/hooks/useExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Download, Search, ChevronLeft, ChevronRight, X, Users } from 'lucide-react';
import { truncateText } from '@/lib/utils';
import { AvatarPicker } from '@/components/avatar/AvatarPicker';
import { UserAvatar } from '@/components/avatar/UserAvatar';

interface User {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN" | "MANAGER";
  managerId?: number | null;
  designation?: string;
  shift?: string;
  active: boolean;
  avatar?: string | null;
}

interface ManagerOption {
  id: number;
  name: string;
}

export function UsersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { page, limit, onPageChange, setPage } = usePagination(1, 10);
  const { searchTerm, setSearchTerm, debouncedSearchTerm } = useSearch();
  const { exportData, isExporting } = useExport();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [searchTxt, setSearchTxt] = useState<string>('');
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    password: string;
    role: User["role"];
    managerId: number;
    avatar?: string | null;
  }>({
    name: "",
    email: "",
    password: "",
    role: "USER",
    managerId: 0,
    avatar: null,
  });

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', page, limit, searchTxt],
    queryFn: () => usersApi.getAll({
      page,
      limit,
      search: searchTxt,
    }) as Promise<{ data: User[], meta: { total: number, page: number, limit: number, totalPages: number } }>,
  });

  const users = usersData?.data || [];
  const meta = usersData?.meta || { total: 0, totalPages: 0 };

  const { data: managers = [] } = useQuery({
    queryKey: ["user-managers"],
    queryFn: () => usersApi.getManagers() as Promise<ManagerOption[]>,
    enabled: isDialogOpen,
  });

  useEffect(() => {
    if (!selectedId || !users || users.length === 0) {
      return;
    }
    const user = users.find((user: User) => user.id === selectedId);

    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
        managerId: user.managerId || 0,
        avatar: user.avatar || null,
      });
    }
  }, [selectedId, users]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "USER",
      managerId: 0,
      avatar: null,
    });
  };

  const createUserMutation = useMutation({
    mutationFn: (payload: any) => usersApi.create({
      ...payload,
      avatar: payload.avatar || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User created", variant: "success" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create user",
        description: error?.response?.data?.message || "Error",
        variant: "destructive"
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: () => usersApi.update({
      id: selectedId as number,
      email: formData.email,
      role: formData.role,
      managerId: formData.managerId ?? null,
      avatar: formData.avatar ?? null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User updated", variant: "success" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update user",
        description: error?.response?.data?.message || "Error",
        variant: "destructive"
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => usersApi.delete(selectedId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User Deleted", variant: "success" });
      setDeleteOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete user",
        description: error?.response?.data?.message || "Error",
        variant: "destructive"
      });
      setDeleteOpen(false);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isEdit) {
      createUserMutation.mutate({
        ...formData,
        managerId: formData.managerId ? Number(formData.managerId) : null,
      });
    } else {
      updateUserMutation.mutate();
    }
  };

  const handleExport = () => {
    exportData(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/users/export`, {
      search: searchTxt,
    }, 'users_export.xlsx');
  }

  const handleSearch = () => {
    setSearchTxt(searchTerm);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden relative"
    >
      <div className="px-6 py-5 border-b border-border bg-white flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Users</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system users and their permissions
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
          <div className="relative flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);

                  if (value === '') {
                    setSearchTxt('');
                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="pl-8 pr-8 w-full sm:w-[180px] min-w-[150px]"
              />
              {searchTerm && (
                <X
                  onClick={() => {
                    setSearchTerm('');
                    setSearchTxt('');
                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                  }}
                  className="absolute right-2 top-2.5 cursor-pointer w-4 h-4 text-muted-foreground"
                />
              )}
            </div>
            {searchTerm.length > 3 && (
              <Button variant="default" onClick={handleSearch} className="whitespace-nowrap">
                Search
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
            <Button variant="outline" size="icon" onClick={handleExport} disabled={isExporting} className="flex-shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => {
              setIsEdit(false);
              setSelectedId(null);
              resetForm();
              setIsDialogOpen(true);
            }}
            className="whitespace-nowrap w-full sm:w-auto"
          >
            Add User
          </Button>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Designation</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border overflow-x-auto">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No records found
                  </p>
                </td>
              </tr>
            ) : users.map((user: User) => (
              <tr key={user.id} className="hover:bg-muted/30">
                <td className="px-6 py-4 whitespace-nowrap font-medium" title={user.name}>{truncateText(user.name, 20)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground" title={user.email}>{truncateText(user.email, 20)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-muted-foreground" title={user.designation || undefined}>{truncateText(user.designation, 20) || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setSelectedId(user.id);
                    setIsEdit(true);
                    setIsDialogOpen(true);
                  }}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                    setSelectedId(user.id);
                    setDeleteOpen(true);
                  }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {meta.totalPages > 0 && `Page ${page} of ${meta.totalPages}`}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= meta.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialogs for Create/Edit and Delete would go here, similar to original file but using state */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>Are you sure you want to delete this user?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteUserMutation.mutate()}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
            </div>
            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(val: any) => setFormData({ ...formData, role: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager">Reporting Manager</Label>
              <Select
                value={formData.managerId ? String(formData.managerId) : "0"}
                onValueChange={(val: string) => setFormData({ ...formData, managerId: Number(val) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager">
                    {formData.managerId ?
                      managers.find(m => m.id === formData.managerId)?.name || "Select manager"
                      : "No Manager"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Manager</SelectItem>
                  {managers.map(manager => (
                    <SelectItem key={manager.id} value={String(manager.id)}>{manager.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <p className="text-sm text-muted-foreground">Select an avatar for this user</p>
              <AvatarPicker
                selectedAvatar={formData.avatar || null}
                onSelect={(avatarUrl) => setFormData({ ...formData, avatar: avatarUrl })}
              />
              {formData.avatar && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Selected:</span>
                  <UserAvatar avatar={formData.avatar} name={formData.name || 'User'} size="md" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, avatar: null })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <Button type="submit" className="w-full">{isEdit ? "Update" : "Create"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
