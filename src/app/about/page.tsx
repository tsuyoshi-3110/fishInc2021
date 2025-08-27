import type { Metadata } from "next";
import AboutClient from "@/components/AboutClient";

export const metadata: Metadata = {
  title: "FISEBASEについて｜大阪市港区の民泊",
  description:
    "大阪市港区・南市岡の民泊『FISEBASE』のコンセプトとご案内。シンプルで心地よい滞在を目指し、アクセスや設備情報など基本情報を掲載しています。",
  openGraph: {
    title: "FISEBASEについて｜大阪市港区の民泊",
    description:
      "民泊『FISEBASE』（大阪市港区・南市岡）の想いと施設概要。滞在前に知っておきたい情報をまとめています。",
    url: "https://fish-inc-2021.com/about",
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
  alternates: { canonical: "https://fish-inc-2021.com/about" },
};

export default function AboutPage() {
  return (
    <main className="px-4 py-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mt-4 text-center text-white/80 text-outline">
        FISEBASEについて
      </h1>
      <AboutClient />
    </main>
  );
}
