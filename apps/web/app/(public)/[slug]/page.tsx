import type { Metadata } from "next";
import { VisitorClient } from "./client";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${appUrl}/api/worlds/public/${slug}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { title: "World Not Found | MyPixelPage" };
    }

    const data = await res.json();
    const name = data.profile?.displayName || slug;

    return {
      title: `${name}'s World | MyPixelPage`,
      description: data.profile?.bio || `Explore ${name}'s pixel world`,
      openGraph: {
        title: `${name}'s World`,
        description: data.profile?.bio || `Explore ${name}'s pixel world`,
        type: "website",
      },
    };
  } catch {
    return { title: "MyPixelPage" };
  }
}

export default async function WorldPage({ params }: PageProps) {
  const { slug } = await params;
  return <VisitorClient slug={slug} />;
}
