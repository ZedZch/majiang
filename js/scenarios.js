/**
 * 雀圣兵法 · 高阶经典战术残局训练题库
 * 专为想要进阶提高、掌握读牌算牌与防放炮的玩家设计的实战推演案例
 */

const TACTICAL_SCENARIOS = [
    {
        id: 'scenario_qingyise_defense',
        title: '【防守进阶】生死拆张·规避下家清一色满贯炮',
        subtitle: '血战到底核心铁律：宁流局弃胡，绝不冲大牌生张',
        description: '此时已到第11巡，下家（南）副露碰了【二条】、【五条】、【八条】，定缺万子，出牌全是筒子，条子清一色听牌已成定局（至少8番起步）。你手中持有一向听手牌，摸到了生张【六条】。你是贪恋向听强行冲牌，还是拆牌防守？',
        targetSuit: 'tiao',
        initialState: {
            currentTurnCount: 11,
            mySeat: 0,
            dealer: 2,
            wallCount: 16,
            myHand: [
                { suit: 'wan', val: 2 }, { suit: 'wan', val: 3 }, { suit: 'wan', val: 4 },
                { suit: 'wan', val: 7 }, { suit: 'wan', val: 8 }, { suit: 'wan', val: 9 },
                { suit: 'tong', val: 5 }, { suit: 'tong', val: 6 },
                { suit: 'tiao', val: 3 }, { suit: 'tiao', val: 4 }, { suit: 'tiao', val: 6 }, // 刚摸到6条
                { suit: 'tong', val: 9 }, { suit: 'tong', val: 9 }, { suit: 'wan', val: 5 }
            ],
            myMelds: [],
            myQue: 'tong',
            opponents: [
                {
                    seatId: 1,
                    name: '下家 (南)',
                    wind: '南',
                    queSuit: 'wan',
                    swapClue: '出【万】入【条】',
                    melds: [
                        { type: 'PENG', tiles: [{ suit: 'tiao', val: 2 }, { suit: 'tiao', val: 2 }, { suit: 'tiao', val: 2 }] },
                        { type: 'PENG', tiles: [{ suit: 'tiao', val: 5 }, { suit: 'tiao', val: 5 }, { suit: 'tiao', val: 5 }] },
                        { type: 'PENG', tiles: [{ suit: 'tiao', val: 8 }, { suit: 'tiao', val: 8 }, { suit: 'tiao', val: 8 }] }
                    ],
                    discards: [
                        { suit: 'wan', val: 1 }, { suit: 'wan', val: 5 }, { suit: 'wan', val: 9 },
                        { suit: 'tong', val: 3 }, { suit: 'tong', val: 4 }, { suit: 'tong', val: 7 }, { suit: 'tong', val: 8 }
                    ],
                    tenpaiProb: 98,
                    handArchetype: '清一色大对子 (8番起步)'
                },
                {
                    seatId: 2,
                    name: '对家 (西)',
                    wind: '西',
                    queSuit: 'tiao',
                    swapClue: '出【条】入【筒】',
                    melds: [],
                    discards: [
                        { suit: 'tiao', val: 1 }, { suit: 'tiao', val: 2 }, { suit: 'tiao', val: 7 }, { suit: 'tiao', val: 9 },
                        { suit: 'wan', val: 5 }, { suit: 'tong', val: 2 }
                    ],
                    tenpaiProb: 35,
                    handArchetype: '平胡在听'
                },
                {
                    seatId: 3,
                    name: '上家 (北)',
                    wind: '北',
                    queSuit: 'tong',
                    swapClue: '出【筒】入【万】',
                    melds: [],
                    discards: [
                        { suit: 'tong', val: 1 }, { suit: 'tong', val: 4 }, { suit: 'tong', val: 5 },
                        { suit: 'wan', val: 1 }, { suit: 'tiao', val: 1 }
                    ],
                    tenpaiProb: 40,
                    handArchetype: '一般向听'
                }
            ]
        },
        lessonPoints: [
            '**清一色避炮原则**：当对手有3副以上同色副露且舍牌高度纯净时，听牌率超过95%，点炮损失呈几何级倍增（8-16倍基准分）。',
            '**拆牌保命**：你手中的【六条】是全场仅见0张的死门绝张生张，点炮概率极高；而【五万】或已现熟张是全场绝对安全牌。',
            '**向听倒退的智慧**：为了规避致死大炮，主动打出熟张安全牌、拆散自己的一向听，是高段位选手与普通玩家的分水岭。'
        ]
    },
    {
        id: 'scenario_suji_reading',
        title: '【读牌精要】筋牌（Suji）与壁牌（Kabe）的安全度拆解',
        subtitle: '看穿牌河中的结构盲区，精准找寻安全出牌通路',
        description: '对家（西）已经门清听牌（变步手切多张中张）。全场剩余牌不多，你需要打出一张牌保证不点炮。西家牌河中打过【四万】和【六条】，你手中有【一万】、【七万】、【九条】。哪张牌是真正的真筋绝对安全，哪张是暗藏杀机的半筋假象？',
        initialState: {
            currentTurnCount: 9,
            mySeat: 0,
            dealer: 0,
            wallCount: 22,
            myHand: [
                { suit: 'wan', val: 1 }, { suit: 'wan', val: 7 }, { suit: 'tiao', val: 9 },
                { suit: 'tong', val: 2 }, { suit: 'tong', val: 3 }, { suit: 'tong', val: 4 },
                { suit: 'tong', val: 6 }, { suit: 'tong', val: 7 }, { suit: 'tong', val: 8 },
                { suit: 'tiao', val: 4 }, { suit: 'tiao', val: 5 }, { suit: 'tiao', val: 6 },
                { suit: 'tong', val: 5 }, { suit: 'tong', val: 5 }
            ],
            myMelds: [],
            myQue: 'wan',
            opponents: [
                {
                    seatId: 2,
                    name: '对家 (西)',
                    wind: '西',
                    queSuit: 'tong',
                    swapClue: '出【筒】入【条】',
                    melds: [],
                    discards: [
                        { suit: 'tong', val: 1 }, { suit: 'tong', val: 2 }, { suit: 'tong', val: 9 },
                        { suit: 'wan', val: 4 }, { suit: 'tiao', val: 6 }, { suit: 'wan', val: 8 }
                    ],
                    tenpaiProb: 80,
                    handArchetype: '门清好型听牌'
                }
            ]
        },
        lessonPoints: [
            '**真筋 vs 半筋**：西家打过【四万】，则【一万】是真筋（西家若听两面 2-3万，打4万即自断1-4两面），安全系数极高；而【七万】只是半筋，如果西家持有 5-6万，仍会单听 4-7万！',
            '**6-9 筋线解析**：西家打过【六条】，【九条】同样具备 6-9 筋牌保护（破两面 7-8条），且靠近幺九位，安全性明显优于半筋【七万】。',
            '**定缺校验**：切记优先检查对手定缺门，如果是对手定缺门内的牌，无需算筋，100% 免疫点炮！'
        ]
    }
];

if (typeof module !== 'undefined') {
    module.exports = TACTICAL_SCENARIOS;
}
