const books = Array.isArray(window.BOOKS_DATA) ? window.BOOKS_DATA : [];
const siteContent = window.SITE_CONTENT || {};
const siteCuration = window.SITE_CURATION || {};
const bookOverrides = window.BOOK_OVERRIDES || {};

const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const statusFilter = document.getElementById("statusFilter");
const resultCount = document.getElementById("resultCount");
const searchSummary = document.getElementById("searchSummary");
const bookGrid = document.getElementById("bookGrid");
const emptyState = document.getElementById("emptyState");
const detailsContent = document.getElementById("detailsContent");
const heroStats = document.getElementById("heroStats");
const pageStatus = document.getElementById("pageStatus");
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const viewSwitcher = document.getElementById("viewSwitcher");
const catalogView = document.getElementById("catalogView");
const genresView = document.getElementById("genresView");
const genreSections = document.getElementById("genreSections");
const genreSummary = document.getElementById("genreSummary");
const siteNav = document.getElementById("siteNav");
const homePage = document.getElementById("homePage");
const catalogPage = document.getElementById("catalogPage");
const catalogLayout = document.getElementById("catalogLayout");
const aboutPage = document.getElementById("aboutPage");
const heroStatsDuplicate = document.getElementById("heroStatsDuplicate");
const featuredWeekTitle = document.getElementById("featuredWeekTitle");
const featuredWeekLabel = document.getElementById("featuredWeekLabel");
const featuredWeekContent = document.getElementById("featuredWeekContent");
const featuredWeekSection = document.getElementById("featuredWeekSection");
const themeChipRow = document.getElementById("themeChipRow");
const homeThemeRow = document.getElementById("homeThemeRow");
const curatedShelves = document.getElementById("curatedShelves");
const homeCurationSection = document.getElementById("homeCurationSection");
const cursorOrbit = document.getElementById("cursorOrbit");

const accentPalette = [
  "#4f6d7a",
  "#bc6c25",
  "#2d5d7b",
  "#7f5539",
  "#606c38",
  "#6d597a",
  "#9c6644",
  "#386641",
  "#1d7874",
  "#7a3e65"
];

const COVER_CACHE_KEY = "library-cover-cache-v1";
const META_CACHE_KEY = "library-book-meta-v2";
const COVER_PLACEHOLDER = "";
const coverCache = loadCoverCache();
const metadataCache = loadMetadataCache();
const coverLookupQueue = [];
const metadataLookupQueue = [];
let activeCoverLookups = 0;
let activeMetadataLookups = 0;
const maxConcurrentLookups = 2;
const BOOKS_PER_PAGE = 12;
const GENRE_PREVIEW_COUNT = 5;
const FEATURED_AUTHORS = siteCuration.featuredAuthors || [];
const BOOK_OF_WEEK = siteCuration.bookOfTheWeek || {};
const QUICK_THEMES = siteCuration.quickThemes || [
  { id: "all", label: "Everything" }
];

const state = {
  selectedBookId: books[0]?.id ?? null,
  currentPage: 1,
  activeView: "catalog",
  expandedGenres: {},
  activePage: "home",
  activeTheme: "all"
};

const renderState = {
  queued: false
};

