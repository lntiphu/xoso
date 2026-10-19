/**
 * Traditional Vietnam Lottery Schedule & Data (js/traditional_data.js)
 * Cung cấp thông tin lịch quay thưởng 63 tỉnh thành, cơ cấu giải và dữ liệu lịch sử
 */

const TRADITIONAL_LOTTERY = (function() {
  'use strict';

  // Lịch quay thưởng 21 đài Xổ Số Kiến Thiết Miền Nam (16:15 hàng ngày)
  const SCHEDULE = {
    mn: {
      name: 'Xổ Số Miền Nam',
      region: 'south',
      time: '16:15',
      prizesCount: 18,
      hasPrize8: true,
      days: {
        1: [{ code: 'HCM', name: 'TP. Hồ Chí Minh' }, { code: 'DT', name: 'Đồng Tháp' }, { code: 'CM', name: 'Cà Mau' }],
        2: [{ code: 'BT', name: 'Bến Tre' }, { code: 'VT', name: 'Vũng Tàu' }, { code: 'BL', name: 'Bạc Liêu' }],
        3: [{ code: 'DN', name: 'Đồng Nai' }, { code: 'CT', name: 'Cần Thơ' }, { code: 'ST', name: 'Sóc Trăng' }],
        4: [{ code: 'TN', name: 'Tây Ninh' }, { code: 'AG', name: 'An Giang' }, { code: 'BTH', name: 'Bình Thuận' }],
        5: [{ code: 'VL', name: 'Vĩnh Long' }, { code: 'BD', name: 'Bình Dương' }, { code: 'TV', name: 'Trà Vinh' }],
        6: [{ code: 'HCM', name: 'TP. Hồ Chí Minh' }, { code: 'LA', name: 'Long An' }, { code: 'BP', name: 'Bình Phước' }, { code: 'HG', name: 'Hậu Giang' }],
        0: [{ code: 'TG', name: 'Tiền Giang' }, { code: 'KG', name: 'Kiên Giang' }, { code: 'DL', name: 'Đà Lạt (Lâm Đồng)' }]
      }
    }
  };

  /**
   * Tạo số ngẫu nhiên có seed theo ngày và mã đài để kết quả đồng nhất và ổn định
   */
  function pseudoRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function generateNumber(digits, seed) {
    let num = Math.floor(pseudoRandom(seed) * Math.pow(10, digits));
    return String(num).padStart(digits, '0');
  }

  /**
   * Truy xuất dữ liệu lịch sử XSMN đã cào chính thức từ hệ thống
   */
  function getHistoricalCache() {
    if (typeof XSMN_HISTORICAL_DATA !== 'undefined' && XSMN_HISTORICAL_DATA) {
      return XSMN_HISTORICAL_DATA;
    }
    if (typeof window !== 'undefined' && window.XSMN_HISTORICAL_DATA) {
      return window.XSMN_HISTORICAL_DATA;
    }
    if (typeof global !== 'undefined' && global.XSMN_HISTORICAL_DATA) {
      return global.XSMN_HISTORICAL_DATA;
    }
    try {
      if (typeof require !== 'undefined') {
        return require('./traditional_history.js');
      }
    } catch (e) {}
    return {};
  }

  /**
   * Lấy kỳ quay mở thưởng chính thức gần đây nhất của một đài
   */
  function getLatestOfficialDraw(region, provinceCode) {
    const history = getHistoricalCache();
    const prefix = `mn_${provinceCode}_`;
    const matchingKeys = Object.keys(history)
      .filter(k => k.startsWith(prefix) && history[k] && history[k].special)
      .sort((a, b) => b.localeCompare(a));

    if (matchingKeys.length > 0) {
      return {
        ...history[matchingKeys[0]],
        hasDrawn: true,
        isOfficial: true
      };
    }
    return null;
  }

  /**
   * Lấy kết quả xổ số chuẩn cho một đài Miền Nam và một ngày cụ thể (18 giải)
   * Ưu tiên dữ liệu thật chính thức từ XSMN, nếu là ngày tương lai hoặc chưa quay thì trả về hasDrawn: false
   * @param {string} region 'mn'
   * @param {string} provinceCode 'HCM', 'DT', 'CM', ...
   * @param {string} dateStr YYYY-MM-DD
   * @param {boolean} allowSimulation Cho phép sinh số mô phỏng khi phục vụ thuật toán thống kê kỳ cũ
   */
  function getDrawResult(region, provinceCode, dateStr, allowSimulation = false) {
    const history = getHistoricalCache();
    const key = `mn_${provinceCode}_${dateStr}`;
    if (history && history[key] && history[key].special) {
      return {
        ...history[key],
        hasDrawn: true,
        isOfficial: true
      };
    }

    if (!allowSimulation) {
      return {
        region: 'mn',
        provinceCode,
        date: dateStr,
        hasDrawn: false,
        isOfficial: false,
        special: '',
        g1: '',
        g2: '',
        g3: [],
        g4: [],
        g5: '',
        g6: [],
        g7: '',
        g8: ''
      };
    }

    const seedBase = hashString(`mn_${provinceCode}_${dateStr}`);
    let seed = seedBase;

    // Xổ Số Miền Nam: Chuẩn 18 giải phục vụ thuật toán thống kê
    return {
      region: 'mn',
      provinceCode,
      date: dateStr,
      hasDrawn: true,
      isOfficial: false,
      isSimulated: true,
      special: generateNumber(6, seed++),
      g1: generateNumber(5, seed++),
      g2: generateNumber(5, seed++),
      g3: [generateNumber(5, seed++), generateNumber(5, seed++)],
      g4: [
        generateNumber(5, seed++), generateNumber(5, seed++), generateNumber(5, seed++),
        generateNumber(5, seed++), generateNumber(5, seed++), generateNumber(5, seed++), generateNumber(5, seed++)
      ],
      g5: generateNumber(4, seed++),
      g6: [generateNumber(4, seed++), generateNumber(4, seed++), generateNumber(4, seed++)],
      g7: generateNumber(3, seed++),
      g8: generateNumber(2, seed++)
    };
  }

  /**
   * Lấy danh sách các số 2 chữ số cuối (Lô tô) từ bảng kết quả
   */
  function extractLotoNumbers(drawResult) {
    const lotoList = [];

    function addNumber(val) {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(v => addNumber(v));
      } else {
        const s = String(val);
        if (s.length >= 2) {
          lotoList.push(s.slice(-2));
        }
      }
    }

    Object.keys(drawResult).forEach(key => {
      if (key !== 'region' && key !== 'provinceCode' && key !== 'date') {
        addNumber(drawResult[key]);
      }
    });

    return lotoList;
  }

  /**
   * Tính bảng phân phối Đầu - Đuôi của 2 số cuối
   */
  function calculateHeadTail(lotoList) {
    const heads = {};
    const tails = {};

    for (let i = 0; i <= 9; i++) {
      heads[i] = [];
      tails[i] = [];
    }

    lotoList.forEach(num => {
      const h = parseInt(num[0], 10);
      const t = parseInt(num[1], 10);
      if (!isNaN(h)) heads[h].push(num);
      if (!isNaN(t)) tails[t].push(num);
    });

    // Sắp xếp các số trong từng đầu, đuôi
    for (let i = 0; i <= 9; i++) {
      heads[i].sort();
      tails[i].sort();
    }

    // Xác định đầu câm, đuôi câm (những đầu/đuôi không ra số nào)
    const silentHeads = Object.keys(heads).filter(h => heads[h].length === 0).map(Number);
    const silentTails = Object.keys(tails).filter(t => tails[t].length === 0).map(Number);

    return { heads, tails, silentHeads, silentTails };
  }

  /**
   * Lấy danh sách các đài mở thưởng trong ngày cụ thể (theo thứ trong tuần)
   */
  function getProvincesByDate(region, dateStr) {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay(); // 0: Chủ Nhật, 1: Thứ Hai,...
    const regConfig = SCHEDULE[region] || SCHEDULE.mn;
    if (!regConfig || !regConfig.days[dayOfWeek]) {
      return SCHEDULE.mn.days[1];
    }
    return regConfig.days[dayOfWeek];
  }

  return {
    SCHEDULE,
    getProvincesByDate,
    getDrawResult,
    getLatestOfficialDraw,
    extractLotoNumbers,
    calculateHeadTail,
    hashString,
    pseudoRandom
  };
})();

if (typeof window !== 'undefined') {
  window.TRADITIONAL_LOTTERY = TRADITIONAL_LOTTERY;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TRADITIONAL_LOTTERY;
}
