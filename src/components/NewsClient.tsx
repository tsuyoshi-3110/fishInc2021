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
  orderBy,
  query,
  limit,
  Timestamp,
  onSnapshot,
} from "firebase/firestore"; // ★ getDocs/startAfter/QueryDocumentSnapshot は不要
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
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";
import { Upload, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { AnimatePresence, motion, useInView } from "framer-motion";

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

const FIRST_LOAD = 20;
const PAGE_SIZE = 20;

const DARK_KEYS: ThemeKey[] = ["brandG", "brandH", "brandI"];

/* ========================================================= */
export default function NewsClient() {
  const gradient = useThemeGradient();
  const isDark = useMemo(
    () => !!gradient && DARK_KEYS.some((k) => THEMES[k] === gradient),
    [gradient]
  );

  /* ---------- state ---------- */
  const [items, setItems] = useState<NewsItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [, setPreviewURL] = useState<string | null>(null);

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadTask, setUploadTask] = useState<ReturnType<
    typeof uploadBytesResumable
  > | null>(null);
  const [uploading, setUploading] = useState(false);

  // ★ 旧: lastDoc/hasMore/isFetchingMore を廃止
  //    新: 表示件数 limit を段階的に増やす
  const [pageLimit, setPageLimit] = useState(FIRST_LOAD);
  const [hasMore, setHasMore] = useState(true);

  const [alertVisible, setAlertVisible] = useState(false);

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

  /* ---------- 認証 ---------- */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  /* ---------- ★ リアルタイム購読 + 疑似ページング（limit を増やす） ---------- */
  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    // 既存リスナーがあれば解除
    if (unsubRef.current) unsubRef.current();

    // “pageLimit+1” で1件多く取得し、まだ続きを取れるか判定
    const q = query(colRef, orderBy("createdAt", "desc"), limit(pageLimit + 1));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs;
      setHasMore(docs.length > pageLimit);
      const slice = docs.slice(0, pageLimit);

      const next: NewsItem[] = slice.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<NewsItem, "id">),
      }));

      setItems(next);
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [colRef, pageLimit]);

  /* ---------- 次ページ（= 表示件数を増やす） ---------- */
  const fetchNextPage = useCallback(() => {
    if (!hasMore || uploading) return;
    setPageLimit((n) => n + PAGE_SIZE);
  }, [hasMore, uploading]);

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
  const handleSelectFile = (file: File) => {
    const isImage = ALLOWED_IMG.includes(file.type);
    const isVideo = ALLOWED_VIDEO.includes(file.type);

    if (!isImage && !isVideo) {
      alert("対応していない形式です");
      return;
    }

    // 動画は長さチェックのみ（プレビューはしない）
    if (isVideo) {
      const video = document.createElement("video");
      const blobURL = URL.createObjectURL(file);
      video.preload = "metadata";
      video.src = blobURL;

      video.onloadedmetadata = () => {
        const over = video.duration > MAX_VIDEO_SEC;
        URL.revokeObjectURL(blobURL); // 使い終わったら解放（プレビューしない）

        if (over) {
          alert("動画は30秒以内にしてください");
          return;
        }
        setDraftFile(file); // ← これだけでOK
        // setPreviewURL は使わない
      };
      return;
    }

    // 画像はそのまま保持（プレビューしない）
    setDraftFile(file);
    // setPreviewURL は使わない
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

      // アップロード
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
      // ★ onSnapshot が反映してくれるが、体感を良くするために即時反映
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
          <AnimatePresence initial={false}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md space-y-4 my-8
              max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-center">
              {editingId ? "お知らせを編集" : "お知らせを追加"}
            </h3>

            {/* 入力欄 */}
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

            {/* メディア選択（プレビューなし／ファイル名のみ表示） */}
            <div className="space-y-1">
              <label className="font-medium">画像 / 動画 (30秒以内)</label>

              {draftFile && (
                <p className="text-xs text-gray-600 flex items-center gap-1 truncate">
                  {ALLOWED_VIDEO.includes(draftFile.type) ? (
                    <VideoIcon className="h-3.5 w-3.5" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  選択中: <span className="truncate">{draftFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      // 選択解除
                      setDraftFile(null);
                      const input = document.getElementById(
                        "media-upload"
                      ) as HTMLInputElement | null;
                      if (input) input.value = "";
                    }}
                    className="ml-2 text-xs text-gray-500 underline"
                  >
                    クリア
                  </button>
                </p>
              )}

              <div className="flex items-center gap-3">
                <input
                  id="media-upload"
                  type="file"
                  className="sr-only"
                  accept={[...ALLOWED_IMG, ...ALLOWED_VIDEO].join(",")}
                  onChange={(e) =>
                    e.target.files?.[0] && handleSelectFile(e.target.files[0])
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("media-upload")?.click()
                  }
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm
               bg-white hover:bg-gray-50 border-gray-300 text-gray-900"
                >
                  <Upload className="h-4 w-4" />
                  ファイルを選択
                </button>

                {!draftFile && (
                  <span className="text-xs text-gray-500">
                    30秒以内 / 画像・動画に対応（プレビューは表示しません）
                  </span>
                )}
              </div>
            </div>

            {/* AI 生成 */}
            <button
              onClick={() => {
                if (!title.trim()) {
                  alert("タイトルを入力してください。");
                  return;
                }
                setShowAIModal(true);
              }}
              className="bg-purple-600 text-white w-full py-2 rounded"
            >
              AIで本文作成
            </button>

            {alertVisible && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>入力エラー</AlertTitle>
                <AlertDescription>
                  タイトルと本文を両方入力してください。
                </AlertDescription>
              </Alert>
            )}

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

/* ===== カード ===== */
function NewsCard({
  item,
  user,
  openEdit,
  handleDelete,
}: {
  item: NewsItem;
  user: User | null;
  openEdit: (n: NewsItem) => void;
  handleDelete: (n: NewsItem) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -150px 0px" });

  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      exit={{ opacity: 0, y: 40 }}
      className="bg-white/50 p-6 rounded-lg shadow"
    >
      <h2 className="font-bold">{item.title}</h2>

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
