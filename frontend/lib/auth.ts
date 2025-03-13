import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

if (!process.env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is not defined');
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                try {
                    const { email, password } = loginSchema.parse(credentials);

                    console.log('Attempting login with email:', email);
                    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        body: JSON.stringify({ email, password }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        console.error('Login failed:', {
                            status: response.status,
                            statusText: response.statusText,
                            data,
                        });
                        throw new Error(data.message || 'Failed to login');
                    }

                    console.log('Login successful:', data);

                    return {
                        id: data.user.id,
                        name: data.user.name,
                        email: data.user.email,
                        image: data.user.avatar,
                        token: data.token,
                    };
                } catch (error) {
                    console.error('Login error:', error);
                    if (error instanceof z.ZodError) {
                        throw new Error(error.errors[0].message);
                    }
                    if (error instanceof Error) {
                        throw new Error(error.message);
                    }
                    throw new Error('An unexpected error occurred');
                }
            },
        }),
    ],
    pages: {
        signIn: '/auth/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.token = user.token;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.token = token.token as string;
            }
            return session;
        },
    },
    session: {
        strategy: 'jwt',
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === 'development',
}; 