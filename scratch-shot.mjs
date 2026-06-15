import puppeteer from "puppeteer-core";
const COOKIE = "edf8pbDwQpBJ72wAMuVRDid9bf44bpGR.gO8Aoh4wYu%2BsDfFXiNzN0BMb55l9YhCUz2d3SGXjiZk%3D";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 414, height: 1100, deviceScaleFactor: 2 });
await page.setCookie({ name: "better-auth.session_token", value: COOKIE, domain: "localhost", path: "/" });
const r = await page.goto("http://localhost:3002/dashboard/employee", { waitUntil: "networkidle0", timeout: 30000 });
console.log("status", r.status());
await new Promise(x => setTimeout(x, 1200));
await page.screenshot({ path: "/tmp/insight2.png", fullPage: true });
console.log("done");
await browser.close();
