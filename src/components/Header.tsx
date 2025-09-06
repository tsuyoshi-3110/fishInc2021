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
          isDark ? "text-white" : "text-black"
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

      {/* 右側：クイックリンク（お問い合わせ／アクセス） */}
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

          <SheetContent
            side="right"
            className={clsx(
              "flex flex-col",
              "bg-gray-100",
              gradient && "bg-gradient-to-b",
              gradient
            )}
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle
                className={clsx(
                  "text-center text-xl",
                  isDark ? "text-white" : "text-black"
                )}
              >
                メニュー
              </SheetTitle>
            </SheetHeader>

            {/* 民泊サイト向けメニュー構成 */}
            <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
              {[
                { href: "/", label: "ホーム" },
                { href: "/products", label: "客室・設備" },
                { href: "/stores", label: "施設情報（所在地）" },
                { href: "/blog", label: "FISEBASEについて" },
                { href: "/news", label: "周辺案内・周辺観光" }, // 使わない場合は削除OK
                { href: "https://www.airbnb.jp/rooms/1330002248659819586?viralityEntryPoint=1&s=76", label: "ご予約・お問い合わせ" }, // 使わない場合は削除OK

              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "text-lg hover:opacity-80",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* 管理者向け（ログイン時のみ表示） */}
            <div className="p-4 space-y-4">
              {isLoggedIn && (
                <>
                  <Link
                    href="/postList"
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "block text-center text-lg hover:opacity-80",
                      isDark ? "text-white" : "text-black"
                    )}
                  >
                    投稿管理（下書き/公開）
                  </Link>
                  <Link
                    href="/analytics"
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "block text-center text-lg hover:opacity-80",
                      isDark ? "text-white" : "text-black"
                    )}
                  >
                    アクセス分析
                  </Link>
                </>
              )}

              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={clsx(
                  "block text-center text-lg hover:opacity-80",
                  isDark ? "text-white" : "text-black"
                )}
              >
                Administrator Login
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
