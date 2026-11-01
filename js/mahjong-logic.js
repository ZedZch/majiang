/**
 * 雀圣兵法 · 川渝麻将核心逻辑与算法库
 * 包含：理牌、定缺验证、向听数精确计算、听牌检索、番数判定、进张广度计算
 */

if (typeof require !== 'undefined' && typeof NUMBER_CHARS === 'undefined') {
    const config = require('./config.js');
    Object.assign(global, config);
}

class MahjongLogic {
    /**
     * 规范理牌：按 万 -> 条 -> 筒，同花色按数字 1-9 排序
     */
    static sortTiles(tiles) {
        const suitOrder = { wan: 0, tiao: 1, tong: 2 };
        return [...tiles].sort((a, b) => {
            if (a.suit !== b.suit) {
                return suitOrder[a.suit] - suitOrder[b.suit];
            }
            return a.val - b.val;
        });
    }

    /**
     * 将牌数组转换成 27 个位置的计数数组
     * 0-8: 万1-9; 9-17: 条1-9; 18-26: 筒1-9
     */
    static tilesToCountArray(tiles) {
        const counts = new Array(27).fill(0);
        for (const tile of tiles) {
            const offset = tile.suit === 'wan' ? 0 : (tile.suit === 'tiao' ? 9 : 18);
            counts[offset + tile.val - 1]++;
        }
        return counts;
    }

    /**
     * 将单张牌转换成 0-26 的索引
     */
    static tileToIndex(tile) {
        const offset = tile.suit === 'wan' ? 0 : (tile.suit === 'tiao' ? 9 : 18);
        return offset + tile.val - 1;
    }

    /**
     * 从 0-26 索引还原成牌对象属性
     */
    static indexToTile(idx) {
        let suit = 'wan';
        let val = idx + 1;
        if (idx >= 18) {
            suit = 'tong';
            val = idx - 18 + 1;
        } else if (idx >= 9) {
            suit = 'tiao';
            val = idx - 9 + 1;
        }
        return {
            suit,
            val,
            code: `${val}${suit[0]}`,
            name: `${NUMBER_CHARS[val]}${SUIT_NAMES[suit]}`
        };
    }

    /**
     * 检查手牌是否含有定缺花色的牌
     */
    static hasQueTile(tiles, queSuit) {
        if (!queSuit) return false;
        return tiles.some(t => t.suit === queSuit);
    }

    /**
     * 过滤出定缺牌（必须打出的牌）
     */
    static getQueTiles(tiles, queSuit) {
        if (!queSuit) return [];
        return tiles.filter(t => t.suit === queSuit);
    }

    /**
     * 深度验证是否成和 (标准 4面子+1将)
     */
    static canFormStandardMentsu(counts, meldsNeeded) {
        if (meldsNeeded === 0) return true;

        // 找到第一个有牌的位置
        let first = -1;
        for (let i = 0; i < 27; i++) {
            if (counts[i] > 0) {
                first = i;
                break;
            }
        }
        if (first === -1) return true;

        // 尝试作为刻子 (3张同牌)
        if (counts[first] >= 3) {
            counts[first] -= 3;
            if (this.canFormStandardMentsu(counts, meldsNeeded - 1)) {
                counts[first] += 3;
                return true;
            }
            counts[first] += 3;
        }

        // 尝试作为顺子 (3张连续同花色牌)
        // 确保不会跨越花色边界 (0-8, 9-17, 18-26)
        const valInSuit = first % 9;
        if (valInSuit <= 6 && counts[first + 1] > 0 && counts[first + 2] > 0) {
            counts[first]--;
            counts[first + 1]--;
            counts[first + 2]--;
            if (this.canFormStandardMentsu(counts, meldsNeeded - 1)) {
                counts[first]++;
                counts[first + 1]++;
                counts[first + 2]++;
                return true;
            }
            counts[first]++;
            counts[first + 1]++;
            counts[first + 2]++;
        }

        return false;
    }

