import { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType } from '@discordjs/voice';
import { Readable } from 'node:stream';

const JAMENDO_API = 'https://api.jamendo.com/v3.0';

export function createMusicManager() {
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
  });
  const queue = [];
  let current = null;

  async function searchTrack(query) {
    const clientId = process.env.JAMENDO_CLIENT_ID;
    if (!clientId) throw new Error('JAMENDO_CLIENT_ID is missing. Add it in Railway Variables.');
    const url = new URL(`${JAMENDO_API}/tracks/`);
    url.search = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      limit: '10',
      search: query,
      audioformat: 'mp32',
      include: 'licenses',
      order: 'relevance'
    }).toString();

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Jamendo search failed (${response.status})`);
    const json = await response.json();
    const tracks = json?.results ?? [];
    // Only use audio URLs returned by Jamendo's API. The user must still comply
    // with the specific track's displayed license/usage terms.
    return tracks.filter(t => t.audio && t.id).map(t => ({
      id: t.id,
      name: t.name,
      artist: t.artist_name,
      album: t.album_name,
      audio: t.audio,
      page: t.shareurl,
      license: t.license_ccurl || 'Check the track page for license terms'
    }));
  }

  async function enqueue(query) {
    const results = await searchTrack(query);
    if (!results.length) throw new Error(`No playable Jamendo result found for "${query}". Try another title/artist.`);
    // Play the best matching result; avoid unexpectedly queuing several similar search results.
    queue.push(results[0]);
    if (!current) playNext();
    return results[0];
  }

  function playNext() {
    current = queue.shift() || null;
    if (!current) return;
    (async () => {
      try {
        const response = await fetch(current.audio);
        if (!response.ok || !response.body) throw new Error(`Audio source returned HTTP ${response.status}`);
        const stream = Readable.fromWeb(response.body);
        const resource = createAudioResource(stream, {
          inputType: StreamType.Arbitrary,
          metadata: current
        });
        player.play(resource);
      } catch (error) {
        console.error('[audio source]', error.message);
        current = null;
        playNext();
      }
    })();
  }

  player.on(AudioPlayerStatus.Idle, () => {
    if (current) playNext();
  });
  player.on('error', error => {
    console.error('[audio player]', error.message);
    current = null;
    playNext();
  });

  return {
    player,
    get current() { return current; },
    get queue() { return [...queue]; },
    enqueue,
    stop() {
      queue.length = 0;
      current = null;
      player.stop(true);
    },
    skip() {
      if (!current) return false;
      player.stop(true);
      return true;
    }
  };
}
