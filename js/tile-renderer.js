/**
 * 雀圣兵法 · 高保真麻将牌面矢量渲染引擎
 * 真实还原传统麻将牌面：
 * - 筒子 (1-9筒)：同心圆、传统大饼罗盘太阳菊纹 (1筒)、正统红蓝绿圆点排布
 * - 条子 (1-9条)：经典立体竹节图案与 1条“幺鸡”雀鸟图腾
 * - 万字 (1-9万)：经典传统书法汉字搭配朱砂红“萬”字
 */

class TileRenderer {
    /**
     * 渲染牌面内部核心图案
     * @param {Object} tile { suit, val, code }
     * @returns {string} HTML / SVG 标记
     */
    static renderTileFace(tile) {
        if (!tile) return '';

        if (tile.suit === 'tong') {
            return this.renderTong(tile.val);
        } else if (tile.suit === 'tiao') {
            return this.renderTiao(tile.val);
        } else if (tile.suit === 'wan') {
            return this.renderWan(tile.val);
        }
        return '';
    }

    /**
     * 1-9 筒 (饼子)：标准同心圆与圆环
     */
    static renderTong(val) {
        // 经典配色：深海蓝 #1e50a2, 朱砂红 #c0392b, 苍绿 #137547
        const BLUE = '#1e50a2';
        const RED = '#c0392b';
        const GREEN = '#137547';

        // 单个同心圆点辅助生成
        const dot = (cx, cy, r, color = BLUE, innerColor = '#fff') => `
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#0b2847" stroke-width="0.8"/>
            <circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="${innerColor}"/>
            <circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="${color}"/>
        `;

        let content = '';

        switch (val) {
            case 1:
                // 1筒：经典大饼罗盘太阳菊纹
                content = `
                    <circle cx="25" cy="35" r="18" fill="#e74c3c" stroke="#962d22" stroke-width="1.2"/>
                    <circle cx="25" cy="35" r="14" fill="#f1c40f" stroke="#c0392b" stroke-width="1"/>
                    <circle cx="25" cy="35" r="9" fill="#137547"/>
                    <circle cx="25" cy="35" r="5" fill="#e74c3c"/>
                    <circle cx="25" cy="35" r="2.2" fill="#fff"/>
                    ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
                        const rad = (deg * Math.PI) / 180;
                        const x = 25 + 11.5 * Math.cos(rad);
                        const y = 35 + 11.5 * Math.sin(rad);
                        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="#c0392b"/>`;
                    }).join('')}
                `;
                break;
            case 2:
                content = dot(25, 20, 6.5, GREEN) + dot(25, 50, 6.5, BLUE);
                break;
            case 3:
                content = dot(14, 18, 5.5, BLUE) + dot(25, 35, 5.5, RED) + dot(36, 52, 5.5, GREEN);
                break;
            case 4:
                content = dot(15, 22, 5.5, BLUE) + dot(35, 22, 5.5, GREEN) +
                          dot(15, 48, 5.5, GREEN) + dot(35, 48, 5.5, BLUE);
                break;
            case 5:
                content = dot(14, 19, 5, BLUE) + dot(36, 19, 5, GREEN) +
                          dot(25, 35, 6, RED) +
                          dot(14, 51, 5, GREEN) + dot(36, 51, 5, BLUE);
                break;
            case 6:
                content = dot(16, 19, 5, GREEN) + dot(34, 19, 5, GREEN) +
                          dot(16, 35, 5, RED) + dot(34, 35, 5, RED) +
                          dot(16, 51, 5, RED) + dot(34, 51, 5, RED);
                break;
            case 7:
                content = dot(13, 16, 4.2, GREEN) + dot(25, 22, 4.2, GREEN) + dot(37, 28, 4.2, GREEN) +
                          dot(16, 42, 4.6, RED) + dot(34, 42, 4.6, RED) +
                          dot(16, 56, 4.6, RED) + dot(34, 56, 4.6, RED);
                break;
            case 8:
                content = dot(16, 15, 4.2, BLUE) + dot(34, 15, 4.2, BLUE) +
                          dot(16, 28, 4.2, BLUE) + dot(34, 28, 4.2, BLUE) +
                          dot(16, 42, 4.2, BLUE) + dot(34, 42, 4.2, BLUE) +
                          dot(16, 55, 4.2, BLUE) + dot(34, 55, 4.2, BLUE);
                break;
            case 9:
                content = dot(14, 18, 4.6, BLUE) + dot(25, 18, 4.6, BLUE) + dot(36, 18, 4.6, BLUE) +
                          dot(14, 35, 4.6, RED) + dot(25, 35, 4.6, RED) + dot(36, 35, 4.6, RED) +
                          dot(14, 52, 4.6, GREEN) + dot(25, 52, 4.6, GREEN) + dot(36, 52, 4.6, GREEN);
                break;
        }

        return `<svg class="tile-svg" viewBox="0 0 50 70">${content}</svg>`;
    }

    /**
     * 1-9 条 (索子)：立体竹节与 1条“幺鸡”雀鸟
     */
    static renderTiao(val) {
        const GREEN = '#137547';
        const RED = '#c0392b';
        const BLUE_TIAO = '#1e50a2';

        // 单根立体竹节辅助生成
        const bamboo = (x, y, w = 5, h = 18, color = GREEN) => `
            <g transform="translate(${x}, ${y})">
                <rect x="0" y="0" width="${w}" height="${h}" rx="2.5" fill="${color}" stroke="#093d25" stroke-width="0.7"/>
                <line x1="0.5" y1="${h * 0.35}" x2="${w - 0.5}" y2="${h * 0.35}" stroke="#fff" stroke-width="0.8"/>
                <line x1="0.5" y1="${h * 0.65}" x2="${w - 0.5}" y2="${h * 0.65}" stroke="#fff" stroke-width="0.8"/>
                <circle cx="${w / 2}" cy="${h / 2}" r="1" fill="${color === GREEN ? RED : GREEN}"/>
            </g>
        `;

        let content = '';

        switch (val) {
            case 1:
                // 1条：经典国标/川麻“幺鸡”（栖于翠竹上的灵雀图腾）
                content = `
                    <!-- 栖枝竹节 -->
                    <rect x="12" y="52" width="26" height="4.5" rx="2" fill="${GREEN}" stroke="#07301c" stroke-width="0.7"/>
                    <!-- 鸟身与羽翼 -->
                    <ellipse cx="25" cy="34" rx="10" ry="14" fill="${GREEN}" stroke="#07301c" stroke-width="0.8"/>
                    <ellipse cx="26" cy="33" rx="7" ry="10" fill="#27ae60"/>
                    <path d="M 21 28 Q 14 34 20 44 Q 24 38 21 28 Z" fill="${RED}"/>
                    <!-- 鸟头与冠羽 -->
                    <circle cx="25" cy="18" r="6.5" fill="${GREEN}" stroke="#07301c" stroke-width="0.8"/>
                    <!-- 鸟眼 -->
                    <circle cx="23" cy="17" r="1.6" fill="#fff"/>
                    <circle cx="23" cy="17" r="0.9" fill="#000"/>
                    <!-- 鸟喙 -->
                    <polygon points="18,17 14,19 18,21" fill="#e67e22"/>
                    <!-- 冠翎与红顶 -->
                    <path d="M 25 12 Q 27 6 32 7 Q 28 11 26 12 Z" fill="${RED}"/>
                    <!-- 尾羽 -->
                    <path d="M 23 46 Q 16 54 18 62 Q 22 56 24 47 Z" fill="${GREEN}"/>
                    <path d="M 26 47 Q 28 56 31 63 Q 30 54 27 47 Z" fill="${RED}"/>
                `;
                break;
            case 2:
                content = bamboo(22.5, 12, 5, 20, GREEN) + bamboo(22.5, 38, 5, 20, BLUE_TIAO || GREEN);
                break;
            case 3:
                content = bamboo(22.5, 10, 5, 18, GREEN) +
                          bamboo(14, 38, 5, 20, GREEN) + bamboo(31, 38, 5, 20, GREEN);
                break;
            case 4:
                content = bamboo(14, 12, 5, 20, GREEN) + bamboo(31, 12, 5, 20, RED) +
                          bamboo(14, 38, 5, 20, RED) + bamboo(31, 38, 5, 20, GREEN);
                break;
            case 5:
                content = bamboo(12, 12, 5, 19, GREEN) + bamboo(33, 12, 5, 19, GREEN) +
                          bamboo(22.5, 25, 5, 20, RED) +
                          bamboo(12, 39, 5, 19, GREEN) + bamboo(33, 39, 5, 19, GREEN);
                break;
            case 6:
                content = bamboo(12, 12, 4.5, 19, GREEN) + bamboo(22.5, 12, 4.5, 19, GREEN) + bamboo(33, 12, 4.5, 19, GREEN) +
                          bamboo(12, 38, 4.5, 19, GREEN) + bamboo(22.5, 38, 4.5, 19, GREEN) + bamboo(33, 38, 4.5, 19, GREEN);
                break;
            case 7:
                content = bamboo(22.5, 8, 4.5, 17, RED) +
                          bamboo(12, 28, 4.5, 17, GREEN) + bamboo(22.5, 28, 4.5, 17, GREEN) + bamboo(33, 28, 4.5, 17, GREEN) +
                          bamboo(12, 47, 4.5, 17, GREEN) + bamboo(22.5, 47, 4.5, 17, GREEN) + bamboo(33, 47, 4.5, 17, GREEN);
                break;
            case 8:
                // 八条经典斜跨或双列4排
                content = bamboo(14, 10, 4.5, 12, GREEN) + bamboo(31, 10, 4.5, 12, GREEN) +
                          bamboo(14, 24, 4.5, 12, GREEN) + bamboo(31, 24, 4.5, 12, GREEN) +
                          bamboo(14, 38, 4.5, 12, GREEN) + bamboo(31, 38, 4.5, 12, GREEN) +
                          bamboo(14, 52, 4.5, 12, GREEN) + bamboo(31, 52, 4.5, 12, GREEN);
                break;
            case 9:
                content = bamboo(12, 10, 4.5, 15, RED) + bamboo(22.5, 10, 4.5, 15, RED) + bamboo(33, 10, 4.5, 15, RED) +
                          bamboo(12, 28, 4.5, 15, GREEN) + bamboo(22.5, 28, 4.5, 15, GREEN) + bamboo(33, 28, 4.5, 15, GREEN) +
                          bamboo(12, 46, 4.5, 15, GREEN) + bamboo(22.5, 46, 4.5, 15, GREEN) + bamboo(33, 46, 4.5, 15, GREEN);
                break;
        }

        return `<svg class="tile-svg" viewBox="0 0 50 70">${content}</svg>`;
    }

    /**
     * 1-9 万 (字牌)：正统传统汉字书法与朱砂大“萬”字
     */
    static renderWan(val) {
        const numChars = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
        const numStr = numChars[val] || '';

        return `
            <div class="wan-face-container">
                <span class="wan-num-glyph">${numStr}</span>
                <span class="wan-char-glyph">萬</span>
            </div>
        `;
    }
}

if (typeof module !== 'undefined') {
    module.exports = TileRenderer;
}