    /**
     * 判断是否胡牌（支持普通胡与七对，川麻必缺一门）
     * @param {Array} handTiles 手牌
     * @param {Array} melds 副露 (碰、杠)
     * @param {string} queSuit 定缺花色
     * @returns {boolean}
     */
    static checkHu(handTiles, melds = [], queSuit = null) {
        // 规则1：定缺花色未出完不能胡牌
        if (queSuit && this.hasQueTile(handTiles, queSuit)) {
            return false;
        }

        const totalTiles = handTiles.length + melds.length * 3;
        if (totalTiles !== 14) {
            return false;
        }

        const counts = this.tilesToCountArray(handTiles);

        // 1. 检查七对 (手牌必须为14张，无副露)
        if (melds.length === 0 && handTiles.length === 14) {
            let pairCount = 0;
            for (let i = 0; i < 27; i++) {
                if (counts[i] === 2) pairCount += 1;
                else if (counts[i] === 4) pairCount += 2;
            }
            if (pairCount === 7) return true;
        }

        // 2. 检查普通面子胡：枚举将牌（对子）
        const meldsNeeded = (handTiles.length - 2) / 3;
        for (let i = 0; i < 27; i++) {
            if (counts[i] >= 2) {
                counts[i] -= 2; // 拔出一对作为将
                const success = this.canFormStandardMentsu(counts, meldsNeeded);
                counts[i] += 2;
                if (success) return true;
            }
        }

        return false;
    }

    /**
     * 计算普通牌型的向听数
     */
    static calculateNormalShanten(counts, meldCount = 0) {
        let minShanten = 8;
        const totalMeldsGoal = 4 - meldCount;

        // 递归或分拆求每个花色的面子、搭子组合
        // 采用川麻拆解：枚举哪张牌作为“将牌”
        // 情况 A: 有将牌
        for (let pairIdx = 0; pairIdx < 27; pairIdx++) {
            if (counts[pairIdx] >= 2) {
                counts[pairIdx] -= 2;
                const shantenWithPair = this._calcShantenWithoutPair(counts, totalMeldsGoal) - 1;
                if (shantenWithPair < minShanten) {
                    minShanten = shantenWithPair;
                }
                counts[pairIdx] += 2;
            }
        }

        // 情况 B: 无确定将牌 (将牌靠单张或虚将进张)
        const shantenNoPair = this._calcShantenWithoutPair(counts, totalMeldsGoal);
        if (shantenNoPair < minShanten) {
            minShanten = shantenNoPair;
        }

        return minShanten;
    }

    /**
     * 辅助函数：无将状态下计算凑齐目标面子数所需的向听
     */
    static _calcShantenWithoutPair(counts, meldsGoal) {
        let maxMentsu = 0;
        let maxTaatsu = 0;

        // 分别计算万、条、筒 3 门的最佳面子与搭子数
        for (let s = 0; s < 3; s++) {
            const suitCounts = counts.slice(s * 9, s * 9 + 9);
            const { mentsu, taatsu } = this._findBestSuitBlocks(suitCounts);
            maxMentsu += mentsu;
            maxTaatsu += taatsu;
        }

        // 面子和搭子总数不能超过 meldsGoal
        if (maxMentsu + maxTaatsu > meldsGoal) {
            maxTaatsu = meldsGoal - maxMentsu;
        }

        // 向听数公式: 2 * (目标面子数 - 已有面子数) - 搭子数
        const shanten = 2 * (meldsGoal - maxMentsu) - maxTaatsu;
        return shanten;
    }

