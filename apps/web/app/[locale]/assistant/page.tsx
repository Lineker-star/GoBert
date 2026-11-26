"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Send, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Msg = { id: string; role: "user" | "assistant"; content: string; thumbs?: "up" | "down" | null };

const QUICK_REPLIES = ["register", "taxi", "pricing"];

export default function AssistantPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { session } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [offline, setOffline] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: q };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setTyping(true);
      try {
        const res = await fetch("/api/mock/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
        const data = await res.json();
        const asstMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: data.answer, thumbs: null };
        setMessages((m) => [...m, asstMsg]);
      } catch {
        const asstMsg: Msg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: t("assistant.offlineReply"),
        };
        setMessages((m) => [...m, asstMsg]);
      } finally {
        setTyping(false);
      }
    },
    [t],
  );

  const thumb = (id: string, dir: "up" | "down") => {
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, thumbs: msg.thumbs === dir ? null : dir } : msg)));
  };

  const quick = (key: string) => {
    const text = t(`assistant.quick.${key}`);
    void send(text);
  };

  return (
    <div className="h-dvh bg-ivory flex flex-col">
      <header className="bg-forest text-white px-4 h-16 flex items-center gap-3 shrink-0">
        <Link href={`/${locale}${session ? "/dashboard" : ""}`} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 !text-white hover:bg-white/20" aria-label={t("common.back")}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
          <Image src="/brand/logo-mark.png" alt="" width={28} height={28} />
        </span>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white leading-tight">{t("assistant.title")}</h1>
          <p className="text-xs text-white/60">{offline ? t("assistant.offline") : t("assistant.subtitle")}</p>
        </div>
        <MessageCircle className="w-5 h-5 text-orange" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-charcoal/50 text-sm mt-10">
            <p className="mb-4">{t("assistant.welcome")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_REPLIES.map((k) => (
                <button key={k} onClick={() => quick(k)} className="px-4 py-2.5 rounded-full border border-green/30 bg-white text-sm font-semibold text-green hover:bg-green hover:text-white transition">
                  {t(`assistant.quick.${k}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-green text-white rounded-br-md" : "bg-white text-charcoal border border-grey rounded-bl-md"}`}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.role === "assistant" && (
                <div className="flex gap-2 mt-1">
                  <button onClick={() => thumb(m.id, "up")} className={`w-6 h-6 flex items-center justify-center ${m.thumbs === "up" ? "text-green" : "text-charcoal/40"}`}>
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => thumb(m.id, "down")} className={`w-6 h-6 flex items-center justify-center ${m.thumbs === "down" ? "text-orange" : "text-charcoal/40"}`}>
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-white border border-grey rounded-2xl px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 rounded-full bg-charcoal/40 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-charcoal/40 animate-bounce" style={{ animationDelay: "0.1s" }} />
                <span className="w-2 h-2 rounded-full bg-charcoal/40 animate-bounce" style={{ animationDelay: "0.2s" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-grey bg-white shrink-0">
        {offline && <div className="text-xs text-orange mb-1">{t("assistant.offline")}</div>}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder={t("assistant.placeholder")}
            className="flex-1 h-12 border border-grey rounded-full px-4 text-[15px] focus:outline-none focus:border-green focus:ring-4 focus:ring-green/10"
          />
          <button onClick={() => send(input)} disabled={typing} aria-label={t("assistant.send")} className="h-12 w-12 flex items-center justify-center bg-green text-white rounded-full disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <a href="mailto:support@gobert.cm" className="text-xs text-green mt-1 inline-block">
          {t("assistant.talkHuman")}
        </a>
      </div>
    </div>
  );
}