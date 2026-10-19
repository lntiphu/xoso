/**
 * Vietlott Analytics & Prediction Application (js/app.js)
 * Bộ điều khiển chính quản lý UI, sự kiện, đồng bộ dữ liệu và hiển thị biểu đồ
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // --- STATE CỦA ỨNG DỤNG ---
  const state = {
    mainMode: 'traditional', // 'traditional' hoặc 'vietlott'
    lotteryType: 'mega645', // 'mega645' hoặc 'power655'
    recentFilter: 'all', // 'all', '100', '50', '30'
    lotteryData: {
      mega645: [],
      power655: []
    },
    currentDraws: [], // Danh sách kỳ quay đang xét
    activeStats: null,
    activeSumStats: null,
    activePairs: [],
    predictions: [],
    pinnedNumbers: [],
    charts: {
      freq: null,
      sum: null,
      evenOdd: null
    },
    isSyncing: false,
    traditional: {
      selectedDate: getTodayString(),
      selectedRegion: 'mn',
      selectedProvince: 'HCM',
      currentDraw: null,
      currentPrediction: null
    }
  };

  // --- CẤU HÌNH LOẠI HÌNH ---
  const CONFIG = {
    mega645: {
      name: 'Mega 6/45',
      totalBalls: 45,
      hasBonusBall: false,
      drawDays: 'Thứ 4, Thứ 6, Chủ Nhật (18:00)',
      themeColor: '#e53935',
      gradient: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
      rawUrl: 'https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power645.jsonl'
    },
    power655: {
      name: 'Power 6/55',
      totalBalls: 55,
      hasBonusBall: true,
      drawDays: 'Thứ 3, Thứ 5, Thứ 7 (18:00)',
      themeColor: '#1e88e5',
      gradient: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
      rawUrl: 'https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power655.jsonl'
    }
  };

  // --- KHỞI TẠO ỨNG DỤNG ---
  initApp();

  function initApp() {
    loadCachedOrInitialData();
    setupEventListeners();
    setupTraditionalEventListeners();
    initTraditionalDatePicker();
    refreshView();
    refreshTraditionalView();
  }

  /**
   * Nạp dữ liệu từ js/data.js (DEFAULT_LOTTERY_DATA) và localStorage cache
   */
  function loadCachedOrInitialData() {
    // 1. Lấy dữ liệu mặc định
    if (typeof DEFAULT_LOTTERY_DATA !== 'undefined') {
      state.lotteryData.mega645 = [...DEFAULT_LOTTERY_DATA.mega645];
      state.lotteryData.power655 = [...DEFAULT_LOTTERY_DATA.power655];
    }

    // 2. Kiểm tra xem localStorage có bản cập nhật mới hơn không
    try {
      const megaCached = localStorage.getItem('vietlott_cache_mega645');
      if (megaCached) {
        const parsed = JSON.parse(megaCached);
        if (parsed.length >= state.lotteryData.mega645.length) {
          state.lotteryData.mega645 = parsed;
        }
      }

      const powerCached = localStorage.getItem('vietlott_cache_power655');
      if (powerCached) {
        const parsed = JSON.parse(powerCached);
        if (parsed.length >= state.lotteryData.power655.length) {
          state.lotteryData.power655 = parsed;
        }
      }
    } catch (e) {
      console.warn('Lỗi khi đọc cache localStorage:', e);
    }
  }

  /**
   * Cập nhật toàn bộ giao diện theo state hiện tại
   */
  function refreshView() {
    const allDraws = state.lotteryData[state.lotteryType] || [];
    const cfg = CONFIG[state.lotteryType];

    // Lọc danh sách kỳ quay theo bộ lọc thời gian
    if (state.recentFilter === 'all') {
      state.currentDraws = [...allDraws];
    } else {
      const count = parseInt(state.recentFilter, 10);
      state.currentDraws = allDraws.slice(-count);
    }

    if (state.currentDraws.length === 0) return;

    // Tính toán thống kê
    const totalBalls = cfg.totalBalls;
    const stats = LotteryStats.analyzeNumbers(state.currentDraws, totalBalls, 30);
    const pairs = LotteryStats.analyzePairs(state.currentDraws, totalBalls, 30);
    const sumStats = LotteryStats.analyzeSums(state.currentDraws, totalBalls);
    const evenOddStats = LotteryStats.analyzeEvenOdd(state.currentDraws);
    const decadeStats = LotteryStats.analyzeDecades(state.currentDraws, totalBalls);

    state.activeStats = stats;
    state.activeSumStats = sumStats;
    state.activePairs = pairs;

    // Ngữ cảnh tính toán
    const contextData = {
      draws: state.currentDraws,
      stats,
      sumStats,
      pairs,
      evenOddStats,
      decadeStats,
      totalBalls
    };

    // Tạo các bộ số dự đoán
    state.predictions = LotteryPredictor.generateAllPredictions(contextData);

    // Render các khu vực giao diện
    renderHeaderInfo();
    renderLatestDrawHero();
    renderHeroPrediction();
    renderPredictionCards();
    renderKPIs();
    renderHotColdLists();
    renderHeatmap();
    renderPairsTable();
    renderCharts(stats, sumStats, evenOddStats);
    renderHistoryTable();
  }

  // ==================== RENDERING FUNCTIONS ====================

  /**
   * Hiển thị trạng thái dữ liệu trên Header
   */
  function renderHeaderInfo() {
    const allDraws = state.lotteryData[state.lotteryType] || [];
    const latest = allDraws[allDraws.length - 1];
    const dataBadge = document.getElementById('data-status-badge');
    const drawCountEl = document.getElementById('total-draws-count');

    if (drawCountEl) {
      drawCountEl.textContent = `${allDraws.length.toLocaleString()} kỳ quay`;
    }
    if (dataBadge && latest) {
      dataBadge.textContent = `Mới nhất: Kỳ #${latest.id} (${formatDate(latest.date)})`;
    }
  }

  /**
   * Render Hero Section: Kỳ quay mới nhất
   */
  function renderLatestDrawHero() {
    const allDraws = state.lotteryData[state.lotteryType] || [];
    const latest = allDraws[allDraws.length - 1];
    if (!latest) return;

    const cfg = CONFIG[state.lotteryType];
    const container = document.getElementById('latest-draw-balls');
    const idEl = document.getElementById('latest-draw-id');
    const dateEl = document.getElementById('latest-draw-date');
    const scheduleEl = document.getElementById('lottery-schedule');
    const sumEl = document.getElementById('latest-draw-sum');
    const evenOddEl = document.getElementById('latest-draw-evenodd');

    if (idEl) idEl.textContent = `Kỳ quay #${latest.id}`;
    if (dateEl) dateEl.textContent = formatDate(latest.date);
    if (scheduleEl) scheduleEl.textContent = cfg.drawDays;

    if (container) {
      container.innerHTML = '';
      // 6 số chính
      const mainNums = latest.result.slice(0, 6);
      mainNums.forEach(num => {
        const ball = createBallElement(num, 'main');
        container.appendChild(ball);
      });

      // Nếu có số đặc biệt (Power 6/55)
      if (cfg.hasBonusBall && latest.result.length >= 7) {
        const separator = document.createElement('div');
        separator.className = 'ball-separator';
        separator.textContent = '+';
        container.appendChild(separator);

        const bonusNum = latest.result[6];
        const bonusBall = createBallElement(bonusNum, 'bonus');
        bonusBall.title = 'Số đặc biệt Jackpot 2';
        container.appendChild(bonusBall);
      }
    }

    // Thống kê nhanh của kỳ này
    const mainNums = latest.result.slice(0, 6);
    const sum = mainNums.reduce((a, b) => a + b, 0);
    const evenCount = mainNums.filter(n => n % 2 === 0).length;

    if (sumEl) sumEl.textContent = `Tổng điểm: ${sum}`;
    if (evenOddEl) evenOddEl.textContent = `${evenCount} Chẵn - ${6 - evenCount} Lẻ`;
  }

  /**
   * Tính ngày mở thưởng của kỳ tiếp theo theo lịch chính thức Vietlott
   */
  function getNextDrawDate(currentDateStr, lotteryType) {
    if (!currentDateStr) return null;
    const d = new Date(currentDateStr);
    const targetDays = lotteryType === 'mega645' ? [0, 3, 5] : [2, 4, 6];
    for (let i = 1; i <= 7; i++) {
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + i);
      if (targetDays.includes(nextD.getDay())) {
        return nextD;
      }
    }
    const fallback = new Date(d);
    fallback.setDate(d.getDate() + 2);
    return fallback;
  }

  /**
   * Render Bộ 6 Số Hoàng Kim (Master Prediction) tại Hero
   */
  function renderHeroPrediction() {
    const heroCard = document.getElementById('hero-prediction-balls');
    const targetDrawEl = document.getElementById('prediction-target-draw');
    const dateEl = document.getElementById('prediction-draw-date');
    const rationaleEl = document.getElementById('hero-prediction-rationale');
    const allDraws = state.lotteryData[state.lotteryType] || [];
    const latest = allDraws[allDraws.length - 1];

    if (targetDrawEl && latest) {
      const nextId = String(parseInt(latest.id, 10) + 1).padStart(5, '0');
      targetDrawEl.textContent = `Dự đoán cho Kỳ tiếp theo #${nextId}`;

      const nextDate = getNextDrawDate(latest.date, state.lotteryType);
      if (dateEl && nextDate) {
        const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dow = daysOfWeek[nextDate.getDay()];
        const dayStr = String(nextDate.getDate()).padStart(2, '0');
        const monthStr = String(nextDate.getMonth() + 1).padStart(2, '0');
        const yearStr = nextDate.getFullYear();
        dateEl.textContent = `📅 Quay thưởng: ${dow}, ${dayStr}/${monthStr}/${yearStr} (18:00)`;
      }
    }

    const masterPrediction = state.predictions[0]; // Chiến lược Cân bằng tối ưu
    if (!masterPrediction) return;

    if (heroCard) {
      heroCard.innerHTML = '';
      masterPrediction.numbers.forEach(num => {
        const ball = createBallElement(num, 'hero');
        heroCard.appendChild(ball);
      });
    }

    if (rationaleEl) {
      rationaleEl.innerHTML = `<strong>Phân tích AI:</strong> ${masterPrediction.rationale}`;
    }
  }

  /**
   * Render danh sách 6 Bộ Số Dự Đoán (Tab Dự Đoán)
   */
  function renderPredictionCards() {
    const container = document.getElementById('prediction-cards-grid');
    if (!container) return;

    container.innerHTML = '';

    state.predictions.forEach((pred, index) => {
      const card = document.createElement('div');
      card.className = `prediction-card strategy-${pred.strategyId}`;

      const numbersHtml = pred.numbers
        .map(n => `<span class="ball-chip">${String(n).padStart(2, '0')}</span>`)
        .join('');

      const tagsHtml = pred.tags
        .map(t => `<span class="tag-badge">${t}</span>`)
        .join('');

      card.innerHTML = `
        <div class="pred-card-header">
          <div class="pred-title-group">
            <span class="pred-index">Bộ #${index + 1}</span>
            <h3 class="pred-name">${pred.name}</h3>
          </div>
          <span class="pred-badge badge-${pred.badgeColor}">${pred.badge}</span>
        </div>
        
        <div class="pred-confidence">
          <div class="confidence-label">
            <span>Độ tự tin thuật toán</span>
            <strong>${pred.confidence}%</strong>
          </div>
          <div class="confidence-bar">
            <div class="confidence-fill fill-${pred.badgeColor}" style="width: ${pred.confidence}%"></div>
          </div>
        </div>

        <div class="pred-balls-row">
          ${numbersHtml}
        </div>

        <div class="pred-meta-row">
          <span class="meta-item"><i class="icon">∑</i> Tổng: <strong>${pred.sum}</strong></span>
          <span class="meta-item"><i class="icon">⚖</i> <strong>${pred.evenOdd}</strong></span>
        </div>

        <p class="pred-rationale">${pred.rationale}</p>

        <div class="pred-tags-row">
          ${tagsHtml}
        </div>

        <div class="pred-actions">
          <button class="btn btn-outline btn-copy-ticket" data-numbers="${pred.numbers.join(', ')}">
            📋 Sao chép bộ số
          </button>
        </div>
      `;

      container.appendChild(card);
    });

    // Gán sự kiện click cho các nút sao chép
    container.querySelectorAll('.btn-copy-ticket').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const numbers = e.currentTarget.getAttribute('data-numbers');
        copyToClipboard(numbers, `Đã sao chép bộ số: [${numbers}]`);
      });
    });
  }

  /**
   * Render các thẻ KPI tóm tắt trong Tab Thống Kê
   */
  function renderKPIs() {
    const stats = state.activeStats;
    const pairs = state.activePairs;
    const sumStats = state.activeSumStats;
    if (!stats || stats.length === 0) return;

    // Sắp xếp số theo tần suất cao nhất
    const sortedByFreq = [...stats].sort((a, b) => b.count - a.count);
    const topHot = sortedByFreq[0];

    // Sắp xếp theo Lô Gan hiện tại dài nhất
    const sortedByGan = [...stats].sort((a, b) => b.currentGan - a.currentGan);
    const topCold = sortedByGan[0];

    // Cặp số nhiều nhất
    const topPair = pairs[0];

    document.getElementById('kpi-total-draws').textContent = state.currentDraws.length.toLocaleString();
    document.getElementById('kpi-hot-number').textContent = `#${String(topHot.number).padStart(2, '0')} (${topHot.count} lần)`;
    document.getElementById('kpi-cold-number').textContent = `#${String(topCold.number).padStart(2, '0')} (Gan ${topCold.currentGan} kỳ)`;
    if (topPair) {
      document.getElementById('kpi-top-pair').textContent = `[${String(topPair.num1).padStart(2, '0')} - ${String(topPair.num2).padStart(2, '0')}] (${topPair.count} lần)`;
    }
    document.getElementById('kpi-avg-sum').textContent = `${sumStats.avgSum} (μ: ${sumStats.theoreticalMean})`;
  }

  /**
   * Render danh sách Top 10 Số Nóng & Top 10 Số Lạnh
   */
  function renderHotColdLists() {
    const stats = state.activeStats;
    if (!stats) return;

    // Top 10 Hot
    const hotList = [...stats].sort((a, b) => b.count - a.count).slice(0, 10);
    const hotContainer = document.getElementById('top-hot-list');
    if (hotContainer) {
      hotContainer.innerHTML = '';
      hotList.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'hotcold-row';
        row.innerHTML = `
          <div class="rank">#${idx + 1}</div>
          <div class="ball-chip hot-chip">${String(item.number).padStart(2, '0')}</div>
          <div class="hotcold-info">
            <div class="freq-bar-bg">
              <div class="freq-bar-fill fill-hot" style="width: ${Math.min(100, item.percentage * 4)}%"></div>
            </div>
            <div class="detail-text">
              <span>Đã về: <strong>${item.count} lần</strong> (${item.percentage.toFixed(1)}%)</span>
              <span>30 kỳ gần đây: <strong>${item.recentCount} lần</strong></span>
            </div>
          </div>
        `;
        hotContainer.appendChild(row);
      });
    }

    // Top 10 Cold / Lô Gan
    const coldList = [...stats].sort((a, b) => b.currentGan - a.currentGan).slice(0, 10);
    const coldContainer = document.getElementById('top-cold-list');
    if (coldContainer) {
      coldContainer.innerHTML = '';
      coldList.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'hotcold-row';
        row.innerHTML = `
          <div class="rank">#${idx + 1}</div>
          <div class="ball-chip cold-chip">${String(item.number).padStart(2, '0')}</div>
          <div class="hotcold-info">
            <div class="freq-bar-bg">
              <div class="freq-bar-fill fill-cold" style="width: ${Math.min(100, (item.currentGan / (item.maxGan || 30)) * 100)}%"></div>
            </div>
            <div class="detail-text">
              <span>Đang Gan: <strong class="text-danger">${item.currentGan} kỳ</strong></span>
              <span>Gan kỷ lục: <strong>${item.maxGan} kỳ</strong></span>
            </div>
          </div>
        `;
        coldContainer.appendChild(row);
      });
    }
  }

  /**
   * Render Bảng Nhiệt Ma Trận (Heatmap Matrix) cho toàn bộ 45/55 số
   */
  function renderHeatmap() {
    const container = document.getElementById('heatmap-container');
    const stats = state.activeStats;
    if (!container || !stats) return;

    container.innerHTML = '';

    // Tìm min, max count để scale màu
    const counts = stats.map(s => s.count);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    stats.forEach(item => {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';

      // Tính sắc thái nhiệt độ (0: xanh lạnh -> 1: đỏ lửa)
      const ratio = maxCount > minCount ? (item.count - minCount) / (maxCount - minCount) : 0.5;
      cell.style.setProperty('--heat-ratio', ratio);

      cell.innerHTML = `
        <span class="cell-num">${String(item.number).padStart(2, '0')}</span>
        <span class="cell-count">${item.count}</span>
      `;

      cell.title = `Số ${String(item.number).padStart(2, '0')}: Đã về ${item.count} lần (${item.percentage.toFixed(1)}%). Đang gan: ${item.currentGan} kỳ.`;

      container.appendChild(cell);
    });
  }

  /**
   * Render Bảng Các Cặp Số Hay Về Cùng Nhau Nhất
   */
  function renderPairsTable() {
    const tbody = document.getElementById('pairs-table-body');
    const pairs = state.activePairs;
    if (!tbody || !pairs) return;

    tbody.innerHTML = '';

    pairs.slice(0, 15).forEach((p, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${index + 1}</td>
        <td>
          <div class="pair-chips">
            <span class="ball-chip">${String(p.num1).padStart(2, '0')}</span>
            <span class="pair-hyphen">-</span>
            <span class="ball-chip">${String(p.num2).padStart(2, '0')}</span>
          </div>
        </td>
        <td><strong>${p.count}</strong> lần</td>
        <td>${p.percentage.toFixed(2)}%</td>
        <td>
          <span class="lift-badge ${p.lift >= 1.2 ? 'high' : 'normal'}">
            ${p.lift.toFixed(2)}x
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * Render Biểu Đồ Thống Kê (Chart.js)
   */
  function renderCharts(stats, sumStats, evenOddStats) {
    // Kiểm tra xem thư viện Chart.js đã nạp chưa
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js chưa sẵn sàng.');
      return;
    }

    // 1. Biểu đồ tần suất các số (Bar Chart)
    const freqCtx = document.getElementById('chart-frequency')?.getContext('2d');
    if (freqCtx) {
      if (state.charts.freq) state.charts.freq.destroy();

      const labels = stats.map(s => String(s.number).padStart(2, '0'));
      const data = stats.map(s => s.count);
      const bgColors = stats.map(s => {
        if (s.status === 'hot') return '#ef4444';
        if (s.status === 'cold') return '#3b82f6';
        return '#eab308';
      });

      state.charts.freq = new Chart(freqCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Số lần xuất hiện',
            data,
            backgroundColor: bgColors,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Đã về: ${ctx.raw} lần`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.08)' },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }

    // 2. Biểu đồ phân bố tổng điểm (Gauss Distribution)
    const sumCtx = document.getElementById('chart-sum-dist')?.getContext('2d');
    if (sumCtx) {
      if (state.charts.sum) state.charts.sum.destroy();

      const dist = sumStats.distribution;
      const labels = Object.keys(dist);
      const data = Object.values(dist);

      state.charts.sum = new Chart(sumCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Số kỳ quay có tổng trong khoảng',
            data,
            fill: true,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: '#3b82f6',
            tension: 0.4,
            pointBackgroundColor: '#60a5fa',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8' }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.08)' },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }

    // 3. Biểu đồ tỷ lệ Chẵn/Lẻ (Doughnut Chart)
    const evenOddCtx = document.getElementById('chart-even-odd')?.getContext('2d');
    if (evenOddCtx) {
      if (state.charts.evenOdd) state.charts.evenOdd.destroy();

      const counts = evenOddStats.counts;
      const labels = Object.keys(counts);
      const data = Object.values(counts);

      state.charts.evenOdd = new Chart(evenOddCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: [
              '#3b82f6',
              '#60a5fa',
              '#10b981',
              '#f59e0b',
              '#ef4444',
              '#ec4899',
              '#8b5cf6'
            ],
            borderWidth: 2,
            borderColor: '#0f172a'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#cbd5e1', font: { size: 11 } }
            }
          }
        }
      });
    }
  }

  /**
   * Render Bảng Lịch Sử Quay Thưởng (Tab Lịch Sử)
   */
  function renderHistoryTable(filterText = '') {
    const tbody = document.getElementById('history-table-body');
    const allDraws = state.lotteryData[state.lotteryType] || [];
    const cfg = CONFIG[state.lotteryType];
    if (!tbody) return;

    tbody.innerHTML = '';

    // Lọc theo từ khóa tìm kiếm (Mã kỳ hoặc ngày)
    let filtered = [...allDraws].reverse(); // Kỳ mới nhất lên đầu
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      filtered = filtered.filter(d => d.id.toLowerCase().includes(q) || d.date.includes(q));
    }

    const displayList = filtered.slice(0, 100); // Giới hạn 100 kỳ đầu để mượt mà

    displayList.forEach(draw => {
      const tr = document.createElement('tr');
      const mainNums = draw.result.slice(0, 6);
      const sum = mainNums.reduce((a, b) => a + b, 0);
      const evenCount = mainNums.filter(n => n % 2 === 0).length;

      const ballsHtml = mainNums
        .map(n => `<span class="ball-chip">${String(n).padStart(2, '0')}</span>`)
        .join('');

      let bonusHtml = '';
      if (cfg.hasBonusBall && draw.result.length >= 7) {
        bonusHtml = `<span class="bonus-separator">+</span><span class="ball-chip bonus-chip" title="Số đặc biệt">${String(draw.result[6]).padStart(2, '0')}</span>`;
      }

      tr.innerHTML = `
        <td><strong>#${draw.id}</strong></td>
        <td>${formatDate(draw.date)}</td>
        <td>
          <div class="history-balls-row">
            ${ballsHtml}
            ${bonusHtml}
          </div>
        </td>
        <td><strong>${sum}</strong></td>
        <td>${evenCount}C - ${6 - evenCount}L</td>
      `;

      tbody.appendChild(tr);
    });

    const countInfo = document.getElementById('history-showing-count');
    if (countInfo) {
      countInfo.textContent = `Hiển thị ${displayList.length} / ${filtered.length} kỳ quay`;
    }
  }

  // ==================== CÔNG CỤ CHẤM ĐIỂM VÉ (TICKET CHECKER) ====================

  function checkUserTicket() {
    const input = document.getElementById('ticket-input');
    const resultBox = document.getElementById('ticket-checker-result');
    if (!input || !resultBox) return;

    const raw = input.value.trim();
    if (!raw) {
      showToast('Vui lòng nhập 6 con số cách nhau bởi dấu phẩy hoặc khoảng trắng!', 'warning');
      return;
    }

    // Tách các con số
    const parts = raw.split(/[\s,;-]+/).filter(Boolean).map(Number);
    if (parts.length !== 6 || parts.some(isNaN)) {
      showToast('Bộ số cần chứa chính xác 6 số hợp lệ!', 'warning');
      return;
    }

    const contextData = {
      draws: state.lotteryData[state.lotteryType] || [],
      stats: state.activeStats,
      sumStats: state.activeSumStats,
      totalBalls: CONFIG[state.lotteryType].totalBalls
    };

    const scored = LotteryStats.scoreTicket(parts, contextData);

    let scoreColor = '#10b981'; // Green
    let scoreTitle = 'Vé Số Tiềm Năng Cao';
    if (scored.score < 50) {
      scoreColor = '#ef4444';
      scoreTitle = 'Vé Số Cực Đoan / Rủi Ro Cao';
    } else if (scored.score < 75) {
      scoreColor = '#f59e0b';
      scoreTitle = 'Vé Số Mức Trung Bình';
    }

    const feedbackListHtml = scored.feedback
      .map(item => `<li>${item}</li>`)
      .join('');

    resultBox.innerHTML = `
      <div class="score-card">
        <div class="score-header">
          <div class="score-circle" style="border-color: ${scoreColor}; color: ${scoreColor};">
            <span class="score-number">${scored.score}</span>
            <span class="score-max">/100</span>
          </div>
          <div class="score-title-group">
            <h3 style="color: ${scoreColor};">${scoreTitle}</h3>
            <div class="score-balls-row">
              ${scored.numbers.map(n => `<span class="ball-chip">${String(n).padStart(2, '0')}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="score-history-matches">
          <h4>Đối soát với toàn bộ ${contextData.draws.length.toLocaleString()} kỳ quay Vietlott:</h4>
          <div class="match-grid">
            <div class="match-item ${scored.historyMatches.match6 > 0 ? 'jackpot' : ''}">
              <span class="match-label">Trúng 6/6 (Jackpot)</span>
              <strong class="match-count">${scored.historyMatches.match6} lần</strong>
            </div>
            <div class="match-item">
              <span class="match-label">Trúng 5/6 (Giải Nhất)</span>
              <strong class="match-count">${scored.historyMatches.match5} lần</strong>
            </div>
            <div class="match-item">
              <span class="match-label">Trúng 4/6 (Giải Nhì)</span>
              <strong class="match-count">${scored.historyMatches.match4} lần</strong>
            </div>
            <div class="match-item">
              <span class="match-label">Trúng 3/6 (Giải Ba)</span>
              <strong class="match-count">${scored.historyMatches.match3} lần</strong>
            </div>
          </div>
        </div>

        <div class="score-feedback-section">
          <h4>Đánh giá chi tiết từ Thuật toán Thống kê:</h4>
          <ul class="feedback-list">
            ${feedbackListHtml}
          </ul>
        </div>
      </div>
    `;

    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ==================== ĐỒNG BỘ DỮ LIỆU VIETLOTT TRỰC TUYẾN ====================

  async function syncDataOnline() {
    if (state.isSyncing) return;
    state.isSyncing = true;

    const syncBtn = document.getElementById('btn-sync-data');
    if (syncBtn) {
      syncBtn.classList.add('loading');
      syncBtn.disabled = true;
    }

    showToast('Đang kết nối đến máy chủ Vietlott để kiểm tra kỳ quay mới nhất...', 'info');

    const cfg = CONFIG[state.lotteryType];
    const targetUrl = cfg.rawUrl;

    try {
      // Thử tải dữ liệu mới nhất từ GitHub Raw (có hỗ trợ CORS)
      // Thêm timestamp để bypass browser cache
      const fetchUrl = `${targetUrl}?_t=${Date.now()}`;
      const response = await fetch(fetchUrl);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const text = await response.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const fetchedRecords = [];

      lines.forEach(l => {
        try {
          const item = JSON.parse(l);
          if (item && item.id && item.result) {
            fetchedRecords.push({
              id: item.id,
              date: item.date,
              result: item.result
            });
          }
        } catch (err) {
          // Bỏ qua dòng lỗi format
        }
      });

      // Sắp xếp theo ID
      fetchedRecords.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

      const currentCount = state.lotteryData[state.lotteryType].length;
      const newCount = fetchedRecords.length;

      if (newCount > currentCount) {
        state.lotteryData[state.lotteryType] = fetchedRecords;
        localStorage.setItem(`vietlott_cache_${state.lotteryType}`, JSON.stringify(fetchedRecords));
        const diff = newCount - currentCount;
        showToast(`Tuyệt vời! Đã cập nhật thêm ${diff} kỳ quay mới nhất từ Vietlott!`, 'success');
      } else {
        showToast(`Dữ liệu của ${cfg.name} hiện tại đã là mới nhất (Kỳ #${fetchedRecords[newCount - 1]?.id})!`, 'success');
      }

      refreshView();
    } catch (err) {
      console.error('Lỗi khi đồng bộ dữ liệu:', err);
      showToast('Không thể kết nối máy chủ Vietlott trực tuyến. Đang dùng dữ liệu tích hợp sẵn.', 'warning');
    } finally {
      state.isSyncing = false;
      if (syncBtn) {
        syncBtn.classList.remove('loading');
        syncBtn.disabled = false;
      }
    }
  }

  // ==================== EVENT LISTENERS ====================

  function setupEventListeners() {
    // 1. Chuyển đổi loại hình xổ số (Mega 6/45 <-> Power 6/55)
    document.querySelectorAll('.lottery-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-type');
        if (type === state.lotteryType) return;

        document.querySelectorAll('.lottery-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        state.lotteryType = type;
        state.pinnedNumbers = []; // Reset pinned
        document.body.setAttribute('data-theme', type);

        refreshView();
      });
    });

    // 2. Chuyển đổi Tabs nội dung chính
    document.querySelectorAll('.main-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.currentTarget.getAttribute('data-tab');
        document.querySelectorAll('.main-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));

        e.currentTarget.classList.add('active');
        const targetPanel = document.getElementById(tabId);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });

    // 3. Bộ lọc thời gian thống kê (30, 50, 100, All)
    document.querySelectorAll('.filter-range-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-range-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.recentFilter = e.currentTarget.getAttribute('data-range');
        refreshView();
      });
    });

    // 4. Nút "Dự đoán lại" tại Hero
    document.getElementById('btn-regenerate-hero')?.addEventListener('click', () => {
      const heroBalls = document.querySelectorAll('#hero-prediction-balls .lottery-ball');
      heroBalls.forEach(b => b.classList.add('rolling'));

      setTimeout(() => {
        refreshView();
        showToast('Đã tính toán lại các bộ số dự đoán mới!', 'success');
      }, 400);
    });

    // 5. Nút "Sao chép bộ số Hero"
    document.getElementById('btn-copy-hero')?.addEventListener('click', () => {
      const master = state.predictions[0];
      if (master) {
        copyToClipboard(master.numbers.join(', '), `Đã sao chép bộ số Hoàng Kim: [${master.numbers.join(', ')}]`);
      }
    });

    // 6. Nút "Đồng bộ từ Vietlott"
    document.getElementById('btn-sync-data')?.addEventListener('click', () => {
      syncDataOnline();
    });

    // 7. Chấm điểm vé số
    document.getElementById('btn-check-ticket')?.addEventListener('click', () => {
      checkUserTicket();
    });

    // 9. Tìm kiếm lịch sử
    const historySearchInput = document.getElementById('history-search-input');
    historySearchInput?.addEventListener('input', (e) => {
      renderHistoryTable(e.target.value);
    });
  }

  // ==================== HELPER UTILITIES ====================

  /**
   * Tạo element bóng số 3D đẹp mắt
   */
  function createBallElement(num, type = 'main') {
    const ball = document.createElement('div');
    ball.className = `lottery-ball ball-${type}`;

    // Màu bóng phân bố theo nhóm chục để sinh động
    const decade = Math.floor((num - 1) / 10);
    ball.setAttribute('data-decade', decade);

    const formatted = String(num).padStart(2, '0');
    ball.textContent = formatted;
    return ball;
  }

  /**
   * Định dạng ngày YYYY-MM-DD sang DD/MM/YYYY
   */
  function formatDate(str) {
    if (!str) return '';
    const parts = str.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
  }

  /**
   * Chuyển đổi chuỗi dd/mm/yyyy sang định dạng chuẩn YYYY-MM-DD
   */
  function parseDateVN(val) {
    if (!val) return null;
    const parts = val.trim().replace(/[-.]/g, '/').split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2099) {
        const dStr = String(day).padStart(2, '0');
        const mStr = String(month).padStart(2, '0');
        return `${year}-${mStr}-${dStr}`;
      }
    }
    return null;
  }

  /**
   * Sao chép vào bộ nhớ tạm
   */
  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, 'success');
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg, 'success');
    } catch (e) {
      showToast('Không thể sao chép tự động', 'error');
    }
    document.body.removeChild(ta);
  }

  /**
   * Hiển thị thông báo Toast
   */
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 300);
    }, 3500);
  }

  // ==================== TRADITIONAL LOTTERY CONTROLLER ====================

  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function syncDateInputs() {
    const picker = document.getElementById('trad-date-picker');
    const display = document.getElementById('trad-date-display');
    if (picker) {
      picker.value = state.traditional.selectedDate;
    }
    if (display) {
      display.value = formatDate(state.traditional.selectedDate);
    }
  }

  function initTraditionalDatePicker() {
    syncDateInputs();
  }

  function setDateAndRefresh(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    state.traditional.selectedDate = `${y}-${m}-${day}`;
    
    syncDateInputs();
    updateDateQuickButtons();
    refreshTraditionalView();
  }

  function updateDateQuickButtons() {
    const today = getTodayString();
    const now = new Date(today);
    
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const yesterday = yDate.toISOString().slice(0, 10);

    const tDate = new Date(now);
    tDate.setDate(tDate.getDate() + 1);
    const tomorrow = tDate.toISOString().slice(0, 10);

    const curr = state.traditional.selectedDate;

    document.getElementById('btn-date-yesterday')?.classList.toggle('active', curr === yesterday);
    document.getElementById('btn-date-today')?.classList.toggle('active', curr === today);
    document.getElementById('btn-date-tomorrow')?.classList.toggle('active', curr === tomorrow);
  }

  function setupTraditionalEventListeners() {
    // Chuyển đổi Chế độ chính: Vietlott <-> XS Truyền Thống
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-main-mode');
        if (mode === state.mainMode) return;

        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.mainMode = mode;

        const vietlottWrapper = document.getElementById('vietlott-section-wrapper');
        const vietlottSub = document.getElementById('vietlott-sub-switcher');
        const tradWrapper = document.getElementById('traditional-section-wrapper');

        if (mode === 'vietlott') {
          if (vietlottWrapper) vietlottWrapper.style.display = 'block';
          if (vietlottSub) vietlottSub.style.display = 'flex';
          if (tradWrapper) tradWrapper.style.display = 'none';
          renderHeaderInfo();
        } else {
          if (vietlottWrapper) vietlottWrapper.style.display = 'none';
          if (vietlottSub) vietlottSub.style.display = 'none';
          if (tradWrapper) tradWrapper.style.display = 'block';
          refreshTraditionalView();
        }
      });
    });

    // Thay đổi ngày trên Date picker (native)
    document.getElementById('trad-date-picker')?.addEventListener('change', (e) => {
      if (e.target.value) {
        state.traditional.selectedDate = e.target.value;
        syncDateInputs();
        updateDateQuickButtons();
        refreshTraditionalView();
      }
    });

    // Mở lịch khi click vào nút icon lịch
    document.getElementById('btn-open-calendar')?.addEventListener('click', () => {
      const picker = document.getElementById('trad-date-picker');
      if (picker) {
        if (typeof picker.showPicker === 'function') {
          try {
            picker.showPicker();
          } catch (err) {
            picker.focus();
          }
        } else {
          picker.focus();
        }
      }
    });

    // Xử lý khi người dùng nhập trực tiếp định dạng dd/mm/yyyy
    const dateDisplay = document.getElementById('trad-date-display');
    if (dateDisplay) {
      dateDisplay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          dateDisplay.blur();
        }
      });

      dateDisplay.addEventListener('change', () => {
        const val = dateDisplay.value.trim();
        const parsed = parseDateVN(val);
        if (parsed) {
          state.traditional.selectedDate = parsed;
          syncDateInputs();
          updateDateQuickButtons();
          refreshTraditionalView();
        } else {
          showToast('Vui lòng nhập ngày theo định dạng dd/mm/yyyy (ví dụ: 20/10/2026)', 'warning');
          syncDateInputs();
        }
      });
    }

    // Nút nhanh ngày
    document.getElementById('btn-date-yesterday')?.addEventListener('click', () => {
      const d = new Date(state.traditional.selectedDate);
      d.setDate(d.getDate() - 1);
      setDateAndRefresh(d);
    });

    document.getElementById('btn-date-today')?.addEventListener('click', () => {
      setDateAndRefresh(new Date());
    });

    document.getElementById('btn-date-tomorrow')?.addEventListener('click', () => {
      const d = new Date(state.traditional.selectedDate);
      d.setDate(d.getDate() + 1);
      setDateAndRefresh(d);
    });

    // Nút soi cầu lại
    document.getElementById('btn-regen-trad-pred')?.addEventListener('click', () => {
      refreshTraditionalView();
      showToast('Đã tính toán lại nhịp cầu Xổ Số Miền Nam!', 'success');
    });

    // Nút sao chép chốt số
    document.getElementById('btn-copy-trad-pred')?.addEventListener('click', () => {
      const pred = state.traditional.currentPrediction;
      if (!pred) return;
      const provs = TRADITIONAL_LOTTERY.getProvincesByDate('mn', pred.date);
      const currProv = provs.find(p => p.code === pred.provinceCode) || { name: pred.provinceCode };

      const vesoText = pred.danVeSo6D
        ? pred.danVeSo6D.map((t, i) => `  ${i + 1}. Vé ${t.ticket} (${t.type})`).join('\n')
        : '';

      const text = `🌴 DỰ ĐOÁN & SỐ CẦN MUA XỔ SỐ MIỀN NAM - ĐÀI ${currProv.name.toUpperCase()} (${formatDate(pred.date)}):
- 🎯 Bao Lô Đài Chính (BTL): ${pred.baoLo}
- ⚡ Song Thủ Bao Lô: ${pred.songThuLo.join(' - ')}
- 🔮 Xỉu Chủ VIP (3 Càng): ${pred.xiuChu.join(', ')}
- 👑 Đầu - Đuôi: Đầu (Giải 8) [${pred.dauDuoi.dau}] | Đuôi (Giải ĐB) [${pred.dauDuoi.duoi}]
- 🔗 Cặp Lô Đá: Đá 2 [${pred.loDa.da2.join(' × ')}] | Đá 3 [${pred.loDa.da3.join(' × ')}]
- 🎫 Dàn 5 Vé Số Kiến Thiết 6 Chữ Số Gợi Ý Mua:
${vesoText}`;

      copyToClipboard(text, 'Đã sao chép toàn bộ chốt số vào bộ nhớ tạm!');
    });
  }

  function refreshTraditionalView() {
    if (typeof TRADITIONAL_LOTTERY === 'undefined' || typeof TRADITIONAL_PREDICTOR === 'undefined') {
      return;
    }

    syncDateInputs();

    const { selectedDate, selectedProvince } = state.traditional;
    const scheduleCfg = TRADITIONAL_LOTTERY.SCHEDULE.mn;

    // Cập nhật giờ quay trên badge
    const schedBadge = document.getElementById('trad-schedule-badge');
    if (schedBadge && scheduleCfg) {
      schedBadge.textContent = `Quay thưởng lúc ${scheduleCfg.time}`;
    }

    // Lấy danh sách đài trong ngày (Xổ Số Miền Nam)
    let provinces = TRADITIONAL_LOTTERY.getProvincesByDate('mn', selectedDate);
    if (!provinces || provinces.length === 0) {
      provinces = scheduleCfg.days[1] || [{ code: 'HCM', name: 'TP. Hồ Chí Minh' }];
    }

    // Đảm bảo selectedProvince hợp lệ
    const foundProv = provinces.find(p => p.code === selectedProvince);
    if (!foundProv) {
      state.traditional.selectedProvince = provinces[0].code;
    }

    const currentProvCode = state.traditional.selectedProvince;
    const currentProv = provinces.find(p => p.code === currentProvCode) || provinces[0];

    // Lấy kết quả & dự đoán Miền Nam
    const drawResult = TRADITIONAL_LOTTERY.getDrawResult('mn', currentProvCode, selectedDate);
    const prediction = TRADITIONAL_PREDICTOR.generatePrediction('mn', currentProvCode, selectedDate);

    state.traditional.currentDraw = drawResult;
    state.traditional.currentPrediction = prediction;

    // Render các khu vực
    renderTradProvincesChips(provinces);
    renderTradPrediction(prediction, currentProv.name);
    renderTradResultTable(drawResult, currentProv.name);
    renderTradHeadTail(drawResult);
    renderTradHotCold(prediction);

    // Cập nhật trạng thái trên header nếu đang ở tab truyền thống
    if (state.mainMode === 'traditional') {
      const dataBadge = document.getElementById('data-status-badge');
      if (dataBadge) {
        dataBadge.textContent = `XSMN: Đài ${currentProv.name} (${formatDate(selectedDate)})`;
      }
    }
  }

  function renderTradProvincesChips(provinces) {
    const container = document.getElementById('trad-provinces-chips');
    if (!container) return;
    container.innerHTML = '';

    provinces.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `province-chip-btn ${p.code === state.traditional.selectedProvince ? 'active' : ''}`;
      btn.textContent = p.name;
      btn.setAttribute('data-code', p.code);

      btn.addEventListener('click', () => {
        state.traditional.selectedProvince = p.code;
        refreshTraditionalView();
      });

      container.appendChild(btn);
    });
  }

  function renderTradPrediction(prediction, provinceName) {
    const heading = document.getElementById('trad-pred-heading');
    const confBadge = document.getElementById('trad-pred-conf');
    const btlEl = document.getElementById('trad-btl-display');
    const stlEl = document.getElementById('trad-stl-display');
    const xiuchuEl = document.getElementById('trad-xiuchu-display');
    const dauduoiEl = document.getElementById('trad-dauduoi-display');
    const lodaEl = document.getElementById('trad-loda-display');
    const veSoHeading = document.getElementById('ve-so-heading-title');
    const vesoGrid = document.getElementById('trad-veso-grid');
    const dande10El = document.getElementById('trad-dande10-display');
    const dande20El = document.getElementById('trad-dande20-display');
    const rationaleEl = document.getElementById('trad-rationale-display');

    if (heading) heading.textContent = `Dự Đoán Số Cần Mua - Đài ${provinceName} (${formatDate(prediction.date)})`;
    if (confBadge) confBadge.textContent = `Độ Tự Tin: ${prediction.confidence}%`;
    if (btlEl) btlEl.textContent = prediction.baoLo;

    if (stlEl) {
      stlEl.innerHTML = `<span>${prediction.songThuLo[0]}</span><span class="hyphen">-</span><span>${prediction.songThuLo[1]}</span>`;
    }

    if (xiuchuEl) {
      xiuchuEl.innerHTML = prediction.xiuChu.map(c => `<span>${c}</span>`).join('<span class="hyphen">, </span>');
    }

    if (dauduoiEl) {
      dauduoiEl.innerHTML = `
        <div>Đầu (Giải 8): <strong style="color: #38bdf8;">${prediction.dauDuoi.dau}</strong></div>
        <div>Đuôi (Giải ĐB): <strong style="color: #f87171;">${prediction.dauDuoi.duoi}</strong></div>
      `;
    }

    if (lodaEl) {
      lodaEl.innerHTML = `
        <div>Đá 2: <strong>${prediction.loDa.da2.join(' × ')}</strong></div>
        <div>Đá 3: <strong>${prediction.loDa.da3.join(' × ')}</strong></div>
      `;
    }

    // Render Dàn 5 Vé Số Kiến Thiết 6D
    if (veSoHeading) {
      veSoHeading.textContent = `Dàn 5 Vé Số Kiến Thiết 6 Chữ Số Gợi Ý Mua - Đài ${provinceName}`;
    }

    if (vesoGrid && prediction.danVeSo6D) {
      vesoGrid.innerHTML = '';
      prediction.danVeSo6D.forEach((ticket) => {
        const slip = document.createElement('div');
        slip.className = 've-so-ticket-slip';
        const prefix = ticket.ticket.slice(0, ticket.ticket.length - ticket.highlight.length);
        const highlight = ticket.highlight;

        slip.innerHTML = `
          <div class="ve-so-prov-name">🏛️ Đài ${provinceName}</div>
          <div class="ve-so-number-box">
            <span>${prefix}</span><span class="gold-tail">${highlight}</span>
          </div>
          <div class="ve-so-tag">${ticket.type}</div>
          <div class="ve-so-stars">${'⭐'.repeat(ticket.star)}</div>
        `;
        slip.title = `Click để sao chép vé số ${ticket.ticket}`;
        slip.addEventListener('click', () => {
          copyToClipboard(ticket.ticket, `Đã sao chép vé số [${ticket.ticket}] (${ticket.type})`);
        });

        vesoGrid.appendChild(slip);
      });
    }

    // Nút sao chép toàn bộ 5 vé số
    const copyAllBtn = document.getElementById('btn-copy-all-tickets');
    if (copyAllBtn && prediction.danVeSo6D) {
      copyAllBtn.onclick = () => {
        const ticketListStr = prediction.danVeSo6D.map((t, i) => `${i + 1}. Vé [${t.ticket}] (${t.type})`).join('\n');
        copyToClipboard(`🎫 5 VÉ SỐ KIẾN THIẾT GỢI Ý MUA - ĐÀI ${provinceName.toUpperCase()}:\n${ticketListStr}`, 'Đã sao chép 5 vé số vào bộ nhớ tạm!');
      };
    }

    if (dande10El) {
      dande10El.innerHTML = prediction.dacBiet.danDe10
        .map(num => `<span class="dan-de-chip">${num}</span>`)
        .join('');
    }

    if (dande20El) {
      dande20El.innerHTML = prediction.dacBiet.danDe20
        .map(num => `<span class="dan-de-chip">${num}</span>`)
        .join('');
    }

    if (rationaleEl) {
      rationaleEl.innerHTML = `<strong>Phân Tích Soi Cầu AI Miền Nam:</strong> ${prediction.rationale}`;
    }
  }

  function renderTradResultTable(drawResult, provinceName) {
    const titleEl = document.getElementById('trad-table-title');
    const dateBadgeEl = document.getElementById('trad-table-date-badge');
    const contentEl = document.getElementById('trad-table-content');
    if (!contentEl) return;

    // Nếu kỳ quay chưa mở thưởng (ví dụ: ngày hôm nay trước 16:30 hoặc ngày mai)
    if (!drawResult || !drawResult.hasDrawn) {
      if (titleEl) titleEl.textContent = `KQXS ${provinceName}`;
      if (dateBadgeEl) {
        dateBadgeEl.textContent = `⏳ Chưa mở thưởng (Quay lúc 16:15)`;
        dateBadgeEl.style.background = 'rgba(245, 158, 11, 0.2)';
        dateBadgeEl.style.color = '#fbbf24';
        dateBadgeEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      }

      // Lấy kết quả kỳ quay trước gần nhất của đài này để người dùng tham khảo
      const prevDraw = TRADITIONAL_LOTTERY.getLatestOfficialDraw('mn', drawResult.provinceCode);
      const prevHtml = prevDraw ? `
        <div style="margin-top: 1.5rem; text-align: left; background: rgba(0,0,0,0.25); border-radius: var(--radius-md); padding: 1.25rem; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <span style="font-size: 0.9rem; font-weight: 800; color: var(--vietlott-gold);">
              📜 Kết quả kỳ trước gần nhất (${formatDate(prevDraw.date)}) để tham khảo:
            </span>
            <span style="font-size: 0.75rem; color: #34d399; background: rgba(16, 185, 129, 0.15); padding: 2px 8px; border-radius: 4px;">✓ Đã mở thưởng</span>
          </div>
          <table class="trad-table">
            <tr class="special-row">
              <td class="prize-label">Đặc Biệt</td>
              <td class="prize-numbers">${prevDraw.special}</td>
            </tr>
            <tr>
              <td class="prize-label">Giải Nhất</td>
              <td class="prize-numbers">${prevDraw.g1}</td>
            </tr>
            <tr>
              <td class="prize-label">Giải Nhì</td>
              <td class="prize-numbers">${prevDraw.g2}</td>
            </tr>
            <tr>
              <td class="prize-label">Giải Ba</td>
              <td class="prize-numbers"><div class="multi-prizes">${(prevDraw.g3 || []).map(n => `<span>${n}</span>`).join('')}</div></td>
            </tr>
            <tr>
              <td class="prize-label">Giải Bảy</td>
              <td class="prize-numbers">${prevDraw.g7}</td>
            </tr>
            <tr>
              <td class="prize-label">Giải Tám</td>
              <td class="prize-numbers" style="color: #38bdf8; font-size: 1.35rem; font-weight: 800;">${prevDraw.g8}</td>
            </tr>
          </table>
        </div>
      ` : '';

      contentEl.innerHTML = `
        <div style="text-align: center; padding: 2.25rem 1.5rem; background: rgba(15, 23, 42, 0.5); border-radius: var(--radius-lg); border: 1px dashed rgba(245, 158, 11, 0.4);">
          <div style="font-size: 3rem; margin-bottom: 0.6rem;">⏰</div>
          <h4 style="font-size: 1.25rem; font-weight: 800; color: var(--vietlott-gold); margin-bottom: 0.5rem;">
            KỲ QUAY NGÀY ${formatDate(drawResult.date)} CHƯA MỞ THƯỞNG
          </h4>
          <p style="color: var(--text-secondary); font-size: 0.92rem; max-width: 650px; margin: 0 auto 1.25rem auto; line-height: 1.6;">
            Đài <strong>${provinceName}</strong> sẽ tiến hành quay thưởng trực tiếp tại trường quay lúc <strong>16:15 - 16:35 chiều nay</strong>.<br>
            Bảng kết quả 18 giải chính thức sẽ tự động hiển thị ngay sau khi có kết quả từ trường quay.
          </p>
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.6rem 1.25rem; border-radius: var(--radius-full); font-size: 0.85rem; color: #38bdf8;">
            <span>💡</span>
            <span>Bộ số dự đoán và 5 vé số gợi ý mua nằm ở <strong>Phòng Dự Đoán &amp; Số Cần Mua</strong> ở phía trên!</span>
          </div>
          ${prevHtml}
        </div>
      `;
      return;
    }

    if (titleEl) titleEl.textContent = `KQXS ${provinceName} (18 Giải)`;
    if (dateBadgeEl) {
      dateBadgeEl.textContent = formatDate(drawResult.date);
      dateBadgeEl.style.background = '';
      dateBadgeEl.style.color = '';
      dateBadgeEl.style.borderColor = '';
    }

    // Bảng kết quả Xổ Số Kiến Thiết Miền Nam chuẩn 18 giải (khi đã mở thưởng)
    contentEl.innerHTML = `
      <table class="trad-table">
        <tr class="special-row">
          <td class="prize-label">Đặc Biệt</td>
          <td class="prize-numbers">${drawResult.special}</td>
        </tr>
        <tr>
          <td class="prize-label">Giải Nhất</td>
          <td class="prize-numbers">${drawResult.g1}</td>
        </tr>
        <tr>
          <td class="prize-label">Giải Nhì</td>
          <td class="prize-numbers">${drawResult.g2}</td>
        </tr>
        <tr>
          <td class="prize-label">Giải Ba</td>
          <td class="prize-numbers"><div class="multi-prizes">${drawResult.g3.map(n => `<span>${n}</span>`).join('')}</div></td>
        </tr>
        <tr>
          <td class="prize-label">Giải Tư</td>
          <td class="prize-numbers"><div class="multi-prizes">${drawResult.g4.map(n => `<span>${n}</span>`).join('')}</div></td>
        </tr>
        <tr>
          <td class="prize-label">Giải Năm</td>
          <td class="prize-numbers">${drawResult.g5}</td>
        </tr>
        <tr>
          <td class="prize-label">Giải Sáu</td>
          <td class="prize-numbers"><div class="multi-prizes">${drawResult.g6.map(n => `<span>${n}</span>`).join('')}</div></td>
        </tr>
        <tr>
          <td class="prize-label">Giải Bảy</td>
          <td class="prize-numbers">${drawResult.g7}</td>
        </tr>
        <tr>
          <td class="prize-label">Giải Tám</td>
          <td class="prize-numbers" style="color: #38bdf8; font-size: 1.35rem; font-weight: 800;">${drawResult.g8}</td>
        </tr>
      </table>
    `;
  }

  function renderTradHeadTail(drawResult) {
    const container = document.getElementById('trad-headtail-content');
    if (!container) return;

    const lotoList = TRADITIONAL_LOTTERY.extractLotoNumbers(drawResult);
    const { heads, tails } = TRADITIONAL_LOTTERY.calculateHeadTail(lotoList);

    let rowsHtml = '';
    for (let digit = 0; digit <= 9; digit++) {
      const headNums = heads[digit];
      const tailNums = tails[digit];

      const headContent = headNums.length > 0
        ? headNums.join(', ')
        : '<span class="silent-badge">CÂM</span>';

      const tailContent = tailNums.length > 0
        ? tailNums.join(', ')
        : '<span class="silent-badge">CÂM</span>';

      rowsHtml += `
        <tr>
          <td class="digit-col">${digit}</td>
          <td class="loto-col">${headContent}</td>
          <td class="digit-col">${digit}</td>
          <td class="loto-col">${tailContent}</td>
        </tr>
      `;
    }

    container.innerHTML = `
      <table class="trad-headtail-table">
        <thead>
          <tr>
            <th style="width: 45px;">Đầu</th>
            <th>Lô Tô Về</th>
            <th style="width: 45px;">Đuôi</th>
            <th>Lô Tô Về</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  function renderTradHotCold(prediction) {
    const hotContainer = document.getElementById('trad-hot-list');
    const ganContainer = document.getElementById('trad-gan-list');

    if (hotContainer) {
      hotContainer.innerHTML = '';
      prediction.topHot.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'hotcold-row';
        row.innerHTML = `
          <div class="rank">#${idx + 1}</div>
          <div class="ball-chip hot-chip">${item.number}</div>
          <div class="hotcold-info">
            <div class="detail-text">
              <span>Đã về: <strong>${item.count} lần</strong></span>
              <span>Gan hiện tại: <strong>${item.currentGan} kỳ</strong></span>
            </div>
          </div>
        `;
        hotContainer.appendChild(row);
      });
    }

    if (ganContainer) {
      ganContainer.innerHTML = '';
      prediction.topGan.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'hotcold-row';
        row.innerHTML = `
          <div class="rank">#${idx + 1}</div>
          <div class="ball-chip cold-chip">${item.number}</div>
          <div class="hotcold-info">
            <div class="detail-text">
              <span>Chưa ra: <strong class="text-danger">${item.currentGan} kỳ</strong></span>
              <span>Kỷ lục gan: <strong>${item.maxGan} kỳ</strong></span>
            </div>
          </div>
        `;
        ganContainer.appendChild(row);
      });
    }
  }
});
