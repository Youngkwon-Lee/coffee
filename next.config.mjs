/** @type {import('next').NextConfig} */
const nextConfig = {
  // 개발 환경 성능 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // 이미지 설정
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.fritz.co.kr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.namusairo.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lowkeycoffee.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn-optimized.imweb.me',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'renew.terarosa.com',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 60,
  },
  
  // TypeScript 설정 - 개발 시 빠른 컴파일
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  
  // ESLint 무시 (개발 단계)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 실험적 기능 활성화 (성능 향상)
  experimental: {
    optimizePackageImports: ['framer-motion', 'firebase'],
  },

  // 웹팩 최적화
  webpack: (config, { dev }) => {
    if (dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          firebase: {
            test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
            name: 'firebase',
            priority: 10,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 5,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig; 