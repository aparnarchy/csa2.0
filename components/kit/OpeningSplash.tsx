import Image from "next/image";

/**
 * The opening animation (owner, 2026-10-23, option A from their logo GIF):
 * "THE", "Super" and the mascot sit on white, a purple block sweeps across
 * and leaves "Culture" behind, then it fades into the app. Pure CSS
 * (globals.css, .opening-*), no library.
 *
 * - First open of the day: the full sweep, the logo held for over a second
 *   (~2.6s in all). Later opens that day: a quick hello (the finished logo,
 *   one mascot hop, ~1.5s). Owner, 2026-10-23: hold it at least a second.
 * - Only when the app is opened fresh: a reload in the same session (e.g.
 *   moving to a new deploy) and moving between screens don't replay it.
 * - A tap skips it. "Reduce motion" shows the still logo instead.
 *
 * The markup is server-rendered so it covers the screen from the first
 * paint; the inline script picks the mode before anything is drawn. It is
 * hidden unless the script sets data-mode, so with no script there is no
 * splash at all. It shows a blank white screen ("wait") until its images
 * are in, so nothing pops in late, then plays. The sweep moves by transform
 * only, so it stays smooth while the app loads underneath. Nothing here
 * leaves the device.
 */
const SCRIPT = `(function(){
  var el=document.getElementById("opening");
  if(!el)return;
  var mode="full";
  try{
    if(sessionStorage.getItem("csa:opened")){return;}
    sessionStorage.setItem("csa:opened","1");
    var d=new Date(),today=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
    if(localStorage.getItem("csa:opening-day")===today){mode="quick";}
    else{localStorage.setItem("csa:opening-day",today);}
  }catch(e){}
  var finished=false,started=false;
  var done=function(){finished=true;el.setAttribute("data-mode","done");};
  var start=function(){
    if(started||finished)return;started=true;
    el.setAttribute("data-mode",mode);
    setTimeout(done,mode==="full"?3200:2000);
  };
  el.setAttribute("data-mode","wait");
  el.addEventListener("click",done);
  el.addEventListener("animationend",function(e){if(e.target===el)done();});
  var imgs=[].slice.call(el.querySelectorAll("img"));
  Promise.all(imgs.map(function(i){return i.decode?i.decode().catch(function(){}):null;})).then(start);
  setTimeout(start,1500);
})();`;

export function OpeningSplash() {
  return (
    <>
      <div id="opening" className="opening" aria-hidden suppressHydrationWarning>
        <div className="opening-logo">
          <Image className="opening-the" src="/brand/wordmark-the.png" alt="" width={284} height={74} priority unoptimized />
          <Image className="opening-culture" src="/brand/wordmark-culture.png" alt="" width={620} height={156} priority unoptimized />
          <Image className="opening-super" src="/brand/wordmark-super.png" alt="" width={554} height={170} priority unoptimized />
          <Image className="opening-mascot" src="/brand/mascot.png" alt="" width={360} height={360} priority unoptimized />
          <span className="opening-bar">
            <span />
          </span>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
