/**
 * Send one email through Resend's HTTP API with a plain fetch.
 *
 * Deliberately NOT the `resend` npm package: that SDK drags in a React-email
 * renderer and Prettier (~1 MB of code), and because it was imported by the
 * auth setup, every logged-in page had to load it — a big share of the CPU
 * that trips the Cloudflare free-tier limit ("Worker exceeded resource limits").
 *
 * Like the SDK, this reports failures in `error` rather than throwing for a
 * rejected send (e.g. an address Resend won't deliver to while no domain is
 * verified). Network failures still throw.
 */
export async function sendEmail(msg: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ error: string | null }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(msg),
  });
  if (res.ok) return { error: null };
  return { error: `${res.status} ${await res.text()}` };
}
