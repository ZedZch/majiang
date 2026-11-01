/**
 * 雀圣兵法 · 高阶麻将推演与读牌防炮决策引擎
 * 核心功能：
 * 1. 对手读牌建模（换三张反推、定缺变步抓听、舍牌轨迹透视、牌型画像）
 * 2. 危险度与防点炮精算（现物、筋牌、壁牌、生熟张判定）
 * 3. 攻守平衡决策模型（向听进张速度 vs 放炮期望损失 EV 综合评估）
 * 4. 详细逻辑推演报告生成（供学习者逐步理解高手的深度思考回路）
 */

if (typeof require !== 'undefined' && typeof SUIT_NAMES === 'undefined') {
    const config = require('./config.js');
    Object.assign(global, config);
}
if (typeof require !== 'undefined' && typeof MahjongLogic === 'undefined') {
    global.MahjongLogic = require('./mahjong-logic.js');
}

class AIAnalyzer {
    /**
     * 针对各家对手的手牌状态进行推测与概率画像
     * @param {Object} gameState 完整游戏状态
     * @returns {Array} 3位对手的读牌画像对象
     */
    static analyzeOpponents(gameState) {
        const { players, visibleCounts, currentTurnCount } = gameState;
        const opponentProfiles = [];

        for (let seatId = 1; seatId <= 3; seatId++) {
            const p = players[seatId];
            if (!p || p.isHu) {
                opponentProfiles.push({
                    seatId,
                    name: p.name,
                    wind: p.wind,
                    isHu: p.isHu,
                    isDefeated: true,
                    desc: '该玩家已胡牌离场'
                });
                continue;
            }

            // 1. 换三张行为分析
            let swapClue = '未发生换牌';
            let suspectedLongSuit = null;
            if (p.swapOutSuit && p.swapInSuit) {
                swapClue = `出【${SUIT_NAMES[p.swapOutSuit]}】入【${SUIT_NAMES[p.swapInSuit]}】`;
                // 通常换出的门类起手 <= 3 张，换入门类增强了 3 张
            }

            // 2. 定缺门与进度分析
            const queSuit = p.queSuit;
            const discards = p.discards || [];
            const nonQueDiscards = discards.filter(t => t.suit !== queSuit);
            const queDiscards = discards.filter(t => t.suit === queSuit);

            // 寻找“变步点”（第一次打非缺门牌的巡目）
            let transitionTurn = null;
            for (let i = 0; i < discards.length; i++) {
                if (discards[i].suit !== queSuit) {
                    transitionTurn = i + 1;
                    break;
                }
            }

            // 3. 统计副露（碰、杠）花色分布
            const melds = p.melds || [];
            const meldSuits = melds.map(m => m.tiles[0].suit);
            const meldCountsBySuit = { wan: 0, tiao: 0, tong: 0 };
            for (const s of meldSuits) {
                meldCountsBySuit[s]++;
            }

            // 4. 判断是否疑似做清一色
            // 条件：定缺一门；副露全部是同一门；舍牌中大量出现另一门；
            const remainingSuits = SUIT_KEYS.filter(s => s !== queSuit);
            let suspectedPureSuit = null;
            let pureSuitConfidence = 0;

            if (remainingSuits.length === 2) {
                const s1 = remainingSuits[0];
                const s2 = remainingSuits[1];

                // 统计已打出的非缺门牌
                const s1CutCount = nonQueDiscards.filter(t => t.suit === s1).length;
                const s2CutCount = nonQueDiscards.filter(t => t.suit === s2).length;

                if (meldCountsBySuit[s1] > 0 && meldCountsBySuit[s2] === 0 && s2CutCount >= 2) {
                    suspectedPureSuit = s1;
                    pureSuitConfidence = Math.min(95, 45 + s2CutCount * 15 + meldCountsBySuit[s1] * 20);
                } else if (meldCountsBySuit[s2] > 0 && meldCountsBySuit[s1] === 0 && s1CutCount >= 2) {
                    suspectedPureSuit = s2;
                    pureSuitConfidence = Math.min(95, 45 + s1CutCount * 15 + meldCountsBySuit[s2] * 20);
                } else if (s1CutCount >= 4 && s2CutCount === 0) {
                    suspectedPureSuit = s2;
                    pureSuitConfidence = Math.min(90, 40 + s1CutCount * 12);
                } else if (s2CutCount >= 4 && s1CutCount === 0) {
                    suspectedPureSuit = s1;
                    pureSuitConfidence = Math.min(90, 40 + s2CutCount * 12);
                }
            }

            // 5. 估算听牌概率 (Tenpai Probability)
            let tenpaiProb = 10;
            // 巡目基础概率
            if (currentTurnCount >= 4) tenpaiProb = 25;
            if (currentTurnCount >= 7) tenpaiProb = 50;
            if (currentTurnCount >= 10) tenpaiProb = 75;
            if (currentTurnCount >= 14) tenpaiProb = 88;

            // 副露修正
            tenpaiProb += melds.length * 18;

            // 变步修正：如果已经打过非缺门牌若干巡
            if (transitionTurn !== null) {
                const turnsAfterTransition = discards.length - transitionTurn;
                tenpaiProb += turnsAfterTransition * 15;
            } else if (queDiscards.length >= 6) {
                // 缺门还没打完，听牌概率极低
                tenpaiProb = Math.min(tenpaiProb, 15);
            }

            tenpaiProb = Math.max(5, Math.min(98, tenpaiProb));

            // 6. 牌型定性与番数预警
            let handArchetype = '平胡 / 杂牌叫';
            let threatLevel = '中';
            let estimatedFan = 1;

            if (suspectedPureSuit && pureSuitConfidence >= 65) {
                handArchetype = `清一色【${SUIT_NAMES[suspectedPureSuit]}】(极危)`;
                threatLevel = '极高';
                estimatedFan = 4;
                if (melds.length >= 2) estimatedFan = 8; // 清对
            } else if (melds.length >= 3) {
                handArchetype = '对对胡 / 金钩钓';
                threatLevel = '高';
                estimatedFan = melds.length === 4 ? 4 : 2;
            } else if (melds.length === 0 && nonQueDiscards.length >= 3 && transitionTurn !== null) {
                // 门清无副露，但出牌稀疏，有可能是七对
                if (nonQueDiscards.some(t => t.val >= 4 && t.val <= 6)) {
                    handArchetype = '门前清 / 疑似七对或大好型';
                    estimatedFan = 2;
                }
            }

            // 7. 疑似听牌叫牌区间 (Dangerous Wait Zones)
            const dangerSuits = suspectedPureSuit ? [suspectedPureSuit] : remainingSuits;
            const liveRiverCodes = new Set(discards.map(t => t.code));

            opponentProfiles.push({
                seatId,
                name: p.name,
                wind: p.wind,
                queSuit,
                swapClue,
                swapOutSuit: p.swapOutSuit,
                swapInSuit: p.swapInSuit,
                transitionTurn,
                discardsCount: discards.length,
                meldsCount: melds.length,
                suspectedPureSuit,
                pureSuitConfidence,
                tenpaiProb,
                handArchetype,
                threatLevel,
                estimatedFan,
                dangerSuits,
                recentDiscards: discards.slice(-3).map(t => formatTile(t)).join('、') || '无'
            });
        }

        return opponentProfiles;
    }

