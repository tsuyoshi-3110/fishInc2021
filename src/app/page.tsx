// src/app/(routes)/home/page.tsx

import type { Metadata } from "next";
import BackgroundVideo from "@/components/backgroundVideo/BackgroundVideo";
import TopFixedText from "@/components/TopFixedText";

export const metadata: Metadata = {
  title: "FISEBASE｜民泊・宿泊（大阪市港区）",
  description:
    "大阪市港区南市岡の民泊『FISEBASE』公式サイト。シンプルで心地よい滞在を提供します。施設情報・アクセスなどの基本情報をご案内します。",
  openGraph: {
    title: "FISEBASE｜民泊・宿泊（大阪市港区）",
    description:
      "大阪市港区の民泊『FISEBASE』。施設情報・アクセスなどの基本情報をご案内します。",
    url: "https://fish-inc-2021.com/",
    siteName: "FISEBASE",
    images: [
      {
        url: "/ogpLogo.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://fish-inc-2021.com/" },
};

export default function HomePage() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* ① ファーストビュー：背景動画または画像 */}
      <section className="relative h-screen overflow-hidden">
        <BackgroundVideo />
      </section>

      {/* ② テキスト紹介セクション */}
      <section className="relative z-10 text-white px-4 py-20">
        {/* 編集可能な固定テキストコンポーネント */}
        <TopFixedText />

        {/* ページタイトルとリード文 */}
        <h1 className="text-3xl lg:text-4xl font-extrabold text-center leading-tight mb-6 text-outline">
          FISEBASE
        </h1>

        <p className="max-w-3xl mx-auto text-center leading-relaxed text-outline">
          大阪府大阪市港区・南市岡の民泊「FISEBASE」は、
          ゆったりと過ごせるシンプルで心地よい空間をご用意しています。
          観光やビジネスの拠点に便利な立地で、長期・短期いずれのご滞在にも対応。
          施設・アクセスの詳細は本サイトよりご確認いただけます。
        </p>
      </section>

      {/* ③ JSON-LD（構造化データ）：LodgingBusiness */}
      <script
        type="application/ld+json"
        // 必要に応じて telephone やチェックイン/アウトなどを追記してください
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "LodgingBusiness",
              name: "FISEBASE",
              url: "https://fish-inc-2021.com/",
              description:
                "大阪市港区南市岡の民泊『FISEBASE』公式サイト。施設情報・アクセスなどの基本情報をご案内します。",
              image: "https://fish-inc-2021.com/ogpLogo.png",
              address: {
                "@type": "PostalAddress",
                postalCode: "552-0011",
                addressRegion: "大阪府",
                addressLocality: "大阪市港区",
                streetAddress: "南市岡3-8-26",
              },
              email: "mailto:fish.inc.2021@gmail.com",
            },
          ]),
        }}
      />
    </main>
  );
}
