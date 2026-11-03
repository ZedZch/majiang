/**
 * 雀圣兵法 · 深度神经网络 (Suphx / Mortal 架构) 推理可视化引擎
 * 模拟并直观展示尖端麻将 AI（如微软 Suphx、NAGA、Mortal）在对局决策时的：
 * 1. 特征张量输入层 (Feature Tensor Layer)
 * 2. 深度残差注意力卷积骨干网络 (ResNet-Attention Backbone)
 * 3. 花色自注意力 (Suit Self-Attention) 与对手威胁交叉注意力 (Threat Cross-Attention)
 * 4. 策略头 (Policy Head π) 与 价值头 (Value Head V) 双头输出
 * 5. 交互式神经元激活脉冲与每一个候选动作的精确数值代入公式
 */

class NeuralVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animId = null;
        this.pulsePhase = 0;
        this.selectedCandidate = null;
    }

    /**
     * 初始化画布与尺寸
     */
    init(canvasElement) {
        if (!canvasElement) return;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = (rect.width || 760) * dpr;
        this.canvas.height = 360 * dpr;
        if (this.ctx) {
            this.ctx.scale(dpr, dpr);
        }
    }

    /**
     * 绘制完整的神经网络结构与脉冲数据流
     * @param {Object} neuralData AIAnalyzer 输出的完整神经状态
     * @param {string} selectedTileCode 当前选中或首选的切牌代号
     */
    draw(neuralData, selectedTileCode) {
        if (!this.canvas || !this.ctx || !neuralData) return;
        const ctx = this.ctx;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = 360;

        ctx.clearRect(0, 0, width, height);

        // 查找选中的候选切牌
        const candidates = neuralData.policyHead || [];
        const activeTile = candidates.find(c => c.tile.code === selectedTileCode) || candidates[0];
        this.selectedCandidate = activeTile;

        // 背景微弱科技网格
        ctx.strokeStyle = 'rgba(30, 58, 100, 0.25)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // 定义 4 个核心层级的水平 X 坐标
        const col1 = width * 0.12; // 特征输入层
        const col2 = width * 0.38; // 残差注意力卷积主干 (ResNet)
        const col3 = width * 0.64; // 攻守时钟调节与隐状态层 (Clock / Dense)
        const col4 = width * 0.88; // 策略头 (Policy) & 价值头 (Value)

        // 1. 特征输入层节点 (5组关键特征)
        const inputNodes = [
            { label: '手牌张量 [27]', y: height * 0.18, color: '#3498db' },
            { label: '四家牌河时序', y: height * 0.34, color: '#2ecc71' },
            { label: '副露与根数矩阵', y: height * 0.50, color: '#9b59b6' },
            { label: '定缺门状态掩码', y: height * 0.66, color: '#e67e22' },
            { label: '牌山时钟 [巡目]', y: height * 0.82, color: '#f1c40f' }
        ];

        // 2. 卷积骨干层节点 (ResNet-18 Blocks & Self-Attention)
        const hiddenNodes1 = [
            { label: '万子通道', y: height * 0.22, active: neuralData.suitAttention?.wan || 0.2 },
            { label: '条子通道', y: height * 0.38, active: neuralData.suitAttention?.tiao || 0.7 },
            { label: '筒子通道', y: height * 0.54, active: neuralData.suitAttention?.tong || 0.1 },
            { label: '自注意力融合', y: height * 0.70, active: 0.85 },
            { label: '对手威胁交叉头', y: height * 0.86, active: 0.6 }
        ];

        // 3. 攻守平衡调节层节点
        const hiddenNodes2 = [
            { label: '进张速度表征 S', y: height * 0.26, color: '#2ecc71', val: activeTile?.math?.baseSpeed || 65 },
            { label: '清一色溢价 F', y: height * 0.44, color: '#9b59b6', val: activeTile?.math?.fanPremium || 15 },
            { label: '放炮惩罚表征 D', y: height * 0.62, color: '#e74c3c', val: activeTile?.math?.defensePenalty || 5 },
            { label: '流局查叫防御 C', y: height * 0.80, color: '#f39c12', val: activeTile?.math?.chajiaoDefense || 0 }
        ];

        // 4. 双头输出层 (Policy Head & Value Head)
        const outputNodes = [
            { label: `策略头 π (P=${activeTile?.probability || 45}%)`, y: height * 0.32, type: 'POLICY', color: '#f1c40f' },
            { label: `价值头 V (EV=${activeTile?.qValue || 108}分)`, y: height * 0.68, type: 'VALUE', color: '#2ecc71' }
        ];

        // 绘制层间突触连线与脉冲动画
        this.pulsePhase = (this.pulsePhase + 0.04) % (Math.PI * 2);

        // 连线：Col1 -> Col2
        inputNodes.forEach((n1, i1) => {
            hiddenNodes1.forEach((n2, i2) => {
                const alpha = 0.08 + (Math.sin(this.pulsePhase + i1 + i2) * 0.05 + 0.05);
                ctx.strokeStyle = `rgba(52, 152, 219, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(col1, n1.y);
                ctx.bezierCurveTo(col1 + 50, n1.y, col2 - 50, n2.y, col2, n2.y);
                ctx.stroke();
            });
        });

        // 连线：Col2 -> Col3
        hiddenNodes1.forEach((n2, i2) => {
            hiddenNodes2.forEach((n3, i3) => {
                const alpha = 0.12 + (Math.cos(this.pulsePhase + i2 * 1.2 + i3) * 0.07 + 0.07);
                ctx.strokeStyle = `rgba(155, 89, 182, ${alpha})`;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(col2, n2.y);
                ctx.bezierCurveTo(col2 + 50, n2.y, col3 - 50, n3.y, col3, n3.y);
                ctx.stroke();
            });
        });

        // 连线：Col3 -> Col4 (高光强化通向 Policy & Value)
        hiddenNodes2.forEach((n3, i3) => {
            outputNodes.forEach((n4, i4) => {
                const pulse = Math.sin(this.pulsePhase * 1.5 + i3 + i4) * 0.5 + 0.5;
                ctx.strokeStyle = i4 === 0 ? `rgba(241, 196, 15, ${0.25 + pulse * 0.35})` : `rgba(46, 204, 113, ${0.25 + pulse * 0.35})`;
                ctx.lineWidth = 1.5 + pulse;
                ctx.beginPath();
                ctx.moveTo(col3, n3.y);
                ctx.bezierCurveTo(col3 + 45, n3.y, col4 - 45, n4.y, col4, n4.y);
                ctx.stroke();
            });
        });

        // 绘制节点本身
        // Col1
        inputNodes.forEach(node => {
            this._drawNode(ctx, col1, node.y, 8, node.color, node.label, 'left');
        });

        // Col2 (ResNet 骨干)
        hiddenNodes1.forEach(node => {
            const r = 9 + (node.active || 0.5) * 5;
            const col = `rgba(155, 89, 182, ${0.6 + (node.active || 0.5) * 0.4})`;
            this._drawNode(ctx, col2, node.y, r, col, `${node.label} (${Math.round((node.active || 0.5) * 100)}%)`, 'center');
        });

        // Col3 (数值调节隐层)
        hiddenNodes2.forEach(node => {
            this._drawNode(ctx, col3, node.y, 11, node.color, `${node.label} = ${node.val}`, 'center');
        });

        // Col4 (输出双头)
        outputNodes.forEach(node => {
            this._drawOutputHead(ctx, col4, node.y, node.color, node.label);
        });

        // 顶部列标题
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('① 特征输入层 (State Tensor)', col1, 24);
        ctx.fillText('② ResNet 注意力主干 (Backbone)', col2, 24);
        ctx.fillText('③ 攻守与价值表征 (Latent Q)', col3, 24);
        ctx.fillText('④ 双头决策输出 (Dual Heads)', col4, 24);
    }

    _drawNode(ctx, x, y, radius, color, label, align = 'center') {
        // 外发光环
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;

        // 实心核
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 标签文字
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#e2e8f0';
        if (align === 'left') {
            ctx.textAlign = 'right';
            ctx.fillText(label, x - radius - 8, y + 4);
        } else if (align === 'right') {
            ctx.textAlign = 'left';
            ctx.fillText(label, x + radius + 8, y + 4);
        } else {
            ctx.textAlign = 'center';
            ctx.fillText(label, x, y - radius - 5);
        }
    }

    _drawOutputHead(ctx, x, y, color, label) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        const w = 140;
        const h = 42;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y + 4);

        ctx.restore();
    }
}

// 导出为单例
if (typeof window !== 'undefined') {
    window.neuralVisualizer = new NeuralVisualizer();
}
if (typeof module !== 'undefined') {
    module.exports = NeuralVisualizer;
}