    /**
     * 计算某张牌针对特定对手的单体危险度 (0 - 100)
     */
    static calculateTileDangerToOpponent(tile, opponentProfile, gameState) {
        if (!opponentProfile || opponentProfile.isHu || opponentProfile.isDefeated) {
            return { score: 0, reason: '该家已胡牌或离场，无危险' };
        }

        // 1. 如果是对手的定缺门，100% 绝对安全！
        if (tile.suit === opponentProfile.queSuit) {
            return { score: 0, reason: `属于该家定缺门【${SUIT_NAMES[tile.suit]}】，绝对安全无法胡牌` };
        }

        // 2. 检查全场该牌是否为绝张（已见4张）
        const tileIdx = MahjongLogic.tileToIndex(tile);
        const seenCount = gameState.visibleCounts[tileIdx];
        if (seenCount >= 4) {
            return { score: 0, reason: '全场4张已全部现明（绝张），绝不可能放炮' };
        }

        // 3. 检查对手自己牌河是否打过该牌（现物绝对安全）
        const opponentDiscards = gameState.players[opponentProfile.seatId].discards || [];
        const hasDiscarded = opponentDiscards.some(t => t.suit === tile.suit && t.val === tile.val);
        if (hasDiscarded) {
            return { score: 2, reason: '对手自身牌河已有现物，极大概率不胡（防点炮绝对现物）' };
        }

        // 4. 清一色针对性严防
        if (opponentProfile.suspectedPureSuit) {
            if (tile.suit !== opponentProfile.suspectedPureSuit) {
                // 对手做清一色，非清一色花色安全性极高！
                return {
                    score: Math.max(3, 20 - opponentProfile.pureSuitConfidence / 5),
                    reason: `对手极大概率专攻【${SUIT_NAMES[opponentProfile.suspectedPureSuit]}】清一色，其他花色非常安全`
                };
            }
        }

        // 5. 筋牌理论 (Suji 1-4-7, 2-5-8, 3-6-9)
        // 观察对手是否打过同花色的 4 / 5 / 6 等
        let isSuji = false;
        let sujiNote = '';
        const opSameSuitDiscards = opponentDiscards.filter(t => t.suit === tile.suit).map(t => t.val);

        if (tile.val === 1 && opSameSuitDiscards.includes(4)) {
            isSuji = true;
            sujiNote = '同门已打4，此牌为1-4筋牌，破两面听概率高';
        } else if (tile.val === 7 && opSameSuitDiscards.includes(4)) {
            // 半筋：只现4，7还要防 56 听 47
            sujiNote = '同门已打4，7为半筋，仍需防56搭子';
        } else if (tile.val === 9 && opSameSuitDiscards.includes(6)) {
            isSuji = true;
            sujiNote = '同门已打6，此牌为6-9筋牌';
        } else if (tile.val === 3 && opSameSuitDiscards.includes(6)) {
            sujiNote = '同门已打6，3为半筋';
        } else if (tile.val === 2 && opSameSuitDiscards.includes(5)) {
            isSuji = true;
            sujiNote = '同门已打5，此牌为2-5筋牌';
        } else if (tile.val === 8 && opSameSuitDiscards.includes(5)) {
            isSuji = true;
            sujiNote = '同门已打5，此牌为5-8筋牌';
        }

        // 6. 壁牌 (No-Chance & One-Chance)
        // 检查相邻内侧牌是否断绝
        let isKabe = false;
        let kabeNote = '';
        if (tile.val === 1 || tile.val === 2) {
            const innerIdx = MahjongLogic.tileToIndex({ suit: tile.suit, val: 3 });
            if (gameState.visibleCounts[innerIdx] >= 4) {
                isKabe = true;
                kabeNote = '3号牌已现4张（No-Chance断壁），绝无2-3听1或1-3嵌2可能';
            }
        } else if (tile.val === 8 || tile.val === 9) {
            const innerIdx = MahjongLogic.tileToIndex({ suit: tile.suit, val: 7 });
            if (gameState.visibleCounts[innerIdx] >= 4) {
                isKabe = true;
                kabeNote = '7号牌已现4张（No-Chance断壁），绝无7-8听9可能';
            }
        }

        // 7. 基础危险分计算
        let baseDanger = 25;

        // 中张牌 (4, 5, 6) 属于核心危险区
        if (tile.val >= 4 && tile.val <= 6) {
            baseDanger += 35;
        } else if (tile.val === 3 || tile.val === 7) {
            baseDanger += 25; // 金三银七
        } else if (tile.val === 2 || tile.val === 8) {
            baseDanger += 15;
        } else {
            baseDanger += 5; // 幺九牌
        }

        // 生张惩罚 (全场未见过的生张危险度极高)
        if (seenCount <= 1) {
            baseDanger += 25;
        } else if (seenCount === 2) {
            baseDanger += 10;
        } else if (seenCount === 3) {
            baseDanger -= 15;
        }

        // 筋牌与壁牌减免
        if (isSuji) baseDanger -= 28;
        if (isKabe) baseDanger -= 35;

        // 结合对手听牌概率修正
        const finalDanger = Math.round((Math.max(5, Math.min(95, baseDanger)) * (opponentProfile.tenpaiProb / 100)));

        let reason = '';
        if (isKabe) {
            reason = kabeNote;
        } else if (isSuji) {
            reason = sujiNote;
        } else if (seenCount <= 1) {
            reason = `生张（全场仅见${seenCount}张），且为该家核心危险花色`;
        } else {
            reason = `中度生熟张，该花色在场上活跃度中等`;
        }

        return {
            score: Math.min(99, Math.max(1, finalDanger)),
            reason
        };
    }

