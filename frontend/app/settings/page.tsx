'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { ImageUploadModal } from '@/components/image-upload-modal';

export default function SettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Initialize state from session and fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user?.token) return;

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${session.user.token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('Fetched user data:', userData);
          
          setUsername(userData.username);
          
          if (userData.avatar) {
            setAvatar(userData.avatar);
            // Only update session if the avatar URL is completely different
            const currentAvatarPath = session.user.image?.split('/api/images/').pop();
            if (currentAvatarPath !== userData.avatar) {
              const fullAvatarUrl = `/api/images/${userData.avatar}`;
              console.log('Updating session with new avatar:', fullAvatarUrl);
              await update({
                ...session,
                user: {
                  ...session.user,
                  image: fullAvatarUrl,
                  name: userData.username,
                },
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Only use session data as fallback if we have no state yet
        if (!username) {
          setUsername(session.user.name || '');
        }
        if (!avatar && session.user.image) {
          const avatarFilename = session.user.image.split('/api/images/').pop() || '';
          setAvatar(avatarFilename);
        }
      }
    };

    fetchUserData();
  }, [session?.user?.token]); // Only depend on the token, not the entire session

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log('State updated:', {
      sessionAvatar: session?.user?.image,
      localAvatar: avatar,
      username,
      fullAvatarUrl: avatar ? `${process.env.NEXT_PUBLIC_API_URL}/api/images/${avatar}` : null
    });
  }, [session?.user?.image, avatar, username]);

  const handleImageUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log('Uploading avatar...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      console.log('Upload response:', data);

      // Get the filename from the response
      const avatarFilename = data.avatar || '';
      if (!avatarFilename) {
        throw new Error('No avatar filename in response');
      }

      // Construct the full avatar URL for the session
      const fullAvatarUrl = `/api/images/${avatarFilename}`;
      console.log('Generated avatar URL:', fullAvatarUrl);

      // Update profile with new avatar filename
      const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.user?.token}`,
        },
        body: JSON.stringify({
          username,
          avatar: avatarFilename,
        }),
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to update profile with new avatar');
      }

      // Update local state with filename only
      setAvatar(avatarFilename);
      
      // Update session with the full avatar URL
      const updatedSession = {
        ...session,
        user: {
          ...session?.user,
          image: fullAvatarUrl,
        },
      };
      
      console.log('Updating session with:', updatedSession);
      await update(updatedSession);

      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsLoading(false);
      setIsUploadModalOpen(false);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.user?.token}`,
        },
        body: JSON.stringify({
          username,
          avatar,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      await update({
        ...session,
        user: {
          ...session?.user,
          name: username,
        },
      });

      toast.success('Username updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update username');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectPartner = async () => {
    if (!confirm('Are you sure you want to disconnect from your partner? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/partner-disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to disconnect partner');
      }

      // Clear any partner-related data from the session
      await update({
        ...session,
        user: {
          ...session?.user,
          partner: null
        }
      });

      toast.success('Successfully disconnected from partner');
      
      // Force a small delay to ensure the server has time to process the disconnection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use replace instead of push to prevent going back to settings
      router.replace('/partner-code');
    } catch (error) {
      console.error('Error disconnecting partner:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect from partner');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/chat')}
                className="mr-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="m15 18-6-6 6-6"/>
                </svg>
                <span className="sr-only">Back to chat</span>
              </Button>
              <h1 className="flex-1 text-2xl font-bold text-center">Settings</h1>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <div 
                  className="relative group cursor-pointer" 
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <Avatar className="h-24 w-24">
                    {avatar ? (
                      <AvatarImage 
                        src={`${process.env.NEXT_PUBLIC_API_URL}/api/images/${avatar}`}
                        onError={(e) => {
                          console.error('Error loading avatar:', e);
                          const imgElement = e.currentTarget as HTMLImageElement;
                          imgElement.style.display = 'none';
                          const fallback = imgElement.nextElementSibling as HTMLElement;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <AvatarFallback>{username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateUsername} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Username
                </Button>
              </form>
            </div>

            <div className="pt-6 border-t">
              <h2 className="text-lg font-semibold mb-4">Partner Connection</h2>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDisconnectPartner}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Disconnect Partner
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ImageUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleImageUpload}
      />
    </>
  );
} 