    /**
     * 递归搜索单个花色内的最优（面子数，搭子数）组合
     */
    static _findBestSuitBlocks(arr) {
        let bestScore = { mentsu: 0, taatsu: 0, val: 0 };

        function backtrack(idx, currentMentsu, currentTaatsu) {
            while (idx < 9 && arr[idx] === 0) idx++;
            if (idx >= 9) {
                const scoreVal = currentMentsu * 10 + currentTaatsu;
                if (scoreVal > bestScore.val) {
                    bestScore = { mentsu: currentMentsu, taatsu: currentTaatsu, val: scoreVal };
                }
                return;
            }

            // 1. 尝试刻子
            if (arr[idx] >= 3) {
                arr[idx] -= 3;
                backtrack(idx, currentMentsu + 1, currentTaatsu);
                arr[idx] += 3;
            }

            // 2. 尝试顺子
            if (idx <= 6 && arr[idx + 1] > 0 && arr[idx + 2] > 0) {
                arr[idx]--;
                arr[idx + 1]--;
                arr[idx + 2]--;
                backtrack(idx, currentMentsu + 1, currentTaatsu);
                arr[idx]++;
                arr[idx + 1]++;
                arr[idx + 2]++;
            }

            // 3. 尝试两面/边张搭子 (idx, idx+1)
            if (idx <= 7 && arr[idx + 1] > 0) {
                arr[idx]--;
                arr[idx + 1]--;
                backtrack(idx, currentMentsu, currentTaatsu + 1);
                arr[idx]++;
                arr[idx + 1]++;
            }

            // 4. 尝试坎张搭子 (idx, idx+2)
            if (idx <= 6 && arr[idx + 2] > 0) {
                arr[idx]--;
                arr[idx + 2]--;
                backtrack(idx, currentMentsu, currentTaatsu + 1);
                arr[idx]++;
                arr[idx + 2]++;
            }

            // 5. 尝试对子搭子
            if (arr[idx] >= 2) {
                arr[idx] -= 2;
                backtrack(idx, currentMentsu, currentTaatsu + 1);
                arr[idx] += 2;
            }

            // 6. 跳过当前单张
            const temp = arr[idx];
            arr[idx] = 0;
            backtrack(idx + 1, currentMentsu, currentTaatsu);
            arr[idx] = temp;
        }

        backtrack(0, 0, 0);
        return bestScore;
    }

    /**
     * 计算七对的向听数
     */
    static calculateSevenPairsShanten(counts) {
        let pairs = 0;
        let kinds = 0;
        for (let i = 0; i < 27; i++) {
            if (counts[i] >= 2) pairs++;
            if (counts[i] >= 1) kinds++;
        }
        // 七对需要7个对子，如果有4张相同的，在四川麻将中算作两对（可做龙七对）
        let extraPairs = 0;
        for (let i = 0; i < 27; i++) {
            if (counts[i] === 4) extraPairs++;
        }
        const effectivePairs = pairs + extraPairs;
        let shanten = 6 - effectivePairs;
        if (kinds < 7) {
            shanten += (7 - kinds);
        }
        return Math.max(0, shanten);
    }

    /**
     * 综合向听数（考虑定缺惩罚：定缺门牌不参与成搭，必须被打掉）
     * -1: 已胡牌
     *  0: 听牌 (叫牌)
     *  1: 一向听
     *  2: 二向听
     */
    static getHandShanten(handTiles, melds = [], queSuit = null) {
        // 如果手中有定缺牌，先扣除定缺门牌并增加其换出步数
        const queCount = queSuit ? handTiles.filter(t => t.suit === queSuit).length : 0;
        const validTiles = queSuit ? handTiles.filter(t => t.suit !== queSuit) : handTiles;

        if (this.checkHu(handTiles, melds, queSuit)) {
            return -1;
        }

        const counts = this.tilesToCountArray(validTiles);
        const normalShanten = this.calculateNormalShanten(counts, melds.length);

        let bestShanten = normalShanten;
        if (melds.length === 0) {
            const qiDuiShanten = this.calculateSevenPairsShanten(counts);
            if (qiDuiShanten < bestShanten) {
                bestShanten = qiDuiShanten;
            }
        }

        // 定缺牌的存在会延缓手牌进度
        return bestShanten + queCount;
    }

