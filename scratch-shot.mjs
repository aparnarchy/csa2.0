import puppeteer from "puppeteer-core";
const COOKIE = "edf8pbDwQpBJ72wAMuVRDid9bf44bpGR.gO8Aoh4wYu%2BsDfFXiNzN0BMb55l9YhCUz2d3SGXjiZk%3D";
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const b = await puppeteer.launch({ executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless:"new", args:["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width:414, height:760, deviceScaleFactor:2 });
await p.setCookie({ name:"better-auth.session_token", value:COOKIE, domain:"localhost", path:"/" });
await p.goto("http://localhost:3002/check-in", { waitUntil:"networkidle0", timeout:30000 });
await sleep(1200);
await p.screenshot({ path:"/tmp/catchup-1.png" });
// pick a low answer to show the tip
await p.evaluate(()=>{const el=[...document.querySelectorAll('button')].find(e=>/Not really|Rarely/.test(e.textContent||''));el&&el.click();});
await sleep(500); await p.screenshot({ path:"/tmp/catchup-2-low.png" });
console.log("done"); await b.close();
