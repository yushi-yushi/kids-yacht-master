/**
 * ヨットレース・シミュレーター
 * race.js — 完全に独立したレース用ゲームロジック
 */

// ============================
// システム初期化
// ============================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// レースモード用ボディクラス追加
document.body.classList.add('race-mode');

// ============================
// ヘルプ画面制御
// ============================
const helpBtn = document.getElementById('btn-help');
const helpModal = document.getElementById('help-modal');
const helpOverlay = document.getElementById('overlay');
const closeHelp = document.getElementById('close-help');

const toggleHelp = (show) => {
    const display = show ? 'block' : 'none';
    helpModal.style.display = display;
    helpOverlay.style.display = display;
};

helpBtn.addEventListener('click', () => toggleHelp(true));
helpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleHelp(true); });
closeHelp.addEventListener('click', () => toggleHelp(false));
helpOverlay.addEventListener('click', () => toggleHelp(false));

// ============================
// コース定義（ワールド座標）
// ============================
const WORLD = {
    width: 4000,
    height: 6000
};

// コースマーク（ブイ）
const courseMarks = [
    { x: 2000, y: 3200, label: 'スタート', radius: 50, color: '#00FF88' }, // 1200と5200の中央
    { x: 2000, y: 1200, label: '風上マーク', radius: 40, color: '#FF4444' },
    { x: 2000, y: 5200, label: '風下マーク', radius: 40, color: '#4488FF' },
    { x: 2000, y: 1200, label: '風上マーク②', radius: 40, color: '#FF4444' },
    { x: 2000, y: 5200, label: 'ゴール', radius: 50, color: '#FFD700' }
];

// スタートライン / ゴールライン
const startLine = { x1: 1800, y1: 3200, x2: 2200, y2: 3200 };

// ============================
// 風の設定
// ============================
const windAngle = Math.PI / 2; // 北風（上から下）

// ============================
// プレイヤーヨット
// ============================
const player = {
    x: 2000,
    y: 3400,
    angle: -Math.PI / 2,
    speed: 0,
    maxSpeed: 6,
    rotationSpeed: 0.05,
    sailTightness: 0,
    autoRotateDir: 0,
    autoRotateTarget: null,
    heel: 0,
    vx: 0,
    vy: 0,
    currentMark: 0,
    finished: false,
    finishTime: 0,
    name: 'あなた',
    color: '#00CCFF',
    isPlayer: true
};

// ============================
// AIヨット
// ============================
const aiNames = ['ライバルA', 'ライバルB', 'ライバルC'];
const aiColors = ['#FF6B6B', '#66BB6A', '#FFA726'];

function createAIBoat(name, color, index) {
    return {
        x: 1900 + index * 100,
        y: 3400 + (index - 1) * 30,
        angle: -Math.PI / 2,
        speed: 0,
        maxSpeed: 5.2 + Math.random() * 1.0,
        rotationSpeed: 0.04 + Math.random() * 0.01,
        sailTightness: 0,
        autoRotateDir: 0,
        autoRotateTarget: null,
        heel: 0,
        vx: 0,
        vy: 0,
        currentMark: 0,
        finished: false,
        finishTime: 0,
        name: name,
        color: color,
        isPlayer: false,
        aiTurnBias: (Math.random() - 0.5) * 0.3, // 個性的なブレ
        aiSkill: 0.6 + Math.random() * 0.35
    };
}

let aiBots = aiNames.map((n, i) => createAIBoat(n, aiColors[i], i));
let allBoats = [player, ...aiBots];

// ============================
// カメラ（プレイヤー追従）
// ============================
const camera = { x: 0, y: 0 };

function updateCamera() {
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
}

// ============================
// 入力処理
// ============================
const input = { left: false, right: false, sailActive: false, sailRelease: false };

