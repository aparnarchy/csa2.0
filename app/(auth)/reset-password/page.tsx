"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { COPY, fill } from "@/lib/copy";
import Link from "next/link";

const t = COPY.reset;

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password/confirm",
    });
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t.sentTitle}</h1>
          <p className="text-base text-gray-500">{fill(t.sentBody, { email })}</p>
          <Link href="/login" className="mt-6 block text-base text-violet-600">
            {t.backToSignInLink}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          {t.pageTitle}
        </h1>
        <p className="text-center text-base text-gray-500 mb-8">
          {t.subtitle}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={t.emailPlaceholder}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 text-white rounded-xl py-3 text-base font-semibold disabled:opacity-50"
          >
            {loading ? t.sendButtonLoading : t.sendButton}
          </button>
        </form>
        <Link href="/login" className="mt-6 block text-center text-base text-violet-600">
          {t.backToSignInLink}
        </Link>
      </div>
    </div>
  );
}
