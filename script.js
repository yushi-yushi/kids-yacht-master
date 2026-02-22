/**
 * システム管理・初期化
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/**
 * ヘルプ画面制御
 */
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

/**
 * ゲーム状態
 */
let score = 0;
const boat = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    angle: -Math.PI / 2,
    speed: 0,
    maxSpeed: 6,
    rotationSpeed: 0.05,
    sailTightness: 0, // 0 to 1
    autoRotateDir: 0,
    autoRotateTarget: null,
    heel: 0,
    vx: 0,
    vy: 0
};

const windAngle = Math.PI / 2; // 北風（上から下）

const star = {
    x: Math.random() * (window.innerWidth - 100) + 50,
    y: Math.random() * (window.innerHeight - 100) + 50,
    size: 18
};

const input = { left: false, right: false, sailActive: false, sailRelease: false };

/**
 * タイマー・ランキング機能
 */
let timerActive = false;
let timeLeft = 60;
let countdownInterval = null;
let highScores = JSON.parse(localStorage.getItem('kidsYachtHiScores')) || [0, 0, 0];

const timerDisplay = document.getElementById('time-left');
const startTimerBtn = document.getElementById('btn-start-timer');
const rankingList = document.getElementById('ranking-list');
const resetScoresBtn = document.getElementById('btn-reset-scores');

function updateRankingUI() {
    rankingList.innerHTML = highScores
        .map((s, i) => `<li><span>${i + 1}位</span> <span>${s}点</span></li>`)
        .join('');
}

function startTimer() {
    if (timerActive) return;

    score = 0;
    document.getElementById('score').innerText = score;
    timerActive = true;
    timeLeft = 60;
    timerDisplay.innerText = timeLeft;
    startTimerBtn.innerText = "チャレンジ中...";
    startTimerBtn.disabled = true;
    startTimerBtn.style.opacity = "0.5";

    countdownInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = timeLeft;

        if (timeLeft <= 0) {
            endTimer();
        }
    }, 1000);
}

function endTimer() {
    clearInterval(countdownInterval);
    timerActive = false;
    startTimerBtn.innerText = "チャレンジ開始！";
    startTimerBtn.disabled = false;
    startTimerBtn.style.opacity = "1";

    // ランキング更新
    highScores.push(score);
    highScores.sort((a, b) => b - a);
    highScores = highScores.slice(0, 3);
    localStorage.setItem('kidsYachtHiScores', JSON.stringify(highScores));
    updateRankingUI();

    alert(`タイムアップ！ スコアは ${score}点 でした！`);
}

function resetScores() {
    if (confirm('すべての記録をリセットしますか？')) {
        highScores = [0, 0, 0];
        localStorage.setItem('kidsYachtHiScores', JSON.stringify(highScores));
        updateRankingUI();
        score = 0;
        document.getElementById('score').innerText = score;
    }
}

startTimerBtn.addEventListener('click', startTimer);
resetScoresBtn.addEventListener('click', resetScores);
updateRankingUI();

/**
 * 旋回ロジック（タック・ジャイブ）
 */
function startSpecialMove(type) {
    // 現在の風に対する角度を確認
    let diff = Math.atan2(Math.sin(boat.angle - windAngle), Math.cos(boat.angle - windAngle));

    if (type === 'tack') {
        // タック：風上を回る
        boat.autoRotateDir = (diff < 0) ? -1 : 1;
        boat.autoRotateTarget = boat.angle + boat.autoRotateDir * Math.PI * 0.5;
    } else if (type === 'gybe') {
        // ジャイブ：風下を回る
        boat.autoRotateDir = (diff < 0) ? 1 : -1;
        boat.autoRotateTarget = boat.angle + boat.autoRotateDir * Math.PI * 0.5;
    }
}

/**
 * 入力イベント処理
 */
// キーボード
window.addEventListener('keydown', (e) => {
    const key = e.code;
    if (key === 'ArrowLeft') { input.left = true; boat.autoRotateDir = 0; }
    if (key === 'ArrowRight') { input.right = true; boat.autoRotateDir = 0; }
    if (key === 'Space' || key === 'ArrowUp') { input.sailActive = true; input.sailRelease = false; }
    if (key === 'ArrowDown') { input.sailRelease = true; input.sailActive = false; }

    // 特殊操船ショートカット
    if (key === 'KeyT') startSpecialMove('tack');
    if (key === 'KeyJ') startSpecialMove('gybe');
});

window.addEventListener('keyup', (e) => {
    const key = e.code;
    if (e.code === 'ArrowLeft') input.left = false;
    if (e.code === 'ArrowRight') input.right = false;
    if (key === 'Space' || key === 'ArrowUp') input.sailActive = false;
    if (key === 'ArrowDown') input.sailRelease = false;
});

