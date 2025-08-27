"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  startAfter,
  limit,
  Timestamp,
  QueryDocumentSnapshot,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import CardSpinner from "./CardSpinner";
import MediaWithSpinner from "./MediaWithSpinner";
import Image from "next/image";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";

/* ---------- 型 ---------- */
interface NewsItem {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

/* ---------- 定数 ---------- */
const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/mpeg",
  "video/3gpp",
  "video/3gpp2",
];
const MAX_VIDEO_SEC = 30;
const STORAGE_PATH = "siteNews/fishInc2021/items";

const FIRST_LOAD = 20; // 初回
const PAGE_SIZE = 20; // 追加ロード

const DARK_KEYS: ThemeKey[] = ["brandG", "brandH", "brandI"];

/* =========================================================
      ここからコンポーネント本体
========================================================= */
export default function NewsClient() {
  const gradient = useThemeGradient();
  const isDark = useMemo(
    () => !!gradient && DARK_KEYS.some((k) => THEMES[k] === gradient),
    [gradient]
  );

  /* ---------- state ---------- */
  const [items, setItems] = useState<NewsItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  /* モーダル入力 */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  /* メディア入力 */
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  /* 進捗・アップロード */
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadTask, setUploadTask] = useState<ReturnType<
    typeof uploadBytesResumable
  > | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ページネーション */
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isFetchingMore = useRef(false);

  /* エラー表示 */
  const [alertVisible, setAlertVisible] = useState(false);

  /* AI生成 */
  const [showAIModal, setShowAIModal] = useState(false);
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [aiLoading, setAiLoading] = useState(false);
  const nonEmptyKeywords = keywords.filter(Boolean);

  /* ---------- Firestore 参照 ---------- */
  const SITE_KEY = "fishInc2021";
  const colRef = useMemo(
    () => collection(db, "siteNews", SITE_KEY, "items"),
    []
  );

  /* ---------- 初期フェッチ & 認証 ---------- */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (isFetchingMore.current) return; // 二重実行防止
    isFetchingMore.current = true;

    const firstQuery = query(
      colRef,
      orderBy("createdAt", "desc"),
      limit(FIRST_LOAD)
    );

    // ------- 🔴 onSnapshot で購読を開始 -------
    const unsub = onSnapshot(firstQuery, (snap) => {
      const firstPage: NewsItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<NewsItem, "id">),
      }));

      setItems(firstPage);
      setLastDoc(snap.docs.at(-1) ?? null);
      setHasMore(snap.docs.length === FIRST_LOAD);
      isFetchingMore.current = false;
    });

    // アンマウント時にリスナー解除
    return () => unsub();
  }, [colRef]);

  const fetchNextPage = useCallback(async () => {
    if (isFetchingMore.current || !hasMore || !lastDoc) return;
    isFetchingMore.current = true;

    const nextQuery = query(
      colRef,
      orderBy("createdAt", "desc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(nextQuery);

    const nextPage: NewsItem[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<NewsItem, "id">),
    }));

    setItems((prev) => [...prev, ...nextPage]);
    setLastDoc(snap.docs.at(-1) ?? null);
    setHasMore(snap.docs.length === PAGE_SIZE);
    isFetchingMore.current = false;
  }, [colRef, lastDoc, hasMore]);

  /* ---------- 無限スクロール ---------- */
  useEffect(() => {
    const onScroll = () => {
      if (
        hasMore &&
        !uploading &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 150
      ) {
        fetchNextPage();
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, hasMore, uploading]);

  /* =====================================================
      メディア選択 & プレビュー
  ===================================================== */
  /* ➊ プレビュー用 URL をこの関数内で 1 回だけ発行 */
  const handleSelectFile = (file: File) => {
    const isImage = ALLOWED_IMG.includes(file.type);
    const isVideo = ALLOWED_VIDEO.includes(file.type);

    if (!isImage && !isVideo) {
      alert("対応していない形式です");
      return;
    }

    /* ---- 動画の場合：長さチェック ---- */
    if (isVideo) {
      const video = document.createElement("video");
      const blobURL = URL.createObjectURL(file);

      video.preload = "metadata";
      video.src = blobURL;

      video.onloadedmetadata = () => {
        if (video.duration > MAX_VIDEO_SEC) {
          alert("動画は30秒以内にしてください");
          URL.revokeObjectURL(blobURL); // チェックだけで使わないので即解放
          return;
        }
        setDraftFile(file);
        setPreviewURL(blobURL); // ※ここでは revoke しない
      };

      return;
    }

    /* ---- 画像の場合 ---- */
    const blobURL = URL.createObjectURL(file);
    setDraftFile(file);
    setPreviewURL(blobURL); // ※ここでも revoke しない
  };

  /* =====================================================
      追加 / 更新
  ===================================================== */
  const openAdd = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setDraftFile(null);
    setPreviewURL(null);
    setModalOpen(true);
  };
  const openEdit = (n: NewsItem) => {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setDraftFile(null);
    setPreviewURL(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitle("");
    setBody("");
    setDraftFile(null);
    setPreviewURL(null);
    setAlertVisible(false);
    setKeywords(["", "", ""]);
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !title.trim() || !body.trim()) {
      setAlertVisible(true);
      return;
    }

    setUploading(true);
    try {
      const payload: Partial<NewsItem> = {
        title,
        body,
        ...(editingId
          ? { updatedAt: Timestamp.now() }
          : { createdAt: Timestamp.now(), createdBy: user.uid }),
      };

      /* メディアアップロード */
      if (draftFile) {
        const sRef = ref(
          getStorage(),
          `${STORAGE_PATH}/${Date.now()}_${draftFile.name}`
        );
        const task = uploadBytesResumable(sRef, draftFile);
        setUploadTask(task);
        setUploadPct(0);

        task.on("state_changed", (s) =>
          setUploadPct(Math.round((s.bytesTransferred / s.totalBytes) * 100))
        );

        const url = await new Promise<string>((res, rej) =>
          task.on("state_changed", undefined, rej, async () =>
            res(await getDownloadURL(task.snapshot.ref))
          )
        );

        Object.assign(payload, {
          mediaUrl: url,
          mediaType: ALLOWED_VIDEO.includes(draftFile.type) ? "video" : "image",
        });
      }

      if (editingId) {
        await updateDoc(doc(colRef, editingId), payload);
      } else {
        await addDoc(colRef, payload as Omit<NewsItem, "id">);
      }

      closeModal();
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
    } finally {
      setUploading(false);
      setUploadPct(null);
      setUploadTask(null);
    }
  }, [title, body, draftFile, editingId, user, colRef]);

  /* =====================================================
      削除
  ===================================================== */
  const handleDelete = useCallback(
    async (n: NewsItem) => {
      if (!user || !confirm("本当に削除しますか？")) return;
      await deleteDoc(doc(colRef, n.id));
      if (n.mediaUrl)
        try {
          await deleteObject(ref(getStorage(), n.mediaUrl));
        } catch {}
      setItems((prev) => prev.filter((m) => m.id !== n.id));
    },
    [user, colRef]
  );

  /* =====================================================
      レンダリング
  ===================================================== */

  if (!gradient) return <CardSpinner />;

  return (
    <div>
      {/* ===== アップロードモーダル ===== */}
      {uploadPct !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="relative z-10 w-2/3 max-w-xs bg-white/90 rounded-xl shadow-xl p-4">
            <p className="text-center text-sm font-medium text-gray-800 mb-2">
              アップロード中… {uploadPct}%
            </p>
            <div className="w-full h-3 bg-gray-200 rounded">
              <div
                className="h-full bg-green-500 rounded transition-all duration-150"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
            {uploadTask?.snapshot.state === "running" && (
              <button
                type="button"
                onClick={() => uploadTask.cancel()}
                className="block mx-auto mt-3 text-xs text-red-600 hover:underline"
              >
                キャンセル
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== 一覧 ===== */}
      <ul className="space-y-4 p-4">
        {items.length === 0 ? (
          <li
            className={`p-6 rounded-lg shadow border ${
              isDark
                ? "bg-gray-800 text-white border-gray-700"
                : "bg-white text-gray-900 border-gray-200"
            }`}
          >
            現在、お知らせはまだありません。
          </li>
        ) : (
          <AnimatePresence /* 退場アニメ不要なら削除可 */ initial={false}>
            {items.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                user={user}
                openEdit={openEdit}
                handleDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        )}
      </ul>

      {/* ===== FAB ===== */}
      {user && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {/* ===== 追加 / 編集モーダル ===== */}
      {modalOpen && (
        // ▼ ① 画面全体を縦スクロールできるように overflow-y-auto を追加
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          {/* ▼ ② モーダル本体にも最大高さを指定し、中だけスクロールできるように */}
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md space-y-4 my-8
                max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-center">
              {editingId ? "お知らせを編集" : "お知らせを追加"}
            </h3>

            {/* ---------- 入力欄 ---------- */}
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full border px-3 py-2 rounded h-40"
              placeholder="本文"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            {/* ---------- メディア選択 ---------- */}
            <div className="space-y-1">
              <label className="font-medium">画像 / 動画 (30秒以内)</label>

              {previewURL && (
                <p className="text-xs text-gray-600 truncate">
                  選択中: {draftFile?.name}
                </p>
              )}

              <input
                type="file"
                accept={[...ALLOWED_IMG, ...ALLOWED_VIDEO].join(",")}
                onChange={(e) =>
                  e.target.files?.[0] && handleSelectFile(e.target.files[0])
                }
              />

              {previewURL &&
                (ALLOWED_VIDEO.includes(draftFile!.type) ? (
                  <video
                    src={previewURL}
                    className="w-full mt-2 rounded"
                    controls
                  />
                ) : (
                  <div className="relative w-full mt-2 rounded overflow-hidden">
                    <Image
                      src={previewURL} // blob: URL そのまま
                      alt="preview"
                      fill // width/height の代わり
                      sizes="100vw"
                      className="object-cover"
                      unoptimized /* ★ 最適化を無効化する */
                    />
                  </div>
                ))}
            </div>

            {/* ---------- AI 生成ボタン ---------- */}
            <button
              onClick={() => {
                if (!title.trim()) {
                  alert("タイトルを入力してください。");
                  return;
                }
                setShowAIModal(true); // モーダルを開く
              }}
              className="bg-purple-600 text-white w-full py-2 rounded"
            >
              AIで本文作成
            </button>

            {/* ---------- バリデーションエラー ---------- */}
            {alertVisible && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>入力エラー</AlertTitle>
                <AlertDescription>
                  タイトルと本文を両方入力してください。
                </AlertDescription>
              </Alert>
            )}

            {/* ---------- 送信 / キャンセル ---------- */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {editingId ? "更新" : "追加"}
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI モーダル ===== */}
      {showAIModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-center">AIで本文を生成</h3>

            <p className="text-sm text-gray-600">最低 1 つ以上入力</p>
            <div className="flex flex-col gap-2">
              {keywords.map((w, i) => (
                <input
                  key={i}
                  type="text"
                  className="border rounded px-2 py-1"
                  placeholder={`キーワード${i + 1}`}
                  value={w}
                  onChange={(e) => {
                    const next = [...keywords];
                    next[i] = e.target.value;
                    setKeywords(next);
                  }}
                />
              ))}
            </div>

            {nonEmptyKeywords.length > 0 && (
              <p className="text-xs text-gray-500">
                送信キーワード：
                <span className="font-medium">
                  {nonEmptyKeywords.join(" / ")}
                </span>
              </p>
            )}

            <button
              disabled={
                !title.trim() || nonEmptyKeywords.length === 0 || aiLoading
              }
              onClick={async () => {
                setAiLoading(true);
                try {
                  const res = await fetch("/api/generate-news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, keywords: nonEmptyKeywords }),
                  });
                  const data = await res.json();
                  setBody(data.text);
                  setShowAIModal(false);
                } catch {
                  alert("AI 生成に失敗しました");
                } finally {
                  setAiLoading(false);
                  setKeywords(["", "", ""]);
                }
              }}
              className="w-full py-2 rounded text-white bg-indigo-600 disabled:opacity-50"
            >
              {aiLoading ? "生成中…" : "本文を作成"}
            </button>

            <button
              onClick={() => {
                setShowAIModal(false);
                setKeywords(["", "", ""]);
              }}
              className="w-full py-2 rounded bg-gray-300"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== ◆ ②：カード用サブコンポーネント（ファイル末尾に追加）=== */
import { AnimatePresence, motion, useInView } from "framer-motion";

interface NewsCardProps {
  item: NewsItem;
  user: User | null;
  openEdit: (n: NewsItem) => void;
  handleDelete: (n: NewsItem) => void;
}

function NewsCard({ item, user, openEdit, handleDelete }: NewsCardProps) {
  /* ―― in-view 判定 ――――――――――――――――――― */
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -150px 0px" });

  const itemVariants = {
    hidden: { opacity: 0, y: 32, scale: 0.94 },

    /* 画面内に入ったとき */
    visible: {
      opacity: 1,
      y: [-8, 4, 0], // ① ちょい上へ → 下へ戻ってピタッ
      scale: [0.94, 1.02, 1], // ② 同時にスケールも弾ませる
      transition: {
        opacity: { duration: 0.25 }, // フェードは素早く
        y: {
          type: "spring",
          stiffness: 420, // バネの強さ
          damping: 24, // 揺れの収束速度
          mass: 0.5,
        },
        scale: {
          type: "spring",
          stiffness: 480,
          damping: 32,
          mass: 0.5,
        },
        delay: 0.05, // 少しだけ遅らせてフェードとズラす
      },
    },
  };

  return (
    <motion.li
      ref={ref}
      variants={itemVariants}
      /* 初回表示アニメ */
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      /* 削除時アニメ（任意）*/
      exit={{ opacity: 0, y: 40 }}
      /* カードの見た目 */
      className="bg-white/50 p-6 rounded-lg shadow"
    >
      <h2 className="font-bold">{item.title}</h2>

      {/* メディア（画像 / 動画） */}
      {item.mediaUrl && (
        <MediaWithSpinner
          src={item.mediaUrl}
          type={item.mediaType!}
          className={
            item.mediaType === "image"
              ? "w-full max-h-80 object-cover mt-3 rounded"
              : "w-full mt-3 rounded"
          }
          autoPlay={item.mediaType === "video"}
          loop={item.mediaType === "video"}
          muted={item.mediaType === "video"}
        />
      )}

      <p className="mt-2 whitespace-pre-wrap">{item.body}</p>

      {/* 編集・削除ボタン（ログイン時のみ） */}
      {user && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => openEdit(item)}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            編集
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            削除
          </button>
        </div>
      )}
    </motion.li>
  );
}
