"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { generateAvatarSeeds, getAvatarUrl, getDefaultAvatarStyle } from "@/lib/avatar";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  selectedAvatar?: string | null;
  onSelect: (avatarUrl: string) => void;
  style?: string;
  count?: number;
  className?: string;
}

export function AvatarPicker({
  selectedAvatar,
  onSelect,
  style = getDefaultAvatarStyle(),
  count = 6,
  className,
}: AvatarPickerProps) {
  const [seeds, setSeeds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate random seeds for avatar options
    const newSeeds = generateAvatarSeeds(count);
    setSeeds(newSeeds);
    setLoading(false);
  }, [count]);

  const handleSelect = (seed: string) => {
    const avatarUrl = getAvatarUrl(seed, style);
    onSelect(avatarUrl);
  };

  if (loading) {
    return (
      <div className={cn("grid grid-cols-3 gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-full bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      {seeds.map((seed) => {
        const avatarUrl = getAvatarUrl(seed, style);
        const isSelected = selectedAvatar === avatarUrl;

        return (
          <button
            key={seed}
            type="button"
            onClick={() => handleSelect(seed)}
            className={cn(
              "relative aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105",
              isSelected
                ? "border-primary ring-2 ring-primary ring-offset-2"
                : "border-border hover:border-primary/50"
            )}
          >
            <Avatar className="h-full w-full">
              <AvatarImage src={avatarUrl} alt="Avatar option" />
            </Avatar>
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                <Check className="h-6 w-6 text-primary" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

