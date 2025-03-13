declare module 'socket.io-client' {
    import { Socket as NetSocket } from 'net';
    import { Server as HTTPServer } from 'http';
    import { Server as HTTPSServer } from 'https';

    export interface Socket extends NetSocket {
        server: HTTPServer | HTTPSServer;
        data: {
            user: {
                id: string;
                username: string;
                avatar?: string;
                isOnline: boolean;
                lastSeen: string;
            };
        };
        close(): void;
    }

    export function io(uri: string, opts?: any): Socket;
} 