/**
 * 雀圣兵法 · AI 选手行为驱动引擎
 * 模拟 3 位各具战术意识的麻将对手（南家、西家、北家）
 * 包含：智能换三张、定缺门选择、出牌决策、碰杠胡反应
 */

if (typeof require !== 'undefined' && typeof SUIT_NAMES === 'undefined') {
    const config = require('./config.js');
    Object.assign(global, config);
}
if (typeof require !== 'undefined' && typeof MahjongLogic === 'undefined') {
    global.MahjongLogic = require('./mahjong-logic.js');
}

class AIPlayerController {
    /**
     * AI 换三张选牌算法
     * 策略：选取张数最少且难以成搭的花色中抽出3张；如果某门有清一色潜力，则坚决换掉杂色
     */
    static chooseSwapTiles(handTiles) {
        const suits = { wan: [], tiao: [], tong: [] };
        for (const tile of handTiles) {
            suits[tile.suit].push(tile);
        }

        // 统计各花色数量
        const suitCounts = Object.keys(suits).map(s => ({
            suit: s,
            count: suits[s].length,
            tiles: suits[s]
        }));

        // 换三张的前提是该花色至少要有3张
        const validSuits = suitCounts.filter(s => s.count >= 3);
        if (validSuits.length === 0) {
            // 理论上13-14张牌由3种花色组成，根据鸽巢原理必然至少有一门>=3张
            return handTiles.slice(0, 3);
        }

        // 排序规则：张数越少越优先换出（留长做大牌，弃短防卡张）
        validSuits.sort((a, b) => a.count - b.count);
        const targetSuitObj = validSuits[0];

        // 在目标花色中，挑选价值最低的3张（优先孤张、幺九牌、非对子牌）
        const sortedTiles = MahjongLogic.sortTiles(targetSuitObj.tiles);
        
        // 尝试挑出不是顺子或对子的3张牌
        const chosen = sortedTiles.slice(0, 3);
        return chosen;
    }

    /**
     * AI 定缺算法
     * 策略：选择牌数最少、成型潜力最低的花色作为定缺门
     */
    static chooseDingque(handTiles) {
        const suitCounts = { wan: 0, tiao: 0, tong: 0 };
        for (const t of handTiles) {
            suitCounts[t.suit]++;
        }

        let bestSuit = 'wan';
        let minCount = 999;

        for (const s of SUIT_KEYS) {
            if (suitCounts[s] < minCount) {
                minCount = suitCounts[s];
                bestSuit = s;
            }
        }

        return bestSuit;
    }

    /**
     * AI 摸打出牌决策
     */
    static chooseDiscard(player, gameState) {
        const hand = player.hand;
        const melds = player.melds;
        const queSuit = player.queSuit;

        // 1. 如果有定缺门牌，强制打定缺门！
        const queTiles = MahjongLogic.getQueTiles(hand, queSuit);
        if (queTiles.length > 0) {
            // 定缺门内优先打孤立中张(4,5,6)，避免在残盘成为放炮生张；其次打1,9
            const sortedQue = [...queTiles].sort((a, b) => {
                const distA = Math.abs(a.val - 5);
                const distB = Math.abs(b.val - 5);
                return distA - distB; // 距离5最近的先打
            });
            return sortedQue[0];
        }

        // 2. 正常牌效与防守综合决策
        const options = MahjongLogic.evaluateDiscardOptions(hand, melds, queSuit, gameState.visibleCounts);
        if (options.length === 0) return hand[0];

        // 简单打分排序：向听数越小越好，进张越多越好
        options.sort((a, b) => {
            if (a.shanten !== b.shanten) return a.shanten - b.shanten;
            return b.effectiveCount - a.effectiveCount;
        });

        return options[0].tile;
    }

    /**
     * AI 针对他人打出的牌，判断是否胡牌或碰牌、杠牌
     */
    static checkReactionToDiscard(player, discardTile, discarderSeat, gameState) {
        // 如果是自己的定缺花色，直接忽略
        if (discardTile.suit === player.queSuit) return null;
        if (player.isHu) return null;

        // 1. 优先判定是否能胡牌 (点炮和)
        const testHand = [...player.hand, discardTile];
        if (MahjongLogic.checkHu(testHand, player.melds, player.queSuit)) {
            const fanInfo = MahjongLogic.evaluateHandFans(testHand, player.melds, player.queSuit, discardTile, false);
            return {
                action: 'HU',
                tile: discardTile,
                fromSeat: discarderSeat,
                fanInfo
            };
        }

        // 2. 判定是否能杠牌 (直杠 / 点杠)
        const matchCount = player.hand.filter(t => t.suit === discardTile.suit && t.val === discardTile.val).length;
        if (matchCount === 3) {
            return {
                action: 'GANG',
                type: 'ZHI_GANG',
                tile: discardTile,
                fromSeat: discarderSeat
            };
        }

        // 3. 判定是否能碰牌
        if (matchCount === 2) {
            // 川麻策略：如果已经听牌且碰牌会退步，则不碰；如果做清一色或对对胡，则积极碰
            const currentShanten = MahjongLogic.getHandShanten(player.hand, player.melds, player.queSuit);
            if (currentShanten > 0 || player.hand.length <= 5) {
                return {
                    action: 'PENG',
                    tile: discardTile,
                    fromSeat: discarderSeat
                };
            }
        }

        return null;
    }
}

if (typeof module !== 'undefined') {
    module.exports = AIPlayerController;
}