window.addEventListener('keydown', (e) => {
    const key = e.code;
    if (key === 'ArrowLeft') { input.left = true; player.autoRotateDir = 0; }
    if (key === 'ArrowRight') { input.right = true; player.autoRotateDir = 0; }
    if (key === 'Space' || key === 'ArrowUp') { input.sailActive = true; input.sailRelease = false; }
    if (key === 'ArrowDown') { input.sailRelease = true; input.sailActive = false; }
    if (key === 'KeyT') startSpecialMoveForBoat(player, 'tack');
    if (key === 'KeyJ') startSpecialMoveForBoat(player, 'gybe');
});

window.addEventListener('keyup', (e) => {
    const key = e.code;
    if (key === 'ArrowLeft') input.left = false;
    if (key === 'ArrowRight') input.right = false;
    if (key === 'Space' || key === 'ArrowUp') input.sailActive = false;
    if (key === 'ArrowDown') input.sailRelease = false;
});

// ボタンUI
function setupDirBtn(id, key) {
    const btn = document.getElementById(id);
    const start = (e) => { e.preventDefault(); input[key] = true; btn.classList.add('pressed'); player.autoRotateDir = 0; };
    const end = (e) => { e.preventDefault(); input[key] = false; btn.classList.remove('pressed'); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
}
setupDirBtn('btn-left', 'left');
setupDirBtn('btn-right', 'right');

function setupHoldBtn(id, key) {
    const btn = document.getElementById(id);
    const start = (e) => { e.preventDefault(); input[key] = true; btn.classList.add('pressed'); };
    const end = (e) => { e.preventDefault(); input[key] = false; btn.classList.remove('pressed'); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
}
setupHoldBtn('btn-sail', 'sailActive');
setupHoldBtn('btn-release', 'sailRelease');

const sailBtn = document.getElementById('btn-sail');
const tackBtn = document.getElementById('btn-tack');
const gybeBtn = document.getElementById('btn-gybe');

tackBtn.addEventListener('click', () => startSpecialMoveForBoat(player, 'tack'));
gybeBtn.addEventListener('click', () => startSpecialMoveForBoat(player, 'gybe'));

// ============================
// 旋回ロジック
// ============================
function startSpecialMoveForBoat(boat, type) {
    let diff = Math.atan2(Math.sin(boat.angle - windAngle), Math.cos(boat.angle - windAngle));
    if (type === 'tack') {
        boat.autoRotateDir = (diff < 0) ? -1 : 1;
        boat.autoRotateTarget = boat.angle + boat.autoRotateDir * Math.PI * 0.5;
    } else if (type === 'gybe') {
        boat.autoRotateDir = (diff < 0) ? 1 : -1;
        boat.autoRotateTarget = boat.angle + boat.autoRotateDir * Math.PI * 0.5;
    }
}

// ============================
// レース管理
// ============================
let raceState = 'waiting'; // 'waiting' | 'countdown' | 'racing' | 'finished'
let raceStartTime = 0;
let raceElapsed = 0;
let countdownValue = 3;
let countdownTimer = null;

const startRaceBtn = document.getElementById('btn-start-race');
const restartBtn = document.getElementById('btn-restart');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownText = document.getElementById('countdown-text');
const finishOverlay = document.getElementById('finish-overlay');

startRaceBtn.addEventListener('click', beginCountdown);
restartBtn.addEventListener('click', resetRace);

function beginCountdown() {
    if (raceState !== 'waiting') return;
    raceState = 'countdown';
    countdownValue = 3;
    countdownOverlay.classList.add('active');
    countdownText.innerText = countdownValue;
    startRaceBtn.disabled = true;
    startRaceBtn.style.opacity = '0.5';
    startRaceBtn.innerText = '準備中...';

    countdownTimer = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
            countdownText.innerText = countdownValue;
        } else if (countdownValue === 0) {
            countdownText.innerText = 'GO!';
        } else {
            clearInterval(countdownTimer);
            countdownOverlay.classList.remove('active');
            startRace();
        }
    }, 1000);
}

