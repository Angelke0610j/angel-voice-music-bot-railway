const fs = require('fs');
const path = require('path');

class PlaylistStore {
  constructor(filePath = 'data/playlists.json') {
    this.filePath = path.resolve(filePath);
    this.ensureStorage();
  }

  ensureStorage() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2));
    }
  }

  read() {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    try {
      return JSON.parse(raw) || {};
    } catch (error) {
      return {};
    }
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  guildKey(guildId) {
    return String(guildId || 'global');
  }

  listPlaylists(guildId) {
    const data = this.read();
    const guildData = data[this.guildKey(guildId)] || {};
    return Object.entries(guildData).map(([name, songs]) => ({
      name,
      songs: Array.isArray(songs) ? songs : [],
    }));
  }

  getPlaylist(guildId, name) {
    const data = this.read();
    const guildData = data[this.guildKey(guildId)] || {};
    return { name, songs: guildData[name] || [] };
  }

  createPlaylist(guildId, name) {
    const store = this.read();
    const guildData = store[this.guildKey(guildId)] || {};
    if (guildData[name]) {
      return false;
    }

    guildData[name] = [];
    store[this.guildKey(guildId)] = guildData;
    this.write(store);
    return true;
  }

  addSong(guildId, name, song) {
    const store = this.read();
    const guildData = store[this.guildKey(guildId)] || {};
    if (!guildData[name]) {
      guildData[name] = [];
    }

    guildData[name].push({
      ...song,
      addedAt: new Date().toISOString(),
    });

    store[this.guildKey(guildId)] = guildData;
    this.write(store);
    return guildData[name];
  }

  removeSong(guildId, name, songNumber) {
    const store = this.read();
    const guildData = store[this.guildKey(guildId)] || {};
    const songs = guildData[name] || [];
    if (songNumber < 1 || songNumber > songs.length) {
      return null;
    }

    const removedSong = songs.splice(songNumber - 1, 1)[0];
    guildData[name] = songs;
    store[this.guildKey(guildId)] = guildData;
    this.write(store);
    return removedSong;
  }

  deletePlaylist(guildId, name) {
    const store = this.read();
    const guildData = store[this.guildKey(guildId)] || {};
    delete guildData[name];
    store[this.guildKey(guildId)] = guildData;
    this.write(store);
    return true;
  }
}

module.exports = {
  PlaylistStore,
};
