import type { MetadataRoute } from "next";

const SITE_URL = "https://coffee-omega-lovat.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 개인 데이터가 보이는 화면과 관리자 화면은 색인하지 않는다.
        disallow: ["/api/", "/admin/", "/my-beans", "/history", "/basket", "/settings/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