function startRace() {
    raceState = 'racing';
    raceStartTime = Date.now();
    startRaceBtn.innerText = 'レース中...';

    // 全ボートをリセット位置に
    allBoats.forEach((b, i) => {
        b.currentMark = 0;
        b.finished = false;
        b.finishTime = 0;
    });
}

function resetRace() {
    raceState = 'waiting';
    raceElapsed = 0;
    finishOverlay.classList.remove('active');
    countdownOverlay.classList.remove('active');
    startRaceBtn.disabled = false;
    startRaceBtn.style.opacity = '1';
    startRaceBtn.innerText = 'レース開始！';

    // プレイヤーリセット
    player.x = 2000;
    player.y = 3400;
    player.angle = -Math.PI / 2;
    player.speed = 0;
    player.vx = 0;
    player.vy = 0;
    player.sailTightness = 0;
    player.autoRotateDir = 0;
    player.currentMark = 0;
    player.finished = false;
    player.finishTime = 0;

    // AI リセット
    aiBots = aiNames.map((n, i) => createAIBoat(n, aiColors[i], i));
    allBoats = [player, ...aiBots];

    document.getElementById('race-time').innerText = '00:00';
    document.getElementById('race-mark').innerText = '0';
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ============================
// 物理演算（全ボート共通）
// ============================
function updateBoatPhysics(boat, doSailActive, doSailRelease) {
    // 自動旋回
    if (boat.autoRotateDir !== 0) {
        boat.angle += boat.rotationSpeed * boat.autoRotateDir;
        if (boat.autoRotateTarget !== null && Math.abs(boat.angle - boat.autoRotateTarget) < 0.1) {
            boat.autoRotateDir = 0;
        }
    }

    // 風との角度計算
    let diff = Math.atan2(Math.sin(boat.angle - windAngle), Math.cos(boat.angle - windAngle));
    let absDiff = Math.abs(diff);

    let windEfficiency = 0;
    let msg = '';

    let targetAbsDiff = Math.PI * 0.55;

    if (absDiff > Math.PI * 0.75) {
        windEfficiency = -0.5;
        const turnDeg = Math.round((absDiff - targetAbsDiff) * 180 / Math.PI);
        if (diff < 0) {
            msg = `かぜに むかいすぎ！ 右に ${turnDeg}度 かたむけよう ⛵`;
        } else {
            msg = `かぜに むかいすぎ！ 左に ${turnDeg}度 かたむけよう ⛵`;
        }
    } else if (absDiff > Math.PI * 0.4) {
        windEfficiency = 1.2;
        if (boat.sailTightness < 0.7) {
            msg = 'もっと セールを はろう！ (GO!ボタン) ⛵✨';
        } else {
            msg = 'ぜっこうちょう！ そのまま すすもう！ 🌟';
        }
    } else if (absDiff < Math.PI * 0.15) {
        windEfficiency = 0.7;
        const turnDeg = Math.round((targetAbsDiff - absDiff) * 180 / Math.PI);
        if (diff < 0) {
            msg = `もっと スピードがでるよ！ 左に ${turnDeg}度 かたむけよう ⛵`;
        } else {
            msg = `もっと スピードがでるよ！ 右に ${turnDeg}度 かたむけよう ⛵`;
        }
    } else {
        windEfficiency = 1.0;
        msg = 'いいかんじ！ セールを しっかり はろう ⛵';
    }

    // セール調整
    if (doSailActive) boat.sailTightness += 0.02;
    if (doSailRelease) boat.sailTightness -= 0.02;
    boat.sailTightness = Math.max(0, Math.min(1, boat.sailTightness));

    // 加速
    let accel = 0.08 * windEfficiency * boat.sailTightness;
    let headX = Math.cos(boat.angle);
    let headY = Math.sin(boat.angle);

    boat.vx += headX * accel;
    boat.vy += headY * accel;

    // 水の抵抗
    let drag = (boat.sailTightness > 0) ? 0.985 : 0.96;
    boat.vx *= drag;
    boat.vy *= drag;

    // キール効果
    let currentVs = Math.sqrt(boat.vx * boat.vx + boat.vy * boat.vy);
    if (currentVs > 0.01) {
        let keelEffect = 0.15;
        boat.vx = boat.vx * (1 - keelEffect) + (headX * currentVs) * keelEffect;
        boat.vy = boat.vy * (1 - keelEffect) + (headY * currentVs) * keelEffect;
    }

    // スピード上限
    let finalSpeed = Math.sqrt(boat.vx * boat.vx + boat.vy * boat.vy);
    if (finalSpeed > boat.maxSpeed) {
        let ratio = boat.maxSpeed / finalSpeed;
        boat.vx *= ratio;
        boat.vy *= ratio;
        finalSpeed = boat.maxSpeed;
    }
    boat.speed = finalSpeed;

    boat.x += boat.vx;
    boat.y += boat.vy;

    // ワールド境界クランプ
    boat.x = Math.max(0, Math.min(WORLD.width, boat.x));
    boat.y = Math.max(0, Math.min(WORLD.height, boat.y));

    return { windEfficiency, msg, absDiff, diff };
}

// ============================
// AI操船ロジック
// ============================
function updateAI(bot) {
    if (bot.finished || raceState !== 'racing') return;

    const target = courseMarks[bot.currentMark];
    if (!target) return;

    let dx = target.x + bot.aiTurnBias * 200 - bot.x;
    let dy = target.y - bot.y;
    let targetAngle = Math.atan2(dy, dx);

    // 風向きを考慮した操船
    let diffFromWind = Math.atan2(Math.sin(targetAngle - windAngle), Math.cos(targetAngle - windAngle));
    let absFromWind = Math.abs(diffFromWind);

    // 風上に向かうとき（タッキング角度を確保）
    if (absFromWind > Math.PI * 0.7) {
        // 風上に近すぎるのでタッキング角度を付ける
        let tackOffset = (Math.PI * 0.4) * ((bot.aiTurnBias > 0) ? 1 : -1);
        targetAngle = windAngle + Math.PI + tackOffset;

        // 一定距離進んだらタック
        let distToMark = Math.sqrt(dx * dx + dy * dy);
        let crossTrack = Math.abs(bot.x - target.x);
        if (crossTrack > 400 + Math.random() * 200) {
            bot.aiTurnBias = -bot.aiTurnBias; // タック方向を切り替え
        }
    }

    // 目標角度に向けてステアリング
    let angleDiff = Math.atan2(Math.sin(targetAngle - bot.angle), Math.cos(targetAngle - bot.angle));

    if (Math.abs(angleDiff) > 0.05) {
        bot.angle += Math.sign(angleDiff) * bot.rotationSpeed * bot.aiSkill;
    }

    // セール調整（AIは常に適切に調整）
    let windDiff = Math.abs(Math.atan2(Math.sin(bot.angle - windAngle), Math.cos(bot.angle - windAngle)));
    if (windDiff < Math.PI * 0.75) {
        bot.sailTightness = Math.min(1, bot.sailTightness + 0.03 * bot.aiSkill);
    } else {
        bot.sailTightness = Math.max(0, bot.sailTightness - 0.01);
    }
}

// ============================
// マーク通過チェック
// ============================
function checkMarkPassing(boat) {
    if (boat.finished || raceState !== 'racing') return;
    if (boat.currentMark >= courseMarks.length) return;

    const mark = courseMarks[boat.currentMark];
    let dx = boat.x - mark.x;
    let dy = boat.y - mark.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < mark.radius + 30) {
        boat.currentMark++;
        if (boat.currentMark >= courseMarks.length) {
            boat.finished = true;
            boat.finishTime = Date.now() - raceStartTime;

            // 全員ゴールしたかチェック
            if (allBoats.every(b => b.finished)) {
                raceState = 'finished';
                showFinishScreen();
            }
        }
        // プレイヤーの場合バイブ
        if (boat.isPlayer && navigator.vibrate) navigator.vibrate(100);
    }
}

