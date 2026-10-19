/**
 * Vietlott Statistical Engine (js/statistics.js)
 * Cung cấp các thuật toán tính toán xác suất thống kê chuyên sâu:
 * - Tần suất xuất hiện (Frequency & Exponential Decay)
 * - Thống kê Lô Gan (Current Drought & Max Gan)
 * - Tương quan cặp số đồng xuất hiện (Co-occurrence Matrix & Lift)
 * - Phân bố tổng điểm (Gaussian Distribution & Sum Range)
 * - Tỷ lệ Chẵn / Lẻ và phân bố đầu số
 * - Chấm điểm chất lượng vé số (Ticket Scoring)
 */

const LotteryStats = (function() {
  'use strict';

  /**
   * Tính toán toàn bộ thống kê cho từng con số
   * @param {Array} draws Danh sách các kỳ quay (mỗi kỳ có result: [n1, n2, ...])
   * @param {number} totalBalls 45 hoặc 55
   * @param {number} recentLimit Số kỳ gần nhất để tính phong độ (mặc định 30)
   */
  function analyzeNumbers(draws, totalBalls, recentLimit = 30) {
    if (!draws || draws.length === 0) return [];

    const totalDraws = draws.length;
    const recentDraws = draws.slice(-recentLimit);
    const expectedProb = 6 / totalBalls; // Xác suất kỳ vọng
    const expectedFreq = totalDraws * expectedProb;
    const stdDev = Math.sqrt(totalDraws * expectedProb * (1 - expectedProb));

    // Khởi tạo bảng dữ liệu cho từng bóng số (1 -> totalBalls)
    const stats = [];
    for (let i = 1; i <= totalBalls; i++) {
      stats[i] = {
        number: i,
        count: 0,
        recentCount: 0,
        percentage: 0,
        recentPercentage: 0,
        currentGan: 0,
        maxGan: 0,
        lastDrawIndex: -1,
        gaps: [],
        meanGap: 0,
        zScore: 0,
        decayWeight: 0,
        status: 'normal' // 'hot', 'cold', 'warm', 'normal'
      };
    }

    // Duyệt qua toàn bộ lịch sử quay (từ kỳ cũ nhất đến kỳ mới nhất)
    const decayFactor = 0.985; // Hệ số suy giảm trọng số thời gian

    draws.forEach((draw, drawIndex) => {
      // Chỉ lấy 6 số chính đầu tiên (bỏ qua số đặc biệt thứ 7 của Power 6/55 nếu có)
      const winningNumbers = new Set(draw.result.slice(0, 6));

      for (let num = 1; num <= totalBalls; num++) {
        const item = stats[num];
        if (winningNumbers.has(num)) {
          item.count++;

          // Tính khoảng cách (gap) giữa 2 lần xuất hiện
          if (item.lastDrawIndex !== -1) {
            const gap = drawIndex - item.lastDrawIndex - 1;
            item.gaps.push(gap);
            if (gap > item.maxGan) {
              item.maxGan = gap;
            }
          }
          item.lastDrawIndex = drawIndex;

          // Trọng số thời gian: kỳ càng gần trọng số càng cao
          const timeWeight = Math.pow(decayFactor, totalDraws - 1 - drawIndex);
          item.decayWeight += timeWeight;
        }
      }
    });

    // Thống kê kỳ gần nhất & tính lô gan hiện tại
    recentDraws.forEach(draw => {
      const winningNumbers = new Set(draw.result.slice(0, 6));
      winningNumbers.forEach(num => {
        if (stats[num]) {
          stats[num].recentCount++;
        }
      });
    });

    // Hoàn thiện các chỉ số cho từng số
    for (let num = 1; num <= totalBalls; num++) {
      const item = stats[num];
      item.percentage = ((item.count / totalDraws) * 100);
      item.recentPercentage = ((item.recentCount / Math.min(recentLimit, totalDraws)) * 100);

      // Gan hiện tại
      item.currentGan = item.lastDrawIndex === -1 ? totalDraws : totalDraws - 1 - item.lastDrawIndex;
      if (item.currentGan > item.maxGan) {
        item.maxGan = item.currentGan;
      }

      // Chu kỳ trung bình
      if (item.gaps.length > 0) {
        const sumGaps = item.gaps.reduce((acc, g) => acc + g, 0);
        item.meanGap = (sumGaps / item.gaps.length);
      } else {
        item.meanGap = (totalBalls - 6) / 6;
      }

      // Z-score đo độ lệch so với kỳ vọng ngẫu nhiên
      item.zScore = stdDev > 0 ? (item.count - expectedFreq) / stdDev : 0;

      // Phân loại trạng thái
      // Hot: Xuất hiện nhiều trong các kỳ gần đây hoặc Z-score cao
      // Cold/Gan: Đang vắng mặt dài ngày vượt quá 1.5 lần chu kỳ trung bình
      if (item.currentGan >= item.meanGap * 1.8 || item.currentGan >= 18) {
        item.status = 'cold';
      } else if (item.recentCount >= (Math.min(recentLimit, totalDraws) * expectedProb * 1.6)) {
        item.status = 'hot';
      } else if (item.currentGan <= 3) {
        item.status = 'warm';
      } else {
        item.status = 'normal';
      }
    }

    // Bỏ phần tử index 0 (vì số từ 1..totalBalls)
    return stats.slice(1);
  }

  /**
   * Tính ma trận cặp số hay xuất hiện cùng nhau nhất (Co-occurrence)
   * @param {Array} draws
   * @param {number} totalBalls
   * @param {number} limit Số lượng top cặp trả về
   */
  function analyzePairs(draws, totalBalls, limit = 25) {
    if (!draws || draws.length === 0) return [];

    const totalDraws = draws.length;
    const pairMap = new Map();

    draws.forEach(draw => {
      const nums = draw.result.slice(0, 6).sort((a, b) => a - b);
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const key = `${nums[i]}-${nums[j]}`;
          pairMap.set(key, (pairMap.get(key) || 0) + 1);
        }
      }
    });

    // Xác suất lý thuyết của một cặp
    // P(pair) = 6*5 / (totalBalls * (totalBalls - 1))
    const expectedPairProb = (6 * 5) / (totalBalls * (totalBalls - 1));
    const expectedPairFreq = totalDraws * expectedPairProb;

    const pairs = [];
    pairMap.forEach((count, key) => {
      const [num1, num2] = key.split('-').map(Number);
      const prob = count / totalDraws;
      const lift = count / (expectedPairFreq || 1); // Lift > 1 nghĩa là đi cùng nhau nhiều hơn ngẫu nhiên
      pairs.push({
        num1,
        num2,
        pair: [num1, num2],
        count,
        percentage: prob * 100,
        lift: lift
      });
    });

    pairs.sort((a, b) => b.count - a.count);
    return pairs.slice(0, limit);
  }

  /**
   * Thống kê tổng điểm của 6 số trong các kỳ quay
   */
  function analyzeSums(draws, totalBalls) {
    if (!draws || draws.length === 0) return { sums: [], stats: {} };

    const theoreticalMean = 6 * (totalBalls + 1) / 2; // 6/45 = 138, 6/55 = 168
    const sums = [];
    let minSum = Infinity;
    let maxSum = -Infinity;
    let totalSum = 0;

    draws.forEach(draw => {
      const nums = draw.result.slice(0, 6);
      const sum = nums.reduce((acc, n) => acc + n, 0);
      sums.push(sum);
      if (sum < minSum) minSum = sum;
      if (sum > maxSum) maxSum = sum;
      totalSum += sum;
    });

    const avgSum = totalSum / sums.length;

    // Tính độ lệch chuẩn
    const variance = sums.reduce((acc, s) => acc + Math.pow(s - avgSum, 2), 0) / sums.length;
    const stdDev = Math.sqrt(variance);

    // Dải vàng (Golden Range): 1 sigma quanh giá trị trung bình (~68% các kỳ)
    const goldenRangeMin = Math.round(theoreticalMean - stdDev);
    const goldenRangeMax = Math.round(theoreticalMean + stdDev);

    // Phân nhóm thành các bucket để vẽ biểu đồ
    const bucketSize = totalBalls === 45 ? 15 : 20;
    const bucketMap = {};
    const startRange = totalBalls === 45 ? 60 : 70;
    const endRange = totalBalls === 45 ? 220 : 260;

    for (let b = startRange; b < endRange; b += bucketSize) {
      const label = `${b}-${b + bucketSize - 1}`;
      bucketMap[label] = 0;
    }

    sums.forEach(s => {
      for (let b = startRange; b < endRange; b += bucketSize) {
        if (s >= b && s < b + bucketSize) {
          const label = `${b}-${b + bucketSize - 1}`;
          bucketMap[label] = (bucketMap[label] || 0) + 1;
          break;
        }
      }
    });

    return {
      sums,
      theoreticalMean,
      avgSum: Math.round(avgSum * 10) / 10,
      minSum,
      maxSum,
      stdDev: Math.round(stdDev * 10) / 10,
      goldenRange: [goldenRangeMin, goldenRangeMax],
      distribution: bucketMap
    };
  }

  /**
   * Thống kê tỷ lệ Chẵn / Lẻ
   */
  function analyzeEvenOdd(draws) {
    if (!draws || draws.length === 0) return {};

    const counts = {
      '0C - 6L': 0,
      '1C - 5L': 0,
      '2C - 4L': 0,
      '3C - 3L': 0,
      '4C - 2L': 0,
      '5C - 1L': 0,
      '6C - 0L': 0
    };

    draws.forEach(draw => {
      const nums = draw.result.slice(0, 6);
      const evenCount = nums.filter(n => n % 2 === 0).length;
      const oddCount = 6 - evenCount;
      const key = `${evenCount}C - ${oddCount}L`;
      if (counts[key] !== undefined) {
        counts[key]++;
      }
    });

    const percentages = {};
    const total = draws.length;
    Object.keys(counts).forEach(k => {
      percentages[k] = Math.round((counts[k] / total) * 1000) / 10;
    });

    return { counts, percentages, totalDraws: total };
  }

  /**
   * Thống kê phân bố theo các nhóm hàng chục (Decades)
   */
  function analyzeDecades(draws, totalBalls) {
    if (!draws || draws.length === 0) return {};

    const ranges = totalBalls === 45
      ? [
          { label: '01 - 09', min: 1, max: 9 },
          { label: '10 - 19', min: 10, max: 19 },
          { label: '20 - 29', min: 20, max: 29 },
          { label: '30 - 39', min: 30, max: 39 },
          { label: '40 - 45', min: 40, max: 45 }
        ]
      : [
          { label: '01 - 09', min: 1, max: 9 },
          { label: '10 - 19', min: 10, max: 19 },
          { label: '20 - 29', min: 20, max: 29 },
          { label: '30 - 39', min: 30, max: 39 },
          { label: '40 - 49', min: 40, max: 49 },
          { label: '50 - 55', min: 50, max: 55 }
        ];

    const distribution = {};
    ranges.forEach(r => distribution[r.label] = 0);

    draws.forEach(draw => {
      const nums = draw.result.slice(0, 6);
      nums.forEach(n => {
        for (const r of ranges) {
          if (n >= r.min && n <= r.max) {
            distribution[r.label]++;
            break;
          }
        }
      });
    });

    return distribution;
  }

  /**
   * Chấm điểm chất lượng 1 bộ 6 số dựa trên các tiêu chí toán học
   * @param {Array<number>} numbers Mảng 6 số [n1, ..., n6]
   * @param {Object} contextData { draws, stats, sumStats, totalBalls }
   * @returns {Object} Kết quả đánh giá chi tiết
   */
  function scoreTicket(numbers, contextData) {
    if (!numbers || numbers.length !== 6) {
      return { score: 0, feedback: ['Cần nhập đủ 6 số hợp lệ'] };
    }

    const { draws, stats, sumStats, totalBalls } = contextData;
    const sorted = [...numbers].sort((a, b) => a - b);
    const feedback = [];
    let score = 50; // Điểm cơ bản

    // 1. Kiểm tra trùng lặp
    const unique = new Set(sorted);
    if (unique.size !== 6) {
      return { score: 0, feedback: ['Có số trùng lặp trong bộ số!'] };
    }

    // 2. Kiểm tra khoảng giá trị
    const outOfBounds = sorted.some(n => n < 1 || n > totalBalls);
    if (outOfBounds) {
      return { score: 0, feedback: [`Số phải nằm trong khoảng từ 01 đến ${totalBalls}`] };
    }

    // 3. Đánh giá Tổng điểm (Tối đa 25 điểm)
    const sum = sorted.reduce((a, b) => a + b, 0);
    const [goldMin, goldMax] = sumStats.goldenRange;
    if (sum >= goldMin && sum <= goldMax) {
      score += 25;
      feedback.push(`✅ Tổng điểm (${sum}) nằm trong Dải Vàng lý tưởng [${goldMin} - ${goldMax}] (+25đ).`);
    } else if (Math.abs(sum - sumStats.theoreticalMean) <= sumStats.stdDev * 1.5) {
      score += 15;
      feedback.push(`ℹ️ Tổng điểm (${sum}) ở mức chấp nhận được (+15đ).`);
    } else {
      score -= 10;
      feedback.push(`⚠️ Tổng điểm (${sum}) quá thấp hoặc quá cao so với phân phối chuẩn (-10đ).`);
    }

    // 4. Đánh giá Tỷ lệ Chẵn / Lẻ (Tối đa 20 điểm)
    const evenCount = sorted.filter(n => n % 2 === 0).length;
    const oddCount = 6 - evenCount;
    if ((evenCount === 3 && oddCount === 3) || (evenCount === 2 && oddCount === 4) || (evenCount === 4 && oddCount === 2)) {
      score += 20;
      feedback.push(`✅ Tỷ lệ Chẵn/Lẻ (${evenCount}C - ${oddCount}L) thuộc nhóm xuất hiện phổ biến nhất >80% (+20đ).`);
    } else if (evenCount === 1 || evenCount === 5) {
      score += 5;
      feedback.push(`ℹ️ Tỷ lệ Chẵn/Lẻ (${evenCount}C - ${oddCount}L) có xác suất xuất hiện thấp (+5đ).`);
    } else {
      score -= 15;
      feedback.push(`⚠️ Tỷ lệ Toàn Chẵn hoặc Toàn Lẻ rất hiếm khi nổ trong thực tế (-15đ).`);
    }

    // 5. Đánh giá Phân bố Đầu số (Tối đa 15 điểm)
    const decadeBuckets = new Set(sorted.map(n => Math.floor((n - 1) / 10)));
    if (decadeBuckets.size >= 4) {
      score += 15;
      feedback.push(`✅ Trải đều trên ${decadeBuckets.size} dải hàng chục khác nhau, tránh dồn số (+15đ).`);
    } else if (decadeBuckets.size === 3) {
      score += 10;
      feedback.push(`ℹ️ Trải trên 3 dải hàng chục (+10đ).`);
    } else {
      score -= 15;
      feedback.push(`⚠️ Số bị tập trung dồn vào quá ít hàng chục (-15đ).`);
    }

    // 6. Đánh giá Tần suất & Cân bằng Nóng/Lạnh
    let hotCount = 0;
    let coldCount = 0;
    sorted.forEach(num => {
      const s = stats.find(item => item.number === num);
      if (s) {
        if (s.status === 'hot') hotCount++;
        if (s.status === 'cold') coldCount++;
      }
    });

    if (hotCount >= 1 && hotCount <= 3 && coldCount <= 2) {
      score += 15;
      feedback.push(`✅ Kết hợp hài hòa giữa số Hot (${hotCount}) và số Lạnh/Gan (${coldCount}) (+15đ).`);
    } else if (coldCount >= 4) {
      score -= 10;
      feedback.push(`⚠️ Có quá nhiều số Gan lâu ngày chưa về (${coldCount} số) (-10đ).`);
    }

    // 7. Tra cứu lịch sử quay thưởng xem bộ số này đã từng về chưa
    let match6Count = 0;
    let match5Count = 0;
    let match4Count = 0;
    let match3Count = 0;

    const setInput = new Set(sorted);
    draws.forEach(draw => {
      const res = draw.result.slice(0, 6);
      let match = 0;
      res.forEach(n => {
        if (setInput.has(n)) match++;
      });
      if (match === 6) match6Count++;
      else if (match === 5) match5Count++;
      else if (match === 4) match4Count++;
      else if (match === 3) match3Count++;
    });

    // Giới hạn điểm từ 0 đến 100
    const finalScore = Math.max(10, Math.min(99, score));

    return {
      numbers: sorted,
      score: finalScore,
      sum,
      evenCount,
      oddCount,
      hotCount,
      coldCount,
      feedback,
      historyMatches: {
        match6: match6Count,
        match5: match5Count,
        match4: match4Count,
        match3: match3Count
      }
    };
  }

  return {
    analyzeNumbers,
    analyzePairs,
    analyzeSums,
    analyzeEvenOdd,
    analyzeDecades,
    scoreTicket
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LotteryStats;
}