    /**
     * 检索当前手牌在听什么牌（叫牌列表）
     * @param {Array} handTiles 13张手牌（非摸牌阶段或已摸牌打掉一张后）
     * @param {Array} melds 副露
     * @param {string} queSuit 定缺花色
     * @param {Array} visibleCounts 全场已见牌数量（0-26，最大4）
     * @returns {Array} 听牌列表 [{ tile, remainCount, fans, patterns }]
     */
    static getWaitingTiles(handTiles, melds = [], queSuit = null, visibleCounts = null) {
        // 如果手牌还有定缺门，不可听牌
        if (queSuit && this.hasQueTile(handTiles, queSuit)) {
            return [];
        }

        const waiting = [];

        for (let i = 0; i < 27; i++) {
            const candidate = this.indexToTile(i);
            // 不可能胡定缺门的牌
            if (candidate.suit === queSuit) continue;

            const testHand = [...handTiles, candidate];
            if (this.checkHu(testHand, melds, queSuit)) {
                // 计算剩余未现张数
                let inHandCount = handTiles.filter(t => t.suit === candidate.suit && t.val === candidate.val).length;
                let seenOnTable = visibleCounts ? visibleCounts[i] : inHandCount;
                let remainCount = Math.max(0, 4 - Math.max(seenOnTable, inHandCount));

                // 测算胡这张牌时的番型与番数
                const fanDetails = this.evaluateHandFans(testHand, melds, queSuit, candidate, false);

                waiting.push({
                    tile: candidate,
                    remainCount,
                    totalFan: fanDetails.totalFan,
                    patterns: fanDetails.patterns
                });
            }
        }

        return waiting;
    }

    /**
     * 评估手牌番型与番数（川麻血战到底计番标准）
     */
    static evaluateHandFans(handTiles, melds = [], queSuit = null, winTile = null, isZimo = false) {
        const patterns = [];
        let totalFan = 1; // 默认平胡 1 番

        // 统计所有牌（手牌 + 副露）
        const allTiles = [...handTiles];
        for (const m of melds) {
            allTiles.push(...m.tiles);
        }

        const counts = this.tilesToCountArray(allTiles);

        // 1. 检查根 (手牌+副露中同一种牌出现4张，每根+1番)
        let genCount = 0;
        for (let i = 0; i < 27; i++) {
            if (counts[i] === 4) genCount++;
        }

        // 2. 检查清一色 (全牌只有一种花色)
        const suitsPresent = new Set(allTiles.map(t => t.suit));
        const isQingYiSe = suitsPresent.size === 1;

        // 3. 检查七对 (手牌14张且无副露)
        let isQiDui = false;
        let isLongQiDui = false;
        if (melds.length === 0 && handTiles.length === 14) {
            let pairs = 0;
            let foured = 0;
            const handCounts = this.tilesToCountArray(handTiles);
            for (let i = 0; i < 27; i++) {
                if (handCounts[i] === 2) pairs++;
                if (handCounts[i] === 4) {
                    pairs += 2;
                    foured++;
                }
            }
            if (pairs === 7) {
                isQiDui = true;
                if (foured > 0) isLongQiDui = true;
            }
        }

        // 4. 检查对对胡 (碰碰胡)
        let isDuiDuiHu = false;
        if (!isQiDui) {
            // 副露必须全是碰或杠，手牌必须全是刻子+1对将
            const handCounts = this.tilesToCountArray(handTiles);
            let pairCount = 0;
            let keCount = 0;
            for (let i = 0; i < 27; i++) {
                if (handCounts[i] === 2) pairCount++;
                else if (handCounts[i] === 3) keCount++;
                else if (handCounts[i] === 4) keCount++; // 算一刻加一单？通常成和时不能有单张
            }
            if (pairCount === 1 && (keCount + melds.length === 4)) {
                isDuiDuiHu = true;
            }
        }

        // 5. 检查金钩钓 (副露4副，手牌只剩1张单调和)
        const isJinGouDiao = melds.length === 4 && handTiles.length === 2;

        // 6. 检查带幺九 (全顺子、刻子、将牌均含1或9)
        let isDaiYaoJiu = false; // 略，暂不作为主流番种干扰

        // 组合计番
        if (isQingYiSe && isQiDui) {
            patterns.push(FAN_CONFIG.QING_QI_DUI);
            totalFan = 16;
        } else if (isQingYiSe && isDuiDuiHu) {
            patterns.push(FAN_CONFIG.QING_DUI);
            totalFan = 8;
        } else if (isLongQiDui) {
            patterns.push(FAN_CONFIG.LONG_QI_DUI);
            totalFan = 8;
        } else if (isQingYiSe) {
            patterns.push(FAN_CONFIG.QING_YI_SE);
            totalFan = 4;
        } else if (isQiDui) {
            patterns.push(FAN_CONFIG.QI_DUI);
            totalFan = 4;
        } else if (isJinGouDiao) {
            patterns.push(FAN_CONFIG.JIN_GOU_DIAO);
            totalFan = 4;
        } else if (isDuiDuiHu) {
            patterns.push(FAN_CONFIG.DUI_DUI_HU);
            totalFan = 2;
        } else {
            patterns.push(FAN_CONFIG.PING_HU);
            totalFan = 1;
        }

        // 加根
        if (genCount > 0 && !isLongQiDui) {
            // 龙七对已经内含1根，避免重复算
            for (let g = 0; g < genCount; g++) {
                patterns.push({ name: `根 (+1番)`, fan: 1 });
                totalFan *= 2; // 川麻中每番通常按翻倍算 (2^fan) 或按番相加，通常 1番=2分，2番=4分，4番=8分
            }
        }

        return {
            totalFan,
            patterns
        };
    }

