import Image from "next/image";

/**
 * The opening animation (owner, 2026-10-23, option A from their logo GIF):
 * the app logo sits on top (owner, 2026-10-28; the mascot used to sit at the
 * bottom), with "THE" and "Super" centred under it on white (owner: the
 * side-by-side logo sat off-centre). A purple block sweeps across
 * and leaves "Culture" behind, the logo holds for over a second, then it
 * fades into the app (~2.6s). Pure CSS (globals.css, .opening-*), no library.
 *
 * - Plays every time the app is opened (owner, 2026-10-23: "each time I open
 *   it"): on every fresh load, and on coming back to the app after more than
 *   5 minutes away (a phone keeps the app alive in the background, so that
 *   return is not a fresh load). A quick switch away and back doesn't replay.
 * - A tap skips it. "Reduce motion" shows the still logo instead.
 *
 * The markup is server-rendered so it covers the screen from the first
 * paint. It is hidden unless the script sets data-mode, so with no script
 * there is no splash at all. It shows a blank white screen ("wait") until
 * the page is on screen (not while Chrome loads it ahead of time, or in a
 * background tab) and its images are in, so nothing plays unseen or pops in
 * late. The sweep moves by transform only, so it stays smooth while the app
 * loads underneath. Nothing here leaves the device.
 */
const SCRIPT = `(function(){
  var el=document.getElementById("opening");
  if(!el)return;
  var AWAY_MS=5*60*1000;
  var playing=false,shown=false,loaded=false,timer=0,hiddenAt=0;
  var done=function(){playing=false;clearTimeout(timer);el.setAttribute("data-mode","done");};
  var play=function(){
    if(playing||!shown||!loaded)return;playing=true;
    el.setAttribute("data-mode","full");
    timer=setTimeout(done,3200);
  };
  el.setAttribute("data-mode","wait");
  playing=true;
  el.addEventListener("click",done);
  el.addEventListener("animationend",function(e){if(e.target===el)done();});
  var onScreen=function(){
    if(document.prerendering||document.visibilityState!=="visible")return;
    if(!shown){shown=true;playing=false;setTimeout(function(){loaded=true;play();},1500);play();return;}
    if(hiddenAt&&Date.now()-hiddenAt>AWAY_MS&&!playing){
      el.setAttribute("data-mode","done");void el.offsetWidth;play();
    }
  };
  document.addEventListener("prerenderingchange",onScreen);
  document.addEventListener("visibilitychange",function(){
    if(document.visibilityState==="hidden")hiddenAt=Date.now();else onScreen();
  });
  var imgs=[].slice.call(el.querySelectorAll("img"));
  Promise.all(imgs.map(function(i){return i.decode?i.decode().catch(function(){}):null;})).then(function(){loaded=true;play();});
  onScreen();
})();`;

export function OpeningSplash() {
  return (
    <>
      <div id="opening" className="opening" aria-hidden suppressHydrationWarning>
        <Image className="opening-mark" src="/brand/logo.png" alt="" width={512} height={512} priority unoptimized />
        <div className="opening-logo">
          <Image className="opening-the" src="/brand/wordmark-the.png" alt="" width={456} height={116} priority unoptimized />
          <Image className="opening-culture" src="/brand/wordmark-culture.png" alt="" width={1000} height={259} priority unoptimized />
          <Image className="opening-super" src="/brand/wordmark-super.png" alt="" width={891} height={266} priority unoptimized />
          <span className="opening-bar">
            <span />
          </span>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