// ============================
// 順位計算
// ============================
function calculateRankings() {
    const ranked = [...allBoats].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;

        // マーク進捗で比較
        if (a.currentMark !== b.currentMark) return b.currentMark - a.currentMark;

        // 同じマーク: 次マークまでの距離で比較
        const nextA = courseMarks[Math.min(a.currentMark, courseMarks.length - 1)];
        const nextB = courseMarks[Math.min(b.currentMark, courseMarks.length - 1)];
        const distA = Math.sqrt((a.x - nextA.x) ** 2 + (a.y - nextA.y) ** 2);
        const distB = Math.sqrt((b.x - nextB.x) ** 2 + (b.y - nextB.y) ** 2);
        return distA - distB;
    });
    return ranked;
}

// ============================
// ゴール画面
// ============================
function showFinishScreen() {
    const ranked = calculateRankings();
    const playerRank = ranked.findIndex(b => b.isPlayer) + 1;

    const titles = ['🥇 1位 おめでとう！', '🥈 2位 すごい！', '🥉 3位 がんばった！', '4位 次はがんばろう！'];
    document.getElementById('finish-title').innerText = titles[playerRank - 1] || 'ゴール！';

    const classes = ['finish-1st', 'finish-2nd', 'finish-3rd', 'finish-4th'];
    let html = '';
    ranked.forEach((b, i) => {
        const cls = classes[i] || 'finish-4th';
        const playerCls = b.isPlayer ? ' is-player' : '';
        const medals = ['🥇', '🥈', '🥉', ''];
        html += `<div class="finish-row ${cls}${playerCls}">
            <span>${medals[i] || ''} ${i + 1}位</span>
            <span class="finish-player-name">${b.name}</span>
            <span class="finish-time">${formatTime(b.finishTime)}</span>
        </div>`;
    });
    document.getElementById('finish-results').innerHTML = html;
    finishOverlay.classList.add('active');
}

