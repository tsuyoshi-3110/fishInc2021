import type { Metadata } from "next";
import StoresClient from "@/components/StoresClient";
import { PhoneSection } from "@/components/PhoneSection";

export const metadata: Metadata = {
  title: "施設情報｜FISEBASE",
  description:
    "大阪市港区の民泊『FISEBASE』の施設情報ページ。所在地・周辺情報・連絡先など、滞在前に知っておきたい基本情報をご案内します。",
  openGraph: {
    title: "施設情報｜FISEBASE",
    description:
      "民泊『FISEBASE』（大阪市港区・南市岡）の施設情報と連絡先。周辺情報もあわせてご確認ください。",
    url: "https://fish-inc-2021.com/stores",
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
};

export default function StoresPage() {
  return (
    <main className="px-4 py-16">
      {/* 見出し・リード */}
      <section className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-2xl lg:text-3xl font-extrabold mb-4 text-white text-outline">
          FISEBASE ─ 施設情報
        </h1>
        <p className="leading-relaxed text-white text-outline">
          大阪府大阪市港区<span className="whitespace-nowrap">南市岡3-8-26</span> にある
          民泊施設 <strong>FISEBASE</strong> の基本情報をご案内します。
          <br className="hidden lg:block" />
          アクセスや連絡先、周辺エリアの情報は以下からご確認ください。
        </p>
      </section>

      {/* 連絡先（PhoneSection を流用） */}
      <section className="max-w-4xl mx-auto text-center mb-12">
        <PhoneSection />
      </section>

      {/* 施設カード（複数拠点にも対応できるUIのまま） */}
      <StoresClient />
    </main>
  );
}
