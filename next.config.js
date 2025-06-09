/** @type {import('next').NextConfig} */
const nextConfig = {
  // 정적 내보내기가 필요한 경우에만 사용
  // output: "export",
  
  /* config options here */
  images: {
    unoptimized: true,
    domains: ['firebasestorage.googleapis.com']
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

module.exports = nextConfig; 
