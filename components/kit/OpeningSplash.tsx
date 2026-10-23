import Image from "next/image";

/**
 * The opening animation (owner, 2026-10-23, option A from their logo GIF):
 * "THE", "Super" and the mascot sit on white, a purple block sweeps across
 * and leaves "Culture" behind, then it fades into the app. Pure CSS
 * (globals.css, .opening-*), no library.
 *
 * - First open of the day: the full sweep (~1.9s). Later opens that day: a
 *   quick hello (the finished logo, one mascot hop, ~1s).
 * - Only when the app is opened fresh: a reload in the same session (e.g.
 *   moving to a new deploy) and moving between screens don't replay it.
 * - A tap skips it. "Reduce motion" shows the still logo instead.
 *
 * The markup is server-rendered so it covers the screen from the first
 * paint; the inline script picks the mode before anything is drawn. It is
 * hidden unless the script sets data-mode, so with no script there is no
 * splash at all. Nothing here leaves the device.
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
  el.setAttribute("data-mode",mode);
  var done=function(){el.setAttribute("data-mode","done");};
  el.addEventListener("click",done);
  setTimeout(done,mode==="full"?2000:1100);
})();`;

export function OpeningSplash() {
  return (
    <>
      <div id="opening" className="opening" aria-hidden suppressHydrationWarning>
        <div className="opening-logo">
          <Image className="opening-the" src="/brand/wordmark-the.png" alt="" width={284} height={74} priority unoptimized />
          <Image className="opening-culture" src="/brand/wordmark-culture.png" alt="" width={620} height={156} priority unoptimized />
          <Image className="opening-super" src="/brand/wordmark-super.png" alt="" width={554} height={170} priority unoptimized />
          <Image className="opening-mascot" src="/mascot/welcome.png" alt="" width={600} height={600} priority unoptimized />
          <span className="opening-bar" />
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
