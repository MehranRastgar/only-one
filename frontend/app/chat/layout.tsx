"use client"

import { signOut, useSession } from "next-auth/react"
import Link from "next/link"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()

  return (
    <div className="flex h-screen flex-col">
      <nav className="border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <Link href="/chat" className="text-xl font-bold">
            Chat App
          </Link>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-md bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  )
} 