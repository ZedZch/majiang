/**
 * 雀圣兵法 · 主应用程序与对局状态驱动器
 * 负责：牌局发牌、换三张、定缺、摸打出牌流转、血战到底规则裁决、UI动态渲染
 */

class MahjongApp {
    constructor() {
        this.deck = [];
        this.wall = [];
        this.players = [];
        this.currentTurn = 0;
        this.dealer = 0;
        this.phase = GAME_PHASES.IDLE;
        this.swapDirection = SWAP_DIRECTIONS.CLOCKWISE;
        this.selectedSwapTiles = [];
        this.selectedDiscardTile = null;
        this.visibleCounts = new Array(27).fill(0);
        this.currentTurnCount = 1;
        this.autoPlayAI = true;
        this.aiThinkingDelay = 800; // 拟真思考延时
        this.pendingReaction = null; // 待处理的吃碰杠胡响应
        this.showDangerOverlay = true; // 是否在手牌上显示危险度标签

        // 初始化绑定
        this.initDOM();
        this.initEvents();
    }

    initDOM() {
        this.dom = {
            wallCount: document.getElementById('wall-count'),
            turnIndicator: document.getElementById('turn-indicator'),
            currentPhaseText: document.getElementById('current-phase-text'),
            myHandRow: document.getElementById('my-hand-tiles'),
            myDrawSlot: document.getElementById('my-draw-tile'),
            myMelds: document.getElementById('my-melds'),
            actionBar: document.getElementById('action-bar'),
            btnDiscard: document.getElementById('btn-discard'),
            btnDeepThinking: document.getElementById('btn-deep-thinking'),
            btnTileMatrix: document.getElementById('btn-tile-matrix'),
            btnScenarios: document.getElementById('btn-scenarios'),
            btnRestart: document.getElementById('btn-restart'),
            // 模态弹窗
            thinkingModal: document.getElementById('thinking-modal'),
            matrixModal: document.getElementById('matrix-modal'),
            scenariosModal: document.getElementById('scenarios-modal'),
            swapModal: document.getElementById('swap-modal'),
            dingqueModal: document.getElementById('dingque-modal'),
            bannerToast: document.getElementById('banner-toast')
        };
    }