    /**
     * 计算某张牌面对全场所有存活对手的“综合危险度”
     */
    static evaluateTileTotalDanger(tile, opponentProfiles, gameState) {
        let maxScore = 0;
        let worstOpponent = null;
        let primaryReason = '';

        for (const op of opponentProfiles) {
            if (op.isHu || op.isDefeated) continue;
            const res = this.calculateTileDangerToOpponent(tile, op, gameState);
            if (res.score > maxScore) {
                maxScore = res.score;
                worstOpponent = op;
                primaryReason = `防【${op.name}】：${res.reason}`;
            }
        }

        let level = 'SAFE'; // SAFE (0-19), CAUTION (20-45), DANGER (46-70), CRITICAL (71-100)
        let badgeColor = '#27ae60';
        let levelText = '安全';

        if (maxScore >= 70) {
            level = 'CRITICAL';
            badgeColor = '#c0392b';
            levelText = '极危炮牌';
        } else if (maxScore >= 45) {
            level = 'DANGER';
            badgeColor = '#e67e22';
            levelText = '高度危险';
        } else if (maxScore >= 20) {
            level = 'CAUTION';
            badgeColor = '#f39c12';
            levelText = '需谨慎';
        }

        return {
            score: maxScore,
            level,
            badgeColor,
            levelText,
            worstOpponent,
            primaryReason: primaryReason || '全场安全牌'
        };
    }

