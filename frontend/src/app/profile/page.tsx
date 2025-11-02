'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Calendar, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

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
          <form className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                type="password"
                id="current-password"
                name="current-password"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                type="password"
                id="new-password"
                name="new-password"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                type="password"
                id="confirm-password"
                name="confirm-password"
                required
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="transition-smooth">
                Update Password
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
