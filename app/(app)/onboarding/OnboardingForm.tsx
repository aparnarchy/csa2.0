"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/kit";
import { COPY } from "@/lib/copy";

const t = COPY.onboarding;

const INPUT =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-ink placeholder-ink-4 focus:outline-none focus:ring-2 focus:ring-brand";

/** First-login onboarding form. Saves via /api/onboarding then routes onward. */
export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: defaultName ?? "",
    currentCompany: "",
    currentRole: "",
    yearsOfExperience: "",
    managerName: "",
    managerEmail: "",
    mentorName: "",
    mentorEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(t.errorMessage);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8">
      <div className="flex flex-col items-center text-center">
        <Mascot state="welcome" size={132} sparkle={false} />
        <h1 className="mt-2 font-display text-[26px] font-black leading-tight text-brand">
          {t.title}
        </h1>
        <p className="mt-1.5 text-sm text-ink-2">{t.subtitle}</p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-5">
        <Field label={t.nameLabel}>
          <input className={INPUT} value={form.name} onChange={set("name")} required placeholder={t.namePlaceholder} />
        </Field>
        <Field label={t.companyLabel}>
          <input className={INPUT} value={form.currentCompany} onChange={set("currentCompany")} placeholder={t.companyPlaceholder} />
        </Field>
        <Field label={t.roleLabel}>
          <input className={INPUT} value={form.currentRole} onChange={set("currentRole")} placeholder={t.rolePlaceholder} />
        </Field>
        <Field label={t.experienceLabel}>
          <input
            className={INPUT}
            value={form.yearsOfExperience}
            onChange={set("yearsOfExperience")}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={t.experiencePlaceholder}
          />
        </Field>

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{t.managerSectionTitle}</p>
          <input className={INPUT} value={form.managerName} onChange={set("managerName")} placeholder={t.managerNamePlaceholder} />
          <input className={INPUT} value={form.managerEmail} onChange={set("managerEmail")} type="email" placeholder={t.managerEmailPlaceholder} />
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{t.mentorSectionTitle}</p>
          <input className={INPUT} value={form.mentorName} onChange={set("mentorName")} placeholder={t.mentorNamePlaceholder} />
          <input className={INPUT} value={form.mentorEmail} onChange={set("mentorEmail")} type="email" placeholder={t.mentorEmailPlaceholder} />
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-brand py-3.5 font-display text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? t.submitButtonLoading : t.submitButton}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}
