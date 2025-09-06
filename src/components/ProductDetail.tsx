"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";

import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { ThemeKey, THEMES } from "@/lib/themes";
import { type Product } from "@/types/Product";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { motion } from "framer-motion";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

type MediaType = "image" | "video";

// 依存の安定化のため、コンポーネント外に定義
const LANGS = [
  { key: "en", label: "英語", emoji: "🇺🇸" },
  { key: "zh", label: "中国語(簡体)", emoji: "🇨🇳" },
  { key: "zh-TW", label: "中国語(繁体)", emoji: "🇹🇼" },
  { key: "ko", label: "韓国語", emoji: "🇰🇷" },
  { key: "fr", label: "フランス語", emoji: "🇫🇷" },
  { key: "es", label: "スペイン語", emoji: "🇪🇸" },
  { key: "de", label: "ドイツ語", emoji: "🇩🇪" },
  { key: "pt", label: "ポルトガル語", emoji: "🇵🇹" },
  { key: "it", label: "イタリア語", emoji: "🇮🇹" },
  { key: "ru", label: "ロシア語", emoji: "🇷🇺" },
  { key: "th", label: "タイ語", emoji: "🇹🇭" },
  { key: "vi", label: "ベトナム語", emoji: "🇻🇳" },
  { key: "id", label: "インドネシア語", emoji: "🇮🇩" },
  { key: "hi", label: "ヒンディー語", emoji: "🇮🇳" },
  { key: "ar", label: "アラビア語", emoji: "🇸🇦" },
] as const;

