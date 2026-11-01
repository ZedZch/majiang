/**
 * 雀圣兵法 · 川渝麻将高阶推演教学系统
 * 全局配置与基础数据定义
 */

const SUITS = {
    WAN: { key: 'wan', name: '万', symbol: '萬', color: '#c3272b' },
    TIAO: { key: 'tiao', name: '条', symbol: '条', color: '#137547' },
    TONG: { key: 'tong', name: '筒', symbol: '筒', color: '#1e50a2' }
};

const SUIT_KEYS = ['wan', 'tiao', 'tong'];

const SUIT_NAMES = {
    wan: '万',
    tiao: '条',
    tong: '筒'
};

const SEATS = [
    { id: 0, name: '自家 (我)', wind: '东', role: 'player' },
    { id: 1, name: '下家 (南)', wind: '南', role: 'ai' },
    { id: 2, name: '对家 (西)', wind: '西', role: 'ai' },
    { id: 3, name: '上家 (北)', wind: '北', role: 'ai' }
];

const GAME_PHASES = {
    IDLE: 'IDLE',
    DEALING: 'DEALING',
    SWAP_SELECT: 'SWAP_SELECT',
    SWAP_EXECUTING: 'SWAP_EXECUTING',
    DINGQUE_SELECT: 'DINGQUE_SELECT',
    PLAYING: 'PLAYING',
    ROUND_END: 'ROUND_END'
};

const SWAP_DIRECTIONS = {
    CLOCKWISE: { id: 0, name: '顺时针', desc: '自家给下家，下家给对家，对家给上家，上家给自家' },
    COUNTER_CLOCKWISE: { id: 1, name: '逆时针', desc: '自家给上家，上家给对家，对家给下家，下家给自家' },
    OPPOSITE: { id: 2, name: '对家互换', desc: '自家与对家互换，下家与上家互换' }
};

const NUMBER_CHARS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/**
 * 生成全套108张麻将牌（四川/重庆麻将无字牌）
 */
function createFullTileDeck() {
    const deck = [];
    let uid = 1;
    for (const suit of SUIT_KEYS) {
        for (let val = 1; val <= 9; val++) {
            for (let copy = 0; copy < 4; copy++) {
                deck.push({
                    uid: uid++,
                    suit: suit,
                    val: val,
                    code: `${val}${suit[0]}`,
                    name: `${NUMBER_CHARS[val]}${SUIT_NAMES[suit]}`
                });
            }
        }
    }
    return deck;
}

/**
 * 牌对象转文字显示
 */
function formatTile(tile) {
    if (!tile) return '未知';
    return `${NUMBER_CHARS[tile.val]}${SUIT_NAMES[tile.suit]}`;
}

/**
 * 牌型番数定义 (经典血战到底番数)
 */
const FAN_CONFIG = {
    PING_HU: { name: '平胡', fan: 1, desc: '基础胡牌 (顺子/刻子混搭)' },
    DUI_DUI_HU: { name: '对对胡 (碰碰胡)', fan: 2, desc: '由4副刻子或杠加1对将组成' },
    QING_YI_SE: { name: '清一色', fan: 4, desc: '整副手牌仅由同一种花色组成' },
    QI_DUI: { name: '七对', fan: 4, desc: '由7个对子组成' },
    QING_DUI: { name: '清对 (清一色对对胡)', fan: 8, desc: '清一色 + 对对胡' },
    LONG_QI_DUI: { name: '龙七对 (豪华七对)', fan: 8, desc: '七对中含有4张相同的牌(暗杠根)' },
    QING_QI_DUI: { name: '清七对', fan: 16, desc: '清一色 + 七对' },
    JIN_GOU_DIAO: { name: '金钩钓', fan: 4, desc: '碰杠4次后手牌仅剩1张单调胡牌' },
    DAI_YAO_JIU: { name: '带幺九', fan: 4, desc: '全部顺子刻子将牌均含有1或9' },
    GEN: { name: '根', fan: 1, desc: '手牌或副露中包含4张相同的牌(每根+1番)' },
    GANG_KAI: { name: '杠上花', fan: 1, desc: '开杠后摸到的牌胡牌(+1番)' },
    GANG_PAO: { name: '杠上炮', fan: 1, desc: '开杠后打出的牌被他人胡牌(+1番)' },
    QIANG_GANG: { name: '抢杠胡', fan: 1, desc: '他人弯杠补杠时截胡(+1番)' }
};

if (typeof module !== 'undefined') {
    module.exports = {
        SUITS,
        SUIT_KEYS,
        SUIT_NAMES,
        SEATS,
        GAME_PHASES,
        SWAP_DIRECTIONS,
        NUMBER_CHARS,
        createFullTileDeck,
        formatTile,
        FAN_CONFIG
    };
}
