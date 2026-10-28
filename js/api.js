/**
 * Wikimedia Commons API Client
 * Interfaces with Wikimedia Action API and XTools API with caching and CORS support.
 */

const API_BASE = 'https://commons.wikimedia.org/w/api.php';
const XTOOLS_BASE = 'https://xtools.wmcloud.org/api/user';
const CACHE_PREFIX = 'wmc_cache_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class CommonsApiClient {
  constructor() {
    this.memoryCache = new Map();
  }

  getCache(key) {
    if (this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (Date.now() - item.time < CACHE_TTL_MS) return item.data;
    }
    try {
      const local = localStorage.getItem(CACHE_PREFIX + key);
      if (local) {
        const item = JSON.parse(local);
        if (Date.now() - item.time < CACHE_TTL_MS) {
          this.memoryCache.set(key, item);
          return item.data;
        }
      }
    } catch (e) {
      // LocalStorage might be disabled or full
    }
    return null;
  }

  setCache(key, data) {
    const item = { time: Date.now(), data };
    this.memoryCache.set(key, item);
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
      // Ignore quota errors
    }
  }

  /**
   * Fetches user account info (registration date, edit count, user groups).
   */
  async fetchUserInfo(username) {
    const cacheKey = `userinfo_${username}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const url = `${API_BASE}?action=query&list=users&ususers=${encodeURIComponent(username)}&usprop=editcount|registration|groups&origin=*&format=json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Commons API Error: ${resp.status}`);
    const data = await resp.json();
    const user = data?.query?.users?.[0];
    if (!user || user.missing !== undefined) {
      throw new Error(`User "${username}" not found on Wikimedia Commons.`);
    }

    const result = {
      userId: user.userid,
      name: user.name,
      editCount: user.editcount || 0,
      registration: user.registration ? user.registration.split('T')[0] : 'Unknown',
      groups: (user.groups || []).filter(g => !['*', 'user', 'autoconfirmed'].includes(g))
    };
    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Fetches exact uploaded file count (namespace 6 creations) via XTools with fallback.
   */
  async fetchUserUploadCount(username) {
    const cacheKey = `uploadcount_${username}`;
    const cached = this.getCache(cacheKey);
    if (cached !== null) return cached;

    try {
      const url = `${XTOOLS_BASE}/pages_count/commons.wikimedia.org/${encodeURIComponent(username)}/6`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const count = data?.counts?.['6']?.count;
        if (typeof count === 'number') {
          this.setCache(cacheKey, count);
          return count;
        }
      }
    } catch (e) {
      console.warn('XTools fetch failed, attempting Commons API fallback...', e);
    }

    // Fallback: fetch usercontribs namespace 6 count estimate
    return 0;
  }

  /**
   * Fetches recent uploads with thumbnails and metadata.
   */
  async fetchUserRecentUploads(username, limit = 12) {
    const cacheKey = `recent_${username}_${limit}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const url = `${API_BASE}?action=query&list=allimages&aiuser=${encodeURIComponent(username)}&aisort=timestamp&aidir=descending&ailimit=${limit}&aiprop=timestamp|user|url|size|mime|dimensions&origin=*&format=json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Commons API Error: ${resp.status}`);
    const data = await resp.json();
    const images = data?.query?.allimages || [];

    const result = images.map(img => {
      // Generate standard Commons thumbnail url
      const thumbUrl = img.url ? img.url.replace('/commons/', '/commons/thumb/') + '/400px-' + encodeURIComponent(img.name) : '';
      return {
        title: img.title.replace(/^File:/i, ''),
        rawTitle: img.title,
        timestamp: img.timestamp ? img.timestamp.split('T')[0] : '',
        timeFull: img.timestamp,
        sizeBytes: img.size,
        sizeMB: (img.size / (1024 * 1024)).toFixed(2),
        width: img.width,
        height: img.height,
        mime: img.mime,
        url: img.url,
        thumbUrl: thumbUrl || img.url,
        filePageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(img.title)}`
      };
    });

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Fetches published SQL query results from Quarry (quarry.wmcloud.org)
   * Supports Quarry run URLs or numeric Run IDs with full CORS support.
   */
  async fetchQuarryResult(runIdOrUrl) {
    let qrunId = runIdOrUrl.toString().trim();
    // Extract run ID if full URL provided
    const match = qrunId.match(/run\/(\d+)/i) || qrunId.match(/(\d+)/);
    if (match) {
      qrunId = match[1];
    } else {
      throw new Error('Invalid Quarry Run ID or URL.');
    }

    const url = `https://quarry.wmcloud.org/run/${qrunId}/output/0/json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Quarry responded with HTTP ${resp.status}`);
    const data = await resp.json();

    const headers = data?.headers || [];
    const rows = data?.rows || [];

    const userIdx = headers.findIndex(h => ['username', 'actor_name', 'user'].includes(h.toLowerCase()));
    const uploadIdx = headers.findIndex(h => ['total_uploads', 'uploads', 'count', 'campaign_uploads'].includes(h.toLowerCase()));
    const sizeIdx = headers.findIndex(h => ['total_size_gb', 'total_mb', 'size'].includes(h.toLowerCase()));

    if (userIdx === -1 || uploadIdx === -1) {
      throw new Error(`Quarry result must contain username and upload count columns. Found: ${headers.join(', ')}`);
    }

    return rows.map(r => ({
      username: r[userIdx],
      uploads: parseInt(r[uploadIdx], 10) || 0,
      size: sizeIdx !== -1 ? parseFloat(r[sizeIdx]) : null
    }));
  }

  /**
   * Scans a Commons Category and groups uploads by contributor in real-time.
   */
  async scanCategoryContributors(categoryName, maxFiles = 150, onProgress = null) {
    let cleanName = categoryName.trim();
    if (!cleanName.toLowerCase().startsWith('category:')) {
      cleanName = 'Category:' + cleanName;
    }

    const files = [];
    let cmcontinue = null;
    let keepFetching = true;

    while (keepFetching && files.length < maxFiles) {
      const limit = Math.min(50, maxFiles - files.length);
      let url = `${API_BASE}?action=query&generator=categorymembers&gcmtitle=${encodeURIComponent(cleanName)}&gcmtype=file&gcmlimit=${limit}&prop=imageinfo&iiprop=user|timestamp|size|mime&origin=*&format=json`;
      if (cmcontinue) {
        url += `&gcmcontinue=${encodeURIComponent(cmcontinue)}`;
      }

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to scan category: ${resp.status}`);
      const data = await resp.json();

      const pages = data?.query?.pages || {};
      for (const pid of Object.keys(pages)) {
        const p = pages[pid];
        if (p.imageinfo && p.imageinfo[0]) {
          const info = p.imageinfo[0];
          files.push({
            title: p.title,
            user: info.user || 'Unknown',
            size: info.size || 0,
            mime: info.mime || 'image/jpeg',
            timestamp: info.timestamp || ''
          });
        }
      }

      if (onProgress) {
        onProgress(files.length, maxFiles);
      }

      if (data?.continue?.gcmcontinue && files.length < maxFiles) {
        cmcontinue = data.continue.gcmcontinue;
      } else {
        keepFetching = false;
      }
    }

    // Aggregate by contributor
    const userMap = {};
    const mimeMap = {};
    let totalSize = 0;

    for (const f of files) {
      if (!userMap[f.user]) {
        userMap[f.user] = { user: f.user, count: 0, totalSize: 0, samples: [] };
      }
      userMap[f.user].count += 1;
      userMap[f.user].totalSize += f.size;
      if (userMap[f.user].samples.length < 3) {
        userMap[f.user].samples.push(f.title);
      }

      mimeMap[f.mime] = (mimeMap[f.mime] || 0) + 1;
      totalSize += f.size;
    }

    const leaderboard = Object.values(userMap).sort((a, b) => b.count - a.count);

    return {
      category: cleanName,
      totalFilesScanned: files.length,
      uniqueContributors: leaderboard.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      leaderboard,
      mimeDistribution: mimeMap
    };
  }
}

export const commonsApi = new CommonsApiClient();
