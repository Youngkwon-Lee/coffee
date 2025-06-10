/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript 설정
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  
  // ESLint 무시 (개발 단계)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 실험적 기능 활성화 (성능 향상)
  experimental: {
    optimizePackageImports: ['framer-motion', 'firebase'],
  },
  
  // Turbopack 설정 (experimental.turbo는 deprecated)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
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