    /**
     * 生成完整的深度思考推演报告 (全方位逻辑推导)
     * @param {Object} gameState 当前全局状态
     * @returns {Object} 包含结构化思考脉络、横向打法对比、对手镜像、最优推荐
     */
    static generateDeepThinkingReport(gameState) {
        const { mySeat, players, visibleCounts } = gameState;
        const myPlayer = players[mySeat];
        const hand = myPlayer.hand;
        const melds = myPlayer.melds;
        const queSuit = myPlayer.queSuit;

        // 1. 深度分析三家对手
        const opponentProfiles = this.analyzeOpponents(gameState);

        // 2. 测算自己手牌的所有出牌候选方案
        const discardOptions = MahjongLogic.evaluateDiscardOptions(hand, melds, queSuit, visibleCounts);

        // 3. 对每个候选切牌进行综合打分 (牌效 EV vs 危险度 Risk)
        const rankedOptions = discardOptions.map(option => {
            const dangerInfo = this.evaluateTileTotalDanger(option.tile, opponentProfiles, gameState);

            // 计算自身进张速度评分 (Speed Score)
            // 向听数越小，进张张数越多，得分越高
            const shantenWeight = option.shanten === 0 ? 100 : (option.shanten === 1 ? 55 : (option.shanten === 2 ? 25 : 10));
            const speedScore = shantenWeight + option.effectiveCount * 2.5;

            // 预估番数潜力
            let potentialFan = 1;
            if (melds.length === 0) {
                // 检查清一色潜力
                const nonQueCount = hand.filter(t => t.suit !== queSuit && t.suit !== option.tile.suit).length;
                if (nonQueCount >= 10) potentialFan = 4;
            }

            // 期望值 EV = 进攻价值 - 防守放炮惩罚
            // 如果手牌向听数较大 (>=2向听)，大幅提高防守权重（弃胡防守）
            const defenseWeight = option.shanten >= 2 ? 1.4 : (option.shanten === 1 ? 0.9 : 0.4);
            const riskPenalty = dangerInfo.score * defenseWeight * (dangerInfo.worstOpponent ? dangerInfo.worstOpponent.estimatedFan : 1);
            const netEV = speedScore - riskPenalty;

            return {
                ...option,
                dangerInfo,
                speedScore: Math.round(speedScore),
                netEV: Math.round(netEV * 10) / 10,
                potentialFan
            };
        });

        // 按净期望值 (netEV) 降序排列，得分最高者为推荐打法
        rankedOptions.sort((a, b) => b.netEV - a.netEV);

        const bestChoice = rankedOptions[0];

        // 4. 构建结构化、高逻辑深度的推理过程（四大思考环节）
        const reasoningSteps = this._buildReasoningSteps(myPlayer, opponentProfiles, rankedOptions, bestChoice, gameState);

        return {
            bestChoice,
            rankedOptions,
            opponentProfiles,
            reasoningSteps,
            timestamp: new Date().toLocaleTimeString()
        };
    }

