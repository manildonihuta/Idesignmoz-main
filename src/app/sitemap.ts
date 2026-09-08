import type { MetadataRoute } from "next";
import { getBlogCategories, getBlogPosts, getHostingPlans, getProjects, getServices } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, hostingPlans, projects, categories, blogPosts] = await Promise.all([
    getServices(),
    getHostingPlans(),
    getProjects(),
    getBlogCategories(),
    getBlogPosts(),
  ]);

  const mainRoutes = ["/", "/services", "/domains", "/hosting", "/portfolio", "/pricing", "/blog"].map(
    (path, index) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: index === 0 ? ("daily" as const) : ("weekly" as const),
      priority: index === 0 ? 1 : 0.8,
    }),
  );

  const pageRoutes = ["/about", "/contact", "/domains/search", "/home"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const serviceRoutes = services.map((service) => ({
    url: `${SITE_URL}/services/${service.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const hostingRoutes = hostingPlans.map((plan) => ({
    url: `${SITE_URL}/hosting/${plan.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const portfolioRoutes = projects.map((project) => ({
    url: `${SITE_URL}/portfolio/${project.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const categoryRoutes = categories.map((category) => ({
    url: `${SITE_URL}/blog/category/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const blogRoutes = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(`${post.updated ?? post.date}T12:00:00`),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...mainRoutes,
    ...pageRoutes,
    ...serviceRoutes,
    ...hostingRoutes,
    ...portfolioRoutes,
    ...categoryRoutes,
    ...blogRoutes,
  ];
}