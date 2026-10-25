
const FEEDS = [
  {
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml"
  },
  {
    name: "Sky Sports",
    url: "https://www.skysports.com/rss/12040"
  },
  {
    name: "ESPN Soccer",
    url: "https://www.espn.com/espn/rss/soccer/news"
  }
];

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=900&q=80";

function clean(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getTag(xml, name) {
  const escaped = name.replace(":", "\\:");
  const regex = new RegExp(
    `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
    "i"
  );
  const match = xml.match(regex);
  return match ? clean(match[1]) : "";
}

function getImage(item) {
  const match = item.match(
    /<(?:media:content|media:thumbnail|enclosure)\b[^>]*url=["']([^"']+)["']/i
  );
  return match ? match[1].replace(/&amp;/g, "&") : FALLBACK_IMAGE;
}

function parseFeed(xml, source) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  return items.map(item => ({
    title: getTag(item, "title"),
    url: getTag(item, "link") || getTag(item, "guid"),
    description: getTag(item, "description").slice(0, 500),
    publishedAt: getTag(item, "pubDate"),
    image: getImage(item),
    source,
    category: getTag(item, "category") || "World Football"
  })).filter(article =>
    article.title &&
    article.url &&
    /^https?:\/\//i.test(article.url)
  );
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=300, stale-while-revalidate=600"
  );
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const results = await Promise.allSettled(
    FEEDS.map(async feed => {
      const response = await fetch(feed.url, {
        headers: {
          "User-Agent": "TouchlineFootballNews/1.0"
        },
        signal: AbortSignal.timeout(7000)
      });

      if (!response.ok) {
        throw new Error(`${feed.name} unavailable`);
      }

      return parseFeed(await response.text(), feed.name);
    })
  );

  let articles = [];
  const workingSources = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
      workingSources.push(FEEDS[index].name);
    }
  });

  const seen = new Set();

  articles = articles.filter(article => {
    const key = article.title.toLowerCase();

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  articles.sort((a, b) =>
    (Date.parse(b.publishedAt) || 0) -
    (Date.parse(a.publishedAt) || 0)
  );

  return res.status(200).json({
    status: workingSources.length
      ? `News from ${workingSources.join(", ")}`
      : "Football news feeds are temporarily unavailable.",
    sources: workingSources,
    articles: articles.slice(0, 60)
  });
};
