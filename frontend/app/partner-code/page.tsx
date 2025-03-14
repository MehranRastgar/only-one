'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function PartnerCodePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [partnerCode, setPartnerCode] = useState('');
  const [userCode, setUserCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.token) {
      fetchUserCode();
    }
  }, [status, session]);

  // Fetch user's own partner code on mount
  const fetchUserCode = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/partner-code`, {
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserCode(data.partnerCode);
      }
    } catch (error) {
      console.error('Error fetching user code:', error);
    }
  };

  // Generate new partner code
  const generateNewCode = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/partner-code/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.user?.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserCode(data.partnerCode);
      } else {
        setError('Failed to generate new code');
      }
    } catch (error) {
      console.error('Error generating code:', error);
      setError('Failed to generate new code');
    } finally {
      setIsLoading(false);
    }
  };

  // Connect with partner using their code
  const connectWithPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerCode.trim()) return;

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/partner-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.user?.token}`,
        },
        body: JSON.stringify({ partnerCode }),
      });

      if (response.ok) {
        router.push('/chat');
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to connect with partner');
      }
    } catch (error) {
      console.error('Error connecting with partner:', error);
      setError('Failed to connect with partner');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-4">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold text-center">Partner Connection</h1>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Share your code with your partner or enter their code to connect
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User's own code section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Your Partner Code</h2>
              <div className="flex gap-2">
                <Input
                  value={userCode}
                  readOnly
                  placeholder="Your partner code will appear here"
                  className="font-mono"
                />
                <Button
                  onClick={generateNewCode}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Generate'
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this code with your partner to let them connect with you
              </p>
            </div>

            {/* Partner code entry section */}
            <form onSubmit={connectWithPartner} className="space-y-4">
              <h2 className="text-lg font-semibold">Enter Partner's Code</h2>
              <Input
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value)}
                placeholder="Enter your partner's code"
                className="font-mono"
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !partnerCode.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  'Connect with Partner'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              Need help? Contact support
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 