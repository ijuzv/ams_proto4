'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Calendar, Edit2, Save, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { usersApi } from '@/lib/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isMatch, setIsMatch] = useState<boolean | null>(null);
  const [cnfrmNewPassword, setCnfrmNewPassword] = useState('');
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Update profile
    setIsEditing(false);
  };

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string, newPassword: string }) => usersApi.changePassword(data),
    onSuccess: () => {
      toast({
        title: 'Success!',
        description: 'Password Updated Successfully.',
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to Update Password.',
        variant: 'destructive',
      });
    },
  });

  if (!user) return null;

  const infoItems = [
    {
      label: 'Full name',
      value: user.name,
      icon: User,
      field: 'name',
    },
    {
      label: 'Email address',
      value: user.email,
      icon: Mail,
      field: 'email',
      disabled: true,
    },
    {
      label: 'Role',
      value: user.role.charAt(0) + user.role.slice(1).toLowerCase(),
      icon: Shield,
    },
    {
      label: 'Member since',
      value: new Date().toLocaleDateString(),
      icon: Calendar,
    },
  ];

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const value = e.target.value;
    if (type === "oldPass") {
      setOldPassword(value)
    } else if (type === "newPass") {
      setNewPassword(value)
    } else {
      setCnfrmNewPassword(value)
    }
  };

  const handleUpdaePassword = () => {
    if (!!newPassword === !!cnfrmNewPassword) {
      changePasswordMutation.mutate(
        {
          currentPassword: oldPassword,
          newPassword: newPassword,
        }
      )
    } else {
      setError("Confirm password isn't matching")
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const value = e.target.value;

    if (type === "oldPass") {
      setOldPassword(value);
    } else if (type === "newPass") {
      setNewPassword(value);
      setIsMatch(value === cnfrmNewPassword);
      setError(value === cnfrmNewPassword ? "" : "Passwords do not match");
    } else {
      setCnfrmNewPassword(value);
      setIsMatch(newPassword === value);
      setError(newPassword === value ? "" : "Passwords do not match");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center pb-6 border-b border-border"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your personal information
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="transition-smooth">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </motion.div>

      {/* Profile Information Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-white">
          <h2 className="text-lg font-semibold text-foreground">
            Profile Information
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal details and account information
          </p>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid gap-6">
              {infoItems
                .filter((item) => item.field)
                .map((item) => (
                  <div key={item.field} className="grid gap-2">
                    <Label htmlFor={item.field}>{item.label}</Label>
                    <Input
                      id={item.field}
                      name={item.field}
                      value={formData[item.field as keyof typeof formData]}
                      onChange={handleInputChange}
                      disabled={item.disabled}
                      required
                    />
                  </div>
                ))}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user?.name || '',
                      email: user?.email || '',
                    });
                  }}
                  className="transition-smooth"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" className="transition-smooth">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {infoItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-lg hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <dt className="text-sm font-medium text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-foreground">
                        {item.value}
                      </dd>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Change Password Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-white">
          <h2 className="text-lg font-semibold text-foreground">
            Change Password
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your password to keep your account secure
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                Current Password
              </label>
              <input
                type="password"
                id="current-password"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                name="current-password"
                required
                onChange={(e) => handleNameChange(e, 'oldPass')}
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                id="new-password"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                name="new-password"
                required
                onChange={(e) => handleNameChange(e, 'newPass')}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirm-password"
                className={`
    mt-1 block w-full rounded-md px-3 py-2 shadow-sm sm:text-sm focus:outline-none
    ${isMatch === null ? "border border-gray-300" : ""}
    ${isMatch === true ? "border-green-500 focus:border-green-500 ring-green-500" : ""}
    ${isMatch === false ? "border-red-500 focus:border-red-500 ring-red-500" : ""}
  `}
                name="confirm-password"
                required
                onChange={(e) => handlePasswordChange(e, 'cnfrmPass')}
              />

              {isMatch === false && (
                <p className="text-red-500 text-sm mt-1">
                  Passwords do not match
                </p>
              )}

              {isMatch === true && (
                <p className="text-green-600 text-sm mt-1">
                  Passwords match ✔
                </p>
              )}

            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="transition-smooth"
                onClick={handleUpdaePassword}
              >
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
