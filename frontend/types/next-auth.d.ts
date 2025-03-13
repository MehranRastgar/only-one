import "next-auth"

declare module "next-auth" {
    interface User {
        id: string
        name?: string | null
        email?: string | null
        image?: string | null
        token: string
        username?: string
        avatar?: string
        isOnline?: boolean
        lastSeen?: string
    }

    interface Session {
        user: User
    }
} 