// ============================
// UI更新
// ============================
function updateStandingsUI() {
    const ranked = calculateRankings();
    const list = document.getElementById('standings-list');
    const rankClasses = ['rank-1', 'rank-2', 'rank-3', 'rank-4'];
    const medals = ['🥇', '🥈', '🥉', '　'];

    let html = '';
    ranked.forEach((b, i) => {
        const cls = rankClasses[i] || 'rank-4';
        const playerCls = b.isPlayer ? ' is-player' : '';
        html += `<div class="standing-item ${cls}${playerCls}">
            <span class="standing-rank">${medals[i]}</span>
            <span class="standing-name">${b.name}</span>
        </div>`;
        if (b.isPlayer) {
            document.getElementById('rank').innerText = `${i + 1}位`;
        }
    });
    list.innerHTML = html;
}

// ============================
// メイン更新処理
// ============================
function update() {
    if (raceState === 'waiting' || raceState === 'countdown') {
        // レース前でも風向は表示、操作だけ可能にする
        const result = updateBoatPhysics(player, false, false);
        updateCamera();
        return;
    }

    if (raceState === 'finished') return;

    // レース中の経過時間
    raceElapsed = Date.now() - raceStartTime;
    document.getElementById('race-time').innerText = formatTime(raceElapsed);

    // プレイヤー更新
    if (input.left) player.angle -= player.rotationSpeed;
    if (input.right) player.angle += player.rotationSpeed;

    const result = updateBoatPhysics(player, input.sailActive, input.sailRelease);
    checkMarkPassing(player);

    // AI更新
    aiBots.forEach(bot => {
        updateAI(bot);
        updateBoatPhysics(bot, true, false);
        checkMarkPassing(bot);
    });

    // UI更新
    document.getElementById('speed').innerText = Math.floor(player.speed * 5);
    let absDiff = result.absDiff;
    let angleFromUpwind = Math.abs(Math.round((Math.PI - absDiff) * 180 / Math.PI));
    document.getElementById('wind-angle-val').innerText = angleFromUpwind;
    let heelVal = Math.round(Math.abs(player.heel) + (Math.random() * 0.5));
    document.getElementById('heel-angle-val').innerText = heelVal;
    document.getElementById('msg').innerText = result.msg;

    // セールゲージ
    document.getElementById('sail-gauge-fill').style.height = (player.sailTightness * 100) + '%';
    if (player.sailTightness > 0.5) {
        sailBtn.classList.add('active');
    } else {
        sailBtn.classList.remove('active');
    }

    // マーク進捗
    document.getElementById('race-mark').innerText = Math.min(player.currentMark, courseMarks.length);
    document.getElementById('race-mark-total').innerText = courseMarks.length;

    // 順位
    updateStandingsUI();

    // カメラ
    updateCamera();
}