// ボタンUI
function setupDirBtn(id, key) {
    const btn = document.getElementById(id);
    const start = (e) => {
        e.preventDefault();
        input[key] = true;
        btn.classList.add('pressed');
        boat.autoRotateDir = 0;
    };
    const end = (e) => {
        e.preventDefault();
        input[key] = false;
        btn.classList.remove('pressed');
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
}
setupDirBtn('btn-left', 'left');
setupDirBtn('btn-right', 'right');

const sailBtn = document.getElementById('btn-sail');
const releaseBtn = document.getElementById('btn-release');
const tackBtn = document.getElementById('btn-tack');
const gybeBtn = document.getElementById('btn-gybe');

function setupHoldBtn(id, key) {
    const btn = document.getElementById(id);
    const start = (e) => {
        e.preventDefault();
        input[key] = true;
        btn.classList.add('pressed');
    };
    const end = (e) => {
        e.preventDefault();
        input[key] = false;
        btn.classList.remove('pressed');
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
}

setupHoldBtn('btn-sail', 'sailActive');
setupHoldBtn('btn-release', 'sailRelease');

tackBtn.addEventListener('click', () => startSpecialMove('tack'));
gybeBtn.addEventListener('click', () => startSpecialMove('gybe'));

/**
 * 更新処理
 */
function update() {
    // 自動旋回
    if (boat.autoRotateDir !== 0) {
        boat.angle += boat.rotationSpeed * boat.autoRotateDir;
        if (Math.abs(boat.angle - boat.autoRotateTarget) < 0.1) {
            boat.autoRotateDir = 0;
        }
    }

    // 手動旋回
    if (input.left) boat.angle -= boat.rotationSpeed;
    if (input.right) boat.angle += boat.rotationSpeed;

    // 風との角度計算
    let diff = Math.atan2(Math.sin(boat.angle - windAngle), Math.cos(boat.angle - windAngle));
    let absDiff = Math.abs(diff);

    let windEfficiency = 0;
    let msg = "";

    // ヨットの帆走物理（角度による効率とアドバイス）
    let targetAbsDiff = Math.PI * 0.55; // 理想的な角度（アビーム付近：ダウンウィンドから約100度）

    if (absDiff > Math.PI * 0.75) {
        // 風上に寄りすぎ（In Irons）
        windEfficiency = -0.5;
        const turnDeg = Math.round((absDiff - targetAbsDiff) * 180 / Math.PI);
        // どちらに曲がるのが早いか判断
        if (diff < 0) {
            msg = `かぜに むかいすぎ！ 右に ${turnDeg}度 かたむけよう ⛵`;
        } else {
            msg = `かぜに むかいすぎ！ 左に ${turnDeg}度 かたむけよう ⛵`;
        }
    } else if (absDiff > Math.PI * 0.4) {
        // ベストな風受け範囲
        windEfficiency = 1.2;
        if (boat.sailTightness < 0.7) {
            msg = "もっと セールを はろう！ (GO!ボタン) ⛵✨";
        } else {
            msg = "ぜっこうちょう！ そのまま すすもう！ 🌟";
        }
    } else if (absDiff < Math.PI * 0.15) {
        // 真後ろからの風（Running）
        windEfficiency = 0.7;
        const turnDeg = Math.round((targetAbsDiff - absDiff) * 180 / Math.PI);
        if (diff < 0) {
            msg = `もっと スピードがでるよ！ 左に ${turnDeg}度 かたむけよう ⛵`;
        } else {
            msg = `もっと スピードがでるよ！ 右に ${turnDeg}度 かたむけよう ⛵`;
        }
    } else {
        // その他（Broad Reach / Special ranges）
        windEfficiency = 1.0;
        msg = "いいかんじ！ セールを しっかり はろう ⛵";
    }

    // セールの貼り具合調整（慣性計算の前に反映させる必要がある）
    if (input.sailActive) {
        boat.sailTightness += 0.02;
    }
    if (input.sailRelease) {
        boat.sailTightness -= 0.02;
    }
    boat.sailTightness = Math.max(0, Math.min(1, boat.sailTightness));

    // --- 慣性・物理演算の更新 ---
    // 加速度の計算 (船体の向きに働く力)
    let accel = 0.08 * windEfficiency * boat.sailTightness;

    // 船体の向きベクトル
    let headX = Math.cos(boat.angle);
    let headY = Math.sin(boat.angle);

    // 速度ベクトルへの加速
    boat.vx += headX * accel;
    boat.vy += headY * accel;

    // 水の抵抗 (全体的な減速)
    let drag = (boat.sailTightness > 0) ? 0.985 : 0.96;
    boat.vx *= drag;
    boat.vy *= drag;

    // キール効果 (船体の向きに速度ベクトルを揃えようとする物理効果)
    // これにより旋回中に「滑り」ながらも徐々に新しい向きへ進むリアルな挙動になる
    let currentVelspeed = Math.sqrt(boat.vx * boat.vx + boat.vy * boat.vy);
    if (currentVelspeed > 0.01) {
        // 0.15 はキールの「効き」具合。低いほどドリフト（滑り）が大きくなる
        let keelEffect = 0.15;
        // ベクトルを徐々に「船首方向」に補正する
        boat.vx = boat.vx * (1 - keelEffect) + (headX * currentVelspeed) * keelEffect;
        boat.vy = boat.vy * (1 - keelEffect) + (headY * currentVelspeed) * keelEffect;
    }

    // スピード上限の適用
    let finalSpeed = Math.sqrt(boat.vx * boat.vx + boat.vy * boat.vy);
    if (finalSpeed > boat.maxSpeed) {
        let ratio = boat.maxSpeed / finalSpeed;
        boat.vx *= ratio;
        boat.vy *= ratio;
        finalSpeed = boat.maxSpeed;
    }
    boat.speed = finalSpeed; // UIやアニメーション描画用に保持

    boat.x += boat.vx;
    boat.y += boat.vy;

    // ループ
    if (boat.x > canvas.width + 20) boat.x = -20;
    if (boat.x < -20) boat.x = canvas.width + 20;
    if (boat.y > canvas.height + 20) boat.y = -20;
    if (boat.y < -20) boat.y = canvas.height + 20;

    // アイテム取得
    let dx = boat.x - star.x;
    let dy = boat.y - star.y;
    if (Math.sqrt(dx * dx + dy * dy) < 35) {
        score++;
        document.getElementById('score').innerText = score;
        star.x = Math.random() * (canvas.width - 100) + 50;
        star.y = Math.random() * (canvas.height - 100) + 50;
        if (navigator.vibrate) navigator.vibrate(50);
    }

    // UI更新
    document.getElementById('speed').innerText = Math.floor(boat.speed * 5);
    // 風との角度を表示（0:風上 〜 180:風下）
    let angleFromUpwind = Math.abs(Math.round((Math.PI - absDiff) * 180 / Math.PI));
    document.getElementById('wind-angle-val').innerText = angleFromUpwind;
    // ヒール角の更新（見栄えのため、少しランダムに揺らす）
    let heelVal = Math.round(Math.abs(boat.heel) + (Math.random() * 0.5));
    document.getElementById('heel-angle-val').innerText = heelVal;
    document.getElementById('msg').innerText = msg;

    // セールゲージの更新
    const gaugeHeight = boat.sailTightness * 100;
    document.getElementById('sail-gauge-fill').style.height = gaugeHeight + '%';

    if (boat.sailTightness > 0.5) {
        sailBtn.classList.add('active');
    } else {
        sailBtn.classList.remove('active');
    }
}

/**
 * 描画処理
 */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 波背景
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    let time = Date.now() / 1000;
    for (let i = -2; i < 10; i++) {
        let yOffset = (time * 50) % 200;
        let baseY = i * 200 + yOffset;
        ctx.beginPath();
        for (let x = 0; x < canvas.width + 100; x += 30) {
            let waveY = baseY + Math.sin(x / 100 + time) * 15;
            if (x === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
    }

    // 星
    ctx.save();
    ctx.fillStyle = "#FFD700";
    ctx.shadowColor = "white";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(star.x + Math.cos((18 + i * 72) / 180 * Math.PI) * star.size,
            star.y + Math.sin((18 + i * 72) / 180 * Math.PI) * star.size);
        ctx.lineTo(star.x + Math.cos((54 + i * 72) / 180 * Math.PI) * star.size / 2,
            star.y + Math.sin((54 + i * 72) / 180 * Math.PI) * star.size / 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 船体
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);

    // ヒール（傾き）を視覚的に表現（船体の幅を狭めることで表現）
    let heelScale = Math.cos(boat.heel * Math.PI / 180);
    ctx.scale(1, heelScale);

    ctx.fillStyle = "#F5F5F5";
    ctx.beginPath();
    ctx.moveTo(25, 0);
    ctx.bezierCurveTo(10, 15, -15, 15, -20, 10);
    ctx.lineTo(-20, -10);
    ctx.bezierCurveTo(-15, -15, 10, -15, 25, 0);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = "#666";
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(10, 0); ctx.stroke();

    // 帆（セール）
    if (boat.sailTightness > 0 || boat.speed > 0.5) {
        let diff = Math.atan2(Math.sin(windAngle - boat.angle), Math.cos(windAngle - boat.angle));
        let sailAngle = -diff / 2; // 風下にセールが流れるように修正
        if (Math.abs(diff) > Math.PI * 0.8) sailAngle = 0;

        ctx.save();
        ctx.rotate(sailAngle);
        // セールの張り具合（透明度）
        ctx.globalAlpha = 0.3 + boat.sailTightness * 0.7;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.moveTo(8, 0);
        // セールの膨らみ具合（スピードと張り具合に連動し、風下側に膨らむように）
        let baseCurve = 1 + (boat.speed + 1) * boat.sailTightness;
        let curveWidth = sailAngle < 0 ? -baseCurve : baseCurve;
        ctx.quadraticCurveTo(-15, curveWidth, -25, 0);
        ctx.lineTo(8, 0);
        ctx.fill();
        ctx.strokeStyle = "#ddd";
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

document.getElementById('arrow').style.transform = `rotate(180deg)`;
gameLoop();
