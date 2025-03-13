/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@radix-ui/react-icons'],
    images: {
        domains: ['avatars.githubusercontent.com'],
    },
}

module.exports = nextConfig 