// ============================
// 描画処理
// ============================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 海の背景グラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    grad.addColorStop(0, '#0B2545');
    grad.addColorStop(0.5, '#13547A');
    grad.addColorStop(1, '#0B2545');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // 波パターン
    drawWaves();

    // コース描画
    drawCourse();

    // 全ヨット描画
    allBoats.forEach(b => drawBoat(b));

    ctx.restore();

    // ミニマップ描画
    drawMinimap();
}

function drawWaves() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    let time = Date.now() / 1000;

    // カメラ範囲内のみ描画
    let startY = Math.floor((camera.y - 50) / 150) * 150;
    let endY = camera.y + canvas.height + 50;

    for (let baseY = startY; baseY < endY; baseY += 150) {
        let yOffset = Math.sin(time * 0.3 + baseY * 0.005) * 20;
        ctx.beginPath();
        for (let x = Math.floor(camera.x / 30) * 30; x < camera.x + canvas.width + 30; x += 30) {
            let waveY = baseY + yOffset + Math.sin(x / 100 + time) * 12;
            if (x === Math.floor(camera.x / 30) * 30) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
    }
}

function drawCourse() {
    // コースライン（点線）
    ctx.setLineDash([15, 15]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    courseMarks.forEach((m, i) => {
        if (i === 0) ctx.moveTo(m.x, m.y);
        else ctx.lineTo(m.x, m.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // スタート/ゴールライン
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startLine.x1, startLine.y1);
    ctx.lineTo(startLine.x2, startLine.y2);
    ctx.stroke();

    // マーク（ブイ）
    courseMarks.forEach((m, i) => {
        ctx.save();
        // グロー
        ctx.shadowColor = m.color;
        ctx.shadowBlur = 20;

        // ブイ本体
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();

        // 中心の白丸
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // ラベル
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, m.x, m.y - m.radius - 10);

        // マーク番号
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(String(i + 1), m.x, m.y + 6);

        ctx.restore();
    });

    // 次のマーク方向矢印（プレイヤー用）
    if (raceState === 'racing' && player.currentMark < courseMarks.length && !player.finished) {
        const nextMark = courseMarks[player.currentMark];
        let dx = nextMark.x - player.x;
        let dy = nextMark.y - player.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 200) {
            let arrowAngle = Math.atan2(dy, dx);
            let arrowDist = 120;
            let ax = player.x + Math.cos(arrowAngle) * arrowDist;
            let ay = player.y + Math.sin(arrowAngle) * arrowDist;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(arrowAngle);
            ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, -8);
            ctx.lineTo(-10, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // 距離表示
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(dist)}m`, ax, ay + 20);
        }
    }
}

function drawBoat(boat) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);

    let heelScale = Math.cos(boat.heel * Math.PI / 180);
    ctx.scale(1, heelScale);

    // 航跡（ウェイク）
    if (boat.speed > 0.5) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        let wakeLen = -20 - boat.speed * 8;
        ctx.lineTo(wakeLen, -boat.speed * 5);
        ctx.lineTo(wakeLen, boat.speed * 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // 船体
    ctx.fillStyle = boat.isPlayer ? '#F5F5F5' : boat.color;
    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.bezierCurveTo(10, 15, -15, 15, -20, 10);
    ctx.lineTo(-20, -10);
    ctx.bezierCurveTo(-15, -15, 10, -15, 25, 0);
    ctx.fill();
    ctx.strokeStyle = boat.isPlayer ? '#333' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // マスト
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();

    // セール
    if (boat.sailTightness > 0 || boat.speed > 0.5) {
        let diff = Math.atan2(Math.sin(windAngle - boat.angle), Math.cos(windAngle - boat.angle));
        let sailAngle = -diff / 2;
        if (Math.abs(diff) > Math.PI * 0.8) sailAngle = 0;

        ctx.save();
        ctx.rotate(sailAngle);
        ctx.globalAlpha = 0.3 + boat.sailTightness * 0.7;
        ctx.fillStyle = boat.isPlayer ? 'white' : 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        let baseCurve = 1 + (boat.speed + 1) * boat.sailTightness;
        let curveWidth = sailAngle < 0 ? -baseCurve : baseCurve;
        ctx.quadraticCurveTo(-15, curveWidth, -25, 0);
        ctx.lineTo(8, 0);
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.stroke();
        ctx.restore();
    }

    // プレイヤーの場合はマーカー
    if (boat.isPlayer) {
        ctx.save();
        ctx.rotate(-boat.angle); // 回転を打ち消し、常に上向き
        ctx.fillStyle = '#00CCFF';
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(-6, -20);
        ctx.lineTo(6, -20);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();

    // 名前ラベル（回転なし）
    ctx.save();
    ctx.fillStyle = boat.isPlayer ? '#00CCFF' : 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(boat.name, boat.x, boat.y + 30);
    ctx.restore();
}

// ============================
// ミニマップ描画
// ============================
function drawMinimap() {
    const mw = minimapCanvas.width;
    const mh = minimapCanvas.height;
    minimapCtx.clearRect(0, 0, mw, mh);

    // 背景
    minimapCtx.fillStyle = 'rgba(0, 20, 60, 0.8)';
    minimapCtx.fillRect(0, 0, mw, mh);

    const scaleX = mw / WORLD.width;
    const scaleY = mh / WORLD.height;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (mw - WORLD.width * scale) / 2;
    const offsetY = (mh - WORLD.height * scale) / 2;

    function toMini(wx, wy) {
        return {
            x: offsetX + wx * scale,
            y: offsetY + wy * scale
        };
    }

    // コースライン
    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    courseMarks.forEach((m, i) => {
        const p = toMini(m.x, m.y);
        if (i === 0) minimapCtx.moveTo(p.x, p.y);
        else minimapCtx.lineTo(p.x, p.y);
    });
    minimapCtx.stroke();

    // マーク
    courseMarks.forEach((m, i) => {
        const p = toMini(m.x, m.y);
        minimapCtx.fillStyle = m.color;
        minimapCtx.beginPath();
        minimapCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    // ボート
    allBoats.forEach(b => {
        const p = toMini(b.x, b.y);
        minimapCtx.fillStyle = b.isPlayer ? '#00CCFF' : b.color;
        if (b.isPlayer) {
            // プレイヤーは三角形
            minimapCtx.beginPath();
            let a = b.angle;
            minimapCtx.moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6);
            minimapCtx.lineTo(p.x + Math.cos(a + 2.5) * 4, p.y + Math.sin(a + 2.5) * 4);
            minimapCtx.lineTo(p.x + Math.cos(a - 2.5) * 4, p.y + Math.sin(a - 2.5) * 4);
            minimapCtx.closePath();
            minimapCtx.fill();
        } else {
            minimapCtx.beginPath();
            minimapCtx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });

    // カメラ範囲
    const tl = toMini(camera.x, camera.y);
    const cw = canvas.width * scale;
    const ch = canvas.height * scale;
    minimapCtx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(tl.x, tl.y, cw, ch);
}

// ============================
// ゲームループ
// ============================
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// 風向き表示
document.getElementById('arrow').style.transform = 'rotate(180deg)';
document.getElementById('race-mark-total').innerText = courseMarks.length;

gameLoop();
