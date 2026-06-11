"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) {
      setError(error.message ?? "Signup failed. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Create your account
        </h1>
        <p className="text-center text-base text-gray-500 mb-8">
          Open to anyone — no invite needed.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              Your name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Aparna"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="At least 8 characters"
            />
          </div>
          {error && <p className="text-base text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 text-white rounded-xl py-3 text-base font-semibold disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-base text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-600 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
