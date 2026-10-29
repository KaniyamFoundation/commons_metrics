# CommonsPulse — Wikimedia Commons Contributor Metrics

> A modern, zero-backend static web application for tracking and exploring **Wikimedia Commons** contributor metrics, with a dedicated focus on **high-volume contributors from India**, regional initiatives, and national upload campaigns.

![CommonsPulse Preview](assets/logo.svg)

---

## 🌟 Key Features

1. **High-Volume Contributor Leaderboard (India Focus)**
   - Curated directory of prominent Indian uploaders (e.g. `Gangulybiswarup`, `Pinakpani`, `Sumita Roy Dutta`, `Vengolis`, `Bodhisattwa`, `Sumitsurai`, `Jkadavoor`, `I.Mahesh`, `Tagooty`, and more).
   - Metrics tracked:
     - Total uploaded media files (**Namespace 6: File**)
     - Overall edit counts and user rights/badges (Autopatrolled, Filemover, Admin/Sysop, Image Reviewer)
     - Quality Images (QI), Valued Images (VI), and Featured Pictures (FP) counts
     - Geographic distribution by state (West Bengal, Kerala, Karnataka, Punjab, Andhra Pradesh, Telangana, Maharashtra, Rajasthan)
     - Focus themes (Terracotta Temples, Biodiversity, Hoysala Architecture, Avifauna, Urban Heritage)
   - Real-time client-side search, filtering, and multi-column sorting.
   - Dual layout options: **Table View** and **Grid Cards View**.

2. **National Campaign & Competition Observatory**
   - Detailed metrics for India's major photo initiatives:
     - **Wiki Loves Monuments (India)**
     - **Wiki Loves Earth (India)**
     - **Wiki Loves Folklore (India)**
     - **Wiki Explores Series** (West Bengal, Bankura, Hooghly, Nadia)
     - **GLAM India** (National Museum, State Archives, digitized manuscripts)
   - Year-by-year upload growth and unique contributor participation.

3. **Live Contributor Inspector (Deep Dive)**
   - Enter **any Wikimedia Commons username** to fetch real-time profile data via the Commons Action API (`origin=*` CORS).
   - Displays user rights, account age, upload count, and a live visual gallery of their most recent uploads with thumbnail previews, dimensions, file size, and direct Commons file links.

4. **Live Commons Category Scanner**
   - Enter any Wikimedia Commons category name (e.g., `Category:Images from Wiki Loves Monuments 2023 in India` or `Category:Terracotta temples in West Bengal`).
   - Dynamically scans the category members and aggregates an on-the-fly contributor leaderboard showing top uploaders and total megabytes.

5. **Visual Analytics & Insights**
   - Interactive charts powered by Chart.js:
     - Top 10 Contributors by Upload Volume (horizontal bar chart)
     - Regional Distribution by State (doughnut chart)
     - Multi-year Campaign Upload Velocity (time-series line chart)
     - Media Format Distribution (JPEG, PDF/DjVu, PNG, SVG)

6. **Data Export**
   - One-click export of current filtered contributor dataset to **CSV** or **JSON**.

7. **Wikimedia Codex & Dark/Light Theme Design**
   - Clean, accessible typography and styling inspired by Wikipedia / Wikimedia Design System.
   - Fluid Dark/Light theme switching with OS preference detection and `localStorage` persistence.

---

## 🚀 Quick Start (Running Locally)

Because this is a completely static site, no Node.js build step or database is required! You can run it with any static HTTP server:

### Option A: Python (Built-in)
```bash
# Run from the project root
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Option B: Node.js / npx
```bash
npx serve .
```

---

## 📁 Repository Structure

```
commons_metrics/
├── index.html                   # Semantic HTML5 single-page application
├── css/
│   └── style.css                # Custom Wikimedia-aligned CSS & animations
├── js/
│   ├── app.js                   # Application coordinator & state management
│   ├── api.js                   # Wikimedia Commons & XTools API client with caching
│   └── charts.js                # Chart.js visualization configurations
├── data/
│   ├── contributors_india.json  # Curated Indian contributor metrics & sample files
│   ├── campaigns_india.json     # Major national campaigns (WLM, WLE, WLF, GLAM)
│   ├── global_benchmarks.json   # Global top uploaders benchmark comparisons
│   └── category_presets.json    # 1-click preset categories for the scanner
├── scripts/
│   ├── fetch_metrics.py         # Python utility to refresh contributor stats
│   ├── scan_category.py         # CLI tool to scan any Commons category
│   └── requirements.txt         # Dependencies (Standard library only!)
├── assets/
│   └── logo.svg                 # CommonsPulse SVG vector logo
└── README.md                    # Project documentation
```

---

## 🛠️ Data Refresh Scripts

Python scripts are included in the `scripts/` directory to query Wikimedia Commons APIs:

### 1. Scan Any Category from Terminal
```bash
python3 scripts/scan_category.py "Category:Images from Wiki Loves Monuments 2023 in India" --limit 100
```
Outputs:
```text
Scanning category: Category:Images from Wiki Loves Monuments 2023 in India (max: 100)...
Scanned 100 files successfully.

--- TOP CONTRIBUTORS ---
1. Santhu9299: 86 files (412.35 MB)
2. Wellwornbackpack: 14 files (48.12 MB)
```

### 2. Batch Fetch User Metrics
```bash
python3 scripts/fetch_metrics.py
```
Uses polite Wikimedia API request pacing (`User-Agent: CommonsMetricsApp/1.0`) with exponential backoff on HTTP 429.

---

## 🚢 Deployment & GitHub Pages

This site is published and automatically deployed on **GitHub Pages**:
- **Live URL**: [https://kaniyamfoundation.github.io/commons_metrics/](https://kaniyamfoundation.github.io/commons_metrics/)
- **Repository**: [https://github.com/KaniyamFoundation/commons_metrics](https://github.com/KaniyamFoundation/commons_metrics)

The site includes two automated GitHub Actions workflows:
1. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): Automatically builds and deploys every commit to GitHub Pages.
2. [`.github/workflows/update-metrics.yml`](.github/workflows/update-metrics.yml): Runs daily at 02:00 UTC to refresh contributor counts against the live Commons API and commit fresh data.

---

## 👥 About & Credits

- **Organization**: [Kaniyam Foundation](https://kaniyam.com/foundation) ([கணியம் அறக்கட்டளை](https://kaniyam.com/foundation))
- **Pair Programming**: Developed with Google DeepMind's Antigravity AI assistant.
- **Data Source**: Wikimedia Commons Action API & Toolforge XTools.

---

## 📄 License & Attribution

- **Code**: Licensed under the [MIT License](https://opensource.org/licenses/MIT).
- **Text & Documentation**: Licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
- **Media Files**: Images referenced from Wikimedia Commons are copyright by their respective authors under free licenses (CC-BY-SA, CC-BY, CC0, or Public Domain).