    initEvents() {
        this.dom.btnRestart.addEventListener('click', () => this.startNewGame());
        this.dom.btnDeepThinking.addEventListener('click', () => this.openDeepThinkingModal());
        this.dom.btnTileMatrix.addEventListener('click', () => this.openTileMatrixModal());
        this.dom.btnScenarios.addEventListener('click', () => this.openScenariosModal());
        this.dom.btnDiscard.addEventListener('click', () => this.executePlayerDiscard());

        // 关闭模态弹窗统一委托
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.classList.remove('active');
            });
        });

        // 战术推演选项卡切换
        document.querySelectorAll('.thinking-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.thinking-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content-panel').forEach(p => p.style.display = 'none');
                btn.classList.add('active');
                const targetId = btn.getAttribute('data-target');
                const targetPanel = document.getElementById(targetId);
                if (targetPanel) targetPanel.style.display = 'block';
            });
        });

        // 定缺按钮点击委托
        document.querySelectorAll('.dingque-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const suit = btn.getAttribute('data-suit');
                this.executePlayerDingque(suit);
            });
        });

        // 换三张确认与推荐按钮
        const btnConfirmSwap = document.getElementById('btn-confirm-swap');
        if (btnConfirmSwap) {
            btnConfirmSwap.addEventListener('click', () => this.executeSwapPhase());
        }
        const btnUseAISwap = document.getElementById('btn-use-ai-swap');
        if (btnUseAISwap) {
            btnUseAISwap.addEventListener('click', () => {
                const totalHand = this.players[0].drawTile ? [...this.players[0].hand, this.players[0].drawTile] : this.players[0].hand;
                this.selectedSwapTiles = [...AIPlayerController.chooseSwapTiles(totalHand)];
                soundEngine.playSelect();
                this.renderSwapHandSelector();
                this.renderSwapPickArea();
            });
        }
    }

    /**
     * 开启新对局
     */
    startNewGame() {
        soundEngine.init();
        this.deck = createFullTileDeck();
        // 洗牌 (Fisher-Yates)
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }

        this.wall = [...this.deck];
        this.currentTurn = 0;
        this.dealer = 0; // 自家起庄
        this.currentTurnCount = 1;
        this.visibleCounts.fill(0);
        this.selectedSwapTiles = [];
        this.selectedDiscardTile = null;

        // 初始化4位玩家状态
        this.players = SEATS.map(seat => ({
            id: seat.id,
            name: seat.name,
            wind: seat.wind,
            role: seat.role,
            hand: [],
            drawTile: null,
            melds: [],
            discards: [],
            queSuit: null,
            isHu: false,
            swapOutTiles: [],
            swapInTiles: [],
            swapOutSuit: null,
            swapInSuit: null,
            score: 1000
        }));

        // 发牌：每人发 13 张牌，庄家多摸第 14 张
        for (let i = 0; i < 4; i++) {
            this.players[i].hand = this.wall.splice(0, 13);
        }
        this.players[this.dealer].drawTile = this.wall.shift();

        // 规范整理手牌
        for (let i = 0; i < 4; i++) {
            this.players[i].hand = MahjongLogic.sortTiles(this.players[i].hand);
        }

        // 更新全局已见牌 (自家看到自己的手牌和摸牌)
        this.updateVisibleCounts();

        this.phase = GAME_PHASES.SWAP_SELECT;
        this.renderAll();
        soundEngine.playDraw();

        // 弹出换三张选择指引
        this.showSwapSelectModal();
    }

    /**
     * 刷新全场可见牌统计 (包括自家手牌、所有牌河弃牌、所有副露明牌)
     */
    updateVisibleCounts() {
        this.visibleCounts.fill(0);

        // 自家手牌和摸牌计入自家视角
        const myHand = this.players[0].hand;
        for (const t of myHand) {
            this.visibleCounts[MahjongLogic.tileToIndex(t)]++;
        }
        if (this.players[0].drawTile) {
            this.visibleCounts[MahjongLogic.tileToIndex(this.players[0].drawTile)]++;
        }

        // 所有玩家的已出牌河
        for (const p of this.players) {
            for (const t of p.discards) {
                this.visibleCounts[MahjongLogic.tileToIndex(t)]++;
            }
            // 所有副露
            for (const m of p.melds) {
                for (const t of m.tiles) {
                    this.visibleCounts[MahjongLogic.tileToIndex(t)]++;
                }
            }
        }
    }

    /**
     * 阶段 1：弹出换三张选择弹窗
     */
    showSwapSelectModal() {
        const modal = this.dom.swapModal;
        const myHand = this.players[0].hand;
        const totalHand = this.players[0].drawTile ? [...myHand, this.players[0].drawTile] : myHand;

        // 计算 AI 推荐换出的花色与3张牌
        const recommendedTiles = AIPlayerController.chooseSwapTiles(totalHand);
        const recSuitName = SUIT_NAMES[recommendedTiles[0].suit];

        const recTip = document.getElementById('swap-recommend-tip');
        if (recTip) {
            recTip.innerHTML = `💡 <strong>AI 大师推荐</strong>：建议换出 3 张【${recSuitName}】(${recommendedTiles.map(t => formatTile(t)).join('、')})。<br>
            <em>战术推演理由</em>：该门牌数较少且搭子价值低，换出杂色能极大净化手牌，迅速做大另一门的清一色或保留快速好型。`;
        }

        // 默认将 AI 推荐的 3 张选中
        this.selectedSwapTiles = [...recommendedTiles];
        this.renderSwapHandSelector();
        this.renderSwapPickArea();
        modal.classList.add('active');
    }

    renderSwapHandSelector() {
        const selectorArea = document.getElementById('swap-hand-selector');
        if (!selectorArea) return;
        selectorArea.innerHTML = '';

        const myHand = this.players[0].hand;
        const totalHand = this.players[0].drawTile ? [...myHand, this.players[0].drawTile] : myHand;

        // 按花色分类
        const suits = { wan: [], tiao: [], tong: [] };
        totalHand.forEach(t => suits[t.suit].push(t));

        SUIT_KEYS.forEach(s => {
            const list = suits[s];
            if (list.length === 0) return;

            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';

            const suitLabel = document.createElement('span');
            suitLabel.style.width = '64px';
            suitLabel.style.fontSize = '12px';
            suitLabel.style.fontWeight = 'bold';
            suitLabel.style.color = SUITS[s.toUpperCase()].color;
            suitLabel.innerText = `${SUIT_NAMES[s]} (${list.length}张):`;
            row.appendChild(suitLabel);

            const tilesRow = document.createElement('div');
            tilesRow.style.display = 'flex';
            tilesRow.style.gap = '4px';

            list.forEach(tile => {
                const isSelected = this.selectedSwapTiles.some(t => t.uid === tile.uid);
                const tileEl = this.createTileElement(tile, {
                    interactive: true,
                    isSelected,
                    size: 'tile-sm'
                });
                tileEl.addEventListener('click', () => {
                    this.toggleSwapTileSelection(tile);
                    this.renderSwapHandSelector();
                });
                tilesRow.appendChild(tileEl);
            });

            row.appendChild(tilesRow);
            selectorArea.appendChild(row);
        });
    }

    renderSwapPickArea() {
        const area = document.getElementById('swap-picked-tiles');
        if (!area) return;
        area.innerHTML = '';
        this.selectedSwapTiles.forEach(tile => {
            const tileEl = this.createTileElement(tile, { interactive: false });
            area.appendChild(tileEl);
        });

        const btnConfirm = document.getElementById('btn-confirm-swap');
        if (btnConfirm) {
            btnConfirm.disabled = this.selectedSwapTiles.length !== 3;
        }
    }

    /**
     * 执行换三张流转逻辑
     */
    executeSwapPhase() {
        soundEngine.playSelect();
        this.dom.swapModal.classList.remove('active');

        // 自家换出牌
        const myTiles = this.selectedSwapTiles;
        const myPlayer = this.players[0];
        myPlayer.swapOutTiles = myTiles;
        myPlayer.swapOutSuit = myTiles[0].suit;

        // 从自家手牌移除换出的 3 张牌
        const combinedHand = myPlayer.drawTile ? [...myPlayer.hand, myPlayer.drawTile] : [...myPlayer.hand];
        for (const t of myTiles) {
            const idx = combinedHand.findIndex(x => x.uid === t.uid);
            if (idx !== -1) combinedHand.splice(idx, 1);
        }
        myPlayer.hand = combinedHand;
        myPlayer.drawTile = null;

        // 3 位 AI 玩家也各自选出 3 张
        for (let i = 1; i <= 3; i++) {
            const aiHand = this.players[i].hand;
            const chosen = AIPlayerController.chooseSwapTiles(aiHand);
            this.players[i].swapOutTiles = chosen;
            this.players[i].swapOutSuit = chosen[0].suit;

            // 从 AI 手牌移除
            for (const t of chosen) {
                const idx = aiHand.findIndex(x => x.uid === t.uid);
                if (idx !== -1) aiHand.splice(idx, 1);
            }
        }

        // 顺时针交换 (0 -> 1 -> 2 -> 3 -> 0)
        // 0 收到 3 的牌, 1 收到 0 的牌, 2 收到 1 的牌, 3 收到 2 的牌
        this.players[0].swapInTiles = this.players[3].swapOutTiles;
        this.players[1].swapInTiles = this.players[0].swapOutTiles;
        this.players[2].swapInTiles = this.players[1].swapOutTiles;
        this.players[3].swapInTiles = this.players[2].swapOutTiles;

        for (let i = 0; i < 4; i++) {
            this.players[i].swapInSuit = this.players[i].swapInTiles[0].suit;
            this.players[i].hand.push(...this.players[i].swapInTiles);
            this.players[i].hand = MahjongLogic.sortTiles(this.players[i].hand);
        }

        this.updateVisibleCounts();
        this.renderAll();

        this.showToast(`换三张完成！你换出【${SUIT_NAMES[myPlayer.swapOutSuit]}】，收到上家换来的【${SUIT_NAMES[myPlayer.swapInSuit]}】× 3`);

        // 进入定缺阶段
        setTimeout(() => {
            this.showDingqueModal();
        }, 1200);
    }

    /**
     * 阶段 2：定缺选择
     */
    showDingqueModal() {
        this.phase = GAME_PHASES.DINGQUE_SELECT;
        const myHand = this.players[0].hand;

        // AI 推荐定缺
        const recSuit = AIPlayerController.chooseDingque(myHand);
        const recName = SUIT_NAMES[recSuit];

        const tip = document.getElementById('dingque-recommend-tip');
        if (tip) {
            tip.innerHTML = `💡 **AI 定缺建议**：推荐定缺【${recName}门】。<br>
            *推演依据*：手牌中【${recName}】仅有 ${myHand.filter(t => t.suit === recSuit).length} 张，且缺乏优质连张搭子，定缺此门能迅速清空，让另外两门主战花色全力爆发。`;
        }

        document.querySelectorAll('.dingque-btn').forEach(btn => {
            btn.classList.remove('ai-picked');
            if (btn.getAttribute('data-suit') === recSuit) {
                btn.classList.add('ai-picked');
            }
        });

        this.dom.dingqueModal.classList.add('active');
    }

    executePlayerDingque(chosenSuit) {
        soundEngine.playSelect();
        this.dom.dingqueModal.classList.remove('active');
        this.players[0].queSuit = chosenSuit;

        // AI 玩家自动定缺
        for (let i = 1; i <= 3; i++) {
            this.players[i].queSuit = AIPlayerController.chooseDingque(this.players[i].hand);
        }

        this.phase = GAME_PHASES.PLAYING;
        this.showToast(`定缺完毕！自家定缺【${SUIT_NAMES[chosenSuit]}】`);

        // 庄家起手补摸第 14 张牌
        if (this.dealer === 0) {
            this.players[0].drawTile = this.wall.shift();
            soundEngine.playDraw();
        }

        this.updateVisibleCounts();
        this.renderAll();

        // 检查庄家是否能胡或出牌
        if (this.dealer === 0) {
            this.handlePlayerTurn();
        } else {
            this.handleAITurn(this.dealer);
        }
    }

    /**
     * 阶段 3：玩家摸打出牌回合
     */
    handlePlayerTurn() {
        this.currentTurn = 0;
        this.renderAll();

        const myHand = this.players[0].hand;
        const drawTile = this.players[0].drawTile;
        const totalHand = drawTile ? [...myHand, drawTile] : myHand;

        // 检查自摸胡
        if (MahjongLogic.checkHu(totalHand, this.players[0].melds, this.players[0].queSuit)) {
            const fanInfo = MahjongLogic.evaluateHandFans(totalHand, this.players[0].melds, this.players[0].queSuit, drawTile, true);
            this.showActionOption({
                type: 'HU',
                text: `自摸胡 (${fanInfo.totalFan}番)`,
                action: () => this.executePlayerHu()
            });
        }

        // 检查暗杠与弯杠 (补杠)
        this.checkSelfGang(totalHand);

        // 高亮出牌候选
        this.dom.btnDiscard.style.display = 'inline-flex';
    }

    checkSelfGang(tiles) {
        const counts = MahjongLogic.tilesToCountArray(tiles);
        for (let i = 0; i < 27; i++) {
            if (counts[i] === 4) {
                const gangTile = MahjongLogic.indexToTile(i);
                if (gangTile.suit !== this.players[0].queSuit) {
                    this.showActionOption({
                        type: 'GANG',
                        text: `暗杠【${formatTile(gangTile)}】`,
                        action: () => this.executePlayerAnGang(gangTile)
                    });
                }
            }
        }
    }

    /**
     * 玩家选择某张牌并打出
     */
    executePlayerDiscard() {
        if (this.currentTurn !== 0) return;
        if (!this.selectedDiscardTile) {
            this.showToast('请先点击手牌选中想要打出的牌！');
            return;
        }

        const tileToDiscard = this.selectedDiscardTile;
        const myPlayer = this.players[0];
        const allTiles = myPlayer.drawTile ? [...myPlayer.hand, myPlayer.drawTile] : [...myPlayer.hand];

        // 规则约束校验：如果有定缺门牌，强制只能打定缺门！
        const queTiles = MahjongLogic.getQueTiles(allTiles, myPlayer.queSuit);
        if (queTiles.length > 0 && tileToDiscard.suit !== myPlayer.queSuit) {
            this.showToast(`定缺门【${SUIT_NAMES[myPlayer.queSuit]}】尚未出完，按规则不可打出其他花色！`);
            return;
        }

        // 移除该牌
        if (myPlayer.drawTile && myPlayer.drawTile.uid === tileToDiscard.uid) {
            myPlayer.drawTile = null;
        } else {
            const idx = myPlayer.hand.findIndex(t => t.uid === tileToDiscard.uid);
            if (idx !== -1) myPlayer.hand.splice(idx, 1);
            if (myPlayer.drawTile) {
                myPlayer.hand.push(myPlayer.drawTile);
                myPlayer.drawTile = null;
            }
        }

        myPlayer.hand = MahjongLogic.sortTiles(myPlayer.hand);
        myPlayer.discards.push(tileToDiscard);
        this.selectedDiscardTile = null;
        soundEngine.playDiscard();

        this.updateVisibleCounts();
        this.renderAll();

        // 触发全场对该打出牌的反应 (下家、对家、上家 是否吃碰杠胡)
        this.processDiscardReactions(0, tileToDiscard);
    }

    /**
     * 处理打出牌后的全场响应（胡、杠、碰）
     */
    processDiscardReactions(discarderSeat, tile) {
        // 顺时针顺序检查其余3位玩家反应
        for (let step = 1; step <= 3; step++) {
            const seat = (discarderSeat + step) % 4;
            const p = this.players[seat];
            if (p.isHu) continue;

            const reaction = AIPlayerController.checkReactionToDiscard(p, tile, discarderSeat, this.getGameState());
            if (reaction) {
                if (reaction.action === 'HU') {
                    // AI 点炮和牌
                    this.executeAIHu(seat, tile, discarderSeat, reaction.fanInfo);
                    return;
                } else if (reaction.action === 'GANG') {
                    this.executeAIGang(seat, tile, discarderSeat);
                    return;
                } else if (reaction.action === 'PENG') {
                    this.executeAIPeng(seat, tile, discarderSeat);
                    return;
                }
            }
        }

        // 检查玩家自己是否能对 AI 的弃牌做出反应
        if (discarderSeat !== 0 && !this.players[0].isHu) {
            const myReactions = this.checkMyReactionToDiscard(tile, discarderSeat);
            if (myReactions.length > 0) {
                this.promptPlayerReactions(myReactions, discarderSeat, tile);
                return;
            }
        }

        // 无人碰杠胡，流转到下一位摸牌
        this.advanceToNextTurn(discarderSeat);
    }

    /**
     * 检查自家对别人出的牌的响应
     */
    checkMyReactionToDiscard(tile, fromSeat) {
        if (tile.suit === this.players[0].queSuit) return [];
        const actions = [];
        const myHand = this.players[0].hand;

        // 1. 检查能否胡 (点炮和)
        const testHand = [...myHand, tile];
        if (MahjongLogic.checkHu(testHand, this.players[0].melds, this.players[0].queSuit)) {
            const fanInfo = MahjongLogic.evaluateHandFans(testHand, this.players[0].melds, this.players[0].queSuit, tile, false);
            actions.push({
                action: 'HU',
                label: `胡牌 (${fanInfo.totalFan}番)`,
                tile,
                fromSeat,
                fanInfo
            });
        }

        // 2. 检查能否直杠
        const matchCount = myHand.filter(t => t.suit === tile.suit && t.val === tile.val).length;
        if (matchCount === 3) {
            actions.push({
                action: 'GANG',
                label: `直杠【${formatTile(tile)}】`,
                tile,
                fromSeat
            });
        }

        // 3. 检查能否碰
        if (matchCount >= 2) {
            actions.push({
                action: 'PENG',
                label: `碰【${formatTile(tile)}】`,
                tile,
                fromSeat
            });
        }

        return actions;
    }

    promptPlayerReactions(reactions, discarderSeat, tile) {
        this.clearActionOptions();
        reactions.forEach(r => {
            if (r.action === 'HU') {
                this.showActionOption({
                    type: 'HU',
                    text: r.label,
                    action: () => this.executePlayerDianPaoHu(tile, discarderSeat, r.fanInfo)
                });
            } else if (r.action === 'GANG') {
                this.showActionOption({
                    type: 'GANG',
                    text: r.label,
                    action: () => this.executePlayerZhiGang(tile, discarderSeat)
                });
            } else if (r.action === 'PENG') {
                this.showActionOption({
                    type: 'PENG',
                    text: r.label,
                    action: () => this.executePlayerPeng(tile, discarderSeat)
                });
            }
        });

        // 永远提供“过”选项
        this.showActionOption({
            type: 'PASS',
            text: '过',
            action: () => {
                this.clearActionOptions();
                this.advanceToNextTurn(discarderSeat);
            }
        });
    }

    executePlayerPeng(tile, fromSeat) {
        soundEngine.playPeng();
        this.clearActionOptions();
        const myPlayer = this.players[0];

        // 移除手牌中2张对应的牌
        let removed = 0;
        const newHand = [];
        const meldCards = [tile];

        for (const t of myPlayer.hand) {
            if (t.suit === tile.suit && t.val === tile.val && removed < 2) {
                meldCards.push(t);
                removed++;
            } else {
                newHand.push(t);
            }
        }

        myPlayer.hand = newHand;
        myPlayer.melds.push({ type: 'PENG', tiles: meldCards });
        this.currentTurn = 0;

        this.updateVisibleCounts();
        this.renderAll();
        this.showToast('碰牌成功！请选择打出一张牌。');
    }

    executePlayerZhiGang(tile, fromSeat) {
        soundEngine.playGang();
        this.clearActionOptions();
        const myPlayer = this.players[0];

        const meldCards = [tile];
        myPlayer.hand = myPlayer.hand.filter(t => {
            if (t.suit === tile.suit && t.val === tile.val) {
                meldCards.push(t);
                return false;
            }
            return true;
        });

        myPlayer.melds.push({ type: 'GANG', tiles: meldCards });
        this.showToast('杠牌成功！开杠补摸一张牌。');

        // 开杠补摸一张牌
        if (this.wall.length > 0) {
            myPlayer.drawTile = this.wall.shift();
            soundEngine.playDraw();
        }

        this.currentTurn = 0;
        this.updateVisibleCounts();
        this.renderAll();
        this.handlePlayerTurn();
    }

    executePlayerHu() {
        soundEngine.playHu();
        this.clearActionOptions();
        const myPlayer = this.players[0];
        myPlayer.isHu = true;
        this.showToast('🎉 自摸胡牌大满贯！血战到底继续角逐！');
        this.renderAll();
        this.checkBloodBattleRoundEnd();
    }

    executePlayerDianPaoHu(tile, fromSeat, fanInfo) {
        soundEngine.playHu();
        this.clearActionOptions();
        const myPlayer = this.players[0];
        myPlayer.hand.push(tile);
        myPlayer.hand = MahjongLogic.sortTiles(myPlayer.hand);
        myPlayer.isHu = true;
        this.showToast(`🎉 点炮胡牌！赢取 ${this.players[fromSeat].name} ${fanInfo.totalFan} 番大奖！`);
        this.renderAll();
        this.checkBloodBattleRoundEnd();
    }

    executeAIPeng(seat, tile, discarderSeat) {
        soundEngine.playPeng();
        const p = this.players[seat];
        let removed = 0;
        const meldCards = [tile];
        p.hand = p.hand.filter(t => {
            if (t.suit === tile.suit && t.val === tile.val && removed < 2) {
                meldCards.push(t);
                removed++;
                return false;
            }
            return true;
        });
        p.melds.push({ type: 'PENG', tiles: meldCards });

        this.updateVisibleCounts();
        this.renderAll();
        this.showToast(`${p.name} 碰了【${formatTile(tile)}】！`);

        setTimeout(() => {
            this.handleAIDiscard(seat);
        }, this.aiThinkingDelay);
    }

    executeAIGang(seat, tile, discarderSeat) {
        soundEngine.playGang();
        const p = this.players[seat];
        const meldCards = [tile];
        p.hand = p.hand.filter(t => {
            if (t.suit === tile.suit && t.val === tile.val) {
                meldCards.push(t);
                return false;
            }
            return true;
        });
        p.melds.push({ type: 'GANG', tiles: meldCards });
        this.showToast(`${p.name} 直杠了【${formatTile(tile)}】！补摸一张。`);

        if (this.wall.length > 0) {
            p.drawTile = this.wall.shift();
        }

        this.updateVisibleCounts();
        this.renderAll();

        setTimeout(() => {
            this.handleAIDiscard(seat);
        }, this.aiThinkingDelay);
    }

    executeAIHu(seat, tile, discarderSeat, fanInfo) {
        soundEngine.playHu();
        const p = this.players[seat];
        p.hand.push(tile);
        p.hand = MahjongLogic.sortTiles(p.hand);
        p.isHu = true;

        this.showToast(`🔔 ${p.name} 胡牌了！${this.players[discarderSeat].name} 点炮！(${fanInfo.totalFan}番)`);
        this.renderAll();

        setTimeout(() => {
            this.checkBloodBattleRoundEnd();
            if (this.phase === GAME_PHASES.PLAYING) {
                this.advanceToNextTurn(discarderSeat);
            }
        }, 1200);
    }

    /**
     * 流转摸牌权到下一位未胡牌的选手
     */
    advanceToNextTurn(lastSeat) {
        if (this.wall.length === 0) {
            this.handleWallExhaustedEnd();
            return;
        }

        let nextSeat = (lastSeat + 1) % 4;
        let loopCount = 0;
        while (this.players[nextSeat].isHu && loopCount < 4) {
            nextSeat = (nextSeat + 1) % 4;
            loopCount++;
        }

        if (loopCount >= 4) {
            this.handleAllHuEnd();
            return;
        }

        this.currentTurn = nextSeat;
        this.currentTurnCount++;

        // 摸牌
        const activeP = this.players[nextSeat];
        activeP.drawTile = this.wall.shift();
        soundEngine.playDraw();

        this.updateVisibleCounts();
        this.renderAll();

        if (nextSeat === 0) {
            this.handlePlayerTurn();
        } else {
            this.handleAITurn(nextSeat);
        }
    }

    handleAITurn(seat) {
        const p = this.players[seat];
        const allTiles = [...p.hand, p.drawTile];

        // 检查 AI 是否自摸胡
        if (MahjongLogic.checkHu(allTiles, p.melds, p.queSuit)) {
            soundEngine.playHu();
            p.isHu = true;
            this.showToast(`🔔 ${p.name} 自摸胡牌！`);
            this.renderAll();
            setTimeout(() => {
                this.checkBloodBattleRoundEnd();
                if (this.phase === GAME_PHASES.PLAYING) {
                    this.advanceToNextTurn(seat);
                }
            }, 1200);
            return;
        }

        // 拟真思考延时后打出牌
        setTimeout(() => {
            this.handleAIDiscard(seat);
        }, this.aiThinkingDelay);
    }

    handleAIDiscard(seat) {
        const p = this.players[seat];
        if (p.drawTile) {
            p.hand.push(p.drawTile);
            p.drawTile = null;
        }

        const tileToDiscard = AIPlayerController.chooseDiscard(p, this.getGameState());
        const cutIdx = p.hand.findIndex(t => t.uid === tileToDiscard.uid);
        if (cutIdx !== -1) p.hand.splice(cutIdx, 1);
        p.hand = MahjongLogic.sortTiles(p.hand);
        p.discards.push(tileToDiscard);
        soundEngine.playDiscard();

        this.updateVisibleCounts();
        this.renderAll();

        this.processDiscardReactions(seat, tileToDiscard);
    }

    /**
     * 血战到底局势裁决：若3家已胡牌，局终；牌山耗尽，查花猪查叫
     */
    checkBloodBattleRoundEnd() {
        const huCount = this.players.filter(p => p.isHu).length;
        if (huCount >= 3) {
            this.phase = GAME_PHASES.ROUND_END;
            this.showToast('🏆 3家均已胡牌，本局血战到底圆满结束！');
            this.renderAll();
        }
    }

    handleWallExhaustedEnd() {
        this.phase = GAME_PHASES.ROUND_END;
        this.showToast('牌山已耗尽（黄庄流局）！开始查大叫与查花猪结算...');
        this.renderAll();
    }

    handleAllHuEnd() {
        this.phase = GAME_PHASES.ROUND_END;
        this.showToast('局终结算！');
        this.renderAll();
    }

    /**
     * 获取全局当前状态镜像（用于 AI 深度推演）
     */
    getGameState() {
        return {
            mySeat: 0,
            players: this.players,
            visibleCounts: this.visibleCounts,
            currentTurnCount: this.currentTurnCount,
            wallCount: this.wall.length
        };
    }

    /**
     * 核心亮点功能：打开战术深度推演抽屉（AI 思考过程展示）
     */
    openDeepThinkingModal() {
        soundEngine.playSelect();
        const gameState = this.getGameState();
        const report = AIAnalyzer.generateDeepThinkingReport(gameState);

        // 渲染推荐置顶大卡片
        const best = report.bestChoice;
        const bannerContainer = document.getElementById('thinking-recommend-banner');
        if (bannerContainer) {
            bannerContainer.innerHTML = `
                <div class="banner-tile-wrap">
                    ${this.createTileElement(best.tile, { interactive: false }).outerHTML}
                    <span style="font-size: 11px; color: #f1c40f; font-weight: bold;">推荐切牌</span>
                </div>
                <div class="banner-info">
                    <div class="banner-action-title">
                        首选切出【${formatTile(best.tile)}】 —— 综合 EV 期望评分：<span style="color:#f1c40f;">${best.netEV}分</span>
                    </div>
                    <div class="banner-action-desc">
                        打出后向听：<strong>${best.shanten === 0 ? '已入听 (0向听)' : `${best.shanten}向听`}</strong> | 
                        有效进张数：<strong>${best.effectiveCount} 张</strong> | 
                        危险度估算：<span style="color:${best.dangerInfo.badgeColor}; font-weight:bold;">${best.dangerInfo.score}% (${best.dangerInfo.levelText})</span>
                        <br><span style="color: #94a3b8; font-size: 12px;">防守透视：${best.dangerInfo.primaryReason}</span>
                    </div>
                </div>
            `;
        }

        // 渲染 4 步深度逻辑推演流
        const flowContainer = document.getElementById('thinking-flow-steps');
        if (flowContainer) {
            flowContainer.innerHTML = '';
            report.reasoningSteps.forEach(s => {
                const stepCard = document.createElement('div');
                stepCard.className = `reasoning-step-card step-${s.step}`;
                stepCard.innerHTML = `
                    <div class="step-card-header">
                        <span class="step-title">${s.title}</span>
                        <span class="step-tag">${s.tag}</span>
                    </div>
                    <div class="step-content">${s.content.replace(/\n/g, '<br>')}</div>
                `;
                flowContainer.appendChild(stepCard);
            });
        }

        // 渲染候选切牌横向对比表格
        const compTbody = document.getElementById('comp-table-tbody');
        if (compTbody) {
            compTbody.innerHTML = '';
            report.rankedOptions.forEach(opt => {
                const tr = document.createElement('tr');
                const effList = opt.effectiveTiles.map(e => `${formatTile(e.tile)}(${e.count}张)`).join(', ');
                tr.innerHTML = `
                    <td><strong>${formatTile(opt.tile)}</strong></td>
                    <td>${opt.shanten === 0 ? '<span style="color:#2ecc71;font-weight:bold;">听牌</span>' : `${opt.shanten}向听`}</td>
                    <td><strong>${opt.effectiveCount}张</strong> <span style="font-size:11px;color:#94a3b8;">(${effList || '无'})</span></td>
                    <td><span style="color:${opt.dangerInfo.badgeColor};font-weight:bold;">${opt.dangerInfo.score}% (${opt.dangerInfo.levelText})</span></td>
                    <td><strong style="color:#f1c40f;">${opt.netEV}</strong></td>
                    <td style="font-size:11px;color:#cbd5e1;">${opt.dangerInfo.primaryReason}</td>
                `;
                compTbody.appendChild(tr);
            });
        }

        // 渲染对手情报侦测卡网格
        const intelGrid = document.getElementById('opponents-intel-grid');
        if (intelGrid) {
            intelGrid.innerHTML = '';
            report.opponentProfiles.forEach(op => {
                const card = document.createElement('div');
                card.className = 'intel-card';
                if (op.isHu) {
                    card.innerHTML = `
                        <div class="intel-header">
                            <span class="intel-name">${op.name} (${op.wind})</span>
                            <span class="hu-badge">已胡牌</span>
                        </div>
                        <div class="intel-item"><span class="intel-item-label">状态</span><span>离场不参与后续摸打</span></div>
                    `;
                } else {
                    card.innerHTML = `
                        <div class="intel-header">
                            <span class="intel-name">${op.name} (${op.wind})</span>
                            <span class="que-badge ${op.queSuit}">缺${SUIT_NAMES[op.queSuit]}</span>
                        </div>
                        <div class="intel-item"><span class="intel-item-label">换三张线索</span><span>${op.swapClue}</span></div>
                        <div class="intel-item"><span class="intel-item-label">听牌概率估算</span><span style="color:#f1c40f;font-weight:bold;">${op.tenpaiProb}%</span></div>
                        <div class="intel-item"><span class="intel-item-label">牌型预警定性</span><span style="color:#e74c3c;">${op.handArchetype}</span></div>
                        <div class="intel-item"><span class="intel-item-label">威胁级别</span><strong>${op.threatLevel}</strong></div>
                        <div class="intel-item"><span class="intel-item-label">主攻危险门类</span><span style="color:#51cf66;">${op.dangerSuits.map(s => SUIT_NAMES[s]).join('/')}</span></div>
                        <div class="intel-item"><span class="intel-item-label">近期手切弃牌</span><span style="font-size:11px;">${op.recentDiscards}</span></div>
                    `;
                }
                intelGrid.appendChild(card);
            });
        }

        this.dom.thinkingModal.classList.add('active');
    }

    /**
     * 打开全场现牌与牌山透视矩阵
     */
    openTileMatrixModal() {
        soundEngine.playSelect();
        const container = document.getElementById('tile-matrix-container');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < 27; i++) {
            const tile = MahjongLogic.indexToTile(i);
            const seen = this.visibleCounts[i];
            const remain = Math.max(0, 4 - seen);

            const cell = document.createElement('div');
            cell.className = 'matrix-cell';
            const tileEl = this.createTileElement(tile, { interactive: false, size: 'tile-xs' });

            let countClass = remain === 0 ? 'zero' : (remain <= 1 ? 'low' : 'high');

            cell.appendChild(tileEl);
            const lbl = document.createElement('span');
            lbl.className = `matrix-cell-count ${countClass}`;
            lbl.innerText = `余${remain}张 (现${seen})`;
            cell.appendChild(lbl);

            container.appendChild(cell);
        }

        this.dom.matrixModal.classList.add('active');
    }

    /**
     * 打开经典战术残局训练题库
     */
    openScenariosModal() {
        soundEngine.playSelect();
        const container = document.getElementById('scenarios-list-container');
        if (!container) return;
        container.innerHTML = '';

        TACTICAL_SCENARIOS.forEach(sc => {
            const card = document.createElement('div');
            card.className = 'reasoning-step-card';
            card.style.cursor = 'pointer';
            card.style.marginBottom = '12px';
            card.innerHTML = `
                <div class="step-card-header">
                    <span class="step-title" style="color:#2ecc71;">${sc.title}</span>
                    <button class="btn btn-primary btn-load-scenario" data-id="${sc.id}">加载该残局实战推演</button>
                </div>
                <p style="font-size:12px;color:#cbd5e1;margin:6px 0;">${sc.description}</p>
                <div style="font-size:11px;color:#f39c12;border-top:1px dashed rgba(255,255,255,0.1);padding-top:4px;">
                    🎯 雀理核心：${sc.lessonPoints[0]}
                </div>
            `;
            container.appendChild(card);
        });

        // 绑定加载残局事件
        container.querySelectorAll('.btn-load-scenario').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const scId = btn.getAttribute('data-id');
                this.loadScenario(scId);
            });
        });

        this.dom.scenariosModal.classList.add('active');
    }

    loadScenario(scenarioId) {
        const sc = TACTICAL_SCENARIOS.find(s => s.id === scenarioId);
        if (!sc) return;

        this.dom.scenariosModal.classList.remove('active');
        const st = sc.initialState;

        // 构造残局数据
        this.currentTurn = 0;
        this.currentTurnCount = st.currentTurnCount;
        this.wall = new Array(st.wallCount).fill(0).map((_, i) => ({ uid: 900 + i, suit: 'wan', val: 1 }));

        this.players = [
            {
                id: 0,
                name: '自家 (我)',
                wind: '东',
                role: 'player',
                hand: st.myHand.slice(0, 13).map((t, idx) => ({ ...t, uid: 100 + idx, code: `${t.val}${t.suit[0]}` })),
                drawTile: { ...st.myHand[13], uid: 199, code: `${st.myHand[13].val}${st.myHand[13].suit[0]}` },
                melds: st.myMelds || [],
                discards: [],
                queSuit: st.myQue,
                isHu: false,
                swapOutSuit: 'tiao',
                swapInSuit: 'wan'
            },
            {
                id: 1,
                name: st.opponents[0] ? st.opponents[0].name : '南家',
                wind: '南',
                role: 'ai',
                hand: new Array(4).fill(0).map((_, i) => ({ uid: 300 + i, suit: 'tiao', val: 5 })),
                drawTile: null,
                melds: st.opponents[0] ? st.opponents[0].melds : [],
                discards: st.opponents[0] ? st.opponents[0].discards.map((t, i) => ({ ...t, uid: 400 + i, code: `${t.val}${t.suit[0]}` })) : [],
                queSuit: st.opponents[0] ? st.opponents[0].queSuit : 'wan',
                isHu: false,
                swapClue: st.opponents[0] ? st.opponents[0].swapClue : ''
            },
            {
                id: 2,
                name: '对家 (西)',
                wind: '西',
                role: 'ai',
                hand: new Array(13).fill(0).map((_, i) => ({ uid: 500 + i, suit: 'tong', val: 1 })),
                drawTile: null,
                melds: [],
                discards: [],
                queSuit: 'tiao',
                isHu: false
            },
            {
                id: 3,
                name: '上家 (北)',
                wind: '北',
                role: 'ai',
                hand: new Array(13).fill(0).map((_, i) => ({ uid: 700 + i, suit: 'wan', val: 1 })),
                drawTile: null,
                melds: [],
                discards: [],
                queSuit: 'tong',
                isHu: false
            }
        ];

        this.phase = GAME_PHASES.PLAYING;
        this.updateVisibleCounts();
        this.renderAll();
        this.showToast(`🎯 已加载【${sc.title}】！点击「💡战术推演」探究大师级拆牌思路！`);

        // 自动弹出思考面板供用户研读
        setTimeout(() => {
            this.openDeepThinkingModal();
        }, 600);
    }

    /**
     * UI 渲染全流程
     */
    renderAll() {
        this.renderHub();
        this.renderOpponents();
        this.renderMySeat();
    }

    renderHub() {
        this.dom.wallCount.innerText = this.wall.length;
        const hubWall = document.getElementById('hub-wall-display');
        if (hubWall) hubWall.innerText = this.wall.length;

        const phaseNames = {
            [GAME_PHASES.IDLE]: '准备就绪',
            [GAME_PHASES.DEALING]: '发牌中',
            [GAME_PHASES.SWAP_SELECT]: '选择换三张',
            [GAME_PHASES.DINGQUE_SELECT]: '选择定缺门',
            [GAME_PHASES.PLAYING]: '摸打对弈中',
            [GAME_PHASES.ROUND_END]: '对局结束'
        };
        this.dom.currentPhaseText.innerText = phaseNames[this.phase] || '对弈中';

        const activePlayer = this.players[this.currentTurn];
        const turnStr = activePlayer ? `${activePlayer.name} 出牌` : '等待中';
        this.dom.turnIndicator.innerText = turnStr;
        const hubStatus = document.getElementById('hub-turn-status');
        if (hubStatus) hubStatus.innerText = activePlayer ? `● ${activePlayer.name}` : '● 进行中';
    }

    renderOpponents() {
        for (let i = 1; i <= 3; i++) {
            const p = this.players[i];
            const seatMap = { 1: 'seat-right', 2: 'seat-top', 3: 'seat-left' };
            const seatEl = document.querySelector(`.${seatMap[i]}`);
            if (!seatEl) continue;

            // 玩家卡片
            const cardEl = seatEl.querySelector('.player-card');
            if (cardEl) {
                if (this.currentTurn === i && this.phase === GAME_PHASES.PLAYING) {
                    cardEl.classList.add('active-turn');
                } else {
                    cardEl.classList.remove('active-turn');
                }

                // 定缺角标
                const queBadge = cardEl.querySelector('.que-badge');
                if (queBadge) {
                    if (p.queSuit) {
                        queBadge.style.display = 'inline-block';
                        queBadge.className = `que-badge ${p.queSuit}`;
                        queBadge.innerText = `缺${SUIT_NAMES[p.queSuit]}`;
                    } else {
                        queBadge.style.display = 'none';
                    }
                }

                // 胡牌角标
                const huBadge = cardEl.querySelector('.hu-badge');
                if (huBadge) {
                    huBadge.style.display = p.isHu ? 'inline-block' : 'none';
                }
            }

            // 牌河弃牌
            const riverEl = seatEl.querySelector('.river-container');
            if (riverEl) {
                riverEl.innerHTML = '';
                p.discards.forEach(tile => {
                    const tileEl = this.createTileElement(tile, { interactive: false, size: 'tile-sm' });
                    riverEl.appendChild(tileEl);
                });
            }

            // 副露
            const meldsEl = seatEl.querySelector('.melds-row');
            if (meldsEl) {
                meldsEl.innerHTML = '';
                p.melds.forEach(m => {
                    const group = document.createElement('div');
                    group.className = 'meld-group';
                    m.tiles.forEach(tile => {
                        group.appendChild(this.createTileElement(tile, { interactive: false, size: 'tile-xs' }));
                    });
                    meldsEl.appendChild(group);
                });
            }

            // 手牌背面（若未胡）
            const handBar = seatEl.querySelector('.opponent-hand-bar');
            if (handBar) {
                handBar.innerHTML = '';
                if (!p.isHu) {
                    const cardCount = p.hand.length + (p.drawTile ? 1 : 0);
                    for (let c = 0; c < cardCount; c++) {
                        const backTile = document.createElement('div');
                        backTile.className = 'mj-tile tile-xs tile-back';
                        handBar.appendChild(backTile);
                    }
                }
            }
        }
    }

    renderMySeat() {
        const myPlayer = this.players[0];
        if (!myPlayer) return;

        // 自家定缺标志
        const myQueBadge = document.getElementById('my-que-badge');
        if (myQueBadge) {
            if (myPlayer.queSuit) {
                myQueBadge.style.display = 'inline-block';
                myQueBadge.className = `que-badge ${myPlayer.queSuit}`;
                myQueBadge.innerText = `缺${SUIT_NAMES[myPlayer.queSuit]}`;
            } else {
                myQueBadge.style.display = 'none';
            }
        }

        // 自家副露
        this.dom.myMelds.innerHTML = '';
        myPlayer.melds.forEach(m => {
            const group = document.createElement('div');
            group.className = 'meld-group';
            m.tiles.forEach(tile => {
                group.appendChild(this.createTileElement(tile, { interactive: false, size: 'tile-sm' }));
            });
            this.dom.myMelds.appendChild(group);
        });

        // 自家牌河
        const myRiver = document.querySelector('.seat-bottom .river-container');
        if (myRiver) {
            myRiver.innerHTML = '';
            myPlayer.discards.forEach(tile => {
                myRiver.appendChild(this.createTileElement(tile, { interactive: false, size: 'tile-sm' }));
            });
        }

        // 自家手牌渲染与定缺门约束提示
        this.dom.myHandRow.innerHTML = '';
        const allMyTiles = myPlayer.drawTile ? [...myPlayer.hand, myPlayer.drawTile] : myPlayer.hand;
        const hasQueTiles = MahjongLogic.hasQueTile(allMyTiles, myPlayer.queSuit);

        // 如果处于正常摸打出牌期，计算各牌危险度
        let dangerMap = {};
        if (this.phase === GAME_PHASES.PLAYING && this.currentTurn === 0) {
            const opponentProfiles = AIAnalyzer.analyzeOpponents(this.getGameState());
            for (const t of allMyTiles) {
                dangerMap[t.uid] = AIAnalyzer.evaluateTileTotalDanger(t, opponentProfiles, this.getGameState());
            }
        }

        // 渲染 13 张主手牌
        myPlayer.hand.forEach(tile => {
            const isQue = tile.suit === myPlayer.queSuit;
            const isSelected = this.selectedDiscardTile && this.selectedDiscardTile.uid === tile.uid;

            const tileEl = this.createTileElement(tile, {
                interactive: true,
                isSelected,
                dangerInfo: dangerMap[tile.uid],
                isQue,
                mustDiscardQue: hasQueTiles && isQue,
                disabledNonQue: hasQueTiles && !isQue
            });

            tileEl.addEventListener('click', () => {
                this.handleTileClick(tile);
            });

            tileEl.addEventListener('dblclick', () => {
                this.selectedDiscardTile = tile;
                this.executePlayerDiscard();
            });

            this.dom.myHandRow.appendChild(tileEl);
        });

        // 渲染摸牌位独立牌
        this.dom.myDrawSlot.innerHTML = '';
        if (myPlayer.drawTile) {
            const dt = myPlayer.drawTile;
            const isQue = dt.suit === myPlayer.queSuit;
            const isSelected = this.selectedDiscardTile && this.selectedDiscardTile.uid === dt.uid;

            const drawEl = this.createTileElement(dt, {
                interactive: true,
                isSelected,
                dangerInfo: dangerMap[dt.uid],
                isQue,
                mustDiscardQue: hasQueTiles && isQue,
                disabledNonQue: hasQueTiles && !isQue
            });

            drawEl.addEventListener('click', () => {
                this.handleTileClick(dt);
            });

            drawEl.addEventListener('dblclick', () => {
                this.selectedDiscardTile = dt;
                this.executePlayerDiscard();
            });

            this.dom.myDrawSlot.appendChild(drawEl);
        }
    }

    handleTileClick(tile) {
        soundEngine.playSelect();

        // 如果在换三张选择阶段
        if (this.phase === GAME_PHASES.SWAP_SELECT) {
            this.toggleSwapTileSelection(tile);
            return;
        }

        // 正常出牌选择
        this.selectedDiscardTile = tile;
        this.renderMySeat();
    }

    toggleSwapTileSelection(tile) {
        const idx = this.selectedSwapTiles.findIndex(t => t.uid === tile.uid);
        if (idx !== -1) {
            this.selectedSwapTiles.splice(idx, 1);
        } else {
            // 必须同花色
            if (this.selectedSwapTiles.length > 0) {
                if (tile.suit !== this.selectedSwapTiles[0].suit) {
                    this.showToast('换三张必须选择 3 张完全相同花色的牌！');
                    return;
                }
            }
            if (this.selectedSwapTiles.length < 3) {
                this.selectedSwapTiles.push(tile);
            }
        }
        this.renderSwapPickArea();
    }

    /**
     * 创建纯 CSS / 矢量高保真麻将牌 DOM 元素
     */
    createTileElement(tile, options = {}) {
        const {
            interactive = true,
            isSelected = false,
            size = '',
            dangerInfo = null,
            isQue = false,
            mustDiscardQue = false,
            disabledNonQue = false
        } = options;

        const el = document.createElement('div');
        el.className = `mj-tile ${size} ${interactive ? 'interactive' : ''} ${isSelected ? 'selected' : ''} ${mustDiscardQue ? 'must-discard-que' : ''} ${disabledNonQue ? 'disabled-non-que' : ''}`;

        // 牌心内容
        const content = document.createElement('div');
        content.className = `mj-content suit-${tile.suit}`;

        if (tile.suit === 'wan') {
            content.innerHTML = `
                <span class="wan-val">${NUMBER_CHARS[tile.val]}</span>
                <span class="wan-char">萬</span>
            `;
        } else if (tile.suit === 'tiao') {
            content.innerHTML = `
                <span class="tiao-val">${tile.val}</span>
                <span class="tiao-char">条</span>
            `;
        } else if (tile.suit === 'tong') {
            content.innerHTML = `
                <span class="tong-val">${tile.val}</span>
                <span class="tong-char">筒</span>
            `;
        }

        el.appendChild(content);

        // 定缺小红点
        if (isQue) {
            const queDot = document.createElement('div');
            queDot.className = 'que-indicator';
            queDot.title = '定缺门牌（必须优先打掉）';
            el.appendChild(queDot);
        }

        // 危险度指示胶囊（如果是出牌期自家手牌）
        if (dangerInfo && this.showDangerOverlay) {
            const badge = document.createElement('div');
            badge.className = `danger-badge ${dangerInfo.level.toLowerCase()}`;
            badge.innerText = `${dangerInfo.score}%`;
            badge.title = `${dangerInfo.levelText}：${dangerInfo.primaryReason}`;
            el.appendChild(badge);
        }

        return el;
    }

    showActionOption({ type, text, action }) {
        const btn = document.createElement('button');
        btn.className = `action-btn btn-${type.toLowerCase()}`;
        btn.innerText = text;
        btn.addEventListener('click', action);
        this.dom.actionBar.appendChild(btn);
    }

    clearActionOptions() {
        const btns = this.dom.actionBar.querySelectorAll('.action-btn:not(#btn-discard)');
        btns.forEach(b => b.remove());
    }

    showToast(msg) {
        const toast = this.dom.bannerToast;
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, 3200);
    }
}

// 页面加载完毕后自启动
window.addEventListener('DOMContentLoaded', () => {
    window.app = new MahjongApp();
    window.app.startNewGame();
});