    /**
     * 综合牌效测算：对14张（或摸牌后）手牌的每个候选切牌进行深度推演
     * @param {Array} handTiles 摸牌后的手牌（通常14张，或11/8/5张）
     * @param {Array} melds 副露
     * @param {string} queSuit 定缺花色
     * @param {Array} visibleCounts 牌桌全场已见牌计数
     * @returns {Array} 候选打法评估数组，按综合收益排序
     */
    static evaluateDiscardOptions(handTiles, melds = [], queSuit = null, visibleCounts = null) {
        // 规则优先：如果手里有定缺门牌，必须且只能打定缺门牌！
        const queTiles = this.getQueTiles(handTiles, queSuit);
        let candidatePool = handTiles;

        if (queTiles.length > 0) {
            candidatePool = queTiles;
        }

        // 去重候选牌（相同牌评估一次即可）
        const evaluatedCodes = new Set();
        const results = [];

        for (const discardTile of candidatePool) {
            if (evaluatedCodes.has(discardTile.code)) continue;
            evaluatedCodes.add(discardTile.code);

            // 模拟打出这张牌后的剩余手牌
            const remainingHand = [...handTiles];
            const cutIdx = remainingHand.findIndex(t => t.uid === discardTile.uid);
            remainingHand.splice(cutIdx, 1);

            // 测算切牌后的向听数
            const currentShanten = this.getHandShanten(remainingHand, melds, queSuit);

            // 如果已经是听牌状态 (向听数 == 0)
            let waitingTiles = [];
            let effectiveTiles = [];
            let totalEffectiveCount = 0;

            if (currentShanten === 0) {
                waitingTiles = this.getWaitingTiles(remainingHand, melds, queSuit, visibleCounts);
                for (const w of waitingTiles) {
                    effectiveTiles.push({
                        tile: w.tile,
                        count: w.remainCount,
                        isWait: true
                    });
                    totalEffectiveCount += w.remainCount;
                }
            } else {
                // 计算让手牌向听数下降的有效进张 (有效牌 / 进张面)
                for (let i = 0; i < 27; i++) {
                    const testDraw = this.indexToTile(i);
                    if (testDraw.suit === queSuit) continue;

                    const nextHand = [...remainingHand, testDraw];
                    const nextShanten = this.getHandShanten(nextHand, melds, queSuit);

                    // 如果进张后向听数减少，则是有效进张牌
                    if (nextShanten < currentShanten) {
                        let inHandCount = remainingHand.filter(t => t.suit === testDraw.suit && t.val === testDraw.val).length;
                        let seen = visibleCounts ? visibleCounts[i] : inHandCount;
                        let remain = Math.max(0, 4 - Math.max(seen, inHandCount));

                        effectiveTiles.push({
                            tile: testDraw,
                            count: remain,
                            isWait: false
                        });
                        totalEffectiveCount += remain;
                    }
                }
            }

            results.push({
                tile: discardTile,
                shanten: currentShanten,
                effectiveTiles,
                effectiveCount: totalEffectiveCount,
                waitingTiles,
                isQueTile: discardTile.suit === queSuit
            });
        }

        return results;
    }
}

if (typeof module !== 'undefined') {
    module.exports = MahjongLogic;
}
