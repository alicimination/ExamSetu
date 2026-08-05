import type { MetadataRoute } from "next";
import { supabase } from "../lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://exam-setu-virid.vercel.app";

  // Static Pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sources`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic Exam Pages from Supabase
  let dynamicRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, first_seen_at")
      .order("first_seen_at", { ascending: false });

    if (notifications && notifications.length > 0) {
      dynamicRoutes = notifications.flatMap((notif) => {
        const lastMod = notif.first_seen_at ? new Date(notif.first_seen_at) : new Date();
        return [
          {
            url: `${baseUrl}/details?id=${notif.id}`,
            lastModified: lastMod,
            changeFrequency: "daily" as const,
            priority: 0.9,
          },
          {
            url: `${baseUrl}/check/${notif.id}`,
            lastModified: lastMod,
            changeFrequency: "weekly" as const,
            priority: 0.8,
          },
          {
            url: `${baseUrl}/chat/${notif.id}`,
            lastModified: lastMod,
            changeFrequency: "weekly" as const,
            priority: 0.8,
          },
        ];
      });
    }
  } catch (err) {
    console.error("Failed to fetch notifications for sitemap:", err);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
