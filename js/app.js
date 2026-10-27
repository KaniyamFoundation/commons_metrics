/**
 * Main Application Orchestrator for Wikimedia Commons Metrics Dashboard
 */

import { commonsApi } from './api.js';
import { metricsCharts } from './charts.js';

class CommonsMetricsApp {
  constructor() {
    this.contributors = [];
    this.campaigns = [];
    this.globalBenchmarks = [];
    this.categoryPresets = [];

    this.state = {
      activeTab: 'leaderboard',
      searchQuery: '',
      stateFilter: 'all',
      minUploads: 0,
      sortBy: 'uploads',
      sortAsc: false,
      viewMode: 'table', // 'table' or 'cards'
      isDark: false,
      currentPage: 1,
      itemsPerPage: 15
    };

    this.selectedContributor = null;
  }

  async init() {
    this.initTheme();
    await this.loadData();
    this.initEventListeners();
    this.renderOverviewStats();
    this.renderLeaderboard();
    this.renderCampaigns();
    this.renderGlobalBenchmarks();
    this.renderCategoryPresets();
    this.renderCharts();
    this.handleRoute();

    // Render Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem('wmc_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.state.isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    this.applyTheme();
  }

  applyTheme() {
    if (this.state.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', this.state.isDark ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons();
    }
    metricsCharts.updateAllThemes(this.state.isDark, this.contributors, this.campaigns);
  }

  toggleTheme() {
    this.state.isDark = !this.state.isDark;
    localStorage.setItem('wmc_theme', this.state.isDark ? 'dark' : 'light');
    this.applyTheme();
    this.showToast(`Switched to ${this.state.isDark ? 'Dark' : 'Light'} theme`);
  }

  async loadData() {
    try {
      const [cResp, campResp, benchResp, presResp] = await Promise.all([
        fetch('data/contributors_india.json'),
        fetch('data/campaigns_india.json'),
        fetch('data/global_benchmarks.json'),
        fetch('data/category_presets.json')
      ]);

      this.contributors = await cResp.json();
      this.campaigns = await campResp.json();
      this.globalBenchmarks = await benchResp.json();
      this.categoryPresets = await presResp.json();

      // Merge any user-added custom contributors from localStorage
      try {
        const custom = JSON.parse(localStorage.getItem('wmc_custom_contributors') || '[]');
        if (Array.isArray(custom)) {
          custom.forEach(item => {
            if (!this.contributors.some(c => c.username.toLowerCase() === item.username.toLowerCase())) {
              this.contributors.push(item);
            }
          });
          this.contributors.sort((a, b) => b.uploads - a.uploads);
        }
      } catch (e) {}
    } catch (err) {
      console.error('Error loading data files:', err);
      this.showToast('Failed to load metrics datasets', 'error');
    }
  }

  initEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());

    // Navigation Tabs
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Hash navigation
    window.addEventListener('hashchange', () => this.handleRoute());

    // Search and filters
    const searchInput = document.getElementById('contributor-search');
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = e.target.value.trim().toLowerCase();
      this.state.currentPage = 1;
      this.renderLeaderboard();
    });

    const stateSelect = document.getElementById('state-filter');
    stateSelect?.addEventListener('change', (e) => {
      this.state.stateFilter = e.target.value;
      this.state.currentPage = 1;
      this.renderLeaderboard();
    });

    const minUploadsSelect = document.getElementById('min-uploads-filter');
    minUploadsSelect?.addEventListener('change', (e) => {
      this.state.minUploads = parseInt(e.target.value, 10) || 0;
      this.state.currentPage = 1;
      this.renderLeaderboard();
    });

    const sortSelect = document.getElementById('sort-by-select');
    sortSelect?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.renderLeaderboard();
    });

    // View toggle (table vs cards)
    document.getElementById('view-table-btn')?.addEventListener('click', () => {
      this.state.viewMode = 'table';
      document.getElementById('view-table-btn')?.classList.add('bg-primary/10', 'text-primary');
      document.getElementById('view-cards-btn')?.classList.remove('bg-primary/10', 'text-primary');
      this.renderLeaderboard();
    });

    document.getElementById('view-cards-btn')?.addEventListener('click', () => {
      this.state.viewMode = 'cards';
      document.getElementById('view-cards-btn')?.classList.add('bg-primary/10', 'text-primary');
      document.getElementById('view-table-btn')?.classList.remove('bg-primary/10', 'text-primary');
      this.renderLeaderboard();
    });

    // Export buttons
    document.getElementById('export-csv-btn')?.addEventListener('click', () => this.exportCSV());
    document.getElementById('export-json-btn')?.addEventListener('click', () => this.exportJSON());

    // Live Inspector Search Form
    const inspectorForm = document.getElementById('inspector-search-form');
    inspectorForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = document.getElementById('inspector-input')?.value.trim();
      if (user) this.inspectUser(user);
    });

    // Category Scanner Form
    const categoryForm = document.getElementById('category-scanner-form');
    categoryForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('category-input')?.value.trim();
      if (cat) this.scanCategory(cat);
    });

    // Modal close
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('contributor-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'contributor-modal') this.closeModal();
    });

    // Add / Verify Contributor live modal
    const addModal = document.getElementById('add-contributor-modal');
    document.getElementById('add-contributor-btn')?.addEventListener('click', () => {
      addModal?.classList.remove('hidden');
    });
    document.getElementById('add-modal-close-btn')?.addEventListener('click', () => {
      addModal?.classList.add('hidden');
    });
    addModal?.addEventListener('click', (e) => {
      if (e.target.id === 'add-contributor-modal') addModal?.classList.add('hidden');
    });

    const addForm = document.getElementById('add-contributor-form');
    addForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('add-username-input')?.value.trim();
      const state = document.getElementById('add-state-input')?.value || 'India';
      if (!username) return;

      const submitBtn = document.getElementById('add-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Querying Commons API...`;
      }

      try {
        const userInfo = await commonsApi.fetchUserInfo(username);
        const uploadCount = await commonsApi.fetchUserUploadCount(username);
        const recent = await commonsApi.fetchUserRecentUploads(username, 2);

        const newContributor = {
          username: userInfo.name,
          realName: userInfo.name,
          avatar: recent[0]?.thumbUrl || recent[0]?.url || 'assets/logo.svg',
          uploads: uploadCount || 1,
          editCount: userInfo.editCount,
          registration: userInfo.registration,
          state: state,
          region: state.includes('Tamil') || state.includes('Kerala') || state.includes('Karnataka') ? 'Southern India' : 'India',
          groups: userInfo.groups,
          qualityImages: 0,
          valuedImages: 0,
          featuredPictures: 0,
          primaryThemes: ['Media Uploads', `${state} Heritage`],
          campaigns: ['Community Contributions'],
          dominantLicense: 'CC-BY-SA 4.0',
          estStorageGB: Math.round((uploadCount * 5) / 1024),
          recentUploads: recent.map(r => ({
            title: r.title,
            fileName: r.rawTitle,
            timestamp: r.timestamp,
            sizeMB: parseFloat(r.sizeMB),
            mime: r.mime
          })),
          notableContributions: `Active contributor from ${state} with ${uploadCount.toLocaleString()} media uploads.`
        };

        // Add or update
        const existingIdx = this.contributors.findIndex(c => c.username.toLowerCase() === username.toLowerCase());
        if (existingIdx >= 0) {
          this.contributors[existingIdx] = newContributor;
        } else {
          this.contributors.push(newContributor);
        }

        // Sort
        this.contributors.sort((a, b) => b.uploads - a.uploads);

        // Save custom contributors in localStorage
        try {
          const custom = JSON.parse(localStorage.getItem('wmc_custom_contributors') || '[]');
          custom.push(newContributor);
          localStorage.setItem('wmc_custom_contributors', JSON.stringify(custom));
        } catch (e) {}

        this.renderOverviewStats();
        this.renderLeaderboard();
        this.renderCharts();
        this.showToast(`Verified & added ${userInfo.name} (${uploadCount.toLocaleString()} uploads) to leaderboard!`);
        addModal?.classList.add('hidden');
        if (addForm) addForm.reset();
      } catch (err) {
        this.showToast(`Error adding contributor: ${err.message}`, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 mr-2"></i><span>Fetch Live & Add to Leaderboard</span>`;
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });
  }

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'leaderboard';
    this.switchTab(hash, false);
  }

  switchTab(tabName, updateHash = true) {
    this.state.activeTab = tabName;
    if (updateHash) {
      window.location.hash = tabName;
    }

    // Update nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const active = btn.getAttribute('data-tab') === tabName;
      if (active) {
        btn.classList.add('border-primary', 'text-primary', 'dark:text-sky-400', 'font-semibold');
        btn.classList.remove('border-transparent', 'text-slate-500');
      } else {
        btn.classList.remove('border-primary', 'text-primary', 'dark:text-sky-400', 'font-semibold');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });

    // Show/hide sections
    document.querySelectorAll('.tab-section').forEach(sec => {
      sec.classList.toggle('hidden', sec.id !== `tab-${tabName}`);
    });

    // Render charts if tab is insights or leaderboard
    if (tabName === 'insights' || tabName === 'leaderboard') {
      setTimeout(() => this.renderCharts(), 50);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.lucide) window.lucide.createIcons();
  }

  renderOverviewStats() {
    const totalUploads = this.contributors.reduce((acc, c) => acc + (c.uploads || 0), 0);
    const totalQI = this.contributors.reduce((acc, c) => acc + (c.qualityImages || 0), 0);
    const totalStorage = this.contributors.reduce((acc, c) => acc + (c.estStorageGB || 0), 0);

    const elUploads = document.getElementById('stat-total-uploads');
    const elContributors = document.getElementById('stat-total-contributors');
    const elQuality = document.getElementById('stat-total-qi');
    const elStorage = document.getElementById('stat-total-storage');

    if (elUploads) elUploads.textContent = totalUploads.toLocaleString() + '+';
    if (elContributors) elContributors.textContent = this.contributors.length.toString();
    if (elQuality) elQuality.textContent = totalQI.toLocaleString() + '+';
    if (elStorage) elStorage.textContent = Math.round(totalStorage).toLocaleString() + ' GB';
  }

  getFilteredContributors() {
    let list = [...this.contributors];

    // Search query
    if (this.state.searchQuery) {
      const q = this.state.searchQuery;
      list = list.filter(c => 
        c.username.toLowerCase().includes(q) ||
        (c.realName && c.realName.toLowerCase().includes(q)) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.primaryThemes && c.primaryThemes.some(t => t.toLowerCase().includes(q)))
      );
    }

    // State filter
    if (this.state.stateFilter !== 'all') {
      list = list.filter(c => c.state === this.state.stateFilter);
    }

    // Min uploads
    if (this.state.minUploads > 0) {
      list = list.filter(c => c.uploads >= this.state.minUploads);
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[this.state.sortBy];
      let valB = b[this.state.sortBy];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.state.sortAsc ? -1 : 1;
      if (valA > valB) return this.state.sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }

  renderLeaderboard() {
    const list = this.getFilteredContributors();
    const countEl = document.getElementById('filtered-count-badge');
    if (countEl) countEl.textContent = `${list.length} contributors`;

    const maxUploads = this.contributors.length > 0 ? this.contributors[0].uploads : 1;

    const tableContainer = document.getElementById('leaderboard-table-view');
    const cardsContainer = document.getElementById('leaderboard-cards-view');
    const tbody = document.getElementById('leaderboard-tbody');

    if (this.state.viewMode === 'table') {
      tableContainer?.classList.remove('hidden');
      cardsContainer?.classList.add('hidden');

      if (!tbody) return;
      tbody.innerHTML = '';

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="py-12 text-center text-slate-400">
              <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
              No contributors match your filters.
            </td>
          </tr>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      list.forEach((c, idx) => {
        const rank = idx + 1;
        const rankBadge = rank === 1 ? 'rank-badge-1' : rank === 2 ? 'rank-badge-2' : rank === 3 ? 'rank-badge-3' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
        const volumePercent = Math.min(100, Math.round((c.uploads / maxUploads) * 100));

        const groupsHtml = (c.groups || []).map(g => {
          let badgeClass = 'badge-autopatrolled';
          if (g === 'sysop') badgeClass = 'badge-admin';
          else if (g === 'filemover') badgeClass = 'badge-filemover';
          else if (g.includes('reviewer')) badgeClass = 'badge-reviewer';
          return `<span class="px-2 py-0.5 text-xs rounded-full font-medium ${badgeClass}">${g}</span>`;
        }).join(' ');

        const themesHtml = (c.primaryThemes || []).slice(0, 3).map(t => 
          `<span class="inline-block bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded mr-1 mb-1">${t}</span>`
        ).join('');

        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors';
        tr.innerHTML = `
          <td class="py-4 px-4 text-center">
            <span class="w-7 h-7 inline-flex items-center justify-center rounded-full text-xs font-bold ${rankBadge}">
              ${rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : rank}
            </span>
          </td>
          <td class="py-4 px-4">
            <div class="flex items-center gap-3">
              <img src="${c.avatar}" alt="${c.username}" class="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm" onerror="this.src='assets/logo.svg'" />
              <div>
                <div class="flex items-center gap-2">
                  <button class="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors contributor-name-btn text-left" data-username="${c.username}">
                    ${c.username}
                  </button>
                  <a href="https://commons.wikimedia.org/wiki/User:${encodeURIComponent(c.username)}" target="_blank" rel="noopener" class="text-slate-400 hover:text-primary" title="Open on Wikimedia Commons">
                    <i data-lucide="external-link" class="w-3.5 h-3.5 inline"></i>
                  </a>
                </div>
                ${c.realName ? `<p class="text-xs text-slate-500 dark:text-slate-400">${c.realName}</p>` : ''}
                <div class="mt-1 flex flex-wrap gap-1">${groupsHtml}</div>
              </div>
            </div>
          </td>
          <td class="py-4 px-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold text-slate-900 dark:text-white text-base">${c.uploads.toLocaleString()}</span>
              <span class="text-xs text-slate-400">files</span>
            </div>
            <div class="w-28 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div class="bg-gradient-to-r from-sky-500 to-emerald-500 h-full rounded-full volume-bar" style="width: ${volumePercent}%"></div>
            </div>
          </td>
          <td class="py-4 px-4">
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${c.editCount.toLocaleString()}</span>
          </td>
          <td class="py-4 px-4">
            <div class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-sm">
              <i data-lucide="award" class="w-4 h-4"></i>
              <span>${c.qualityImages || 0}</span>
              ${c.featuredPictures ? `<span class="text-xs text-rose-500 ml-1">(${c.featuredPictures} FP)</span>` : ''}
            </div>
          </td>
          <td class="py-4 px-4">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-200">${c.state || 'India'}</p>
            <div class="mt-1">${themesHtml}</div>
          </td>
          <td class="py-4 px-4 text-right">
            <button class="px-3 py-1.5 text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors inspect-btn" data-username="${c.username}">
              Inspect
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      // Cards View
      tableContainer?.classList.add('hidden');
      cardsContainer?.classList.remove('hidden');

      if (!cardsContainer) return;
      cardsContainer.innerHTML = '';

      list.forEach((c, idx) => {
        const rank = idx + 1;
        const rankBadge = rank === 1 ? 'rank-badge-1' : rank === 2 ? 'rank-badge-2' : rank === 3 ? 'rank-badge-3' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
        const card = document.createElement('div');
        card.className = 'contributor-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between';
        
        const themesHtml = (c.primaryThemes || []).slice(0, 3).map(t => 
          `<span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded">${t}</span>`
        ).join('');

        card.innerHTML = `
          <div>
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="flex items-center gap-3">
                <img src="${c.avatar}" alt="${c.username}" class="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm" onerror="this.src='assets/logo.svg'" />
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white hover:text-primary cursor-pointer contributor-name-btn" data-username="${c.username}">${c.username}</h4>
                  ${c.realName ? `<p class="text-xs text-slate-500 dark:text-slate-400">${c.realName}</p>` : ''}
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">📍 ${c.city ? `${c.city}, ` : ''}${c.state}</p>
                </div>
              </div>
              <span class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${rankBadge}">
                ${rank <= 3 ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : `#${rank}`}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 py-3 my-2 border-y border-slate-100 dark:border-slate-800/80">
              <div>
                <span class="text-xs text-slate-400 uppercase font-medium">Uploads</span>
                <p class="text-xl font-extrabold text-slate-900 dark:text-white">${c.uploads.toLocaleString()}</p>
              </div>
              <div>
                <span class="text-xs text-slate-400 uppercase font-medium">Quality Images</span>
                <p class="text-xl font-extrabold text-amber-500">${c.qualityImages || 0}</p>
              </div>
            </div>

            <p class="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 my-2">${c.notableContributions || ''}</p>
            <div class="flex flex-wrap gap-1 my-3">${themesHtml}</div>
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span class="text-xs text-slate-400">Since ${c.registration ? c.registration.split('-')[0] : 'N/A'}</span>
            <button class="px-3.5 py-1.5 text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg border border-sky-200 dark:border-sky-800 transition-colors inspect-btn" data-username="${c.username}">
              Deep Dive
            </button>
          </div>
        `;
        cardsContainer.appendChild(card);
      });
    }

    // Attach inspect click handlers
    document.querySelectorAll('.inspect-btn, .contributor-name-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.currentTarget.getAttribute('data-username');
        if (username) this.openInspectorModal(username);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderCampaigns() {
    const container = document.getElementById('campaigns-list-container');
    if (!container) return;
    container.innerHTML = '';

    this.campaigns.forEach(camp => {
      const card = document.createElement('div');
      card.className = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow';
      
      const themesHtml = (camp.topThemes || []).map(t => 
        `<span class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-2.5 py-1 rounded-full">${t}</span>`
      ).join('');

      card.innerHTML = `
        <div class="flex items-start justify-between gap-4 mb-3">
          <div>
            <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-2 inline-block">
              ${camp.yearsActive}
            </span>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">${camp.name}</h3>
          </div>
          <a href="https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(camp.category)}" target="_blank" rel="noopener" class="text-primary hover:text-sky-600 flex items-center gap-1 text-xs font-medium">
            Category <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
          </a>
        </div>

        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">${camp.description}</p>

        <div class="grid grid-cols-2 gap-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 mb-4">
          <div>
            <span class="text-xs text-slate-400 block font-medium">Total Media Uploads</span>
            <span class="text-xl font-black text-slate-900 dark:text-white">${camp.totalUploads.toLocaleString()}+</span>
          </div>
          <div>
            <span class="text-xs text-slate-400 block font-medium">Unique Uploaders</span>
            <span class="text-xl font-black text-sky-600 dark:text-sky-400">${camp.uniqueUploaders.toLocaleString()}</span>
          </div>
        </div>

        <div class="mb-4">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Key Themes</span>
          <div class="flex flex-wrap gap-1.5">${themesHtml}</div>
        </div>

        <button class="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white dark:hover:bg-primary text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 scan-campaign-btn" data-category="${camp.category}">
          <i data-lucide="scan" class="w-4 h-4"></i>
          Scan Live Contributor Leaderboard
        </button>
      `;
      container.appendChild(card);
    });

    document.querySelectorAll('.scan-campaign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-category');
        this.switchTab('explorer');
        const input = document.getElementById('category-input');
        if (input) input.value = cat;
        this.scanCategory(cat);
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderGlobalBenchmarks() {
    const tbody = document.getElementById('global-benchmarks-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    this.globalBenchmarks.forEach((g, idx) => {
      const tr = document.createElement('tr');
      const isInd = g.isIndianTop;
      tr.className = `border-b border-slate-100 dark:border-slate-800 ${isInd ? 'bg-amber-50/50 dark:bg-amber-950/20 font-semibold' : ''}`;
      tr.innerHTML = `
        <td class="py-3 px-4 text-center text-sm font-bold">${idx + 1}</td>
        <td class="py-3 px-4">
          <span class="${isInd ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}">
            ${g.username}
          </span>
          ${isInd ? ' 🇮🇳' : ''}
        </td>
        <td class="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">${g.country}</td>
        <td class="py-3 px-4 text-sm font-bold text-slate-900 dark:text-white">${g.uploads.toLocaleString()}</td>
        <td class="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">${g.primaryThemes ? g.primaryThemes.join(', ') : ''}</td>
        <td class="py-3 px-4 text-right">
          <a href="https://commons.wikimedia.org/wiki/User:${encodeURIComponent(g.username)}" target="_blank" rel="noopener" class="text-xs text-primary hover:underline">
            View Commons
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderCategoryPresets() {
    const container = document.getElementById('category-presets-container');
    if (!container) return;
    container.innerHTML = '';

    this.categoryPresets.forEach(preset => {
      const chip = document.createElement('button');
      chip.className = 'px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary hover:text-white dark:hover:bg-primary transition-colors flex items-center gap-1.5';
      chip.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-primary inline-block"></span>
        ${preset.name}
      `;
      chip.addEventListener('click', () => {
        const input = document.getElementById('category-input');
        if (input) input.value = preset.category;
        this.scanCategory(preset.category);
      });
      container.appendChild(chip);
    });
  }

  renderCharts() {
    metricsCharts.renderTopUploadersChart('chart-top-contributors', this.contributors, this.state.isDark);
    metricsCharts.renderStateDistributionChart('chart-state-distribution', this.contributors, this.state.isDark);
    metricsCharts.renderCampaignsChart('chart-campaigns-trend', this.campaigns, this.state.isDark);
  }

  async openInspectorModal(username) {
    const modal = document.getElementById('contributor-modal');
    modal?.classList.remove('hidden');

    let localData = this.contributors.find(c => c.username.toLowerCase() === username.toLowerCase());

    const titleEl = document.getElementById('modal-username');
    const subtitleEl = document.getElementById('modal-realname');
    const avatarEl = document.getElementById('modal-avatar');
    const uploadsCountEl = document.getElementById('modal-uploads-count');
    const editCountEl = document.getElementById('modal-edit-count');
    const regDateEl = document.getElementById('modal-registration-date');
    const groupsEl = document.getElementById('modal-groups');
    const commonsLinkEl = document.getElementById('modal-commons-link');
    const galleryEl = document.getElementById('modal-gallery-container');
    const loaderEl = document.getElementById('modal-gallery-loader');

    if (titleEl) titleEl.textContent = username;
    if (commonsLinkEl) commonsLinkEl.href = `https://commons.wikimedia.org/wiki/User:${encodeURIComponent(username)}`;
    if (subtitleEl) subtitleEl.textContent = localData?.realName || 'Wikimedia Commons Contributor';
    if (avatarEl) avatarEl.src = localData?.avatar || 'assets/logo.svg';
    if (uploadsCountEl) uploadsCountEl.textContent = localData ? localData.uploads.toLocaleString() : 'Fetching...';
    if (editCountEl) editCountEl.textContent = localData ? localData.editCount.toLocaleString() : 'Fetching...';
    if (regDateEl) regDateEl.textContent = localData?.registration || 'Fetching...';

    if (groupsEl) {
      const groups = localData?.groups || ['user'];
      groupsEl.innerHTML = groups.map(g => `<span class="px-2 py-0.5 text-xs rounded-full font-medium badge-autopatrolled">${g}</span>`).join(' ');
    }

    if (galleryEl) galleryEl.innerHTML = '';
    if (loaderEl) loaderEl.classList.remove('hidden');

    // If user not in local pre-bundled dataset, fetch info live from Commons API
    if (!localData) {
      try {
        const userInfo = await commonsApi.fetchUserInfo(username);
        if (editCountEl) editCountEl.textContent = userInfo.editCount.toLocaleString();
        if (regDateEl) regDateEl.textContent = userInfo.registration;
        if (groupsEl && userInfo.groups.length > 0) {
          groupsEl.innerHTML = userInfo.groups.map(g => `<span class="px-2 py-0.5 text-xs rounded-full font-medium badge-autopatrolled">${g}</span>`).join(' ');
        }
        
        const count = await commonsApi.fetchUserUploadCount(username);
        if (uploadsCountEl) uploadsCountEl.textContent = count > 0 ? count.toLocaleString() : 'Available on Commons';
      } catch (err) {
        console.warn('Could not fetch live user info:', err);
      }
    }

    // Fetch live recent uploads
    try {
      const recent = await commonsApi.fetchUserRecentUploads(username, 8);
      if (loaderEl) loaderEl.classList.add('hidden');

      if (recent.length === 0) {
        galleryEl.innerHTML = `<p class="col-span-full py-8 text-center text-slate-400">No public uploads retrieved for this user.</p>`;
      } else {
        recent.forEach(img => {
          const item = document.createElement('div');
          item.className = 'preview-thumb bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between';
          item.innerHTML = `
            <a href="${img.filePageUrl}" target="_blank" rel="noopener" class="block aspect-video overflow-hidden bg-slate-900/10">
              <img src="${img.url}" alt="${img.title}" class="w-full h-full object-cover" loading="lazy" onerror="this.src='assets/logo.svg'" />
            </a>
            <div class="p-3">
              <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title="${img.title}">${img.title}</p>
              <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>${img.timestamp}</span>
                <span>${img.sizeMB} MB</span>
              </div>
            </div>
          `;
          galleryEl.appendChild(item);
        });
      }
    } catch (err) {
      if (loaderEl) loaderEl.classList.add('hidden');
      galleryEl.innerHTML = `<p class="col-span-full py-6 text-center text-rose-500">Failed to fetch live uploads: ${err.message}</p>`;
    }

    // Render file format doughnut chart
    metricsCharts.renderUserFormatChart('modal-user-format-chart', this.state.isDark);

    if (window.lucide) window.lucide.createIcons();
  }

  closeModal() {
    const modal = document.getElementById('contributor-modal');
    modal?.classList.add('hidden');
  }

  async inspectUser(username) {
    this.openInspectorModal(username);
  }

  async scanCategory(categoryName) {
    const loader = document.getElementById('category-scanner-loader');
    const resultBox = document.getElementById('category-results-box');
    const statusText = document.getElementById('category-scan-status');

    loader?.classList.remove('hidden');
    resultBox?.classList.add('hidden');
    if (statusText) statusText.textContent = `Connecting to Commons Action API for "${categoryName}"...`;

    try {
      const data = await commonsApi.scanCategoryContributors(categoryName, 120, (scanned, total) => {
        if (statusText) statusText.textContent = `Scanned ${scanned} files from category...`;
      });

      loader?.classList.add('hidden');
      resultBox?.classList.remove('hidden');

      // Populate results
      document.getElementById('cat-res-title').textContent = data.category;
      document.getElementById('cat-res-files').textContent = data.totalFilesScanned.toLocaleString();
      document.getElementById('cat-res-contributors').textContent = data.uniqueContributors.toLocaleString();
      document.getElementById('cat-res-size').textContent = `${data.totalSizeMB} MB`;

      const tbody = document.getElementById('category-leaderboard-tbody');
      if (tbody) {
        tbody.innerHTML = '';
        data.leaderboard.forEach((row, idx) => {
          const tr = document.createElement('tr');
          tr.className = 'border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40';
          tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-center">${idx + 1}</td>
            <td class="py-3 px-4 font-medium text-slate-900 dark:text-white">
              <button class="hover:text-primary contributor-name-btn" data-username="${row.user}">${row.user}</button>
            </td>
            <td class="py-3 px-4 font-bold text-primary">${row.count}</td>
            <td class="py-3 px-4 text-sm text-slate-500">${(row.totalSize / (1024 * 1024)).toFixed(2)} MB</td>
            <td class="py-3 px-4 text-right">
              <button class="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white rounded-md inspect-btn" data-username="${row.user}">Inspect</button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.inspect-btn, .contributor-name-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const u = e.currentTarget.getAttribute('data-username');
            if (u) this.openInspectorModal(u);
          });
        });
      }

      this.showToast(`Scanned ${data.totalFilesScanned} files across ${data.uniqueContributors} contributors!`);
    } catch (err) {
      loader?.classList.add('hidden');
      this.showToast(`Error scanning category: ${err.message}`, 'error');
    }
  }

  exportCSV() {
    const list = this.getFilteredContributors();
    if (list.length === 0) return;

    const headers = ['Rank', 'Username', 'RealName', 'Uploads', 'Edits', 'QualityImages', 'State', 'City', 'DominantLicense', 'Registration'];
    const rows = list.map((c, idx) => [
      idx + 1,
      `"${c.username}"`,
      `"${c.realName || ''}"`,
      c.uploads,
      c.editCount,
      c.qualityImages || 0,
      `"${c.state || ''}"`,
      `"${c.city || ''}"`,
      `"${c.dominantLicense || ''}"`,
      `"${c.registration || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wikimedia_commons_contributors_india_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast(`Exported ${list.length} contributors to CSV`);
  }

  exportJSON() {
    const list = this.getFilteredContributors();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(list, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `wikimedia_commons_contributors_india_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast(`Exported ${list.length} contributors to JSON`);
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.className = `fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 transform translate-y-0 opacity-100 ${
      type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800' : 'bg-slate-900 text-white border-slate-800 dark:bg-white dark:text-slate-900'
    }`;

    setTimeout(() => {
      toast.classList.add('translate-y-12', 'opacity-0');
    }, 3200);
  }
}

// Instantiate and start app
document.addEventListener('DOMContentLoaded', () => {
  const app = new CommonsMetricsApp();
  app.init();
  window.commonsApp = app;
});
