const state = { articles: [], filter: "all", query: "", shown: 12 };
const fallbackImage = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=900&q=80";
const $ = (s) => document.querySelector(s);
const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const timeAgo = (date) => {
  if (!date) return "Recently";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Recently";
  const hours = Math.max(0, Math.floor((Date.now()-d.getTime())/3600000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours/24);
  return `${days}d ago`;
};

function isFootballNews(a) {
  const text = `${a.title || ""} ${a.description || ""} ${a.url || ""}`.toLowerCase();

  const footballTerms =
    /\b(football|soccer|premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league|conference league|fifa|uefa|real madrid|barcelona|chelsea|arsenal|liverpool|manchester city|manchester united|tottenham|bayern|juventus|inter milan|ac milan|psg|transfer|world cup|el clasico|footballer|striker|goalkeeper|midfielder|defender|winger|manager|fc|afc)\b/i;

  const excludedTerms =
    /\b(golf|golfer|lpga|pga tour|tennis|cricket|rugby|formula 1|f1 racing|basketball|nfl)\b/i;

  return footballTerms.test(text) && !excludedTerms.test(text);
}

function categoryFor(a) {
  const s = `${a.title||""} ${a.description||""} ${a.source||""}`.toLowerCase();
  if (/transfer|signing|signs for|joins |deal agreed|loan move|bid for|linked with/.test(s)) return "Transfer News";
  if (/champions league|uefa|europa league|conference league/.test(s)) return "Champions League";
  if (/la liga|real madrid|barcelona|atletico madrid|girona|sevilla/.test(s)) return "La Liga";
  if (/premier league|arsenal|liverpool|manchester city|manchester united|chelsea|tottenham|newcastle|aston villa|west ham/.test(s)) return "Premier League";
  if (/serie a|inter milan|juventus|ac milan|napoli|roma|atalanta/.test(s)) return "Serie A";
  if (/bundesliga|bayern|borussia dortmund|leverkusen|rb leipzig/.test(s)) return "Bundesliga";
  if (/ligue 1|paris saint-germain|psg|marseille|monaco/.test(s)) return "Ligue 1";
  return "World Football";
}
function isTransfer(a) { return /transfer|signing|signs for|joins |deal agreed|loan move|bid for|linked with|interest in/.test(`${a.title||""} ${a.description||""}`.toLowerCase()); }
function matchesFilter(a) {
  const hay = `${a.title||""} ${a.description||""} ${a.source||""} ${a.category||""}`.toLowerCase();
  if (state.query && !hay.includes(state.query.toLowerCase())) return false;
  if (state.filter === "all") return true;
  if (state.filter === "transfer") return isTransfer(a);
  return hay.includes(state.filter);
}
function card(a, compact=false) {
  const title = esc(a.title || "Football news update");
  const url = /^https?:\/\//i.test(a.url||"") ? a.url : "#";
  const img = /^https?:\/\//i.test(a.image||"") ? a.image : fallbackImage;
  const cat = esc(a.category || categoryFor(a));
  const source = esc(a.source || "Football news");
  const desc = esc(a.description || "Open the original report for the full story.");
  const when = esc(timeAgo(a.publishedAt));
  if (compact) return `<article class="top-story"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img class="story-thumb" src="${esc(img)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'"></a><div><span class="story-tag">${cat}</span><div class="story-title"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}</a></div><span class="story-time">${when} · ${source}</span></div></article>`;
  return `<article class="news-card"><div class="news-image"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(img)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'"></a></div><div class="news-body"><div class="news-meta">${cat}</div><h3><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${title}</a></h3><p>${desc}</p><div class="card-foot"><span>${when} · ${source}</span><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">READ ↗</a></div></div></article>`;
}
function render() {
  const filtered = state.articles.filter(matchesFilter);
  $("#resultCount").textContent = `(${filtered.length})`;
  $("#newsGrid").innerHTML = filtered.slice(0,state.shown).map(a=>card(a)).join("") || "";
  $("#noResults").hidden = filtered.length > 0;
  $("#loadMore").hidden = filtered.length <= state.shown;
  const top = state.articles.slice(0,5);
  $("#topStories").innerHTML = top.map(a=>card(a,true)).join("") || '<div class="loading">No stories returned yet. Refresh in a moment.</div>';
  const transfers = state.articles.filter(isTransfer).slice(0,4);
  $("#transferGrid").innerHTML = transfers.map(a=>card(a)).join("") || '<div class="loading">No transfer reports found in the current feeds.</div>';
}
async function loadNews() {
  try {
    const response = await fetch("/api/news", {headers: {"Accept":"application/json"}});
    if (!response.ok) throw new Error("News API returned " + response.status);
    const data = await response.json();
    state.articles = (Array.isArray(data.articles) ? data.articles : [])
  .filter(isFootballNews);
    $("#feedStatus").textContent = data.status || "News feed loaded";
    $("#updatedAt").textContent = "UPDATED " + new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    render();
  } catch (err) {
    $("#feedStatus").textContent = "Could not load news feed";
    $("#updatedAt").textContent = "FEED UNAVAILABLE";
    $("#topStories").innerHTML = '<div class="loading">The news feed could not be reached. Deploy the project on Vercel and refresh.</div>';
    $("#transferGrid").innerHTML = "";
    $("#newsGrid").innerHTML = "";
    $("#noResults").hidden = false;
    $("#noResults").textContent = "News is temporarily unavailable. Please refresh in a moment.";
  }
}
document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click",()=>{
  document.querySelectorAll(".filter").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active"); state.filter=btn.dataset.filter; state.shown=12; render();
}));
document.querySelectorAll("[data-quick-filter]").forEach(link => link.addEventListener("click",()=>{
  const f = link.dataset.quickFilter;
  state.filter = f;
  state.query = "";
  $("#searchInput").value = "";
  document.querySelectorAll(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===f));
  state.shown=12;
  // Team and league links use a broad title/source search.
  render();
}));
$("#searchToggle").addEventListener("click",()=>{
  const wrap=$("#searchWrap"); wrap.hidden=!wrap.hidden;
  if(!wrap.hidden) $("#searchInput").focus();
});
$("#searchInput").addEventListener("input",e=>{state.query=e.target.value;state.shown=12;render();});
$("#clearSearch").addEventListener("click",()=>{$("#searchInput").value="";state.query="";render();});
$("#loadMore").addEventListener("click",()=>{state.shown+=12;render();});
$("#themeToggle").addEventListener("click",()=>{document.body.classList.toggle("light");$("#themeToggle").textContent=document.body.classList.contains("light")?"☀":"☾";});
$("#menuBtn").addEventListener("click",()=>$("#mainNav").classList.toggle("nav-open"));
$("#year").textContent=new Date().getFullYear();
loadNews();
