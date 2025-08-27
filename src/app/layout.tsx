// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Script from "next/script";
import ThemeBackground from "@/components/ThemeBackground";
import WallpaperBackground from "@/components/WallpaperBackground";
import SubscriptionOverlay from "@/components/SubscriptionOverlay";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import {
  kosugiMaru,
  notoSansJP,
  shipporiMincho,
  reggaeOne,
  yomogi,
  hachiMaruPop,
} from "@/lib/font";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

// ✅ FISEBASE（民泊）用メタ情報に書き換え。themeColor は viewport 側で指定
export const metadata: Metadata = {
  title: "FISEBASE｜大阪市港区の民泊・宿泊",
  description:
    "大阪府大阪市港区南市岡の民泊『FISEBASE』公式サイト。施設情報・アクセスなどの基本情報をご案内します。",
  keywords: [
    "FISEBASE",
    "民泊",
    "大阪市港区",
    "大阪",
    "宿泊",
    "ホテル",
    "旅館",
    "民泊予約",
  ],
  authors: [{ name: "FISEBASE" }],
  // ★ 新ドメインを設定（相対URLを自動で絶対URL化）
  metadataBase: new URL("https://fish-inc-2021.com"),
  alternates: {
    canonical: "https://fish-inc-2021.com/",
  },
  openGraph: {
    title: "FISEBASE｜大阪市港区の民泊・宿泊",
    description:
      "大阪市港区の民泊『FISEBASE』。施設情報・アクセスなどの基本情報をご案内します。",
    url: "https://fish-inc-2021.com/",
    siteName: "FISEBASE",
    type: "website",
    images: [
      {
        url: "/ogpLogo.png", // metadataBase により絶対URL化
        width: 1200,
        height: 630,
        alt: "FISEBASE OGP",
      },
    ],
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "FISEBASE｜大阪市港区の民泊・宿泊",
    description: "大阪市港区の民泊『FISEBASE』の基本情報をご案内します。",
    images: ["/ogpLogo.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=4" },
      { url: "/icon.png", type: "image/png", sizes: "any" },
    ],
    apple: "/icon.png",
    shortcut: "/favicon.ico?v=4",
  },
};

// ✅ ここで themeColor を指定（root で一括適用）
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`
        ${geistSans.variable} ${geistMono.variable}
        ${kosugiMaru.variable} ${notoSansJP.variable}
        ${yomogi.variable} ${hachiMaruPop.variable} ${reggaeOne.variable} ${shipporiMincho.variable}
        antialiased
      `}
    >
      <head>
        {/* OGP画像の事前読み込み（ファイル名は固定 /ogpLogo.png） */}
        <link rel="preload" as="image" href="/ogpLogo.png" type="image/png" />
        {/* 検索コンソールの所有権確認を行う場合は下記を使用
        <meta name="google-site-verification" content="（コード）" />
        */}
      </head>

      <body className="relative min-h-screen bg-[#ffffff]">
        <SubscriptionOverlay siteKey={SITE_KEY} />
        <WallpaperBackground />
        <ThemeBackground />
        <Header />
        {children}

        {/* 構造化データ（WebSite / LodgingBusiness / Person）※絶対URLで記述 */}
        <Script id="ld-json" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                name: "FISEBASE",
                url: "https://fish-inc-2021.com/",
                inLanguage: "ja",
                image: "https://fish-inc-2021.com/ogpLogo.png",
                publisher: { "@id": "#owner" },
                description:
                  "大阪府大阪市港区南市岡の民泊『FISEBASE』公式サイト。施設情報・アクセスなどの基本情報をご案内します。",
              },
              {
                "@type": "LodgingBusiness",
                name: "FISEBASE",
                url: "https://fish-inc-2021.com/",
                image: "https://fish-inc-2021.com/ogpLogo.png",
                description:
                  "大阪市港区にある民泊施設。滞在に関する情報は公式サイトをご覧ください。",
                address: {
                  "@type": "PostalAddress",
                  postalCode: "552-0011",
                  addressRegion: "大阪府",
                  addressLocality: "大阪市港区",
                  streetAddress: "南市岡3-8-26",
                },
                email: "mailto:fish.inc.2021@gmail.com",
                // telephone は未提供のため省略
                owner: { "@id": "#owner" },
              },
              {
                "@type": "Person",
                "@id": "#owner",
                name: "福本 聡",
                jobTitle: "オーナー",
                email: "mailto:fish.inc.2021@gmail.com",
                address: {
                  "@type": "PostalAddress",
                  postalCode: "552-0011",
                  addressRegion: "大阪府",
                  addressLocality: "大阪市港区",
                  streetAddress: "南市岡3-8-26",
                },
              },
            ],
          })}
        </Script>
      </body>
    </html>
  );
}
