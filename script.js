// ===== CONFIG: paste your free Finnhub key here when hosting on GitHub Pages =====
const KEY = "";
const FETCH_MS = 60000, TICK_MS = 2500;

const CO = {
  SPY:{n:"S&P 500 (tracked with SPY)",s:"S&P 500",p:584.2,v:.0016},
  AAPL:{n:"Apple",s:"Apple",p:228.4,v:.0026},
  MSFT:{n:"Microsoft",s:"Microsoft",p:431.9,v:.0022},
  NVDA:{n:"Nvidia",s:"Nvidia",p:139.6,v:.0058},
  TSLA:{n:"Tesla",s:"Tesla",p:348.1,v:.0075}
};
const RANGES = {day:60,week:70,month:90};
const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
let sel="SPY", range="day", live=false;
const S = {}; // per-symbol state
for (const k in CO){ S[k]={open:CO[k].p,price:CO[k].p,hist:[],shown:CO[k].p}; seed(k); }

function rnd(){return (Math.random()+Math.random()+Math.random()-1.5)}
function seed(k){
  const c=CO[k],st=S[k];
  st.hist=[]; let p=st.open*(1-c.v*6*(Math.random()-.3));
  for(let i=0;i<RANGES[range];i++){ p*=1+rnd()*c.v; st.hist.push(p); }
  st.price=st.hist[st.hist.length-1];
}
const pctOf = k => (S[k].price-S[k].open)/S[k].open*100;
const cls = p => Math.abs(p)<.03?"flat":p>0?"up":"down";
function vol(k){ // volatility from recent moves
  const h=S[k].hist.slice(-20); if(h.length<3) return 0;
  let s=0; for(let i=1;i<h.length;i++) s+=Math.abs(h[i]/h[i-1]-1);
  return s/(h.length-1);
}

