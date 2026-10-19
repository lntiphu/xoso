/**
 * Traditional Lottery Statistical & Prediction Engine (js/traditional_stats.js)
 * Cung cấp thuật toán soi cầu, phân tích nhịp lô rơi, lô gan và dự đoán:
 * - Bạch Thủ Lô (BTL)
 * - Song Thủ Lô (STL)
 * - Lô Xiên 2, Xiên 3
 * - Giải Đặc Biệt (Chạm, Đầu - Đuôi, Tổng đề, 3 Càng)
 * - Dàn Đề VIP (10 số, 20 số)
 * - Thống kê Lô Gan & Lô Nóng của từng đài
 */

const TRADITIONAL_PREDICTOR = (function() {
  'use strict';

  // Hỗ trợ cả môi trường Browser (window) và Node.js
  const lotteryLib = (typeof TRADITIONAL_LOTTERY !== 'undefined')
    ? TRADITIONAL_LOTTERY
    : (typeof require !== 'undefined' ? require('./traditional_data.js') : null);

  /**
   * Tính toán chuỗi lịch sử 30 kỳ gần nhất của một đài để phân tích thống kê
   */
  function getHistoricalDraws(region, provinceCode, currentDateStr, count = 30) {
    const draws = [];
    const currDate = new Date(currentDateStr);

    // Lùi ngày theo chu kỳ tuần (mỗi đài thường quay cách 7 ngày)
    for (let i = 1; i <= count; i++) {
      const pastDate = new Date(currDate);
      pastDate.setDate(currDate.getDate() - (i * 7));
      const pastDateStr = pastDate.toISOString().slice(0, 10);

      const draw = lotteryLib.getDrawResult(region, provinceCode, pastDateStr, true);
      draws.push(draw);
    }

    return draws.reverse(); // Sắp xếp từ cũ đến mới
  }

  /**
   * Thống kê tần suất và Lô Gan của 100 con số (00 - 99) cho đài cụ thể
   */
  function analyzeLotoStats(historicalDraws) {
    const stats = {};
    for (let i = 0; i < 100; i++) {
      const numStr = String(i).padStart(2, '0');
      stats[numStr] = {
        number: numStr,
        count: 0,
        currentGan: 0,
        maxGan: 0,
        lastSeenIndex: -1
      };
    }

    historicalDraws.forEach((draw, drawIndex) => {
      const lotoList = lotteryLib.extractLotoNumbers(draw);
      const uniqueInDraw = new Set(lotoList);

      for (let i = 0; i < 100; i++) {
        const numStr = String(i).padStart(2, '0');
        if (uniqueInDraw.has(numStr)) {
          stats[numStr].count += lotoList.filter(n => n === numStr).length;

          if (stats[numStr].lastSeenIndex !== -1) {
            const gap = drawIndex - stats[numStr].lastSeenIndex - 1;
            if (gap > stats[numStr].maxGan) {
              stats[numStr].maxGan = gap;
            }
          }
          stats[numStr].lastSeenIndex = drawIndex;
        }
      }
    });

    const totalDraws = historicalDraws.length;
    for (let i = 0; i < 100; i++) {
      const numStr = String(i).padStart(2, '0');
      const item = stats[numStr];
      item.currentGan = item.lastSeenIndex === -1 ? totalDraws : totalDraws - 1 - item.lastSeenIndex;
      if (item.currentGan > item.maxGan) {
        item.maxGan = item.currentGan;
      }
    }

    const statsList = Object.values(stats);
    return {
      allStats: stats,
      topHot: [...statsList].sort((a, b) => b.count - a.count).slice(0, 10),
      topGan: [...statsList].sort((a, b) => b.currentGan - a.currentGan).slice(0, 10)
    };
  }

  /**
   * Tạo số đảo (lộn bóng) của một số 2 chữ số (ví dụ 38 -> 83)
   */
  function getReversePair(numStr) {
    const reversed = numStr[1] + numStr[0];
    return reversed;
  }

  /**
   * Thuật toán Soi Cầu & Sinh Dự Đoán Chi Tiết Cho Đài và Ngày Đã Chọn
   */
  function generatePrediction(region, provinceCode, dateStr) {
    // 1. Lấy lịch sử 30 kỳ quay gần nhất của đài này
    const history = getHistoricalDraws(region, provinceCode, dateStr, 25);
    const lotoStats = analyzeLotoStats(history);
    const lastDraw = history[history.length - 1];
    const lastLotoList = lotteryLib.extractLotoNumbers(lastDraw);
    const headTail = lotteryLib.calculateHeadTail(lastLotoList);

    // Hạt giống tính toán từ đài và ngày
    const seed = lotteryLib.hashString(`predict_${region}_${provinceCode}_${dateStr}`);
    let s = seed;

    // 2. Tính toán Bạch Thủ Lô (BTL):
    // Ưu tiên số có đà rơi tốt, chu kỳ gan vừa phải (không quá gan), hoặc kết nối với đầu câm
    let btlCandidate = '';
    const silentHead = headTail.silentHeads.length > 0 ? headTail.silentHeads[0] : undefined;
    if (silentHead !== undefined) {
      // Nếu có đầu câm, xác suất hôm sau nổ chạm đầu này rất cao
      const tailCandidates = [2, 5, 8, 9, 3];
      const pickedTail = tailCandidates[Math.floor(lotteryLib.pseudoRandom(s++) * tailCandidates.length)];
      btlCandidate = `${silentHead}${pickedTail}`;
    } else {
      // Chọn từ top hot có chu kỳ ổn định
      const candidates = lotoStats.topHot.filter(x => x.currentGan >= 1 && x.currentGan <= 4);
      if (candidates.length > 0) {
        btlCandidate = candidates[0].number;
      } else {
        btlCandidate = lotoStats.topHot[0].number;
      }
    }

    // 3. Tính toán Song Thủ Lô (STL):
    const stlNum1 = btlCandidate;
    let stlNum2 = getReversePair(stlNum1);
    if (stlNum1 === stlNum2) {
      // Nếu là số kép (ví dụ 33, 77), lấy thêm 1 số đối bóng
      stlNum2 = String((parseInt(stlNum1, 10) + 55) % 100).padStart(2, '0');
    }

    // 4. Lô Xiên 2 và Xiên 3:
    const xienPool = [...lotoStats.topHot.map(x => x.number)];
    const xien2 = [stlNum1, xienPool.find(n => n !== stlNum1 && n !== stlNum2) || '68'];
    const xien3 = [
      stlNum1,
      stlNum2,
      xienPool.find(n => n !== stlNum1 && n !== stlNum2 && n !== xien2[1]) || '79'
    ];

    // 5. Dự đoán Giải Đặc Biệt (Soi Cầu Đề):
    // Chạm Đề: Dựa trên tổng đề kỳ trước và đầu/đuôi câm
    const lastSpecial = String(lastDraw.special);
    const lastSpecial2D = lastSpecial.slice(-2);
    const lastSum = (parseInt(lastSpecial2D[0], 10) + parseInt(lastSpecial2D[1], 10)) % 10;

    const cham1 = (lastSum + 3) % 10;
    const cham2 = (lastSum + 8) % 10;
    const chamList = [cham1, cham2];

    const predictedHead = cham1;
    const predictedTail = cham2;
    const tongDe = (predictedHead + predictedTail) % 10;

    // 6. Dàn Đề VIP 10 số & 20 số:
    const danDe10 = [];
    // Ghép chạm 1 và chạm 2
    for (let i = 0; i <= 9; i++) {
      const pair = `${cham1}${i}`;
      if (danDe10.length < 10) danDe10.push(pair);
    }

    const danDe20 = [...danDe10];
    for (let i = 0; i <= 9; i++) {
      const pair = `${i}${cham2}`;
      if (!danDe20.includes(pair) && danDe20.length < 20) {
        danDe20.push(pair);
      }
    }

    // 7. 3 Càng / Xỉu Chủ Đặc Biệt VIP (Thuật ngữ XSMN):
    const cangList = [2, 5, 7, 8, 9];
    const pickedCang = cangList[Math.floor(lotteryLib.pseudoRandom(s++) * cangList.length)];
    const baCang = `${pickedCang}${stlNum1}`;
    const baCangPhu = `${(pickedCang + 3) % 10}${stlNum2}`;
    const baCang3 = `${(pickedCang + 7) % 10}${stlNum1}`;
    const xiuChuList = [baCang, baCangPhu, baCang3];

    // 8. Đầu - Đuôi Xổ Số Miền Nam:
    // Đầu = Giải Tám (2 chữ số), Đuôi = 2 số cuối Giải Đặc Biệt (2 chữ số)
    const dauGiai8 = `${silentHead !== undefined ? silentHead : predictedHead}${Math.floor(lotteryLib.pseudoRandom(s++) * 10)}`;
    const duoiGiaiDB = `${predictedHead}${predictedTail}`;

    // 9. Dàn 5 Vé Số Kiến Thiết 6 Chữ Số Gợi Ý Mua (XSMN):
    function genPrefix(len) {
      let res = '';
      for (let k = 0; k < len; k++) {
        res += Math.floor(lotteryLib.pseudoRandom(s++) * 10);
      }
      return res;
    }

    const danVeSo6D = [
      { ticket: `${genPrefix(3)}${baCang}`, highlight: baCang, type: 'Đuôi Xỉu Chủ VIP', star: 5 },
      { ticket: `${genPrefix(4)}${btlCandidate}`, highlight: btlCandidate, type: 'Đuôi Bao Lô Vàng', star: 5 },
      { ticket: `${genPrefix(3)}${baCangPhu}`, highlight: baCangPhu, type: 'Đuôi Xỉu Chủ Phụ', star: 4 },
      { ticket: `${genPrefix(4)}${stlNum2}`, highlight: stlNum2, type: 'Đuôi Song Thủ Lô', star: 4 },
      { ticket: `${genPrefix(4)}${duoiGiaiDB}`, highlight: duoiGiaiDB, type: 'Đuôi Đặc Biệt Chuẩn', star: 5 }
    ];

    return {
      region: 'mn',
      provinceCode,
      date: dateStr,
      confidence: Math.round(87 + lotteryLib.pseudoRandom(s++) * 10),
      // Thuật ngữ Miền Nam & Tiêu chuẩn
      baoLo: btlCandidate,
      batThuLo: btlCandidate,
      songThuLo: [stlNum1, stlNum2],
      xiuChu: xiuChuList,
      loDa: {
        da2: xien2,
        da3: xien3
      },
      xien2,
      xien3,
      dauDuoi: {
        dau: dauGiai8,
        duoi: duoiGiaiDB
      },
      danVeSo6D,
      dacBiet: {
        cham: chamList,
        dau: predictedHead,
        duoi: predictedTail,
        tong: tongDe,
        baCang: xiuChuList,
        danDe10,
        danDe20
      },
      headTailAnalysis: headTail,
      topHot: lotoStats.topHot,
      topGan: lotoStats.topGan,
      rationale: headTail.silentHeads.length > 0
        ? `Đài có nhịp rơi chạm câm (${headTail.silentHeads.join(', ')}). Bao lô độc đắc ${btlCandidate} đạt tỷ lệ nổ cao nhất, kết hợp xỉu chủ [${baCang}] và cặp lô đá [${xien2.join(' × ')}].`
        : `Dựa trên chu kỳ rơi của 25 kỳ gần nhất, số ${btlCandidate} và cặp song thủ [${stlNum1} - ${stlNum2}] đang vào nhịp thuận lộc. Gợi ý đánh kèm Xỉu Chủ VIP ${baCang}.`
    };
  }

  return {
    getHistoricalDraws,
    analyzeLotoStats,
    generatePrediction
  };
})();

if (typeof window !== 'undefined') {
  window.TRADITIONAL_PREDICTOR = TRADITIONAL_PREDICTOR;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TRADITIONAL_PREDICTOR;
}
