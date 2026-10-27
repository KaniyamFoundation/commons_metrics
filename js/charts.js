/**
 * Chart.js Visualization Module for Commons Metrics
 */

export class MetricsCharts {
  constructor() {
    this.charts = {};
  }

  getThemeColors(isDark) {
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',
      tooltipBorder: isDark ? '#334155' : '#e2e8f0'
    };
  }

  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      delete this.charts[id];
    }
  }

  /**
   * Top 10 Indian Contributors by Upload Volume (Horizontal Bar Chart)
   */
  renderTopUploadersChart(canvasId, contributors, isDark = false) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors(isDark);
    const top10 = [...contributors].sort((a, b) => b.uploads - a.uploads).slice(0, 10);

    const labels = top10.map(c => c.realName ? `${c.username} (${c.realName})` : c.username);
    const data = top10.map(c => c.uploads);

    // Gradient bar styling
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 500, 0);
    gradient.addColorStop(0, '#006699');
    gradient.addColorStop(1, '#339966');

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Uploads (Namespace 6)',
          data: data,
          backgroundColor: gradient,
          borderRadius: 6,
          barThickness: 20
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => ` Uploads: ${context.raw.toLocaleString()} files`
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              callback: (val) => val >= 1000 ? `${val / 1000}k` : val
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: theme.textColor,
              font: { weight: 500 }
            }
          }
        }
      }
    });
  }

  /**
   * State / Regional Distribution of Uploads (Doughnut Chart)
   */
  renderStateDistributionChart(canvasId, contributors, isDark = false) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors(isDark);

    // Aggregate uploads by state
    const stateCounts = {};
    for (const c of contributors) {
      const state = c.state || 'Other';
      stateCounts[state] = (stateCounts[state] || 0) + c.uploads;
    }

    const sortedStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);
    const labels = sortedStates.map(s => s[0]);
    const data = sortedStates.map(s => s[1]);

    const palette = [
      '#0284c7', '#059669', '#d97706', '#9333ea',
      '#e11d48', '#0d9488', '#ea580c', '#4f46e5'
    ];

    this.charts[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: isDark ? 2 : 2,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: theme.textColor,
              boxWidth: 14,
              padding: 14,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = ((context.raw / total) * 100).toFixed(1);
                return ` ${context.label}: ${context.raw.toLocaleString()} (${percent}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Campaigns Growth Chart (Uploads by Year)
   */
  renderCampaignsChart(canvasId, campaigns, isDark = false) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors(isDark);

    // Years 2019 to 2024
    const years = [2019, 2020, 2021, 2022, 2023, 2024];
    const colors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    const datasets = campaigns.slice(0, 4).map((c, idx) => {
      const yearMap = {};
      (c.yearlyBreakdown || []).forEach(y => { yearMap[y.year] = y.uploads; });
      return {
        label: c.name.replace(/\(.*?\)/g, '').trim(),
        data: years.map(yr => yearMap[yr] || 0),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '22',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35
      };
    });

    this.charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: years,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: theme.textColor, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.raw.toLocaleString()} uploads`
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              callback: (val) => val >= 1000 ? `${val / 1000}k` : val
            }
          }
        }
      }
    });
  }

  /**
   * User File Format Distribution (Doughnut Chart in Inspector modal)
   */
  renderUserFormatChart(canvasId, isDark = false) {
    this.destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors(isDark);

    this.charts[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['JPEG Images', 'PDF / DjVu Documents', 'PNG Graphics', 'SVG Vector', 'Video / Audio'],
        datasets: [{
          data: [82, 11, 4, 2, 1],
          backgroundColor: ['#0284c7', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'],
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: theme.textColor, boxWidth: 12, padding: 10, font: { size: 11 } }
          }
        }
      }
    });
  }

  /**
   * Refreshes chart themes upon Dark/Light toggle
   */
  updateAllThemes(isDark, contributors, campaigns) {
    if (this.charts['chart-top-contributors']) {
      this.renderTopUploadersChart('chart-top-contributors', contributors, isDark);
    }
    if (this.charts['chart-state-distribution']) {
      this.renderStateDistributionChart('chart-state-distribution', contributors, isDark);
    }
    if (this.charts['chart-campaigns-trend']) {
      this.renderCampaignsChart('chart-campaigns-trend', campaigns, isDark);
    }
  }
}

export const metricsCharts = new MetricsCharts();
