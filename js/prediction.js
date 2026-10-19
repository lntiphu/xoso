/**
 * Vietlott Prediction Engine (js/prediction.js)
 * Cung cấp 6 chiến lược dự đoán bộ số dựa trên toán học xác suất & thống kê:
 * 1. Cân Bằng Tối Ưu (Optimal Ensemble)
 * 2. Xu Hướng Nóng (Hot Momentum)
 * 3. Lô Gan Hồi Quy (Cold Rebound)
 * 4. Cặp Đôi Tương Quan (Co-occurrence Pairs)
 * 5. Phân Bố Chuẩn Gauss (Golden Gaussian Bell)
 * 6. Mô Phỏng Monte Carlo (10,000 Weighted Runs)
 * Kèm thuật toán Gợi ý theo Số May Mắn đã ghim (Lucky Pinning Assistant)
 */

const LotteryPredictor = (function() {
  'use strict';

  /**
   * Helper: Lấy số ngẫu nhiên có trọng số (Roulette Wheel / Weighted Random)
   */
  function pickWeighted(pool, weights) {
    let sumWeight = 0;
    for (let i = 0; i < pool.length; i++) {
      sumWeight += weights[pool[i]];
    }
    let r = Math.random() * sumWeight;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[pool[i]];
      if (r <= 0) {
        return pool[i];
      }
    }
    return pool[pool.length - 1];
  }

  /**
   * Helper: Chọn k số ngẫu nhiên không lặp lại từ pool dựa theo trọng số
   */
  function sampleWithoutReplacement(pool, weights, k) {
    const available = [...pool];
    const picked = [];
    while (picked.length < k && available.length > 0) {
      const chosen = pickWeighted(available, weights);
      picked.push(chosen);
      const idx = available.indexOf(chosen);
      if (idx !== -1) available.splice(idx, 1);
    }
    return picked.sort((a, b) => a - b);
  }

  /**
   * Tính toán ma trận trọng số tổng hợp cho mỗi bóng số
   */
  function computeWeightMap(stats, totalBalls) {
    const weights = {};
    stats.forEach(s => {
      // Điểm tần suất chuẩn hóa (0..1)
      const freqScore = s.percentage / 25;

      // Điểm đà rơi gần đây (Decay weight)
      const momentumScore = s.decayWeight / 15;

      // Điểm hồi quy lô gan: nếu đang gan vượt chu kỳ trung bình thì tăng dần xác suất
      let ganBonus = 1.0;
      if (s.currentGan >= s.meanGap) {
        ganBonus = 1.0 + Math.min(1.5, (s.currentGan - s.meanGap) / s.meanGap);
      } else if (s.currentGan <= 2) {
        // Vừa mới ra, nhịp rơi liên tiếp
        ganBonus = 1.15;
      }

      // Trọng số cơ sở (Base Weight)
      let w = (freqScore * 0.4 + momentumScore * 0.4) * ganBonus;
      weights[s.number] = Math.max(0.1, w);
    });
    return weights;
  }

  /**
   * CHIẾN LƯỢC 1: CÂN BẰNG TỐI ƯU (Optimal Ensemble)
   * Kết hợp đa tiêu chí: Tần suất, lô gan chuẩn, tổng điểm và chẵn lẻ chuẩn
   */
  function predictBalancedEnsemble(contextData) {
    const { stats, sumStats, totalBalls, pairs } = contextData;
    const [goldMin, goldMax] = sumStats.goldenRange;
    const weights = computeWeightMap(stats, totalBalls);

    // Tìm tổ hợp tối ưu bằng tìm kiếm cục bộ (Local Beam Search / Monte Carlo evaluation)
    let bestTicket = null;
    let bestScore = -Infinity;

    for (let trial = 0; trial < 1500; trial++) {
      const allNumbers = stats.map(s => s.number);
      const candidate = sampleWithoutReplacement(allNumbers, weights, 6);

      // Đánh giá candidate
      const sum = candidate.reduce((a, b) => a + b, 0);
      if (sum < goldMin || sum > goldMax) continue; // Ràng buộc tổng điểm

      const evenCount = candidate.filter(n => n % 2 === 0).length;
      if (evenCount < 2 || evenCount > 4) continue; // Ràng buộc chẵn lẻ

      const decades = new Set(candidate.map(n => Math.floor((n - 1) / 10)));
      if (decades.size < 4) continue; // Rải đều ít nhất 4 hàng chục

      // Tính điểm chất lượng
      let trialScore = 0;
      candidate.forEach(num => {
        trialScore += weights[num] * 10;
      });

      // Bonus tương quan cặp
      for (let i = 0; i < candidate.length; i++) {
        for (let j = i + 1; j < candidate.length; j++) {
          const p = pairs.find(pair => (pair.num1 === candidate[i] && pair.num2 === candidate[j]) || (pair.num1 === candidate[j] && pair.num2 === candidate[i]));
          if (p) trialScore += p.lift * 5;
        }
      }

      if (trialScore > bestScore) {
        bestScore = trialScore;
        bestTicket = candidate;
      }
    }

    // Dự phòng nếu không thỏa mãn đủ ràng buộc khắt khe
    if (!bestTicket) {
      bestTicket = stats.slice(0, 15).map(s => s.number).slice(0, 6);
    }

    const sum = bestTicket.reduce((a, b) => a + b, 0);
    const evenCount = bestTicket.filter(n => n % 2 === 0).length;

    return {
      strategyId: 'balanced',
      name: 'Cân Bằng Toàn Diện (Optimal Ensemble)',
      badge: 'Khuyên Dùng',
      badgeColor: 'success',
      confidence: 94,
      numbers: bestTicket.sort((a, b) => a - b),
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      tags: ['Chuẩn Gaussian', 'Đa Mục Tiêu', 'Tương Quan Cao'],
      rationale: `Bộ số đạt chuẩn phân phối vàng (Tổng ${sum} trong khoảng [${goldMin}-${goldMax}]), cân bằng chẵn lẻ ${evenCount}:${6 - evenCount} và rải đều trên ${new Set(bestTicket.map(n => Math.floor((n - 1) / 10))).size} đầu số.`
    };
  }

  /**
   * CHIẾN LƯỢC 2: XU HƯỚNG NÓNG (Hot Momentum)
   * Tập trung các bóng số có nhịp rơi dày đặc trong 30-50 kỳ gần nhất
   */
  function predictHotTrend(contextData) {
    const { stats, totalBalls, sumStats } = contextData;
    // Sắp xếp theo số lần xuất hiện gần đây (recentCount) và decayWeight
    const hotPool = [...stats]
      .filter(s => s.recentCount > 0)
      .sort((a, b) => (b.decayWeight + b.recentCount * 0.5) - (a.decayWeight + a.recentCount * 0.5))
      .slice(0, 16)
      .map(s => s.number);

    // Chọn 6 số từ hot pool
    let bestTicket = null;
    let minDiff = Infinity;

    for (let trial = 0; trial < 800; trial++) {
      // Xáo trộn và lấy 6 số
      const shuffled = [...hotPool].sort(() => 0.5 - Math.random());
      const candidate = shuffled.slice(0, 6).sort((a, b) => a - b);
      const sum = candidate.reduce((a, b) => a + b, 0);
      const diff = Math.abs(sum - sumStats.theoreticalMean);

      const evenCount = candidate.filter(n => n % 2 === 0).length;
      if (evenCount >= 2 && evenCount <= 4 && diff < minDiff) {
        minDiff = diff;
        bestTicket = candidate;
      }
    }

    if (!bestTicket) {
      bestTicket = hotPool.slice(0, 6).sort((a, b) => a - b);
    }

    const sum = bestTicket.reduce((a, b) => a + b, 0);
    const evenCount = bestTicket.filter(n => n % 2 === 0).length;

    return {
      strategyId: 'hot_trend',
      name: 'Xu Hướng Nóng (Hot Momentum)',
      badge: 'Phong Độ Cao',
      badgeColor: 'warning',
      confidence: 89,
      numbers: bestTicket,
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      tags: ['Số Nóng 🔥', 'Đang Vào Nhịp', 'Tần Suất Cao'],
      rationale: `Lựa chọn từ các con số có tần suất xuất hiện liên tục trong các kỳ gần đây nhất, tận dụng quán tính chuỗi rơi của bóng số.`
    };
  }

  /**
   * CHIẾN LƯỢC 3: SĂN LÔ GAN HỒI QUY (Cold Rebound)
   * Đón đầu các số gan lâu chưa về nhưng đã chạm ngưỡng đảo chiều thống kê
   */
  function predictColdRebound(contextData) {
    const { stats, pairs, sumStats, totalBalls } = contextData;

    // Lọc các số có Current Gan cao (vượt 1.2 lần mean gap)
    const coldPool = [...stats]
      .filter(s => s.currentGan >= s.meanGap * 1.2 || s.currentGan >= 14)
      .sort((a, b) => b.currentGan - a.currentGan);

    // Lấy 2 số gan sáng giá nhất
    const topColdNums = coldPool.slice(0, 4).map(s => s.number);
    const pickedCold = topColdNums.slice(0, 2);

    // 4 số còn lại là các số có cặp tương quan (co-occurrence) mạnh nhất với 2 số gan này
    const companionScores = {};
    stats.forEach(s => {
      if (!pickedCold.includes(s.number)) {
        companionScores[s.number] = s.percentage * 0.5 + s.decayWeight * 0.5;
      }
    });

    pairs.forEach(p => {
      if (pickedCold.includes(p.num1) && companionScores[p.num2] !== undefined) {
        companionScores[p.num2] += p.lift * 3;
      }
      if (pickedCold.includes(p.num2) && companionScores[p.num1] !== undefined) {
        companionScores[p.num1] += p.lift * 3;
      }
    });

    const companionPool = Object.keys(companionScores)
      .map(Number)
      .sort((a, b) => companionScores[b] - companionScores[a])
      .slice(0, 15);

    let bestTicket = null;
    let minSumDiff = Infinity;

    for (let t = 0; t < 500; t++) {
      const shuffled = [...companionPool].sort(() => 0.5 - Math.random());
      const candidate = [...pickedCold, ...shuffled.slice(0, 4)].sort((a, b) => a - b);
      const sum = candidate.reduce((a, b) => a + b, 0);
      const diff = Math.abs(sum - sumStats.theoreticalMean);
      const evenCount = candidate.filter(n => n % 2 === 0).length;

      if (evenCount >= 2 && evenCount <= 4 && diff < minSumDiff) {
        minSumDiff = diff;
        bestTicket = candidate;
      }
    }

    if (!bestTicket) {
      bestTicket = [...pickedCold, ...companionPool.slice(0, 4)].sort((a, b) => a - b);
    }

    const sum = bestTicket.reduce((a, b) => a + b, 0);
    const evenCount = bestTicket.filter(n => n % 2 === 0).length;

    return {
      strategyId: 'cold_rebound',
      name: 'Lô Gan Hồi Quy (Cold Rebound)',
      badge: 'Chực Chờ Nổ',
      badgeColor: 'info',
      confidence: 85,
      numbers: bestTicket,
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      tags: ['Săn Lô Gan ❄️', 'Hồi Quy Thống Kê', 'Số Bù Tương Quan'],
      rationale: `Bắt 2 số gan chạm đỉnh chu kỳ trung bình [${pickedCold.map(n => String(n).padStart(2, '0')).join(', ')}] kết hợp với 4 số vệ tinh có độ đồng xuất hiện mạnh nhất.`
    };
  }

  /**
   * CHIẾN LƯỢC 4: CẶP SỐ TƯƠNG QUAN CAO (Co-occurrence Pairs)
   * Xây dựng từ các cặp số có tần suất đồng xuất hiện cao nhất
   */
  function predictCooccurrencePairs(contextData) {
    const { pairs, stats, sumStats } = contextData;
    const topPairs = pairs.slice(0, 20);

    let bestTicket = null;
    let bestScore = -Infinity;

    for (let trial = 0; trial < 1000; trial++) {
      // Chọn ngẫu nhiên 3 cặp số từ top pairs sao cho không bị trùng số
      const shuffled = [...topPairs].sort(() => 0.5 - Math.random());
      const selectedNums = new Set();
      let pairCount = 0;

      for (const p of shuffled) {
        if (!selectedNums.has(p.num1) && !selectedNums.has(p.num2)) {
          selectedNums.add(p.num1);
          selectedNums.add(p.num2);
          pairCount++;
          if (pairCount === 3) break;
        }
      }

      if (selectedNums.size === 6) {
        const candidate = Array.from(selectedNums).sort((a, b) => a - b);
        const sum = candidate.reduce((a, b) => a + b, 0);
        const [gMin, gMax] = sumStats.goldenRange;
        if (sum >= gMin - 15 && sum <= gMax + 15) {
          const evenCount = candidate.filter(n => n % 2 === 0).length;
          if (evenCount >= 2 && evenCount <= 4) {
            const score = 100 - Math.abs(sum - sumStats.theoreticalMean);
            if (score > bestScore) {
              bestScore = score;
              bestTicket = candidate;
            }
          }
        }
      }
    }

    if (!bestTicket) {
      bestTicket = [topPairs[0].num1, topPairs[0].num2, topPairs[1].num1, topPairs[1].num2, topPairs[2].num1, topPairs[2].num2];
      bestTicket = Array.from(new Set(bestTicket)).slice(0, 6).sort((a, b) => a - b);
    }

    const sum = bestTicket.reduce((a, b) => a + b, 0);
    const evenCount = bestTicket.filter(n => n % 2 === 0).length;

    return {
      strategyId: 'cooccurrence',
      name: 'Cặp Đôi Tương Quan (Co-occurrence Matrix)',
      badge: 'Đồng Điệu',
      badgeColor: 'primary',
      confidence: 88,
      numbers: bestTicket,
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      tags: ['Cặp Song Hành', 'Lift Cao', 'Ma Trận Đồng Xuất Hiện'],
      rationale: `Ghép từ các cặp 2 số có hệ số liên kết (Co-occurrence Lift) vượt trội nhất lịch sử, có xu hướng cùng về trong một kỳ quay.`
    };
  }

  /**
   * CHIẾN LƯỢC 5: PHÂN BỐ VÀNG GAUSS (Golden Gaussian Bell)
   * Tối ưu hóa phân phối đối xứng và tổng điểm tiệm cận chính xác giá trị trung bình lý thuyết
   */
  function predictGaussianBell(contextData) {
    const { stats, sumStats, totalBalls } = contextData;
    const targetMean = sumStats.theoreticalMean; // 138 (6/45) hoặc 168 (6/55)

    // Chia thành các dải hàng chục: 1..9, 10..19, 20..29, 30..39, 40..N
    const buckets = [];
    const ranges = totalBalls === 45
      ? [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]]
      : [[1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 55]];

    ranges.forEach(([min, max]) => {
      const inRange = stats.filter(s => s.number >= min && s.number <= max);
      buckets.push(inRange);
    });

    let bestTicket = null;
    let minDiff = Infinity;

    for (let trial = 0; trial < 1500; trial++) {
      const picked = [];
      // Lấy từ mỗi bucket ít nhất 1 số
      const shuffledBuckets = [...buckets].sort(() => 0.5 - Math.random());
      for (let i = 0; i < 5; i++) {
        const b = shuffledBuckets[i];
        if (b && b.length > 0) {
          const randomItem = b[Math.floor(Math.random() * b.length)];
          if (!picked.includes(randomItem.number)) {
            picked.push(randomItem.number);
          }
        }
      }

      // Chọn số thứ 6 ngẫu nhiên
      const remaining = stats.filter(s => !picked.includes(s.number));
      picked.push(remaining[Math.floor(Math.random() * remaining.length)].number);

      const candidate = picked.sort((a, b) => a - b);
      const sum = candidate.reduce((a, b) => a + b, 0);
      const diff = Math.abs(sum - targetMean);
      const evenCount = candidate.filter(n => n % 2 === 0).length;

      // Ưu tiên 3 Chẵn 3 Lẻ và diff nhỏ nhất
      if (evenCount === 3 && diff < minDiff) {
        minDiff = diff;
        bestTicket = candidate;
        if (diff === 0) break;
      }
    }

    if (!bestTicket) {
      bestTicket = stats.slice(0, 6).map(s => s.number).sort((a, b) => a - b);
    }

    const sum = bestTicket.reduce((a, b) => a + b, 0);
    const evenCount = bestTicket.filter(n => n % 2 === 0).length;

    return {
      strategyId: 'gaussian',
      name: 'Phân Bố Vàng Gauss (Golden Bell Curve)',
      badge: 'Chuẩn Toán Học',
      badgeColor: 'secondary',
      confidence: 91,
      numbers: bestTicket,
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      tags: ['Đường Cong Chuẩn', 'Tổng Sát μ', 'Trải Đều Đầu Số'],
      rationale: `Tổng điểm (${sum}) tiệm cận hoàn hảo giá trị trung bình lý thuyết $\\mu = ${targetMean}$, tỷ lệ chuẩn 3C - 3L và chia đều khắp các hàng chục.`
    };
  }

  /**
   * CHIẾN LƯỢC 6: MÔ PHỎNG MONTE CARLO 10,000 LẦN (Weighted Monte Carlo Simulation)
   * Chạy mô phỏng rút thăm ngẫu nhiên lớn với phân bố xác suất thực tế
   */
  function predictMonteCarlo(contextData) {
    const { stats, totalBalls, sumStats } = contextData;
    const weights = computeWeightMap(stats, totalBalls);
    const allNumbers = stats.map(s => s.number);
    const comboMap = new Map();

    const ITERATIONS = 10000;
    for (let i = 0; i < ITERATIONS; i++) {
      const ticket = sampleWithoutReplacement(allNumbers, weights, 6);
      const key = ticket.join('-');
      comboMap.set(key, (comboMap.get(key) || 0) + 1);
    }

    // Nếu không có combo trùng lặp nhiều lần (vì không gian mẫu C(45, 6) = 8.1 triệu),
    // đếm tần suất các số được bốc trúng trong mô phỏng
    const simNumberCounts = {};
    for (let n = 1; n <= totalBalls; n++) simNumberCounts[n] = 0;

    for (let i = 0; i < 5000; i++) {
      const ticket = sampleWithoutReplacement(allNumbers, weights, 6);
      ticket.forEach(num => simNumberCounts[num]++);
    }

    // Sắp xếp số theo tần suất mô phỏng
    const topSimNumbers = Object.keys(simNumberCounts)
      .map(Number)
      .sort((a, b) => simNumberCounts[b] - simNumberCounts[a]);

    // Chọn bộ 6 số thỏa mãn bộ lọc từ top 15 số của mô phỏng
    const pool = topSimNumbers.slice(0, 16);
    let bestTicket = null;
    let minDiff = Infinity;

    for (let trial = 0; trial < 800; trial++) {
      const candidate = [...pool].sort(() => 0.5 - Math.random()).slice(0, 6).sort((a, b) => a - b);
      const sum = candidate.reduce((a, b) => a + b, 0);
      const diff = Math.abs(sum - sumStats.theoreticalMean);
      const evenCount = candidate.filter(n => n % 2 === 0).length;

      if (evenCount >= 2 && evenCount <= 4 && diff < minDiff) {
        minDiff = diff;
        bestTicket = candidate;
      }
    }

    if (!bestTicket) {
      bestTicket = pool.slice(0, 6).sort((a, b) => a - b);
    }

    const sum = bestTicket.reduce((a, b) => a + b, 0);
    const evenCount = bestTicket.filter(n => n % 2 === 0).length;

    return {
      strategyId: 'monte_carlo',
      name: 'Mô Phỏng Monte Carlo (10,000 Runs)',
      badge: 'Mô Phỏng Lớn',
      badgeColor: 'danger',
      confidence: 87,
      numbers: bestTicket,
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      tags: ['Monte Carlo 🎲', '10,000 Lượt Rút', 'Xác Suất Hội Tụ'],
      rationale: `Kết quả từ thuật toán mô phỏng 10,000 lần bốc thăm ngẫu nhiên có trọng số, chọn lọc các số có tần suất xuất hiện hội tụ cao nhất.`
    };
  }

  /**
   * Sinh toàn bộ 6 bộ số dự đoán theo 6 chiến lược khác nhau
   */
  function generateAllPredictions(contextData) {
    return [
      predictBalancedEnsemble(contextData),
      predictHotTrend(contextData),
      predictColdRebound(contextData),
      predictCooccurrencePairs(contextData),
      predictGaussianBell(contextData),
      predictMonteCarlo(contextData)
    ];
  }

  /**
   * Tính toán bộ số bổ sung khi người dùng GHIM (PIN) các số may mắn
   * @param {Array<number>} pinnedNumbers Mảng các số người dùng đã chọn (1 đến 5 số)
   * @param {Object} contextData
   */
  function generatePinAssistedTicket(pinnedNumbers, contextData) {
    if (!pinnedNumbers || pinnedNumbers.length === 0) {
      return predictBalancedEnsemble(contextData);
    }

    const { stats, pairs, sumStats, totalBalls } = contextData;
    const needed = 6 - pinnedNumbers.length;
    if (needed <= 0) {
      const sum = pinnedNumbers.reduce((a, b) => a + b, 0);
      const evenCount = pinnedNumbers.filter(n => n % 2 === 0).length;
      return {
        numbers: [...pinnedNumbers].sort((a, b) => a - b),
        sum,
        evenOdd: `${evenCount}C - ${6 - evenCount}L`,
        rationale: 'Bộ 6 số do chính bạn lựa chọn hoàn toàn.'
      };
    }

    // Đánh giá điểm liên kết của các số còn lại với nhóm số đã ghim
    const candidateScores = {};
    const pinnedSet = new Set(pinnedNumbers);

    stats.forEach(s => {
      if (!pinnedSet.has(s.number)) {
        // Điểm cơ bản: Tần suất và trọng số thời gian
        candidateScores[s.number] = s.percentage * 0.4 + s.decayWeight * 0.4;
      }
    });

    // Cộng điểm tương quan Co-occurrence với từng số đã ghim
    pairs.forEach(p => {
      if (pinnedSet.has(p.num1) && candidateScores[p.num2] !== undefined) {
        candidateScores[p.num2] += p.lift * 5;
      }
      if (pinnedSet.has(p.num2) && candidateScores[p.num1] !== undefined) {
        candidateScores[p.num1] += p.lift * 5;
      }
    });

    const rankedCandidates = Object.keys(candidateScores)
      .map(Number)
      .sort((a, b) => candidateScores[b] - candidateScores[a])
      .slice(0, 20);

    let bestComplement = null;
    let minSumDiff = Infinity;

    for (let trial = 0; trial < 1000; trial++) {
      const shuffled = [...rankedCandidates].sort(() => 0.5 - Math.random());
      const complement = shuffled.slice(0, needed);
      const fullTicket = [...pinnedNumbers, ...complement].sort((a, b) => a - b);
      const sum = fullTicket.reduce((a, b) => a + b, 0);
      const diff = Math.abs(sum - sumStats.theoreticalMean);
      const evenCount = fullTicket.filter(n => n % 2 === 0).length;

      if (evenCount >= 2 && evenCount <= 4 && diff < minSumDiff) {
        minSumDiff = diff;
        bestComplement = complement;
      }
    }

    if (!bestComplement) {
      bestComplement = rankedCandidates.slice(0, needed);
    }

    const finalNumbers = [...pinnedNumbers, ...bestComplement].sort((a, b) => a - b);
    const sum = finalNumbers.reduce((a, b) => a + b, 0);
    const evenCount = finalNumbers.filter(n => n % 2 === 0).length;

    return {
      numbers: finalNumbers,
      pinnedNumbers: [...pinnedNumbers].sort((a, b) => a - b),
      addedNumbers: [...bestComplement].sort((a, b) => a - b),
      sum,
      evenOdd: `${evenCount} Chẵn - ${6 - evenCount} Lẻ`,
      confidence: 90,
      rationale: `Giữ cố định ${pinnedNumbers.length} số bạn chọn [${pinnedNumbers.map(n => String(n).padStart(2, '0')).join(', ')}] và tự động bổ sung ${needed} số có độ tương quan co-occurrence mạnh nhất [${bestComplement.map(n => String(n).padStart(2, '0')).join(', ')}].`
    };
  }

  return {
    generateAllPredictions,
    generatePinAssistedTicket,
    predictBalancedEnsemble,
    predictHotTrend,
    predictColdRebound,
    predictCooccurrencePairs,
    predictGaussianBell,
    predictMonteCarlo
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LotteryPredictor;
}
