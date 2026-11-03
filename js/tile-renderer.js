/**
 * 雀圣兵法 · 高保真麻将牌面矢量渲染引擎 (V2 质感与正统比例重制版)
 * 严格按照传统骨玉麻将牌面尺寸与传统图腾重塑：
 * - 筒子 (1-9筒)：大直径立体凹凸同心圆、1筒“大红花罗盘铜钱罗汉菊”
 * - 条子 (1-9条)：粗壮立体双节玉竹节、1条国标正统“灵雀幺鸡”图腾 (饱满居中)
 * - 万字 (1-9万)：经典金石书法字体排版、正统群青一至九字与赤朱砂“萬”字
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
     * 1-9 筒 (饼子)：大幅放大直径、立体饱满圆盘
     */
    static renderTong(val) {
        const BLUE = '#124580';
        const RED = '#b82a1e';
        const GREEN = '#0f6e3f';

        // 雕刻感立体同心同花纹饼图
        const dot = (cx, cy, r, color = BLUE, innerColor = '#ffffff') => `
            <g transform="translate(${cx}, ${cy})">
                <!-- 外层雕刻深槽圆 -->
                <circle cx="0" cy="0" r="${r}" fill="${color}" stroke="#061c30" stroke-width="0.9"/>
                <!-- 中层浅色环带 -->
                <circle cx="0" cy="0" r="${r * 0.65}" fill="${color}" stroke="${innerColor}" stroke-width="${Math.max(0.8, r * 0.16)}"/>
                <!-- 核心内陷小圆点 -->
                <circle cx="0" cy="0" r="${r * 0.22}" fill="${innerColor}"/>
            </g>
        `;

        let content = '';

        switch (val) {
            case 1:
                // 1筒：经典巨型罗盘太阳红花大彩筒（直径占满牌心，尊贵威严）
                content = `
                    <defs>
                        <radialGradient id="sun-grad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stop-color="#fff" />
                            <stop offset="40%" stop-color="#f1c40f" />
                            <stop offset="85%" stop-color="#e67e22" />
                            <stop offset="100%" stop-color="#c0392b" />
                        </radialGradient>
                    </defs>
                    <!-- 外沿大铜钱红绿轮圈 -->
                    <circle cx="25" cy="35" r="20" fill="#e74c3c" stroke="#7a1a11" stroke-width="1.2"/>
                    <circle cx="25" cy="35" r="16.5" fill="#137547" stroke="#0a4628" stroke-width="0.8"/>
                    <circle cx="25" cy="35" r="13" fill="#f1c40f" stroke="#b82a1e" stroke-width="0.8"/>
                    <!-- 16 瓣放射状向日葵菊花花瓣 -->
                    ${[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map(deg => {
                        const rad = (deg * Math.PI) / 180;
                        const x = 25 + 14.5 * Math.cos(rad);
                        const y = 35 + 14.5 * Math.sin(rad);
                        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="#fff" stroke="#962d22" stroke-width="0.5"/>`;
                    }).join('')}
                    <!-- 中间翠玉轮圈 -->
                    <circle cx="25" cy="35" r="9.5" fill="#137547" stroke="#07301c" stroke-width="0.6"/>
                    <!-- 中央红日金丹 -->
                    <circle cx="25" cy="35" r="5.5" fill="url(#sun-grad)"/>
                    <circle cx="25" cy="35" r="2.2" fill="#fff"/>
                `;
                break;
            case 2:
                // 2筒：超大双饼，上下严格对称
                content = dot(25, 20.5, 9.2, GREEN) + dot(25, 49.5, 9.2, BLUE);
                break;
            case 3:
                // 3筒：斜向三饼，主副分明
                content = dot(13.5, 17, 8.0, BLUE) +
                          dot(25, 35, 8.5, RED) +
                          dot(36.5, 53, 8.0, GREEN);
                break;
            case 4:
                // 4筒：大四喜四角均布
                content = dot(15.5, 20, 8.2, BLUE) + dot(34.5, 20, 8.2, GREEN) +
                          dot(15.5, 50, 8.2, GREEN) + dot(34.5, 50, 8.2, BLUE);
                break;
            case 5:
                // 5筒：经典梅花五饼（四角大饼环抱中央朱砂大红心）
                content = dot(14.2, 18.2, 7.2, BLUE) + dot(35.8, 18.2, 7.2, GREEN) +
                          dot(25, 35, 9.0, RED) +
                          dot(14.2, 51.8, 7.2, GREEN) + dot(35.8, 51.8, 7.2, BLUE);
                break;
            case 6:
                // 6筒：上绿下红两列
                content = dot(15.5, 17.5, 7.2, GREEN) + dot(34.5, 17.5, 7.2, GREEN) +
                          dot(15.5, 35, 7.2, RED) + dot(34.5, 35, 7.2, RED) +
                          dot(15.5, 52.5, 7.2, RED) + dot(34.5, 52.5, 7.2, RED);
                break;
            case 7:
                // 7筒：上斜三绿，下正四红
                content = dot(11.5, 14, 5.8, GREEN) + dot(25, 21.5, 5.8, GREEN) + dot(38.5, 29, 5.8, GREEN) +
                          dot(15.5, 43, 6.6, RED) + dot(34.5, 43, 6.6, RED) +
                          dot(15.5, 57, 6.6, RED) + dot(34.5, 57, 6.6, RED);
                break;
            case 8:
                // 8筒：双列各4个清一色深蓝大饼
                content = dot(15.5, 13.5, 6.0, BLUE) + dot(34.5, 13.5, 6.0, BLUE) +
                          dot(15.5, 28, 6.0, BLUE) + dot(34.5, 28, 6.0, BLUE) +
                          dot(15.5, 42.5, 6.0, BLUE) + dot(34.5, 42.5, 6.0, BLUE) +
                          dot(15.5, 57, 6.0, BLUE) + dot(34.5, 57, 6.0, BLUE);
                break;
            case 9:
                // 9筒：九宫格饱满大饼（上蓝、中红、下绿）
                content = dot(12.5, 16, 6.3, BLUE) + dot(25, 16, 6.3, BLUE) + dot(37.5, 16, 6.3, BLUE) +
                          dot(12.5, 35, 6.3, RED) + dot(25, 35, 6.3, RED) + dot(37.5, 35, 6.3, RED) +
                          dot(12.5, 54, 6.3, GREEN) + dot(25, 54, 6.3, GREEN) + dot(37.5, 54, 6.3, GREEN);
                break;
        }

        return `<svg class="tile-svg" viewBox="0 0 50 70">${content}</svg>`;
    }

    /**
     * 1-9 条 (索子)：粗壮立体双节竹段，1条“幺鸡”雀鸟气度轩昂
     */
    static renderTiao(val) {
        const GREEN = '#0f6e3f';
        const RED = '#b82a1e';
        const BLUE_TIAO = '#124580';

        // 粗壮立体双节竹段辅助组件 (宽度从原 4.5 提升至 7.5-8.2)
        const bamboo = (cx, cy, w = 7.8, h = 21, color = GREEN) => {
            const x = cx - w / 2;
            const y = cy - h / 2;
            const innerColor = color === GREEN ? RED : GREEN;
            return `
                <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">
                    <!-- 竹节柱体与双节凹凸曲线 -->
                    <rect x="0" y="0" width="${w}" height="${h}" rx="${w / 2}" fill="${color}" stroke="#072b18" stroke-width="0.8"/>
                    <!-- 上节环纹凸起 -->
                    <rect x="-0.8" y="${(h * 0.32).toFixed(1)}" width="${w + 1.6}" height="2.2" rx="1.1" fill="#fff" opacity="0.85"/>
                    <!-- 下节环纹凸起 -->
                    <rect x="-0.8" y="${(h * 0.64).toFixed(1)}" width="${w + 1.6}" height="2.2" rx="1.1" fill="#fff" opacity="0.85"/>
                    <!-- 节心玉核圆点 -->
                    <circle cx="${w / 2}" cy="${h / 2}" r="1.3" fill="${innerColor}"/>
                </g>
            `;
        };

        let content = '';

        switch (val) {
            case 1:
                // 1条：正统国标/川麻“幺鸡”（栖于翠竹枝头上的灵雀图腾，正中饱满）
                content = `
                    <!-- 栖枝翠竹横节 -->
                    <rect x="9" y="55" width="32" height="6.5" rx="3.2" fill="${GREEN}" stroke="#062414" stroke-width="1"/>
                    <line x1="20" y1="55" x2="20" y2="61.5" stroke="#fff" stroke-width="1.2"/>
                    <line x1="30" y1="55" x2="30" y2="61.5" stroke="#fff" stroke-width="1.2"/>

                    <!-- 爪足 -->
                    <line x1="21" y1="48" x2="19" y2="55" stroke="#e67e22" stroke-width="2" stroke-linecap="round"/>
                    <line x1="29" y1="48" x2="31" y2="55" stroke="#e67e22" stroke-width="2" stroke-linecap="round"/>

                    <!-- 灵雀体态羽翼（饱满居中） -->
                    <ellipse cx="25" cy="34" rx="12" ry="16" fill="${GREEN}" stroke="#07301c" stroke-width="1"/>
                    <!-- 腹部亮翠翡翠羽毛 -->
                    <ellipse cx="26" cy="34" rx="8.5" ry="11.5" fill="#27ae60"/>
                    <!-- 翅膀朱砂赤羽 -->
                    <path d="M 21 26 Q 12 33 19 46 Q 24 38 21 26 Z" fill="${RED}" stroke="#7a1a11" stroke-width="0.8"/>
                    
                    <!-- 鸟颈与鸟首 -->
                    <circle cx="25" cy="17" r="7.8" fill="${GREEN}" stroke="#07301c" stroke-width="1"/>
                    <!-- 颊部赤斑 -->
                    <circle cx="27" cy="18" r="3" fill="#e74c3c" opacity="0.7"/>
                    <!-- 雀眼明目 -->
                    <circle cx="22.5" cy="16" r="2.2" fill="#ffffff"/>
                    <circle cx="22.5" cy="16" r="1.2" fill="#000000"/>
                    <circle cx="22.0" cy="15.5" r="0.5" fill="#ffffff"/>
                    
                    <!-- 金喙尖喙 -->
                    <polygon points="16,16 11,18 16,21" fill="#f39c12" stroke="#d35400" stroke-width="0.6"/>
                    
                    <!-- 凤点头朱砂顶冠 -->
                    <path d="M 25 9.5 Q 28 3 34 4 Q 30 8.5 27 10 Z" fill="${RED}" stroke="#7a1a11" stroke-width="0.8"/>
                    
                    <!-- 灵动开屏双尾羽 -->
                    <path d="M 22 47 Q 14 56 16 66 Q 21 59 23 48 Z" fill="${GREEN}" stroke="#07301c" stroke-width="0.8"/>
                    <path d="M 27 48 Q 30 58 34 67 Q 33 57 28 48 Z" fill="${RED}" stroke="#7a1a11" stroke-width="0.8"/>
                `;
                break;
            case 2:
                content = bamboo(25, 21, 8.2, 23, GREEN) + bamboo(25, 49, 8.2, 23, BLUE_TIAO);
                break;
            case 3:
                content = bamboo(25, 19, 8.0, 22, GREEN) +
                          bamboo(15, 48, 8.0, 24, GREEN) + bamboo(35, 48, 8.0, 24, GREEN);
                break;
            case 4:
                content = bamboo(15, 21, 8.0, 23, GREEN) + bamboo(35, 21, 8.0, 23, RED) +
                          bamboo(15, 49, 8.0, 23, RED) + bamboo(35, 49, 8.0, 23, GREEN);
                break;
            case 5:
                content = bamboo(14, 20, 7.6, 21, GREEN) + bamboo(36, 20, 7.6, 21, GREEN) +
                          bamboo(25, 35, 8.2, 22, RED) +
                          bamboo(14, 50, 7.6, 21, GREEN) + bamboo(36, 50, 7.6, 21, GREEN);
                break;
            case 6:
                content = bamboo(13.5, 21, 7.2, 22, GREEN) + bamboo(25, 21, 7.2, 22, GREEN) + bamboo(36.5, 21, 7.2, 22, GREEN) +
                          bamboo(13.5, 49, 7.2, 22, GREEN) + bamboo(25, 49, 7.2, 22, GREEN) + bamboo(36.5, 49, 7.2, 22, GREEN);
                break;
            case 7:
                // 7条：顶上一根赤红竹，下排两组各3根翠竹
                content = bamboo(25, 14, 7.8, 17, RED) +
                          bamboo(13.5, 33, 7.0, 16, GREEN) + bamboo(25, 33, 7.0, 16, GREEN) + bamboo(36.5, 33, 7.0, 16, GREEN) +
                          bamboo(13.5, 53, 7.0, 16, GREEN) + bamboo(25, 53, 7.0, 16, GREEN) + bamboo(36.5, 53, 7.0, 16, GREEN);
                break;
            case 8:
                // 8条：双列各4根整齐挺拔的翠绿竹节
                content = bamboo(15.5, 12.5, 7.6, 13.5, GREEN) + bamboo(34.5, 12.5, 7.6, 13.5, GREEN) +
                          bamboo(15.5, 27.5, 7.6, 13.5, GREEN) + bamboo(34.5, 27.5, 7.6, 13.5, GREEN) +
                          bamboo(15.5, 42.5, 7.6, 13.5, GREEN) + bamboo(34.5, 42.5, 7.6, 13.5, GREEN) +
                          bamboo(15.5, 57.5, 7.6, 13.5, GREEN) + bamboo(34.5, 57.5, 7.6, 13.5, GREEN);
                break;
            case 9:
                // 9条：三排各3根（上排赤红、中下翠绿）
                content = bamboo(13.5, 16, 7.2, 16, RED) + bamboo(25, 16, 7.2, 16, RED) + bamboo(36.5, 16, 7.2, 16, RED) +
                          bamboo(13.5, 35, 7.2, 16, GREEN) + bamboo(25, 35, 7.2, 16, GREEN) + bamboo(36.5, 35, 7.2, 16, GREEN) +
                          bamboo(13.5, 54, 7.2, 16, GREEN) + bamboo(25, 54, 7.2, 16, GREEN) + bamboo(36.5, 54, 7.2, 16, GREEN);
                break;
        }

        return `<svg class="tile-svg" viewBox="0 0 50 70">${content}</svg>`;
    }

    /**
     * 1-9 万 (字牌)：正统传统汉字书法与朱砂大“萬”字 (完美居中与大字体)
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
