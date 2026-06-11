"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

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
          <h1 className="text-xl font-bold text-gray-900 mb-3">Check your email</h1>
          <p className="text-sm text-gray-500">
            If an account exists for <strong>{email}</strong>, we sent a reset link.
            It expires in 1 hour.
          </p>
          <Link href="/login" className="mt-6 block text-sm text-violet-600">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
          Reset password
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          Enter your email and we&apos;ll send you a reset link.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="you@example.com"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="mt-6 block text-center text-sm text-violet-600">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