    /**
     * 编写极为详尽、严密的战术推演步骤
     */
    static _buildReasoningSteps(myPlayer, opponentProfiles, rankedOptions, bestChoice, gameState) {
        const hand = myPlayer.hand;
        const queSuit = myPlayer.queSuit;
        const hasQue = MahjongLogic.hasQueTile(hand, queSuit);

        const steps = [];

        // 思考步骤 1：手牌结构与规则约束层
        let step1Title = '【第一步】手牌骨架与定缺约束审视';
        let step1Desc = '';
        if (hasQue) {
            const queTiles = MahjongLogic.getQueTiles(hand, queSuit);
            step1Desc = `川麻换三张铁律：定缺门【${SUIT_NAMES[queSuit]}】必须率先出清方可入听胡牌。当前手牌仍持有 ${queTiles.length} 张【${SUIT_NAMES[queSuit]}】(${queTiles.map(t => formatTile(t)).join('、')})，因此出牌候选池被强制锁定在定缺门内。在定缺牌内部，应遵循“先打孤张中张、再打边张或对子”原则，避免在终盘被动点炮。`;
        } else {
            step1Desc = `定缺门【${SUIT_NAMES[queSuit]}】已全部清空，手牌进入纯粹的战斗形态。当前手牌有效向听数为【${bestChoice.shanten === 0 ? '已听牌 (0向听)' : (bestChoice.shanten === 1 ? '一向听' : `${bestChoice.shanten}向听`)}】。核心目标是平衡“进张广度”与“控张防守”。`;
        }
        steps.push({ step: 1, title: step1Title, content: step1Desc, tag: '规则与向听' });

        // 思考步骤 2：全场对手威胁画像与危险源定位
        let step2Title = '【第二步】全场对手读牌与危险源精确定位';
        const activeThreats = opponentProfiles.filter(o => !o.isHu && !o.isDefeated);
        let threatSummary = activeThreats.map(op => {
            return `• **${op.name} (${op.wind})**：定缺【${SUIT_NAMES[op.queSuit]}】，估算听牌率 **${op.tenpaiProb}%**，手牌定性为【${op.handArchetype}】，主攻门类为【${op.dangerSuits.map(s => SUIT_NAMES[s]).join('/')}】。换牌历史：${op.swapClue}。`;
        }).join('\n');

        steps.push({
            step: 2,
            title: step2Title,
            content: `经过对三家牌河、副露以及变步节奏的扫描：\n${threatSummary}\n> **雀圣战术点**：血战到底的核心是“宁可流局弃胡，绝不给清一色或大番数点炮”。任何向听数落后的局面，必须优先规避上述高危主攻门的生张。`,
            tag: '敌情洞察'
        });

        // 思考步骤 3：出牌方案进张与牌效横向对比
        let step3Title = '【第三步】候选切牌的向听数与有效进张面测算';
        let compText = rankedOptions.slice(0, 3).map((opt, idx) => {
            const tileStr = formatTile(opt.tile);
            const effStr = opt.effectiveTiles.length > 0 
                ? opt.effectiveTiles.map(e => `${formatTile(e.tile)}(余${e.count}张)`).join(', ') 
                : '无有效进张';
            return `选项 ${idx + 1}：打【${tileStr}】 $\\to$ 剩余向听：${opt.shanten}向听，有效进张：共 ${opt.effectiveCount} 张 (${effStr})，危险度：${opt.dangerInfo.score}% (${opt.dangerInfo.levelText})。综合EV评分：${opt.netEV}分。`;
        }).join('\n\n');

        steps.push({
            step: 3,
            title: step3Title,
            content: `对比当前最有价值的前几项切牌策略：\n\n${compText}`,
            tag: '牌效精算'
        });

        // 思考步骤 4：攻守抉择与最佳打法最终裁决
        let step4Title = '【第四步】终局攻守裁决：为何推荐打这张牌？';
        let decisionText = '';
        const recTileName = formatTile(bestChoice.tile);

        if (bestChoice.shanten === 0) {
            const waitDetails = bestChoice.waitingTiles.map(w => `${formatTile(w.tile)}(剩${w.remainCount}张, 预估${w.totalFan}番)`).join('、');
            decisionText = `**全力进攻冲听**！打出【${recTileName}】即可立即进入听牌状态！听牌叫口为：【${waitDetails}】。当前局势下胡牌收益巨大，危险度可控，应当果断打出推荐牌占领听牌先机！`;
        } else if (bestChoice.dangerInfo.score <= 25) {
            decisionText = `**推荐平稳进张，兼顾极致安全**。打出【${recTileName}】不仅能保留最宽阔的进张面 (${bestChoice.effectiveCount}张)，而且在全场对手眼中属于【${bestChoice.dangerInfo.levelText}】(危险度仅 ${bestChoice.dangerInfo.score}%)。原因：${bestChoice.dangerInfo.primaryReason}。此乃收益最大化且零放炮隐患的稳健大师打法。`;
        } else {
            decisionText = `**攻守拉锯折衷**：虽然打出【${recTileName}】有一定放炮风险 (${bestChoice.dangerInfo.score}%)，但相比其他切牌方案，打该牌能最大限度保住手牌结构或迅速将高危死门化解。如若防守压力进一步升级，建议下一轮立刻切换至绝对现物弃胡。`;
        }

        steps.push({
            step: 4,
            title: step4Title,
            content: decisionText,
            tag: '大师决策'
        });

        return steps;
    }
}

if (typeof module !== 'undefined') {
    module.exports = AIAnalyzer;
}
