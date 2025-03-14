'use client';

import React from "react";
import { User } from "@/types/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserListProps {
  users: User[];
  currentUserId: string;
  onSelectUser: (userId: string) => void;
  selectedUserId?: string;
}

export function UserList({ users, currentUserId, onSelectUser, selectedUserId }: UserListProps) {
  console.log('UserList rendered with users:', users);
  console.log('Selected user ID:', selectedUserId);

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Users</h2>
      <div className="space-y-1">
        {users.map((user) => (
          <button
            key={user._id}
            onClick={() => {
              console.log('User clicked:', user);
              onSelectUser(user._id);
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent',
              selectedUserId === user._id && 'bg-accent'
            )}
          >
            <Avatar>
              <AvatarImage src={`${process.env.NEXT_PUBLIC_API_URL}/api/images/${user.avatar}`} />
              <AvatarFallback>
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 items-center justify-between">
              <span className="font-medium">{user.username}</span>
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                )}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 