export default function ProductDetail({ product }: { product: Product }) {
  /* ---------- 権限・テーマ ---------- */
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [langQuery, setLangQuery] = useState("");
  const filteredLangs = useMemo(() => {
    if (!langQuery.trim()) return LANGS;
    const q = langQuery.trim().toLowerCase();
    return LANGS.filter(
      (l) =>
        l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q)
    );
  }, [langQuery]);

  const gradient = useThemeGradient();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsAdmin(!!u));
    return () => unsub();
  }, []);

  const isDark = useMemo(() => {
    const darks: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return gradient && darks.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  /* ---------- 表示用データ ---------- */
  const [displayProduct, setDisplayProduct] = useState<Product>(product);

  /* ---------- 編集モーダル用 state ---------- */
  const [showEdit, setShowEdit] = useState(false);
  const [title, setTitle] = useState(product.title);
  const [body, setBody] = useState(product.body);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  /* ---------- 本文AI生成モーダル state ---------- */
  const [showBodyGen, setShowBodyGen] = useState(false);
  const [aiKeywords, setAiKeywords] = useState<string[]>(["", "", ""]);
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const canOpenBodyGen = Boolean(title?.trim());
  const canGenerateBody = aiKeywords.some((k) => k.trim().length > 0);

  /* ---------- 多国語：翻訳→追記 ---------- */
  const translateAndAppend = async (langKey: (typeof LANGS)[number]["key"]) => {
    if (!title?.trim() || !body?.trim()) return;
    try {
      setTranslating(true);
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, target: langKey }),
      });
      if (!res.ok) throw new Error("翻訳APIエラー");
      const data = (await res.json()) as { title: string; body: string };

      // ✅ タイトルは改行で追記
      setTitle((prev) => `${prev}\n${data.title}`);
      // ✅ 本文は節として追記
      setBody((prev) => `${prev}\n\n${data.body}`);

      setShowLangPicker(false);
    } catch (e) {
      console.error(e);
      alert("翻訳に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setTranslating(false);
    }
  };

  /* ---------- 本文AI生成（/api/generate-description） ---------- */
  const generateBodyWithAI = async () => {
    if (!title.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    try {
      setAiGenLoading(true);
      const keywords = aiKeywords.filter((k) => k.trim() !== "");
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, keywords }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "生成に失敗しました");
      }
      const newBody = (data?.body ?? "").trim();
      if (!newBody) {
        alert("AIから有効な本文が返りませんでした。キーワードを見直してください。");
        return;
      }
      setBody(newBody);
      setShowBodyGen(false);
      setAiKeywords(["", "", ""]);
    } catch (e) {
      console.error(e);
      alert("本文生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setAiGenLoading(false);
    }
  };

  /* ---------- 保存 ---------- */
  const handleSave = async () => {
    if (!title.trim()) return alert("タイトル必須");

    try {
      let mediaURL = displayProduct.mediaURL;
      let mediaType: MediaType = displayProduct.mediaType;

      // メディア差し替え時のみアップロード
      if (file) {
        const isVideo = file.type.startsWith("video/");
        mediaType = isVideo ? "video" : "image";

        const isValidImage =
          file.type === "image/jpeg" || file.type === "image/png";
        const isValidVideo =
          file.type === "video/mp4" || file.type === "video/quicktime";
        if (!isValidImage && !isValidVideo)
          return alert("対応形式：JPEG/PNG/MP4/MOV");

        if (isVideo && file.size > 100 * 1024 * 1024)
          return alert("動画は 100 MB 未満にしてください");

        const ext = isVideo
          ? file.type === "video/quicktime"
            ? "mov"
            : "mp4"
          : "jpg";

        const uploadFile = isVideo
          ? file
          : await imageCompression(file, {
              maxWidthOrHeight: 1200,
              maxSizeMB: 0.7,
              useWebWorker: true,
              fileType: "image/jpeg",
              initialQuality: 0.8,
            });

        const storageRef = ref(
          getStorage(),
          `products/public/${SITE_KEY}/${product.id}.${ext}`
        );
        const task = uploadBytesResumable(storageRef, uploadFile, {
          contentType: isVideo ? file.type : "image/jpeg",
        });

        setProgress(0);
        task.on("state_changed", (s) =>
          setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100))
        );
        await task;

        mediaURL = `${await getDownloadURL(storageRef)}?v=${uuid()}`;
        setProgress(null);
      }

      // Firestore 更新
      await updateDoc(doc(db, "siteProducts", SITE_KEY, "items", product.id), {
        title,
        body,
        mediaURL,
        mediaType,
        updatedAt: serverTimestamp(),
      });

      // ローカル表示も即更新
      setDisplayProduct((prev) => ({
        ...prev,
        title,
        body,
        mediaURL,
        mediaType,
      }));

      setShowEdit(false);
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
      setProgress(null);
    }
  };

  /* ---------- 削除 ---------- */
  const handleDelete = async () => {
    if (!confirm(`「${displayProduct.title}」を削除しますか？`)) return;

    const storage = getStorage();

    // 1) Firestore ドキュメントを先に削除
    await deleteDoc(
      doc(db, "siteProducts", SITE_KEY, "items", product.id)
    ).catch(() => {});

    // 2) 元メディア（存在するものだけ）削除
    try {
      const folderRef = ref(storage, `products/public/${SITE_KEY}`);
      const listing = await listAll(folderRef);
      const mine = listing.items.filter((i) =>
        i.name.startsWith(`${product.id}.`)
      );
      await Promise.all(mine.map((item) => deleteObject(item).catch(() => {})));
    } catch {
      /* 無視 */
    }

    // 3) HLS 配下（もしあれば）再帰削除
    try {
      const walkAndDelete = async (dirRef: ReturnType<typeof ref>) => {
        const ls = await listAll(dirRef);
        await Promise.all(ls.items.map((i) => deleteObject(i).catch(() => {})));
        await Promise.all(ls.prefixes.map((p) => walkAndDelete(p)));
      };
      const hlsDirRef = ref(
        storage,
        `products/public/${SITE_KEY}/hls/${product.id}`
      );
      await walkAndDelete(hlsDirRef);
    } catch {
      /* 無視 */
    }

    // 4) 戻る
    router.back();
  };

  /* ---------- JSX ---------- */
  return (
    <main className="min-h-screen flex items-start justify-center p-4 pt-24">
      {/* カード外枠 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className={clsx(
          "border rounded-lg overflow-hidden shadow-xl relative transition-colors duration-200",
          "w-full max-w-md",
          "bg-gradient-to-b",
          "mt-5",
          gradient,
          isDark ? "bg-black/40 text-white" : "bg-white"
        )}
      >
        {/* 編集・削除 */}
        {isAdmin && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <button
              onClick={() => setShowEdit(true)}
              className="px-2 py-1 bg-blue-600 text-white text-md rounded shadow disabled:opacity-50"
            >
              編集
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 bg-red-600 text-white text-md rounded shadow disabled:opacity-50"
            >
              削除
            </button>
          </div>
        )}

        {/* メディア */}
        {displayProduct.mediaType === "image" ? (
          <div className="relative w-full aspect-square">
            <Image
              src={displayProduct.mediaURL}
              alt={displayProduct.title}
              fill
              className="object-cover"
              sizes="100vw"
              unoptimized
            />
          </div>
        ) : (
          <video
            src={displayProduct.mediaURL}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            className="w-full aspect-square object-cover"
          />
        )}

        {/* テキスト */}
        <div className="p-4 space-y-2">
          {/* ✅ 改行表示 */}
          <h1
            className={clsx(
              "text-lg font-bold whitespace-pre-wrap",
              isDark && "text-white"
            )}
          >
            {displayProduct.title}
          </h1>

          {displayProduct.body && (
            <p
              className={clsx(
                "text-sm whitespace-pre-wrap leading-relaxed",
                isDark && "text-white"
              )}
            >
              {displayProduct.body}
            </p>
          )}
        </div>
      </motion.div>

      {/* ---------- 編集モーダル ---------- */}
      {isAdmin && showEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">商品を編集</h2>

            {/* ✅ タイトル（改行可にしたい場合は textarea に変更可） */}
            <input
              placeholder="商品名（改行可）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />

            <textarea
              placeholder="紹介文"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={4}
              disabled={uploading}
            />

            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
              disabled={uploading}
            />

            {/* ✅ AIで本文生成（タイトルがあると有効） */}
            <button
              type="button"
              onClick={() => setShowBodyGen(true)}
              className={clsx(
                "w-full mt-2 px-4 py-2 rounded text-white",
                canOpenBodyGen
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-400 cursor-not-allowed"
              )}
              disabled={!canOpenBodyGen || uploading}
            >
              AIで本文生成
            </button>

            {/* AIで多国語対応（既存） */}
            {Boolean(title?.trim()) && Boolean(body?.trim()) && (
              <button
                type="button"
                onClick={() => setShowLangPicker(true)}
                className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                disabled={uploading || translating}
              >
                AIで多国語対応
              </button>
            )}

            {/* ===== 本文生成モーダル ===== */}
            {showBodyGen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
                onClick={() => !aiGenLoading && setShowBodyGen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="w-full max-w-md mx-4 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="rounded-2xl bg-white/90 backdrop-saturate-150 border border-white/50">
                    <div className="p-5 border-b border-black/5">
                      <h3 className="text-lg font-bold">AIで本文生成</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        キーワードを1〜3個入力（1つ以上で生成可能）
                      </p>
                    </div>

                    <div className="p-5 space-y-2">
                      <input
                        type="text"
                        value={aiKeywords[0]}
                        onChange={(e) =>
                          setAiKeywords([e.target.value, aiKeywords[1], aiKeywords[2]])
                        }
                        placeholder="キーワード①"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={aiKeywords[1]}
                        onChange={(e) =>
                          setAiKeywords([aiKeywords[0], e.target.value, aiKeywords[2]])
                        }
                        placeholder="キーワード②（任意）"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={aiKeywords[2]}
                        onChange={(e) =>
                          setAiKeywords([aiKeywords[0], aiKeywords[1], e.target.value])
                        }
                        placeholder="キーワード③（任意）"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="px-5 pb-5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBodyGen(false)}
                        className="flex-1 rounded-lg px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                        disabled={aiGenLoading}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={generateBodyWithAI}
                        className={clsx(
                          "flex-1 rounded-lg px-4 py-2 text-white",
                          canGenerateBody
                            ? "bg-indigo-600 hover:bg-indigo-700"
                            : "bg-gray-400 cursor-not-allowed"
                        )}
                        disabled={!canGenerateBody || aiGenLoading}
                      >
                        {aiGenLoading ? "生成中…" : "生成する"}
                      </button>
                    </div>

                    {aiGenLoading && (
                      <div className="h-1 w-full overflow-hidden rounded-b-2xl">
                        <div className="h-full w-1/2 animate-[progress_1.2s_ease-in-out_infinite] bg-indigo-500" />
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}

            {/* ===== 言語ピッカー（既存） ===== */}
            {showLangPicker && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
                onClick={() => !translating && setShowLangPicker(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* ガラス風カード */}
                  <div className="rounded-2xl bg-white/90 backdrop-saturate-150 border border-white/50">
                    <div className="p-5 border-b border-black/5 flex items-center justify-between">
                      <h3 className="text-lg font-bold">言語を選択</h3>
                      <button
                        type="button"
                        onClick={() => setShowLangPicker(false)}
                        className="text-sm text-gray-500 hover:text-gray-800"
                        disabled={translating}
                      >
                        閉じる
                      </button>
                    </div>

                    {/* 検索 */}
                    <div className="px-5 pt-4">
                      <input
                        type="text"
                        value={langQuery}
                        onChange={(e) => setLangQuery(e.target.value)}
                        placeholder="言語名やコードで検索（例: フランス語 / fr）"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* グリッド */}
                    <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredLangs.map((lng) => (
                        <button
                          key={lng.key}
                          type="button"
                          onClick={() => translateAndAppend(lng.key)}
                          disabled={translating}
                          className={clsx(
                            "group relative rounded-xl border p-3 text-left transition",
                            "bg-white hover:shadow-lg hover:-translate-y-0.5",
                            "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                            "disabled:opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{lng.emoji}</span>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">
                                {lng.label}
                              </div>
                              <div className="text-xs text-gray-500">
                                /{lng.key}
                              </div>
                            </div>
                          </div>
                          {/* 右上のアクセント */}
                          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      ))}
                      {filteredLangs.length === 0 && (
                        <div className="col-span-full text-center text-sm text-gray-500 py-6">
                          一致する言語が見つかりません
                        </div>
                      )}
                    </div>

                    {/* フッター */}
                    <div className="px-5 pb-5">
                      <button
                        type="button"
                        onClick={() => setShowLangPicker(false)}
                        className="w-full rounded-lg px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700"
                        disabled={translating}
                      >
                        キャンセル
                      </button>
                    </div>

                    {/* ローディングバー（翻訳中のわかりやすい表示） */}
                    {translating && (
                      <div className="h-1 w-full overflow-hidden rounded-b-2xl">
                        <div className="h-full w-1/2 animate-[progress_1.2s_ease-in-out_infinite] bg-indigo-500" />
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}

            {uploading && (
              <div className="w-full flex flex-col items-center gap-2">
                <p>アップロード中… {progress}%</p>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSave}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                更新
              </button>
              <button
                onClick={() => !uploading && setShowEdit(false)}
                disabled={uploading}
                className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
