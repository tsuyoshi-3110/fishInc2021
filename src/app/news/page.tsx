// src/app/(routes)/news/page.tsx
import type { Metadata } from "next";
import NewsClient from "@/components/NewsClient";

export const metadata: Metadata = {
  title: "お知らせ・更新情報｜FISEBASE",
  description:
    "民泊『FISEBASE』（大阪市港区・南市岡）の最新情報。予約受付状況、メンテナンス、キャンペーン、チェックインに関するご案内などを掲載します。",
  openGraph: {
    title: "お知らせ・更新情報｜FISEBASE",
    description:
      "FISEBASEの最新トピックス（予約受付状況・設備メンテナンス・キャンペーン等）を随時更新しています。",
    url: "https://fish-inc-2021.com/news",
    siteName: "FISEBASE",
    images: [{ url: "/ogpLogo.png", width: 1200, height: 630 }],
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://fish-inc-2021.com/news" },
};

export default function NewsPage() {
  return (
    <main className="px-4 py-12 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mt-6 mb-6 text-center text-white/80">
        周辺案内・周辺観光
      </h1>
      <NewsClient />
    </main>
  );
}