// ===== real data (Finnhub), falls back to simulation if blocked or no key =====
async function getQuote(sym){
  if(!KEY) return false;
  try{
    const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${KEY}`);
    const d=await r.json();
    if(!d||!d.c) return false;
    S[sym].open=d.pc||d.c; S[sym].price=d.c; S[sym].hist.push(d.c);
    if(S[sym].hist.length>RANGES[range]) S[sym].hist.shift();
    return true;
  }catch(e){return false}
}
async function refreshAll(){
  let ok=false;
  for(const k in CO){ if(await getQuote(k)) ok=true; }
  live=ok;
  $("#status").textContent = ok ? "Live data from Finnhub" : "Sample data, updating every few seconds";
  render();
}
function tick(){
  if(live) return;
  for(const k in CO){
    const st=S[k]; st.price*=1+rnd()*CO[k].v*1.4;
    st.hist.push(st.price); if(st.hist.length>RANGES[range]) st.hist.shift();
  }
  render();
}

// ===== rendering =====
const tweens={};
function tween(el,key,to){
  const from=tweens[key]??to; tweens[key]=to; const t0=performance.now();
  (function f(t){ const k=Math.min(1,(t-t0)/700), e=1-Math.pow(1-k,3);
    el.textContent=fmt(from+(to-from)*e); if(k<1) requestAnimationFrame(f); })(t0);
}
function path(h,w,hh){
  const mn=Math.min(...h),mx=Math.max(...h),pad=(mx-mn||1)*.15;
  const y=v=>hh-((v-(mn-pad))/((mx-mn)+pad*2))*hh, x=i=>i/(h.length-1)*w;
  return {pts:h.map((v,i)=>[x(i),y(v)]),y,x};
}
function render(){
  const st=S[sel], p=pctOf(sel), c=cls(p);
  document.body.dataset.trend=c==="flat"?"flat":c;
  tween($("#price"),"p"+sel,st.price);
  $("#pct").textContent=(p>=0?"▲ +":"▼ ")+p.toFixed(2)+"%";
  $("#chartName").textContent=CO[sel].n;
  const v=vol(sel);
  document.documentElement.style.setProperty("--beat",Math.max(.5,1.8-v*400)+"s");
  // main chart
  const {pts}=path(st.hist,700,280);
  const d=pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join("");
  $("#line").setAttribute("d",d);
  $("#area").setAttribute("d",d+"L700 280L0 280Z");
  // hero: spiky line whose amplitude follows volatility
  const base=SPY=S.SPY, vv=vol("SPY"), amp=Math.min(55,10+vv*14000);
  const hp=base.hist.slice(-40).map((val,i,a)=>{
    const dev=(val/a[0]-1)*2200; return (i/(a.length-1)*400).toFixed(1)+","+(65-Math.max(-amp,Math.min(amp,dev))+Math.sin(i*1.7)*amp*.25).toFixed(1);
  }).join(" ");
  $("#heroLine").setAttribute("points",hp);
  const sp=pctOf("SPY"), sc=cls(sp);
  tween($("#heroPrice"),"hero",S.SPY.price);
  $("#heroChip").textContent=(sp>=0?"+":"")+sp.toFixed(2)+"%";
  // list
  const q=$("#q").value.trim().toLowerCase();
  $("#list").innerHTML=Object.keys(CO).filter(k=>!q||(k+CO[k].n).toLowerCase().includes(q)).map(k=>{
    const pp=pctOf(k);
    return `<button class="co" data-k="${k}" aria-pressed="${k===sel}"><span><b>${CO[k].s}</b><small>${k}</small></span><span class="c ${cls(pp)}">${fmt(S[k].price)}<br>${pp>=0?"+":""}${pp.toFixed(2)}%</span></button>`;
  }).join("")||`<p class="note">No match. Try Apple, Tesla or SPY.</p>`;
  // mood
  const m=pctOf("SPY"), mood=sc==="flat"?"Steady":m>0?(m>1?"Very positive":"Positive"):(m<-1?"Very negative":"Negative");
  $("#mood").textContent=mood;
  $("#meter").style.width=Math.max(8,Math.min(100,50+m*25))+"%";
  stories();
}

// ===== news (emphasis follows the data) =====
const NEWS=[
  {t:"Why are {c} stocks moving?",tag:"Market news",b:"Discover what’s influencing the market and why it matters.",w:"Prices move when more people want to buy than sell, or the reverse. News about earnings, interest rates or new products shifts how people feel about a company."},
  {t:"What does a {d} day mean for you?",tag:"Explainer",b:"One day’s move rarely changes long-term plans.",w:"Most investors look at years, not hours. A single day is useful as a mood check, not as advice."},
  {t:"What is volatility, and why does it matter?",tag:"Learn",b:"Bigger swings mean more uncertainty.",w:"Volatility measures how much a price jumps around. Watch the pulse line at the top: the more it spikes, the more volatile the market is right now."}
];
let hotIdx=-1,lastHot=0;
function stories(){
  const g=$("#newsGrid"), p=pctOf(sel);
  if(!g.children.length){
    g.innerHTML=NEWS.map((n,i)=>`<article class="card story" data-i="${i}"><span class="tag">${n.tag}</span><h3></h3><p>${n.b}</p><div class="why">${n.w}</div><button class="link">Understand this story →</button></article>`).join("");
  }
  [...g.children].forEach((el,i)=>{
    el.querySelector("h3").textContent=NEWS[i].t.replace("{c}",CO[sel].s).replace("{d}",p>=0?"green":"red");
    el.classList.toggle("hot",i===hotIdx);
  });
  // a big move (or a timer) promotes a story
  const big=Math.abs(p)>1.2, now=Date.now();
  if((big&&hotIdx!==0)||now-lastHot>20000){ hotIdx=big?0:(hotIdx+1)%3; lastHot=now; [...g.children].forEach((el,i)=>el.classList.toggle("hot",i===hotIdx)); }
}

// ===== learn =====
const TERMS=[
  ["Index","A basket of many companies shown as one number. The S&P 500 tracks 500 large US firms."],
  ["Percent change","How much a price moved since yesterday’s close, as a share of that price."],
  ["Volatility","How wildly a price swings. Calm markets draw a gentle line; volatile ones spike."]
];
$("#terms").innerHTML=TERMS.map((t,i)=>`<button class="term" data-i="${i}"><b>${t[0]}</b><span>Tap to learn more</span></button>`).join("");

// ===== interactions =====
document.addEventListener("click",e=>{
  const co=e.target.closest(".co"); if(co){ sel=co.dataset.k; render(); }
  const tab=e.target.closest(".tab"); if(tab){
    range=tab.dataset.r; document.querySelectorAll(".tab").forEach(b=>b.setAttribute("aria-pressed",b===tab));
    for(const k in CO) seed(k); render();
  }
  const lk=e.target.closest(".link"); if(lk){ const s=lk.closest(".story"); const o=s.dataset.open==="true"; s.dataset.open=!o; lk.textContent=o?"Understand this story →":"Hide explanation"; }
  const tm=e.target.closest(".term"); if(tm){ const t=TERMS[tm.dataset.i]; const sp=tm.querySelector("span"); sp.textContent = sp.dataset.on ? "Tap to learn more" : t[1]; sp.dataset.on = sp.dataset.on ? "" : "1"; }
});
$("#q").addEventListener("input",render);
$("#burger").addEventListener("click",()=>{ const n=$("#nav"); const o=n.classList.toggle("open"); $("#burger").setAttribute("aria-expanded",o); });
document.querySelectorAll(".links a").forEach(a=>a.addEventListener("click",()=>$("#nav").classList.remove("open")));

// hover / touch on chart
const svg=$("#chart");
function hover(ev){
  const r=svg.getBoundingClientRect(), h=S[sel].hist, cx=(ev.touches?ev.touches[0].clientX:ev.clientX);
  const f=Math.max(0,Math.min(1,(cx-r.left)/r.width)), i=Math.round(f*(h.length-1));
  const {pts}=path(h,700,280), px=pts[i][0], py=pts[i][1];
  $("#cursor").setAttribute("x1",px);$("#cursor").setAttribute("x2",px);$("#cursor").setAttribute("opacity",1);
  $("#dotc").setAttribute("cx",px);$("#dotc").setAttribute("cy",py);$("#dotc").setAttribute("opacity",1);
  const t=$("#tip"); t.style.opacity=1; t.style.left=(px/700*r.width)+"px"; t.style.top=(py/280*r.height)+"px";
  t.textContent="$"+fmt(h[i]);
}
function leave(){ ["#cursor","#dotc"].forEach(s=>$(s).setAttribute("opacity",0)); $("#tip").style.opacity=0; }
svg.addEventListener("pointermove",hover); svg.addEventListener("pointerleave",leave);
svg.addEventListener("touchmove",hover,{passive:true}); svg.addEventListener("touchend",leave);

function route(){const v=["home","news","tips-resources"];let h=location.hash.slice(1);if(!v.includes(h))h="home";
document.querySelectorAll("[data-view]").forEach(e=>e.hidden=e.dataset.view!==h);
document.querySelectorAll(".links a").forEach(a=>a.setAttribute("aria-current",a.dataset.v===h?"page":"false"));window.scrollTo(0,0)}
addEventListener("hashchange",route);route();
// ===== go =====
$("#status").textContent="Sample data, updating every few seconds";
render();
if(KEY){ refreshAll(); setInterval(refreshAll,FETCH_MS); }
setInterval(tick,TICK_MS);