function loadCoverCache() {
  try {
    const raw = window.localStorage.getItem(COVER_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCoverCache() {
  try {
    window.localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(coverCache));
  } catch {
    // Ignore storage errors so the catalog remains usable.
  }
}

function loadMetadataCache() {
  try {
    const raw = window.localStorage.getItem(META_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMetadataCache() {
  try {
    window.localStorage.setItem(META_CACHE_KEY, JSON.stringify(metadataCache));
  } catch {
    // Ignore storage errors so the catalog remains usable.
  }
}

function requestRender() {
  if (renderState.queued) {
    return;
  }

  renderState.queued = true;
  window.requestAnimationFrame(() => {
    renderState.queued = false;
    renderActivePage();
  });
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean);
}

function scoreCandidate(book, candidate) {
  const titleTokens = tokenize(book.title);
  const authorTokens = tokenize(book.author);
  const candidateTitle = normalizeText(candidate.title);
  const candidateAuthor = normalizeText(candidate.author);
  let score = 0;

  titleTokens.forEach((token) => {
    if (candidateTitle.includes(token)) {
      score += 3;
    }
  });

  authorTokens.forEach((token) => {
    if (candidateAuthor.includes(token)) {
      score += 2;
    }
  });

  if (normalizeText(book.title) === candidateTitle) {
    score += 8;
  }

  if (
    book.published &&
    candidate.published &&
    String(book.published) === String(candidate.published)
  ) {
    score += 2;
  }

  return score;
}

function buildOpenLibraryCoverUrl(candidate) {
  if (candidate.coverId) {
    return `https://covers.openlibrary.org/b/id/${candidate.coverId}-L.jpg?default=false`;
  }

  if (candidate.olid) {
    return `https://covers.openlibrary.org/b/olid/${candidate.olid}-L.jpg?default=false`;
  }

  if (candidate.isbn) {
    return `https://covers.openlibrary.org/b/isbn/${candidate.isbn}-L.jpg?default=false`;
  }

  return "";
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSentenceCase(text) {
  if (!text) {
    return "";
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function summarizeText(text, minWords = 50, maxWords = 75) {
  const clean = stripHtml(text);
  if (!clean) {
    return "";
  }

  const words = clean.split(/\s+/);
  if (words.length <= maxWords) {
    return toSentenceCase(clean);
  }

  let summaryWords = words.slice(0, maxWords);
  if (summaryWords.length < minWords) {
    summaryWords = words.slice(0, Math.min(words.length, minWords));
  }

  const joined = summaryWords.join(" ").replace(/[,:;-\s]+$/, "");
  return `${toSentenceCase(joined)}...`;
}

function buildFallbackSummary(book) {
  if (bookOverrides[book.title]?.summary) {
    return bookOverrides[book.title].summary;
  }

  const sentenceParts = [
    book.title ? `${book.title} is a ${book.genre ? book.genre.toLowerCase() : "library"} title in the Fireflies Studio collection` : "",
    book.author ? `written by ${book.author}` : "",
    book.language ? `This copy is available in ${book.language}` : "",
    book.translator ? `and includes translation details linked to ${book.translator}` : "",
    book.publisher ? `The edition is associated with ${book.publisher}` : "",
    book.published ? `and dates to around ${book.published}` : "",
    book.notes ? `Catalog notes mention ${book.notes}` : "",
    `It has been selected as part of a shelf meant for slow browsing, shared discovery, and thoughtful borrowing among visitors.`
  ].filter(Boolean);

  const summary = sentenceParts.join(". ").replace(/\.\s+\./g, ". ");
  return summarizeText(summary, 45, 72) || summary;
}

function getBookSummary(book) {
  const candidate =
    book.generatedSummary ||
    summarizeText(book.summary, 45, 72) ||
    buildFallbackSummary(book);

  return candidate;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function lookupOpenLibraryCover(book) {
  const params = new URLSearchParams({
    title: book.title,
    author: book.author,
    fields: "title,author_name,cover_i,edition_key,isbn,first_publish_year",
    limit: "5"
  });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params.toString()}`);
  const candidates = (data.docs || [])
    .map((doc) => ({
      title: doc.title || "",
      author: (doc.author_name || []).join(" "),
      coverId: doc.cover_i || "",
      olid: (doc.edition_key || [])[0] || "",
      isbn: (doc.isbn || [])[0] || "",
      published: doc.first_publish_year || ""
    }))
    .filter((candidate) => candidate.coverId || candidate.olid || candidate.isbn)
    .sort((left, right) => scoreCandidate(book, right) - scoreCandidate(book, left));

  const bestMatch = candidates[0];
  return bestMatch ? buildOpenLibraryCoverUrl(bestMatch) : "";
}

async function lookupGoogleBooksCover(book) {
  const data = await lookupGoogleBooksData(book);

  return data.image || "";
}

async function lookupGoogleBooksData(book) {
  const query = encodeURIComponent(`intitle:${book.title} inauthor:${book.author}`);
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&printType=books`
  );

  const candidates = (data.items || [])
    .map((item) => ({
      title: item.volumeInfo?.title || "",
      author: (item.volumeInfo?.authors || []).join(" "),
      published: item.volumeInfo?.publishedDate || "",
      image:
        item.volumeInfo?.imageLinks?.thumbnail ||
        item.volumeInfo?.imageLinks?.smallThumbnail ||
        "",
      description: item.volumeInfo?.description || "",
      averageRating: item.volumeInfo?.averageRating || null,
      ratingsCount: item.volumeInfo?.ratingsCount || null,
      infoLink: item.volumeInfo?.infoLink || ""
    }))
    .filter((candidate) => candidate.image || candidate.description || candidate.averageRating)
    .sort((left, right) => scoreCandidate(book, right) - scoreCandidate(book, left));

  const bestMatch = candidates[0];
  if (!bestMatch) {
    return {};
  }

  return {
    image: bestMatch.image ? bestMatch.image.replace("http://", "https://") : "",
    summary: summarizeText(bestMatch.description),
    rating: bestMatch.averageRating,
    ratingsCount: bestMatch.ratingsCount,
    ratingSource: bestMatch.averageRating ? "Google Books" : "",
    infoLink: bestMatch.infoLink || ""
  };
}

async function lookupOpenLibrarySummary(book) {
  const params = new URLSearchParams({
    title: book.title,
    author: book.author,
    fields: "key,title,author_name",
    limit: "3"
  });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params.toString()}`);
  const best = (data.docs || [])[0];
  if (!best?.key) {
    return "";
  }

  const work = await fetchJson(`https://openlibrary.org${best.key}.json`);
  const description =
    typeof work.description === "string"
      ? work.description
      : work.description?.value || "";

  return summarizeText(description);
}

async function resolveCoverForBook(book) {
  try {
    return (await lookupOpenLibraryCover(book)) || (await lookupGoogleBooksCover(book));
  } catch {
    try {
      return await lookupGoogleBooksCover(book);
    } catch {
      return COVER_PLACEHOLDER;
    }
  }
}

function scheduleMetadataLookup(book) {
  if (
    !book ||
    metadataCache[book.id] === null ||
    metadataLookupQueue.includes(book.id) ||
    (book.generatedSummary && (book.rating || metadataCache[book.id]))
  ) {
    return;
  }

  if (metadataCache[book.id]) {
    Object.assign(book, metadataCache[book.id]);
    return;
  }

  metadataLookupQueue.push(book.id);
  runMetadataQueue();
}

async function resolveMetadataForBook(book) {
  try {
    const googleData = await lookupGoogleBooksData(book);
    const summary =
      googleData.summary ||
      summarizeText(book.summary, 35, 65) ||
      (await lookupOpenLibrarySummary(book)) ||
      buildFallbackSummary(book);

    return {
      generatedSummary: summary,
      rating: googleData.rating ?? null,
      ratingsCount: googleData.ratingsCount ?? null,
      ratingSource: googleData.ratingSource || "",
      infoLink: googleData.infoLink || ""
    };
  } catch {
    return {
      generatedSummary: summarizeText(book.summary, 35, 65) || buildFallbackSummary(book),
      rating: null,
      ratingsCount: null,
      ratingSource: "",
      infoLink: ""
    };
  }
}

async function runMetadataQueue() {
  while (
    activeMetadataLookups < maxConcurrentLookups &&
    metadataLookupQueue.length > 0
  ) {
    const bookId = metadataLookupQueue.shift();
    const book = books.find((entry) => entry.id === bookId);

    if (!book) {
      continue;
    }

    activeMetadataLookups += 1;

    resolveMetadataForBook(book)
      .then((data) => {
        Object.assign(book, data);
        metadataCache[book.id] = data;
        saveMetadataCache();
        requestRender();
      })
      .finally(() => {
        activeMetadataLookups -= 1;
        runMetadataQueue();
      });
  }
}

function scheduleCoverLookup(book) {
  if (!book || book.coverImage || coverCache[book.id] === null || coverLookupQueue.includes(book.id)) {
    return;
  }

  if (coverCache[book.id]) {
    book.coverImage = coverCache[book.id];
    return;
  }

  coverLookupQueue.push(book.id);
  runCoverQueue();
}

async function runCoverQueue() {
  while (activeCoverLookups < maxConcurrentLookups && coverLookupQueue.length > 0) {
    const bookId = coverLookupQueue.shift();
    const book = books.find((entry) => entry.id === bookId);

    if (!book || book.coverImage) {
      continue;
    }

    activeCoverLookups += 1;

    resolveCoverForBook(book)
      .then((coverUrl) => {
        if (coverUrl) {
          book.coverImage = coverUrl;
          coverCache[book.id] = coverUrl;
        } else {
          coverCache[book.id] = null;
        }
        saveCoverCache();
        requestRender();
      })
      .finally(() => {
        activeCoverLookups -= 1;
        runCoverQueue();
      });
  }
}

function getAccent(book) {
  const source = `${book.genre || ""}${book.author || ""}${book.title || ""}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % accentPalette.length;
  }

  return accentPalette[hash];
}

function getDisplayLocation(book) {
  return book.location || book.catalogCode || "To be assigned";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createDetailItem(label, value) {
  if (!value) {
    return "";
  }

  return `
    <div class="detail-list-item">
      <span class="detail-label">${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function formatRating(book) {
  if (!book.rating) {
    return "No web rating yet";
  }

  const count = book.ratingsCount
    ? ` (${Number(book.ratingsCount).toLocaleString()} ratings)`
    : "";
  const source = book.ratingSource ? ` via ${book.ratingSource}` : "";
  return `${book.rating}/5${count}${source}`;
}

function formatAvailability(status) {
  const mapping = {
    available: "Available to borrow",
    "checked-out": "Currently borrowed",
    "reference-only": "Read in library"
  };

  return mapping[status] || formatStatus(status);
}

function matchesTheme(book, themeId) {
  const genre = normalizeText(book.genre);
  const title = normalizeText(book.title);
  const author = normalizeText(book.author);

  switch (themeId) {
    case "young-readers":
      return genre.includes("children") || author.includes("geronimo stilton");
    case "deep-thinking":
      return genre.includes("philosophy") || genre.includes("religion") || genre.includes("science");
    case "poetry-corner":
      return genre.includes("poetry");
    case "nature-shelf":
      return genre.includes("nature") || title.includes("birds") || title.includes("flowers");
    case "gentle-reads":
      return author.includes("ruskin bond") || title.includes("little book") || title.includes("flowers");
    default:
      return true;
  }
}

function renderThemeChips() {
  const markup = QUICK_THEMES.map(
    (theme) => `
      <button class="theme-chip ${theme.id === state.activeTheme ? "active" : ""}" data-theme="${theme.id}" type="button">
        ${theme.label}
      </button>
    `
  ).join("");

  themeChipRow.innerHTML = markup;
  homeThemeRow.innerHTML = markup;
}

function getCuratedShelvesData() {
  const configuredShelves = siteCuration.shelves || [];

  return configuredShelves.map((shelf) => {
    let shelfBooks = [];

    if (shelf.mode === "featured-authors") {
      shelfBooks = books
        .filter((book) => getAuthorFeatureScore(book) > 0)
        .sort((left, right) => getAuthorFeatureScore(right) - getAuthorFeatureScore(left))
        .slice(0, 4);
    } else if (shelf.mode === "theme") {
      shelfBooks = books.filter((book) => matchesTheme(book, shelf.themeId)).slice(0, 4);
    } else if (shelf.mode === "mixed-gentle") {
      shelfBooks = books
        .filter((book) => matchesTheme(book, "gentle-reads") || (book.rating ?? 0) >= 4)
        .slice(0, 4);
    } else if (Array.isArray(shelf.titles)) {
      shelfBooks = shelf.titles
        .map((title) =>
          books.find((book) => normalizeText(book.title) === normalizeText(title))
        )
        .filter(Boolean)
        .slice(0, 4);
    }

    return {
      title: shelf.title,
      description: shelf.description,
      books: shelfBooks
    };
  });
}

function renderCuratedShelves() {
  curatedShelves.innerHTML = getCuratedShelvesData()
    .map(
      (shelf) => `
        <section class="curated-shelf">
          <h3>${escapeHtml(shelf.title)}</h3>
          <p class="detail-text">${escapeHtml(shelf.description)}</p>
          <div class="curated-shelf-grid">
            ${shelf.books
              .map(
                (book) => `
                  <article class="mini-book-card" data-book-id="${book.id}">
                    <h3>${escapeHtml(book.title)}</h3>
                    <p class="meta-text">${escapeHtml(book.author)}</p>
                    <div class="detail-meta">
                      <span class="tag">${escapeHtml(book.genre)}</span>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderBookOfTheWeek() {
  const featuredBook =
    books.find((book) => normalizeText(book.title) === normalizeText(BOOK_OF_WEEK.title)) ||
    books.find((book) => normalizeText(book.title).includes(normalizeText(BOOK_OF_WEEK.title))) ||
    null;

  if (!featuredBook) {
    featuredWeekTitle.textContent = "This week’s timely read";
    featuredWeekLabel.textContent = BOOK_OF_WEEK.weekLabel;
    featuredWeekContent.innerHTML = `
      <div class="detail-card">
        <h3>Featured title unavailable</h3>
        <p class="detail-text">We could not match this week's featured book to the catalog yet.</p>
      </div>
    `;
    return;
  }

  scheduleCoverLookup(featuredBook);
  scheduleMetadataLookup(featuredBook);
  featuredWeekTitle.textContent = BOOK_OF_WEEK.kicker;
  featuredWeekLabel.textContent = BOOK_OF_WEEK.weekLabel;
  featuredWeekContent.innerHTML = `
    <div>
      ${createCoverMarkup(featuredBook, true).replace("detail-cover", "detail-cover featured-cover")}
    </div>
    <div class="featured-copy">
      <div>
        <h2>${escapeHtml(featuredBook.title)}</h2>
        <p class="meta-text">${escapeHtml(featuredBook.author)}</p>
        <div class="detail-meta">
          <span class="tag">${escapeHtml(featuredBook.genre)}</span>
          <span class="tag">${escapeHtml(formatRating(featuredBook))}</span>
        </div>
      </div>
      <div class="featured-context">
        <p>${escapeHtml(BOOK_OF_WEEK.theme)}</p>
      </div>
      <div class="detail-card">
        <h3>Why read it now</h3>
        <p class="detail-text">${escapeHtml(getBookSummary(featuredBook))}</p>
      </div>
      <div class="hero-actions">
        <button class="hero-button" data-page-target="catalog" data-featured-book-id="${featuredBook.id}" type="button">
          Open In Catalog
        </button>
        ${
          featuredBook.infoLink
            ? `<a class="hero-button ghost" href="${featuredBook.infoLink}" target="_blank" rel="noreferrer">See Reader Context</a>`
            : ""
        }
      </div>
    </div>
  `;
}

function scheduleBooksForCurrentView(booksToSchedule) {
  booksToSchedule.forEach(scheduleCoverLookup);
  booksToSchedule.forEach(scheduleMetadataLookup);
}

function applySiteContent() {
  document.querySelector("#homePage .hero-copy .eyebrow").textContent =
    siteContent.home?.eyebrow || "A Reading Space By Fireflies";
  document.querySelector("#homePage .hero-copy h1").textContent =
    siteContent.home?.title || "Stories, ideas, and quiet discoveries for curious readers.";
  document.querySelector("#homePage .hero-copy .hero-text").textContent =
    siteContent.home?.text ||
    "Fireflies Studio Library is a warm reading corner where visitors can browse thoughtfully, follow reader favourites, and discover books that travel from one curious mind to another.";
  document.querySelector("#homePage .hero-note p").textContent =
    siteContent.home?.note ||
    "Browse slowly. Borrow thoughtfully. Let one good book lead to the next.";
  document.querySelector('[data-page-target="catalog"]').textContent =
    siteContent.home?.primaryCta || "Explore The Catalog";
  document.querySelector('[data-page-target="about"]').textContent =
    siteContent.home?.secondaryCta || "About Fireflies";

  document.querySelector("#homePage .hero-story .eyebrow").textContent =
    siteContent.whyFireflies?.eyebrow || "Why Fireflies";
  document.querySelector("#homePage .hero-story h2").textContent =
    siteContent.whyFireflies?.title || "A library shaped by shared reading.";
  document.querySelector("#homePage .hero-story > .detail-text").textContent =
    siteContent.whyFireflies?.text ||
    "Fireflies brings books, people, and conversation together in one welcoming cultural space.";

  const whyCards = document.querySelectorAll("#homePage .story-grid .detail-card");
  if (siteContent.whyFireflies?.cards?.[0]) {
    whyCards[0].querySelector("h3").textContent = siteContent.whyFireflies.cards[0].title;
    whyCards[0].querySelector("p").textContent = siteContent.whyFireflies.cards[0].text;
  }
  if (siteContent.whyFireflies?.cards?.[1]) {
    whyCards[1].querySelector("h3").textContent = siteContent.whyFireflies.cards[1].title;
    whyCards[1].querySelector("p").textContent = siteContent.whyFireflies.cards[1].text;
  }
  document.querySelector("#homePage .story-quote p").textContent =
    siteContent.whyFireflies?.quote ||
    "Every shelf is a small invitation: pause here, pick something unexpected, and carry a thought outward.";

  document.querySelector("#catalogPage .hero-copy .eyebrow").textContent =
    siteContent.catalogHero?.eyebrow || "Browse The Collection";
  document.querySelector("#catalogPage .hero-copy h1").textContent =
    siteContent.catalogHero?.title || "Find books by title, mood, genre, or shared curiosity.";
  document.querySelector("#catalogPage .hero-copy .hero-text").textContent =
    siteContent.catalogHero?.text ||
    "Start with welcoming shelves, refine by theme or availability, and open any title for a quick summary, author context, and related reading ideas.";

  document.querySelector("#aboutPage .about-copy .eyebrow").textContent =
    siteContent.about?.eyebrow || "About Fireflies";
  document.querySelector("#aboutPage .about-copy h2").textContent =
    siteContent.about?.title || "Books, place-making, and quiet cultural exchange.";
  document.querySelector("#aboutPage .about-copy > .hero-text").textContent =
    siteContent.about?.text ||
    "Fireflies Studio Library is imagined as more than a catalog. It is a reading room, a neighbourhood cultural pause, and a growing collection that encourages people to spend time with stories, ideas, and each other.";

  const aboutCards = document.querySelectorAll("#aboutPage .about-cards .detail-card");
  if (siteContent.about?.visionTitle) {
    aboutCards[0].querySelector("h3").textContent = siteContent.about.visionTitle;
    aboutCards[0].querySelector("p").textContent = siteContent.about.visionText;
  }
  if (siteContent.about?.libraryTitle) {
    aboutCards[1].querySelector("h3").textContent = siteContent.about.libraryTitle;
    aboutCards[1].querySelector("p").textContent = siteContent.about.libraryText;
  }
  const visitCard = document.querySelector("#aboutPage .about-copy > .detail-card");
  visitCard.querySelector("h3").textContent = siteContent.about?.visitTitle || "Visit Us";
  visitCard.querySelector("p").textContent = siteContent.about?.visitText || "";

  document.querySelector(".footer-copy").innerHTML =
    `${siteContent.footer?.byline || "Fireflies Studio Library by"} <a href="https://www.detourodisha.com" target="_blank" rel="noreferrer">Detour Odisha</a>`;
  const footerNotes = document.querySelectorAll(".footer-note");
  footerNotes[0].textContent = siteContent.footer?.address || "";
  footerNotes[1].textContent = siteContent.footer?.note || "";
}

function getAuthorFeatureScore(book) {
  const author = normalizeText(book.author);

  for (let index = 0; index < FEATURED_AUTHORS.length; index += 1) {
    if (author.includes(normalizeText(FEATURED_AUTHORS[index]))) {
      return FEATURED_AUTHORS.length - index;
    }
  }

  return 0;
}

function getVisibleBooks(filteredBooks) {
  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PER_PAGE));
  state.currentPage = Math.min(state.currentPage, totalPages);
  const startIndex = (state.currentPage - 1) * BOOKS_PER_PAGE;

  return {
    totalPages,
    books: filteredBooks.slice(startIndex, startIndex + BOOKS_PER_PAGE)
  };
}

function formatStatus(status) {
  return status
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function buildGenreOptions() {
  const genres = ["all", ...new Set(books.map((book) => book.genre))];
  genreFilter.innerHTML = genres
    .map(
      (genre) =>
        `<option value="${genre}">${genre === "all" ? "All" : genre}</option>`
    )
    .join("");
}

function renderHeroStats() {
  const availableCount = books.filter((book) => book.status === "available").length;
  const genres = new Set(books.map((book) => book.genre)).size;
  const languages = new Set(
    books.map((book) => book.language).filter(Boolean)
  ).size;

  const statsMarkup = `
    <div class="stat-pill"><strong>${books.length}</strong> books listed</div>
    <div class="stat-pill"><strong>${availableCount}</strong> ready to borrow</div>
    <div class="stat-pill"><strong>${genres}</strong> genres covered</div>
    <div class="stat-pill"><strong>${languages}</strong> languages tagged</div>
  `;

  heroStats.innerHTML = statsMarkup;
  heroStatsDuplicate.innerHTML = statsMarkup;
}

function getFilteredBooks() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedGenre = genreFilter.value;
  const selectedStatus = statusFilter.value;

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      searchTerm === "" ||
      [
        book.title,
        book.author,
        book.genre,
        book.catalogCode,
        book.language,
        book.publisher,
        book.translator,
        book.notes,
        ...book.tags
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);

    const matchesGenre =
      selectedGenre === "all" || book.genre === selectedGenre;

    const matchesStatus =
      selectedStatus === "all" || book.status === selectedStatus;

    const matchesQuickTheme = matchesTheme(book, state.activeTheme);

    return matchesSearch && matchesGenre && matchesStatus && matchesQuickTheme;
  });

  return filteredBooks.sort((left, right) => {
    const rightAuthorScore = getAuthorFeatureScore(right);
    const leftAuthorScore = getAuthorFeatureScore(left);

    if (rightAuthorScore !== leftAuthorScore) {
      return rightAuthorScore - leftAuthorScore;
    }

    const rightRating = right.rating ?? -1;
    const leftRating = left.rating ?? -1;

    if (rightRating !== leftRating) {
      return rightRating - leftRating;
    }

    const rightCount = right.ratingsCount ?? -1;
    const leftCount = left.ratingsCount ?? -1;

    if (rightCount !== leftCount) {
      return rightCount - leftCount;
    }

    return left.title.localeCompare(right.title);
  });
}

function createCoverMarkup(book, large = false) {
  const imageClass = large ? "cover-image detail-image" : "cover-image";
  const imageMarkup = book.coverImage
    ? `<img class="${imageClass}" src="${book.coverImage}" alt="Cover of ${escapeHtml(book.title)}" loading="${large ? "eager" : "lazy"}" decoding="async" onerror="this.remove()" />`
    : "";
  const accent = getAccent(book);

  return `
    <div class="${large ? "detail-cover" : "book-card-cover"}" style="background: linear-gradient(135deg, ${accent}, #1f2b25);">
      ${imageMarkup}
      <div class="cover-inner">
        <div class="cover-title">${book.title}</div>
        <div class="cover-author">${book.author}</div>
      </div>
    </div>
  `;
}

function renderBooks() {
  const filteredBooks = getFilteredBooks();
  const paginated = getVisibleBooks(filteredBooks);
  resultCount.textContent = `${filteredBooks.length} result${filteredBooks.length === 1 ? "" : "s"}`;
  searchSummary.textContent = buildSearchSummary(filteredBooks.length);

  if (!filteredBooks.some((book) => book.id === state.selectedBookId)) {
    state.selectedBookId = filteredBooks[0]?.id ?? null;
  }

  emptyState.classList.toggle("hidden", filteredBooks.length > 0);
  searchSummary.classList.toggle("hidden", filteredBooks.length === 0);

  bookGrid.innerHTML = paginated.books
    .map(
      (book) => `
        <article class="book-card ${book.id === state.selectedBookId ? "active" : ""}" data-id="${book.id}" tabindex="0" aria-label="View details for ${book.title}">
          ${createCoverMarkup(book)}
          <h3>${book.title}</h3>
          <p class="meta-text">${book.author}</p>
          <div class="meta-row">
            <span class="tag">${book.genre}</span>
            <span class="status-badge ${book.status}">${formatAvailability(book.status)}</span>
          </div>
          <p class="meta-text">${book.language || "Language TBD"} • ${formatRating(book)}</p>
        </article>
      `
    )
    .join("");

  pageStatus.textContent =
    filteredBooks.length > 0
      ? `Page ${state.currentPage} of ${paginated.totalPages}`
      : "Page 0 of 0";
  prevPageButton.disabled = state.currentPage <= 1;
  nextPageButton.disabled =
    filteredBooks.length === 0 || state.currentPage >= paginated.totalPages;

  renderDetails(filteredBooks);
  scheduleBooksForCurrentView(paginated.books);
}

function buildSearchSummary(resultCountValue) {
  const parts = [];

  if (searchInput.value.trim()) {
    parts.push(`matching "${searchInput.value.trim()}"`);
  }
  if (genreFilter.value !== "all") {
    parts.push(`in ${genreFilter.value}`);
  }
  if (statusFilter.value !== "all") {
    parts.push(`${formatAvailability(statusFilter.value).toLowerCase()}`);
  }
  if (state.activeTheme !== "all") {
    const theme = QUICK_THEMES.find((item) => item.id === state.activeTheme);
    if (theme) {
      parts.push(`under ${theme.label.toLowerCase()}`);
    }
  }

  if (parts.length === 0) {
    return `${resultCountValue} books ready to explore.`;
  }

  return `${resultCountValue} books ${parts.join(", ")}.`;
}

function renderGenresView() {
  const filteredBooks = getFilteredBooks();
  const groupedBooks = filteredBooks.reduce((groups, book) => {
    const genre = book.genre || "Uncategorized";
    if (!groups[genre]) {
      groups[genre] = [];
    }
    groups[genre].push(book);
    return groups;
  }, {});

  const orderedGenres = Object.keys(groupedBooks).sort((left, right) =>
    left.localeCompare(right)
  );

  genreSummary.textContent = `${orderedGenres.length} genre${orderedGenres.length === 1 ? "" : "s"}`;
  genreSections.innerHTML = orderedGenres
    .map((genre) => {
      const items = groupedBooks[genre].sort((left, right) =>
        left.title.localeCompare(right.title)
      );
      const isExpanded = Boolean(state.expandedGenres[genre]);
      const visibleItems = isExpanded ? items : items.slice(0, GENRE_PREVIEW_COUNT);

      scheduleBooksForCurrentView(items.slice(0, 12));

      return `
        <section class="genre-section">
          <div class="genre-header">
            <h3>${escapeHtml(genre)}</h3>
            <p class="genre-count">${items.length} book${items.length === 1 ? "" : "s"}</p>
          </div>
          <div class="genre-book-list">
            ${visibleItems
              .map(
                (book) => `
                  <article class="genre-book" data-id="${book.id}" tabindex="0" aria-label="View details for ${book.title}">
                    <div>
                      <p class="genre-book-title">${escapeHtml(book.title)}</p>
                      <p class="genre-book-meta">${escapeHtml(book.author)} • ${escapeHtml(book.language || "Language TBD")}</p>
                    </div>
                    <div class="detail-meta">
                      <span class="status-badge ${book.status}">${formatAvailability(book.status)}</span>
                      <span class="tag">${escapeHtml(formatRating(book))}</span>
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
          ${
            items.length > GENRE_PREVIEW_COUNT
              ? `
          <div class="genre-actions">
            <button class="ghost-button genre-toggle" type="button" data-genre="${escapeHtml(genre)}">
              ${isExpanded ? "Show less" : `View more (${items.length - GENRE_PREVIEW_COUNT} more)`}
            </button>
          </div>
          `
              : ""
          }
        </section>
      `;
    })
    .join("");
}

function renderActiveView() {
  const showCatalog = state.activeView === "catalog";
  catalogView.classList.toggle("hidden", !showCatalog);
  genresView.classList.toggle("hidden", showCatalog);

  Array.from(viewSwitcher.querySelectorAll(".view-tab")).forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });

  if (showCatalog) {
    renderBooks();
  } else {
    renderGenresView();
    renderDetails(getFilteredBooks());
  }
}

function renderActivePage() {
  const isHome = state.activePage === "home";
  const isCatalog = state.activePage === "catalog";
  const isAbout = state.activePage === "about";

  homePage.classList.toggle("hidden", !isHome);
  featuredWeekSection.classList.toggle("hidden", !isHome);
  homeCurationSection.classList.toggle("hidden", !isHome);
  catalogPage.classList.toggle("hidden", !isCatalog);
  catalogLayout.classList.toggle("hidden", !isCatalog);
  aboutPage.classList.toggle("hidden", !isAbout);

  Array.from(siteNav.querySelectorAll(".site-nav-link")).forEach((button) => {
    button.classList.toggle("active", button.dataset.page === state.activePage);
  });

  if (isCatalog) {
    renderActiveView();
  }

  if (isHome) {
    renderCuratedShelves();
    renderBookOfTheWeek();
  }
}

function initCursorEffect() {
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const brandLogo = document.querySelector(".brand-logo");

  if (!cursorOrbit || !brandLogo || !finePointer || reducedMotion) {
    return;
  }
  let rafId = null;
  let active = false;
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };

  function animate() {
    if (!active) {
      rafId = null;
      return;
    }

    current.x += (target.x - current.x) * 0.18;
    current.y += (target.y - current.y) * 0.18;
    cursorOrbit.style.transform = `translate(${current.x}px, ${current.y}px)`;
    rafId = window.requestAnimationFrame(animate);
  }

  brandLogo.addEventListener("pointerenter", (event) => {
    active = true;
    target.x = event.clientX;
    target.y = event.clientY;
    current.x = event.clientX;
    current.y = event.clientY;
    cursorOrbit.classList.remove("hidden");

    if (!rafId) {
      rafId = window.requestAnimationFrame(animate);
    }
  });

  brandLogo.addEventListener(
    "pointermove",
    (event) => {
      target.x = event.clientX;
      target.y = event.clientY;
    },
    { passive: true }
  );

  brandLogo.addEventListener("pointerleave", () => {
    active = false;
    cursorOrbit.classList.add("hidden");
  });
}

function renderDetails(filteredBooks) {
  const selectedBook =
    filteredBooks.find((book) => book.id === state.selectedBookId) ?? null;

  if (!selectedBook) {
    detailsContent.innerHTML = `
      <div class="detail-card">
        <h3>No book selected</h3>
        <p class="detail-text">Adjust the filters or search term to explore the collection again.</p>
      </div>
    `;
    return;
  }

  detailsContent.innerHTML = `
    ${createCoverMarkup(selectedBook, true)}
    <div class="detail-grid">
      <div>
        <h2>${selectedBook.title}</h2>
        <p class="meta-text">${selectedBook.author}</p>
        <div class="detail-meta">
          <span class="tag">${selectedBook.genre}</span>
          <span class="status-badge ${selectedBook.status}">${formatAvailability(selectedBook.status)}</span>
          <span class="tag">${escapeHtml(formatRating(selectedBook))}</span>
        </div>
      </div>

      <div class="detail-card">
        <h3>Summary</h3>
        <p class="detail-text">${escapeHtml(getBookSummary(selectedBook))}</p>
      </div>

      <div class="detail-card">
        <h3>Why It Stands Out</h3>
        <p class="detail-text">${escapeHtml(buildWhyItStandsOut(selectedBook))}</p>
      </div>

      <div class="detail-card">
        <h3>Edition Details</h3>
        <div class="detail-list">
          ${createDetailItem("Availability", formatAvailability(selectedBook.status))}
          ${createDetailItem("Reader rating", formatRating(selectedBook))}
          ${createDetailItem("Copies", String(selectedBook.copies || 1))}
          ${createDetailItem("Language", selectedBook.language)}
          ${createDetailItem("Publisher", selectedBook.publisher)}
          ${createDetailItem("Published", String(selectedBook.published || ""))}
          ${createDetailItem("ISBN", selectedBook.isbn)}
          ${createDetailItem("Translator", selectedBook.translator)}
          ${createDetailItem("Condition", selectedBook.condition)}
          ${createDetailItem("Donated by", selectedBook.donatedBy)}
          ${createDetailItem("Borrowed by", selectedBook.borrowedBy)}
          ${createDetailItem("Borrow date", selectedBook.borrowDate)}
          ${createDetailItem("Return date", selectedBook.returnDate)}
        </div>
      </div>

      ${
        selectedBook.notes
          ? `
      <div class="detail-card">
        <h3>Notes</h3>
        <p class="detail-text">${escapeHtml(selectedBook.notes)}</p>
      </div>
      `
          : ""
      }

      <div class="detail-card">
        <h3>Tags</h3>
        <div class="detail-meta">
          ${selectedBook.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>

      <div class="detail-card">
        <h3>Author Spotlight</h3>
        <p class="detail-text">${escapeHtml(buildAuthorSpotlight(selectedBook))}</p>
      </div>

      <div class="detail-card">
        <h3>Similar Picks</h3>
        <div class="detail-meta">
          ${getSimilarBooks(selectedBook)
            .map(
              (book) => `<button class="theme-chip related-book-chip" data-related-book-id="${book.id}" type="button">${escapeHtml(book.title)}</button>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function buildAuthorSpotlight(book) {
  if (bookOverrides[book.title]?.authorSpotlight) {
    return bookOverrides[book.title].authorSpotlight;
  }

  const sameAuthor = books.filter((entry) => normalizeText(entry.author) === normalizeText(book.author));
  const genres = new Set(sameAuthor.map((entry) => entry.genre).filter(Boolean));

  if (sameAuthor.length <= 1) {
    return `${book.author} appears in the Fireflies collection as a distinctive voice worth exploring further. This title is a good starting point for visitors discovering their work.`;
  }

  return `${book.author} appears ${sameAuthor.length} times in the Fireflies collection across ${genres.size} genre${genres.size === 1 ? "" : "s"}, making this author a strong thread for readers who enjoy following a voice across different books.`;
}

function getSimilarBooks(book) {
  return books
    .filter((entry) => entry.id !== book.id && entry.genre === book.genre)
    .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
    .slice(0, 3);
}

function buildWhyItStandsOut(book) {
  if (bookOverrides[book.title]?.whyItStandsOut) {
    return bookOverrides[book.title].whyItStandsOut;
  }

  const lines = [
    book.genre ? `A strong choice for readers drawn to ${book.genre.toLowerCase()}.` : "",
    book.language ? `This edition is available in ${book.language}.` : "",
    book.rating ? `It also carries a visible web reader rating, making it an easy recommendation for new visitors.` : `It is a good candidate for discovery if you like finding less obvious titles in a physical library.`
  ].filter(Boolean);

  return lines.join(" ");
}

function attachEvents() {
  [searchInput, genreFilter, statusFilter].forEach((element) => {
    element.addEventListener("input", () => {
      state.currentPage = 1;
      renderActiveView();
    });
    element.addEventListener("change", () => {
      state.currentPage = 1;
      renderActiveView();
    });
  });

  bookGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".book-card");
    if (!card) {
      return;
    }

    state.selectedBookId = Number(card.dataset.id);
    renderActiveView();
  });

  bookGrid.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const card = event.target.closest(".book-card");
    if (!card) {
      return;
    }

    event.preventDefault();
    state.selectedBookId = Number(card.dataset.id);
    renderActiveView();
  });

  prevPageButton.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      renderActiveView();
    }
  });

  nextPageButton.addEventListener("click", () => {
    state.currentPage += 1;
    renderActiveView();
  });

  viewSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest(".view-tab");
    if (!button || button.dataset.view === state.activeView) {
      return;
    }

    state.activeView = button.dataset.view;
    renderActiveView();
  });

  genreSections.addEventListener("click", (event) => {
    const toggle = event.target.closest(".genre-toggle");
    if (toggle) {
      const genre = toggle.dataset.genre;
      state.expandedGenres[genre] = !state.expandedGenres[genre];
      renderActiveView();
      return;
    }

    const row = event.target.closest(".genre-book");
    if (!row) {
      return;
    }

    state.selectedBookId = Number(row.dataset.id);
    renderActiveView();
  });

  genreSections.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const toggle = event.target.closest(".genre-toggle");
    if (toggle) {
      event.preventDefault();
      const genre = toggle.dataset.genre;
      state.expandedGenres[genre] = !state.expandedGenres[genre];
      renderActiveView();
      return;
    }

    const row = event.target.closest(".genre-book");
    if (!row) {
      return;
    }

    event.preventDefault();
    state.selectedBookId = Number(row.dataset.id);
    renderActiveView();
  });

  siteNav.addEventListener("click", (event) => {
    const button = event.target.closest(".site-nav-link");
    if (!button) {
      return;
    }

    state.activePage = button.dataset.page;
    renderActivePage();
  });

  document.addEventListener("click", (event) => {
    const themeButton = event.target.closest(".theme-chip");
    if (themeButton?.dataset.theme) {
      state.activeTheme = themeButton.dataset.theme;
      state.currentPage = 1;
      if (themeButton.closest("#homeThemeRow")) {
        state.activePage = "catalog";
      }
      renderThemeChips();
      renderActivePage();
      return;
    }

    const curatedBook = event.target.closest("[data-book-id]");
    if (curatedBook) {
      state.selectedBookId = Number(curatedBook.dataset.bookId);
      state.activePage = "catalog";
      renderActivePage();
      return;
    }

    const relatedBook = event.target.closest("[data-related-book-id]");
    if (relatedBook) {
      state.selectedBookId = Number(relatedBook.dataset.relatedBookId);
      renderActiveView();
      return;
    }

    const button = event.target.closest("[data-page-target]");
    if (!button) {
      return;
    }

    if (button.dataset.featuredBookId) {
      state.selectedBookId = Number(button.dataset.featuredBookId);
    }
    state.activePage = button.dataset.pageTarget;
    renderActivePage();
  });
}

if (books.length > 0) {
  books.forEach((book) => {
    book.generatedSummary = getBookSummary(book);
    if (coverCache[book.id]) {
      book.coverImage = coverCache[book.id];
    }
    if (metadataCache[book.id]) {
      Object.assign(book, metadataCache[book.id]);
    }
  });
  buildGenreOptions();
  renderThemeChips();
  renderHeroStats();
  applySiteContent();
  attachEvents();
  renderActivePage();
  initCursorEffect();
} else {
  genreFilter.innerHTML = '<option value="all">All</option>';
  resultCount.textContent = "0 results";
  detailsContent.innerHTML = `
    <div class="detail-card">
      <h3>No catalog data found</h3>
      <p class="detail-text">Add records to <code>books-data.js</code> to populate the app.</p>
    </div>
  `;
}
