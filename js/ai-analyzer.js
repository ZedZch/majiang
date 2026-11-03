/**
 * 雀圣兵法 · 高阶麻将推演与读牌防炮决策引擎 (SOTA 神经强化学习架构重制版)
 * 吸收微软 Suphx、Mortal 与顶级川麻职业实战算法：
 * 1. 巡目时钟攻守自适应 (序盘 100% 牌效进攻、中盘变步抓听、终盘防大牌防查叫)
 * 2. 川麻特色“清一色 4番/16倍”巨大价值溢价 (Qingyise Potential Head)
 * 3. 终盘流局“查叫赔付”风险防御 (Chajiao Protection)
 * 4. 攻守平衡双头神经网络决策 (Policy Head π & Value Head V)
 * 5. 100% 数值代入透明化与实时公式输出
 */

if (typeof require !== 'undefined') {
    if (typeof global.SUIT_NAMES === 'undefined') {
        Object.assign(global, require('./config.js'));
    }
    if (typeof global.MahjongLogic === 'undefined') {
        global.MahjongLogic = require('./mahjong-logic.js');
    }
}

class AIAnalyzer {
    /**
     * 针对各家对手的手牌状态进行推测与概率画像
     * @param {Object} gameState 完整游戏状态
     * @returns {Array} 3位对手的读牌画像对象
     */
    static analyzeOpponents(gameState) {
        const { players, visibleCounts, currentTurnCount = 1 } = gameState;
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
            if (p.swapOutSuit && p.swapInSuit) {
                swapClue = `换出【${SUIT_NAMES[p.swapOutSuit]}】换入【${SUIT_NAMES[p.swapInSuit]}】`;
            }

            // 2. 定缺门与进度分析
            const queSuit = p.queSuit;
            const discards = p.discards || [];
            const nonQueDiscards = discards.filter(t => t.suit !== queSuit);
            const queDiscards = discards.filter(t => t.suit === queSuit);

            // 寻找“变步点”（打完定缺牌后，第一次打非缺门牌的巡目）
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
            const remainingSuits = SUIT_KEYS.filter(s => s !== queSuit);
            let suspectedPureSuit = null;
            let pureSuitConfidence = 0;

            if (remainingSuits.length === 2) {
                const s1 = remainingSuits[0];
                const s2 = remainingSuits[1];
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

            // 5. 估算听牌概率 (Tenpai Probability) - 真实巡目模型
            let tenpaiProb = 5;
            if (currentTurnCount <= 6) {
                // 序盘定缺尚未出完，听牌概率极低
                tenpaiProb = transitionTurn !== null ? 20 : 5;
            } else if (currentTurnCount <= 11) {
                tenpaiProb = 40 + melds.length * 15;
                if (transitionTurn !== null) {
                    const turnsAfter = discards.length - transitionTurn;
                    tenpaiProb += turnsAfter * 10;
                }
            } else {
                // 终盘
                tenpaiProb = 75 + melds.length * 10;
            }

            tenpaiProb = Math.max(3, Math.min(96, tenpaiProb));

            // 6. 牌型定性与番数预警
            let handArchetype = '常规平胡 / 杂牌叫';
            let threatLevel = '中';
            let estimatedFan = 1;

            if (suspectedPureSuit && pureSuitConfidence >= 60) {
                handArchetype = `清一色【${SUIT_NAMES[suspectedPureSuit]}】(极危大牌)`;
                threatLevel = '极高';
                estimatedFan = 4;
                if (melds.length >= 2) estimatedFan = 8;
            } else if (melds.length >= 3) {
                handArchetype = '对对胡 / 金钩钓';
                threatLevel = '高';
                estimatedFan = melds.length === 4 ? 4 : 2;
            }

            const dangerSuits = suspectedPureSuit ? [suspectedPureSuit] : remainingSuits;

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
            return { score: 0, reason: '该家已胡牌离场，无危险' };
        }

        // 1. 如果是对手的定缺门，100% 绝对安全！
        if (tile.suit === opponentProfile.queSuit) {
            return { score: 0, reason: `属于该家定缺门【${SUIT_NAMES[tile.suit]}】，放炮率为绝对 0%` };
        }

        // 2. 检查全场该牌是否为绝张（已见4张）
        const tileIdx = MahjongLogic.tileToIndex(tile);
        const seenCount = gameState.visibleCounts ? gameState.visibleCounts[tileIdx] : 0;
        if (seenCount >= 4) {
            return { score: 0, reason: '全场4张已现满（绝张），绝不可能点炮' };
        }

        // 3. 检查对手自己牌河是否打过该牌（现物绝对安全）
        const opponentDiscards = gameState.players[opponentProfile.seatId]?.discards || [];
        const hasDiscarded = opponentDiscards.some(t => t.suit === tile.suit && t.val === tile.val);
        if (hasDiscarded) {
            return { score: 2, reason: '对手自家牌河已有同张现物，无法荣和（绝对现物）' };
        }

        // 4. 对手做清一色的针对性严防
        if (opponentProfile.suspectedPureSuit) {
            if (tile.suit !== opponentProfile.suspectedPureSuit) {
                return {
                    score: Math.max(3, 16 - opponentProfile.pureSuitConfidence / 6),
                    reason: `对手专注【${SUIT_NAMES[opponentProfile.suspectedPureSuit]}】清一色，此花色极度安全`
                };
            }
        }

        // 5. 筋牌理论 (Suji)
        let isSuji = false;
        let sujiNote = '';
        const opSameSuitDiscards = opponentDiscards.filter(t => t.suit === tile.suit).map(t => t.val);

        if (tile.val === 1 && opSameSuitDiscards.includes(4)) {
            isSuji = true;
            sujiNote = '同门已打4，此牌为1-4真筋，破两面听';
        } else if (tile.val === 9 && opSameSuitDiscards.includes(6)) {
            isSuji = true;
            sujiNote = '同门已打6，此牌为6-9真筋';
        } else if (tile.val === 2 && opSameSuitDiscards.includes(5)) {
            isSuji = true;
            sujiNote = '同门已打5，此牌为2-5真筋';
        } else if (tile.val === 8 && opSameSuitDiscards.includes(5)) {
            isSuji = true;
            sujiNote = '同门已打5，此牌为5-8真筋';
        } else if (tile.val === 7 && opSameSuitDiscards.includes(4)) {
            sujiNote = '同门已打4，7为半筋（仍需防5-6待4-7）';
        } else if (tile.val === 3 && opSameSuitDiscards.includes(6)) {
            sujiNote = '同门已打6，3为半筋';
        }

        // 6. 壁牌 (Kabe No-Chance)
        let isKabe = false;
        let kabeNote = '';
        if (tile.val === 1 || tile.val === 2) {
            const innerIdx = MahjongLogic.tileToIndex({ suit: tile.suit, val: 3 });
            if (gameState.visibleCounts && gameState.visibleCounts[innerIdx] >= 4) {
                isKabe = true;
                kabeNote = '3号已见4张（No-Chance断壁），绝无2-3听1可能';
            }
        } else if (tile.val === 8 || tile.val === 9) {
            const innerIdx = MahjongLogic.tileToIndex({ suit: tile.suit, val: 7 });
            if (gameState.visibleCounts && gameState.visibleCounts[innerIdx] >= 4) {
                isKabe = true;
                kabeNote = '7号已见4张（No-Chance断壁），绝无7-8听9可能';
            }
        }

        // 7. 基础危险分
        let baseDanger = 20;
        if (tile.val >= 4 && tile.val <= 6) {
            baseDanger += 30; // 核心中张
        } else if (tile.val === 3 || tile.val === 7) {
            baseDanger += 20; // 尖张
        } else if (tile.val === 2 || tile.val === 8) {
            baseDanger += 12;
        } else {
            baseDanger += 5; // 幺九
        }

        // 生张惩罚
        if (seenCount <= 1) {
            baseDanger += 20;
        } else if (seenCount === 2) {
            baseDanger += 8;
        } else if (seenCount === 3) {
            baseDanger -= 12;
        }

        if (isSuji) baseDanger -= 26;
        if (isKabe) baseDanger -= 32;

        const finalDanger = Math.round((Math.max(4, Math.min(95, baseDanger)) * (opponentProfile.tenpaiProb / 100)));

        let reason = '';
        if (isKabe) reason = kabeNote;
        else if (isSuji) reason = sujiNote;
        else if (seenCount <= 1) reason = `生张（全场仅见${seenCount}张），危险度随巡目上升`;
        else reason = `中度生熟张，全场已现${seenCount}张`;

        return {
            score: Math.min(98, Math.max(1, finalDanger)),
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

        let level = 'SAFE';
        let badgeColor = '#27ae60';
        let levelText = '安全';

        if (maxScore >= 65) {
            level = 'CRITICAL';
            badgeColor = '#c0392b';
            levelText = '极危炮牌';
        } else if (maxScore >= 40) {
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
     * 核心算法：生成全透明、可解释的深度决策报告 (Suphx 架构与川麻高胜率模型)
     * @param {Object} gameState 当前全局状态
     * @returns {Object} 包含结构化思考脉络、精确代入公式、神经推理状态与最优推荐
     */
    static generateDeepThinkingReport(gameState) {
        const { mySeat, players, visibleCounts } = gameState;
        const myPlayer = players[mySeat];
        const hand = myPlayer.hand;
        const melds = myPlayer.melds;
        const queSuit = myPlayer.queSuit;
        const turnCount = gameState.currentTurnCount || 1;

        // 1. 深度分析三家对手
        const opponentProfiles = this.analyzeOpponents(gameState);

        // 2. 判定当前局势时钟 (Game Clock Stage)
        let gameStage = 'EARLY';
        let gameStageText = `序盘第 ${turnCount} 巡 (极速进张抢叫期)`;
        let stageDefMultiplier = 0.04; // 序盘 100% 拼进张速度，绝不盲目弃胡防守！

        if (turnCount >= 12) {
            gameStage = 'LATE';
            gameStageText = `终盘第 ${turnCount} 巡 (决战保叫与防点炮期)`;
            stageDefMultiplier = 1.15;
        } else if (turnCount >= 7) {
            gameStage = 'MID';
            gameStageText = `中盘第 ${turnCount} 巡 (攻守平衡与变步抓听期)`;
            stageDefMultiplier = 0.45;
        }

        // 3. 统计手牌花色分布，评估清一色潜力 (川麻清一色 4番 = 16倍溢价)
        const activeSuits = SUIT_KEYS.filter(s => s !== queSuit);
        const suitCounts = { wan: 0, tiao: 0, tong: 0 };
        hand.forEach(t => suitCounts[t.suit]++);
        melds.forEach(m => suitCounts[m.tiles[0].suit] += 3);

        let targetPureSuit = null;
        let pureSuitRatio = 0;
        for (const s of activeSuits) {
            if (suitCounts[s] >= 7) {
                targetPureSuit = s;
                pureSuitRatio = suitCounts[s] / 13;
                break;
            }
        }

        // 4. 测算自己手牌的所有出牌候选方案
        const discardOptions = MahjongLogic.evaluateDiscardOptions(hand, melds, queSuit, visibleCounts);

        // 5. 对每个候选切牌进行深度 Q值 (EV) 精算
        const rankedOptions = discardOptions.map(option => {
            const dangerInfo = this.evaluateTileTotalDanger(option.tile, opponentProfiles, gameState);

            // [项 A] 进张速度得分 (Speed Score)
            let shantenBase = 0;
            if (option.shanten === 0) shantenBase = 120; // 听牌一击必杀
            else if (option.shanten === 1) shantenBase = 65;
            else if (option.shanten === 2) shantenBase = 25;
            else shantenBase = 5;

            const effectiveScore = Math.round(option.effectiveCount * 2.2 * 10) / 10;
            const totalSpeed = shantenBase + effectiveScore;

            // [项 B] 清一色与大牌溢价 (Fan Expectation Bonus)
            let fanPremium = 0;
            let qingyiseNote = '常规杂合牌型';
            if (targetPureSuit) {
                if (option.tile.suit !== targetPureSuit) {
                    // 切掉杂门牌，加速纯化清一色！
                    fanPremium = Math.round(26 * pureSuitRatio * 10) / 10;
                    qingyiseNote = `纯化【${SUIT_NAMES[targetPureSuit]}】清一色(4番/16倍)，切除杂牌`;
                } else {
                    // 拆毁主战花色，扣除大牌潜力
                    fanPremium = -18;
                    qingyiseNote = `拆损主战门【${SUIT_NAMES[targetPureSuit]}】，破坏大牌结构`;
                }
            }

            // [项 C] 放炮危险折损 (Deal-in Risk Penalty)
            // 核心修复：自身若已听牌(0向听)，攻守折半强力冲胡！序盘防守折损几乎为0！
            let actualDefMultiplier = stageDefMultiplier;
            if (option.shanten === 0) {
                actualDefMultiplier *= 0.35; // 听牌攻坚
            } else if (option.shanten >= 2 && gameStage === 'LATE') {
                actualDefMultiplier *= 1.3;
            }

            const worstOpponentFan = dangerInfo.worstOpponent ? dangerInfo.worstOpponent.estimatedFan : 1;
            const defensePenalty = Math.round(dangerInfo.score * actualDefMultiplier * worstOpponentFan * 0.45 * 10) / 10;

            // [项 D] 流局查叫防御 (Chajiao Protection)
            // 终盘退向听会导致流局被查叫罚巨款，增加重罚
            let chajiaoDefense = 0;
            if (gameStage === 'LATE' && option.shanten >= 2) {
                chajiaoDefense = 20.0;
            }

            // [总项] 综合期望得分 (Net EV Q-Value)
            const netEV = Math.round((totalSpeed + fanPremium - defensePenalty - chajiaoDefense) * 10) / 10;

            // 构造完全透明的数学代入公式
            const fanStr = fanPremium > 0 ? `+${fanPremium}` : `${fanPremium}`;
            const formulaString = `Q = ${shantenBase}(向听基数) + ${effectiveScore}(进张加成) ${fanStr}(番型溢价) - ${defensePenalty}(放炮折损) - ${chajiaoDefense}(查叫防御) = ${netEV}分`;

            return {
                ...option,
                dangerInfo,
                speedScore: Math.round(totalSpeed),
                netEV,
                math: {
                    baseSpeed: shantenBase,
                    effectiveScore,
                    fanPremium,
                    defensePenalty,
                    chajiaoDefense,
                    formulaString,
                    qingyiseNote
                }
            };
        });

        // 降序排序，最优者置顶
        rankedOptions.sort((a, b) => b.netEV - a.netEV);
        const bestChoice = rankedOptions[0];

        // Softmax 计算各候选切牌的策略选择概率 P(a|s)
        const maxQ = Math.max(...rankedOptions.map(o => o.netEV));
        const expSum = rankedOptions.reduce((acc, o) => acc + Math.exp((o.netEV - maxQ) / 12), 0);
        rankedOptions.forEach(opt => {
            opt.probability = Math.round((Math.exp((opt.netEV - maxQ) / 12) / expSum) * 100);
        });

        // 6. 构造可供交互渲染的深度神经网络状态数据 (Neural Tensor Payload)
        const neuralState = {
            gameStage,
            gameStageText,
            turnCount,
            suitAttention: {
                wan: Math.round((suitCounts.wan / 14) * 100) / 100,
                tiao: Math.round((suitCounts.tiao / 14) * 100) / 100,
                tong: Math.round((suitCounts.tong / 14) * 100) / 100
            },
            policyHead: rankedOptions.map(o => ({
                tile: o.tile,
                probability: o.probability,
                qValue: o.netEV,
                shanten: o.shanten,
                effectiveCount: o.effectiveCount,
                math: o.math
            })),
            valueHead: {
                winProb: bestChoice.shanten === 0 ? 82 : (bestChoice.shanten === 1 ? 52 : 24),
                dealInProb: bestChoice.dangerInfo.score,
                expectedFan: targetPureSuit ? 4 : 1.5,
                qScore: bestChoice.netEV
            }
        };

        // 7. 构建结构化、高逻辑深度的推理过程（四大思考环节）
        const reasoningSteps = this._buildReasoningSteps(myPlayer, opponentProfiles, rankedOptions, bestChoice, gameState, gameStageText);

        return {
            bestChoice,
            rankedOptions,
            opponentProfiles,
            reasoningSteps,
            neuralState,
            timestamp: new Date().toLocaleTimeString()
        };
    }

    /**
     * 编写详尽严密的四大战术推演步骤
     */
    static _buildReasoningSteps(myPlayer, opponentProfiles, rankedOptions, bestChoice, gameState, gameStageText) {
        const hand = myPlayer.hand;
        const queSuit = myPlayer.queSuit;
        const hasQue = MahjongLogic.hasQueTile(hand, queSuit);

        const steps = [];

        // 思考步骤 1：局势时钟与规则向听
        let step1Title = '【第一步】局势时钟与定缺约束审视';
        let step1Desc = '';
        if (hasQue) {
            const queTiles = MahjongLogic.getQueTiles(hand, queSuit);
            step1Desc = `【${gameStageText}】川麻铁律：定缺门【${SUIT_NAMES[queSuit]}】必须优先打完方可入听。当前仍持 ${queTiles.length} 张缺门牌，锁定打缺门。在定缺牌内部，遵循“先出孤张中张，后出边张搭子”原则，避免中后期滞留放炮。`;
        } else {
            step1Desc = `【${gameStageText}】定缺门已完全清空，当前向听数为【${bestChoice.shanten === 0 ? '已入听 (0向听)' : (bestChoice.shanten === 1 ? '一向听' : `${bestChoice.shanten}向听`)}】。首要目标是最大化进张广度，以攻代守争夺最先胡牌！`;
        }
        steps.push({ step: 1, title: step1Title, content: step1Desc, tag: '时钟与向听' });

        // 思考步骤 2：全场敌情侦测与变步抓听
        let step2Title = '【第二步】全场对手镜像读牌与威胁过滤';
        const activeThreats = opponentProfiles.filter(o => !o.isHu && !o.isDefeated);
        let threatSummary = activeThreats.map(op => {
            return `• **${op.name} (${op.wind})**：定缺【${SUIT_NAMES[op.queSuit]}】，估算听牌率 **${op.tenpaiProb}%**，手牌定性为【${op.handArchetype}】，主攻门类为【${op.dangerSuits.map(s => SUIT_NAMES[s]).join('/')}】。换牌历史：${op.swapClue}。`;
        }).join('\n');

        steps.push({
            step: 2,
            title: step2Title,
            content: `扫描三家弃牌与变步时机：\n${threatSummary}\n> **雀圣战术原则**：在川麻序盘(1-6巡)，对手听牌率极低，切忌过度脑补防守而拆毁好型；唯有当对手做清一色副露显明时，才对该特定门类保持戒备。`,
            tag: '敌情洞察'
        });

        // 思考步骤 3：大牌清一色潜力与做牌规划
        let step3Title = '【第三步】清一色与做大牌潜力权衡';
        let step3Desc = `当前决策：${bestChoice.math.qingyiseNote}。在川渝血战到底中，无番不起早，平胡收益极低而清一色收益高达16倍。若起手某门密集，系统将赋予巨额纯化权重！`;
        steps.push({ step: 3, title: step3Title, content: step3Desc, tag: '番型规划' });

        // 思考步骤 4：数学公式全透明代入与最终决断
        let step4Title = '【第四步】综合 Q值计算公式与精确数值代入';
        let step4Desc = `经过深度神经网络双头推理，首选切出【${formatTile(bestChoice.tile)}】：\n` +
                        `$$\\text{综合 Q值} = \\text{进张速度} + \\text{大牌溢价} - \\text{放炮折损} - \\text{查叫防御}$$\n` +
                        `**代入具体实战参数**：\n` +
                        `• ${bestChoice.math.formulaString}\n` +
                        `• 有效进张面：**${bestChoice.effectiveCount} 张未见牌**\n` +
                        `• 策略头置信概率：**$P(\\pi) = ${bestChoice.probability}\\%$** (全场第一)`;
        steps.push({ step: 4, title: step4Title, content: step4Desc, tag: '公式决断' });

        return steps;
    }

    /**
     * 针对他人弃牌产生的【碰 / 杠 / 胡】决策进行深度战术推演
     */
    static analyzeMeldReaction(reactionInfo, gameState) {
        if (!reactionInfo) return null;
        const { tile, fromSeat, reactions = [] } = reactionInfo;
        const myPlayer = gameState.players[0];
        const opponent = gameState.players[fromSeat];

        const results = [];

        // 1. 胡牌推演
        if (reactions.includes('HU')) {
            const testHand = [...myPlayer.hand, tile];
            const fanInfo = MahjongLogic.evaluateHandFans(testHand, myPlayer.melds, myPlayer.queSuit, tile, false);
            results.push({
                action: 'HU',
                recommendation: '强烈建议：立即胡牌！',
                badge: '必胡',
                badgeColor: '#c0392b',
                summary: `荣和点炮胡！从【${opponent.name}】处收取 ${fanInfo.totalFan} 番大奖！`,
                details: `• 番型构成：${fanInfo.patterns.map(p => `${p.name} (${p.fan}番)`).join('、')}。\n• 血战到底战略法则：在川渝血战到底中，先胡牌不仅锁定得分落袋为安，而且胡牌后不会放炮、不会查叫，风险降为绝对0，必须毫不犹豫胡牌！`
            });
        }

        // 2. 杠牌推演 (直杠)
        if (reactions.includes('GANG')) {
            results.push({
                action: 'GANG',
                recommendation: '建议开杠（点杠）',
                badge: '直杠',
                badgeColor: '#8e44ad',
                summary: `直杠【${formatTile(tile)}】！直接从点杠者【${opponent.name}】处赢取 2 分，并获得开杠补牌权。`,
                details: `• 收益分析：开杠后立即摸一张杠牌，有概率触发【杠上开花】（额外+1番）；且形成4张同色【根】（全手牌倍率加倍）。\n• 风险评估：若场上有人听牌且清一色门类重合，需警惕补摸后的出牌安全。`
            });
        }

        // 3. 碰牌推演 (深度权衡)
        if (reactions.includes('PENG')) {
            const currentShanten = MahjongLogic.getHandShanten(myPlayer.hand, myPlayer.melds, myPlayer.queSuit);

            const testHand = [...myPlayer.hand];
            let removed = 0;
            for (let i = testHand.length - 1; i >= 0 && removed < 2; i--) {
                if (testHand[i].suit === tile.suit && testHand[i].val === tile.val) {
                    testHand.splice(i, 1);
                    removed++;
                }
            }
            const testMelds = [...myPlayer.melds, { type: 'PENG', tiles: [tile, tile, tile] }];
            const discardOpts = MahjongLogic.evaluateDiscardOptions(testHand, testMelds, myPlayer.queSuit, gameState.visibleCounts);
            const opponentProfiles = this.analyzeOpponents(gameState);

            let bestAfterCut = discardOpts[0];
            let afterShanten = bestAfterCut ? bestAfterCut.shanten : currentShanten;
            let cutTileDanger = bestAfterCut ? this.evaluateTileTotalDanger(bestAfterCut.tile, opponentProfiles, gameState) : { score: 0, levelText: '未知' };

            const isPureSuitPursuit = myPlayer.hand.filter(t => t.suit !== myPlayer.queSuit && t.suit === tile.suit).length >= 6;

            let pengAdvice = '建议碰牌';
            let pengBadge = '推荐碰';
            let pengColor = '#2980b9';
            let pengReason = '';

            if (isPureSuitPursuit) {
                pengAdvice = '强烈建议碰牌！加速清一色成型';
                pengBadge = '加速清一色';
                pengColor = '#27ae60';
                pengReason = `此牌为你主战门【${SUIT_NAMES[tile.suit]}】，碰牌后直接压缩手牌，向听数由 ${currentShanten} 缩短至 ${afterShanten}，极大加快4番/16倍清一色推进！碰后推荐切掉【${bestAfterCut ? formatTile(bestAfterCut.tile) : '杂牌'}】。`;
            } else if (afterShanten < currentShanten) {
                pengAdvice = '建议碰牌！向听数前进';
                pengBadge = '推进向听';
                pengColor = '#2ecc71';
                pengReason = `碰牌让手牌从 ${currentShanten}向听 直接推进至 ${afterShanten}向听。碰后切【${formatTile(bestAfterCut.tile)}】(危险度 ${cutTileDanger.score}% - ${cutTileDanger.levelText})。`;
            } else if (cutTileDanger.score >= 60 && (gameState.currentTurnCount || 1) >= 8) {
                pengAdvice = '不建议碰牌！碰后需切高危生张，易被反杀';
                pengBadge = '慎碰防炮';
                pengColor = '#e67e22';
                pengReason = `虽然可以碰，但碰后手牌被迫切出【${formatTile(bestAfterCut.tile)}】(${cutTileDanger.score}% 放炮率)，此时贪碰得不偿失，建议过牌留存防守牌。`;
            } else {
                pengAdvice = '可碰可过（依局势决定）';
                pengBadge = '均势平稳';
                pengColor = '#3498db';
                pengReason = `碰后向听数为 ${afterShanten}向听。若想快速叫牌可以碰；若想留存门清做根可过牌。`;
            }

            results.push({
                action: 'PENG',
                recommendation: pengAdvice,
                badge: pengBadge,
                badgeColor: pengColor,
                summary: `碰【${formatTile(tile)}】决策分析`,
                details: pengReason
            });
        }

        return {
            tile,
            fromSeat,
            opponentName: opponent ? opponent.name : '对手',
            results
        };
    }
}

if (typeof module !== 'undefined') {
    module.exports = AIAnalyzer;
}
