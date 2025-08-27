import type { Metadata } from "next";
import ProductsClient from "@/components/ProductsClient";

export const metadata: Metadata = {
  title: "客室・設備一覧｜FISEBASE",
  description:
    "大阪市港区の民泊『FISEBASE』の客室・設備一覧。アメニティや設備、チェックイン情報、周辺施設などを写真付きでご紹介します。",
  openGraph: {
    title: "客室・設備一覧｜FISEBASE",
    description:
      "FISEBASEの客室タイプ・設備・アメニティを写真とともに掲載。ご滞在前の確認にお役立てください。",
    url: "https://fish-inc-2021.com/products",
    siteName: "FISEBASE",
    images: [
      {
        url: "/ogpLogo.png", // layout.tsx の metadataBase により絶対URL化
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://fish-inc-2021.com/products" },
};

export default function ProductsPage() {
  return <ProductsClient />;
}






