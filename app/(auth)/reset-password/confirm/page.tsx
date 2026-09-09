"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { COPY } from "@/lib/copy";
import Link from "next/link";

const t = COPY.reset;

function ConfirmForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || linkError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t.invalidTokenTitle}</h1>
          <p className="text-base text-gray-500">{t.invalidTokenBody}</p>
          <Link href="/reset-password" className="mt-6 block text-base text-violet-600">
            {t.requestNewLinkLink}
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t.successTitle}</h1>
          <p className="text-base text-gray-500">{t.successBody}</p>
          <Link href="/login" className="mt-6 block text-base text-violet-600">
            {t.goToSignInLink}
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t.mismatchError);
      return;
    }
    setLoading(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token!,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message ?? t.invalidTokenBody);
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          {t.confirmTitle}
        </h1>
        <p className="text-center text-base text-gray-500 mb-8">{t.confirmSubtitle}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={t.newPasswordPlaceholder}
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={t.confirmPasswordPlaceholder}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 text-white rounded-xl py-3 text-base font-semibold disabled:opacity-50"
          >
            {loading ? t.confirmButtonLoading : t.confirmButton}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense>
      <ConfirmForm />
    </Suspense>
  );
}
