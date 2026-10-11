const yts = require('yt-search');

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreResult(query, result) {
  const score = { title: 0, channel: 0 };
  const normalizedQuery = normalize(query);
  const title = normalize(result && result.title ? result.title : '');
  const author = normalize(result && result.author ? result.author.name : '');

  if (!normalizedQuery) return 0;

  if (title.includes(normalizedQuery)) score.title += 80;
  if (author.includes(normalizedQuery)) score.channel += 20;

  const queryTerms = normalizedQuery.split(' ');
  for (const term of queryTerms) {
    if (!term) continue;
    if (title.includes(term)) score.title += 10;
    if (author.includes(term)) score.channel += 5;
  }

  return score.title + score.channel;
}

async function searchYouTube(query, limit = 5) {
  if (!query || !String(query).trim()) {
    throw new Error('A valid YouTube search query is required.');
  }

  const search = await yts(query);
  const videos = Array.isArray(search?.videos) ? search.videos : [];

  return videos.slice(0, limit).map((video) => ({
    title: video.title,
    artist: video.author?.name || 'Unknown artist',
    url: video.url,
    description: video.description || '',
    thumbnail: video.thumbnail || '',
    duration: video.duration || 'N/A',
    views: video.views || 0,
  }));
}

function pickBestResult(query, results = []) {
  if (!results.length) return null;
  const ranked = [...results].sort((a, b) => scoreResult(query, b) - scoreResult(query, a));
  return ranked[0];
}

async function getPlayableTrack(query, limit = 5) {
  const searchResults = await searchYouTube(query, limit);
  if (!searchResults.length) return null;

  const best = pickBestResult(query, searchResults);
  return {
    ...best,
    query,
    source: 'youtube',
    addedAt: new Date().toISOString(),
  };
}

module.exports = {
  searchYouTube,
  pickBestResult,
  getPlayableTrack,
};
