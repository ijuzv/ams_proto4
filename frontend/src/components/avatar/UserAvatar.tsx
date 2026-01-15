"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

interface UserAvatarProps {
  avatar?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  fallback?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

export function UserAvatar({
  avatar,
  name = "User",
  size = "md",
  className,
  fallback,
}: UserAvatarProps) {
  const initials = fallback || getInitials(name);
  const sizeClass = sizeClasses[size];

  return (
    <Avatar className={cn(sizeClass, className)}>
      {avatar && avatar.trim() !== '' ? (
        <AvatarImage 
          src={avatar} 
          alt={name}
          onError={(e) => {
            // If image fails to load, hide the image to show fallback
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

