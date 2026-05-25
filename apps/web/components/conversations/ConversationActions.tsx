"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Download, FolderInput, MoreHorizontal, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/utils";

type Folder = { id: string; name: string; kind: "real" | "avatar" };

export function ConversationActions({
  conversationId,
  kind,
  archived,
  folders,
  onChanged,
}: {
  conversationId: string;
  kind: "real" | "avatar";
  archived?: boolean;
  folders: Folder[];
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFolderOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const kindFolders = folders.filter((f) => f.kind === kind);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      onChanged?.();
    } catch {
      /* ignore */
    }
    setOpen(false);
    setFolderOpen(false);
  }

  async function exportTxt() {
    const data = await apiFetch(`/community/conversation/${conversationId}/export`);
    const blob = new Blob([data.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename || "conversation.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-ely-muted hover:bg-white/5 hover:text-white"
        aria-label="Conversation options"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-xl border border-white/10 bg-[#12121a] py-1 shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
            onClick={() => run(exportTxt)}
          >
            <Download size={14} /> Export .txt
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
            onClick={() => setFolderOpen((v) => !v)}
          >
            <FolderInput size={14} /> Move to folder
          </button>

          {folderOpen && (
            <div className="border-t border-white/5 py-1">
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-xs text-ely-muted hover:bg-white/5"
                onClick={() =>
                  run(() =>
                    apiFetch(`/community/conversation/${conversationId}/folder`, {
                      method: "POST",
                      body: JSON.stringify({ folderId: null }),
                    })
                  )
                }
              >
                Inbox (no folder)
              </button>
              {kindFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5"
                  onClick={() =>
                    run(() =>
                      apiFetch(`/community/conversation/${conversationId}/folder`, {
                        method: "POST",
                        body: JSON.stringify({ folderId: f.id }),
                      })
                    )
                  }
                >
                  {f.name}
                </button>
              ))}
              {kindFolders.length === 0 && (
                <p className="px-3 py-1.5 text-[10px] text-ely-muted">Create a folder first</p>
              )}
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
            onClick={() =>
              run(() =>
                apiFetch(`/community/conversation/${conversationId}/${archived ? "unarchive" : "archive"}`, {
                  method: "POST",
                })
              )
            }
          >
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {archived ? "Unarchive" : "Archive"}
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5"
            onClick={() => {
              if (!confirm("Delete this conversation from your inbox?")) return;
              run(() =>
                apiFetch(`/community/conversation/${conversationId}`, { method: "DELETE" })
              );
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
