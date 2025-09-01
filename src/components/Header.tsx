"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import clsx from "clsx";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { useHeaderLogoUrl } from "../hooks/useHeaderLogoUrl";
import { auth } from "@/lib/firebase";
import { THEMES, ThemeKey } from "@/lib/themes";

const HEADER_H = "3rem";

type MenuItem = {
  href: string;
  label: string; // 日本語
  en: string; // 英語
  external?: boolean;
};

export default function Header({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const gradient = useThemeGradient();
  const logoUrl = useHeaderLogoUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const gradientClass = gradient
    ? `bg-gradient-to-b ${gradient}`
    : "bg-gray-100";

  // ダーク判定（brandH, brandG, brandI）
  const darkKeys: ThemeKey[] = ["brandH", "brandG", "brandI"];
  const currentKey = (Object.entries(THEMES).find(
    ([, v]) => v === gradient
  )?.[0] ?? null) as ThemeKey | null;
  const isDark = currentKey ? darkKeys.includes(currentKey) : false;

  const textColor = isDark ? "text-white" : "text-black";
  const sepColor = isDark ? "bg-white/25" : "bg-black/15"; // ← 区切り線カラー

  const menuItems: MenuItem[] = [
    { href: "/", label: "ホーム", en: "Home" },
    { href: "/products", label: "客室・設備", en: "Rooms & Amenities" },
    {
      href: "/stores",
      label: "施設情報（所在地）",
      en: "Location & Facility Info",
    },
    { href: "/blog", label: "FISEBASEについて", en: "About FISEBASE" },
    { href: "/news", label: "周辺案内・周辺観光", en: "Nearby & Sightseeing" },
    {
      href: "https://www.airbnb.jp/rooms/1330002248659819586?viralityEntryPoint=1&s=76",
      label: "ご予約・お問い合わせ",
      en: "Book / Contact",
      external: true,
    },
  ];

  // 下部固定ブロック
  const adminItems: MenuItem[] = [
    { href: "/postList", label: "タイムライン", en: "Posts (Draft/Publish)" },
    { href: "/analytics", label: "アクセス分析", en: "Analytics" },
    { href: "/login", label: "Administrator Login", en: "Admin Login" },
  ];

  function MenuLink({
    item,
    onClick,
  }: {
    item: MenuItem;
    onClick?: () => void;
  }) {
    const inner = (
      <div className="leading-tight text-center">
        {/* 日本語 */}
        <div className={clsx("text-base md:text-lg font-semibold", textColor)}>
          {item.label}
        </div>
        {/* 英語（モバイルは控えめ） */}
        <div
          className={clsx(
            "mt-0.5 block leading-snug tracking-wide font-medium",
            "text-[11px] md:text-sm",
            isDark ? "text-white/90" : "text-black/80"
          )}
        >
          {item.en}
        </div>
      </div>
    );

    if (item.external) {
      return (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="block px-3 py-1.5 rounded-md hover:opacity-85 transition"
        >
          {inner}
        </a>
      );
    }

    return (
      <Link
        href={item.href}
        onClick={onClick}
        className="block px-3 py-1.5 rounded-md hover:opacity-85 transition"
      >
        {inner}
      </Link>
    );
  }

  return (
    <header
      className={clsx(
        "sticky top-0 z-30 flex items-center justify-between px-4 h-12",
        gradientClass,
        className,
        !isDark && "border-b border-gray-300"
      )}
      style={{ "--header-h": HEADER_H } as React.CSSProperties}
    >
      {/* ロゴ／ブランド */}
      <Link
        href="/"
        className={clsx(
          "text-md font-bold flex items-center gap-2 py-2 hover:opacity-80",
          textColor
        )}
        aria-label="FISEBASE ホーム"
      >
        {logoUrl && logoUrl.trim() !== "" && (
          <Image
            src={logoUrl}
            alt="FISEBASE ロゴ"
            width={48}
            height={48}
            className="w-12 h-12 object-contain transition-opacity duration-200"
            unoptimized
          />
        )}
        FISEBASE
      </Link>

      {/* 右側：クイックリンク（Airbnb） */}
      <nav className="hidden sm:flex items-center gap-3 ml-auto mr-2">
        <a
          href="https://www.airbnb.jp/rooms/1330002248659819586?viralityEntryPoint=1&s=76"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Airbnbで予約する"
          className="inline-flex rounded-md overflow-hidden hover:opacity-80 transition"
        >
          <Image
            src="/airbnb.png"
            alt="Airbnbで予約する"
            width={96}
            height={28}
            className="h-7 w-auto object-contain rounded-md"
            unoptimized
          />
        </a>
      </nav>

      {/* ハンバーガーメニュー */}
      <div className="sm:ml-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={clsx(
                "w-7 h-7 border-2",
                isDark ? "text-white border-white" : "text-black border-black"
              )}
              aria-label="メニューを開く"
            >
              <Menu size={26} />
            </Button>
          </SheetTrigger>

          {/* 縦いっぱい＋上下2段構成 */}
          <SheetContent
            side="right"
            className={clsx(
              "flex h-[100dvh] max-h-[100dvh] flex-col p-0",
              "bg-gray-100",
              gradient && "bg-gradient-to-b",
              gradient
            )}
          >
            {/* ヘッダー */}
            <SheetHeader className="px-4 pt-4 pb-2">
              <SheetTitle
                className={clsx(
                  "text-center text-lg md:text-xl leading-tight",
                  textColor
                )}
              >
                メニュー
              </SheetTitle>
              <p
                className={clsx(
                  "mt-0.5 text-center tracking-wide font-medium",
                  "text-sm md:text-base",
                  isDark ? "text-white/85" : "text-black/75"
                )}
                aria-hidden="true"
              >
                Menu
              </p>
            </SheetHeader>

            {/* ▼ タイトル直下の区切り線（常に表示） */}
            <div className={clsx("h-px mx-4", sepColor)} />

            {/* 上段：通常メニュー（スクロール領域） */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="flex flex-col items-center text-center space-y-2 md:space-y-3 px-2 py-2">
                {menuItems.map((item) => (
                  <MenuLink
                    key={item.href}
                    item={item}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </div>
            </div>

            {/* 下段：固定ブロック */}
            <div className="shrink-0 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] bg-black/0">
              <div className="flex flex-col items-center text-center space-y-2 md:space-y-3">
                {isLoggedIn && (
                  <>
                    <MenuLink
                      item={adminItems[0]} // タイムライン
                      onClick={() => setOpen(false)}
                    />
                    <MenuLink
                      item={adminItems[1]} // アクセス分析
                      onClick={() => setOpen(false)}
                    />
                  </>
                )}

                {/* ログインは常に表示 */}
                <MenuLink
                  item={adminItems[2]} // Admin Login
                  onClick={() => setOpen(false)}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
