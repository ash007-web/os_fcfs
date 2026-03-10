// ------------- Utility Functions -------------

function parseRequests(inputStr) {
    return inputStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

function calculateMovementAndPath(head, requests, algo) {
    let currentHead = head;
    let path = [head];
    let movement = 0;
    let reqs = [...requests];

    if (algo === 'FCFS') {
        reqs.forEach(req => {
            movement += Math.abs(currentHead - req);
            currentHead = req;
            path.push(currentHead);
        });
    } else if (algo === 'SSTF') {
        while (reqs.length > 0) {
            let closestIdx = 0;
            let minDiff = Infinity;
            reqs.forEach((req, idx) => {
                let diff = Math.abs(currentHead - req);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = idx;
                }
            });
            let nextReq = reqs.splice(closestIdx, 1)[0];
            movement += Math.abs(currentHead - nextReq);
            currentHead = nextReq;
            path.push(currentHead);
        }
    } else if (algo === 'SCAN') {
        // Assume moving towards 199 first
        let left = reqs.filter(r => r < currentHead).sort((a, b) => b - a);
        let right = reqs.filter(r => r >= currentHead).sort((a, b) => a - b);

        right.forEach(r => { movement += Math.abs(currentHead - r); currentHead = r; path.push(currentHead); });
        // Go to end 199
        if (currentHead !== 199 && left.length > 0) {
            movement += Math.abs(currentHead - 199);
            currentHead = 199;
            path.push(currentHead);
        }
        left.forEach(r => { movement += Math.abs(currentHead - r); currentHead = r; path.push(currentHead); });

    } else if (algo === 'C-SCAN') {
        let left = reqs.filter(r => r < currentHead).sort((a, b) => a - b);
        let right = reqs.filter(r => r >= currentHead).sort((a, b) => a - b);

        right.forEach(r => { movement += Math.abs(currentHead - r); currentHead = r; path.push(currentHead); });

        if (left.length > 0) {
            // Jump to end 199 then 0
            if (currentHead !== 199) { movement += Math.abs(currentHead - 199); currentHead = 199; path.push(currentHead); }
            movement += Math.abs(currentHead - 0); currentHead = 0; path.push(currentHead);

            left.forEach(r => { movement += Math.abs(currentHead - r); currentHead = r; path.push(currentHead); });
        }
    } else if (algo === 'LOOK') {
        let left = reqs.filter(r => r < currentHead).sort((a, b) => b - a);
        let right = reqs.filter(r => r >= currentHead).sort((a, b) => a - b);

        right.forEach(r => { movement += Math.abs(currentHead - r); currentHead = r; path.push(currentHead); });
        left.forEach(r => { movement += Math.abs(currentHead - r); currentHead = r; path.push(currentHead); });
    }

    return { path, movement };
}

// ------------- Canvas Drawing & Slider Logic -------------

// Global Variables for FCFS logic and playback state
let globalFCFSPath = [];
let globalFCFSMaxTrack = 199;
let fcfsNodes = [];

let fcfsPlayback = {
    state: 'idle', // 'idle', 'playing', 'paused', 'finished', 'stepping'
    segmentIndex: 0,
    segmentProgress: 0.0,
    resolveStep: null, // used to pause/resume standard execution
    reqAnimFrame: null,
    durationPerSegment: 800
};

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Render the graphical state based on an exact point in time/progress
function renderState(ctx, width, height, paddingX, paddingY, nodes, progressIndex, segmentProgress, highlightedStepIndex = -1) {
    ctx.clearRect(0, 0, width, height);

    // Base track line
    ctx.beginPath();
    ctx.moveTo(paddingX, paddingY);
    ctx.lineTo(width - paddingX, paddingY);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 4;
    ctx.stroke();

    if (nodes.length === 0) return;

    // Lines
    for (let i = 1; i < nodes.length; i++) {
        if (i > progressIndex + 1) break;

        let startNode = nodes[i - 1];
        let endNode = nodes[i];

        let currentEndX = endNode.x;
        let currentEndY = endNode.y;

        let isCurrentSegment = (i === progressIndex + 1);
        if (isCurrentSegment) {
            currentEndX = startNode.x + (endNode.x - startNode.x) * segmentProgress;
            currentEndY = startNode.y + (endNode.y - startNode.y) * segmentProgress;
        }

        let grad = ctx.createLinearGradient(startNode.x, startNode.y, endNode.x, endNode.y);
        grad.addColorStop(0, "#FF2E63");
        grad.addColorStop(1, "#08D9D6");

        ctx.beginPath();
        ctx.moveTo(startNode.x, startNode.y);
        ctx.lineTo(currentEndX, currentEndY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = (highlightedStepIndex === i || (highlightedStepIndex === -1 && isCurrentSegment)) ? 4 : 2;

        if (highlightedStepIndex !== -1 && highlightedStepIndex !== i) {
            ctx.globalAlpha = 0.2; // Dim unselected path segments
        } else {
            ctx.globalAlpha = 1.0;
        }

        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Pending nodes (faded)
    for (let i = progressIndex + 1; i < nodes.length; i++) {
        drawSolidNode(ctx, nodes[i].x, nodes[i].y, nodes[i].label, "#EAEAEA", "#412653", 2, 0.4);
    }

    // Visited nodes
    for (let i = 0; i <= progressIndex; i++) {
        let isInitial = i === 0;
        let nInfo = nodes[i];
        let color = isInitial ? "#FF2E63" : "#08D9D6";

        let opacity = 1.0;
        if (i < progressIndex && highlightedStepIndex === -1) {
            opacity = 0.6; // Fade older visited nodes
        }
        if (highlightedStepIndex !== -1) {
            if (i === highlightedStepIndex - 1 || i === highlightedStepIndex) opacity = 1.0;
            else opacity = 0.3;
        }

        drawSolidNode(ctx, nInfo.x, nInfo.y, nInfo.label, color, "#fff", isInitial ? 5 : 4, opacity);
    }

    // Moving head point on graph
    if (segmentProgress > 0 && segmentProgress < 1 && progressIndex + 1 < nodes.length) {
        let startNode = nodes[progressIndex];
        let endNode = nodes[progressIndex + 1];
        let curX = startNode.x + (endNode.x - startNode.x) * segmentProgress;
        let curY = startNode.y + (endNode.y - startNode.y) * segmentProgress;
        drawSolidNode(ctx, curX, curY, "", "#FF2E63", "#fff", 4, 1.0);
    }
}

// Draw static nodes wrapper
function drawSolidNode(ctx, x, y, label, bgColor, borderColor, radius, opacity) {
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = bgColor;
    ctx.fill();
    if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    if (label !== "") {
        ctx.fillStyle = "#EAEAEA";
        ctx.font = "10px sans-serif";
        ctx.fillText(label.toString(), x + 8, y + 4);
    }
    ctx.globalAlpha = 1.0;
}

// Master initialization func (handles setup, but waits for user Play)
function initializeFCFSGraph(canvasId, path, maxTrack = 199) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    globalFCFSPath = path;
    globalFCFSMaxTrack = maxTrack;

    const paddingX = 30;
    const paddingY = 20;
    const usableWidth = width - (paddingX * 2);
    const usableHeight = height - (paddingY * 2);
    const stepY = usableHeight / (path.length > 1 ? path.length - 1 : 1);
    const getX = (val) => paddingX + (val / maxTrack) * usableWidth;

    fcfsNodes = path.map((val, i) => ({
        x: getX(val),
        y: paddingY + (i * stepY),
        label: val
    }));

    // Reset State
    fcfsPlayback.state = 'idle';
    fcfsPlayback.segmentIndex = 0;
    fcfsPlayback.segmentProgress = 0.0;
    if (fcfsPlayback.reqAnimFrame) cancelAnimationFrame(fcfsPlayback.reqAnimFrame);

    window.fcfsCtx = ctx;
    window.fcfsWidth = width;
    window.fcfsHeight = height;
    window.fcfsPadX = paddingX;
    window.fcfsPadY = paddingY;

    // Render Initial Frame (idle)
    updateGraphAndSlider(0, 0.0, -1);
    document.getElementById('play-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('next-btn').disabled = false;
    document.getElementById('reset-btn').disabled = false;

    // Bind Hover Sync function to window
    window.renderFCFSGraphStep = function (stepIndex) {
        if (fcfsPlayback.state !== 'playing') {
            updateGraphAndSlider(fcfsPlayback.segmentIndex, fcfsPlayback.segmentProgress, stepIndex);
        }
    };
}

// Function to update graph UI AND the new Slider Head UI simultaneously
function updateGraphAndSlider(progressIndex, segmentProgress, highlightedStepIndex = -1) {
    if (!window.fcfsCtx || fcfsNodes.length === 0) return;

    // Draw Graph
    renderState(window.fcfsCtx, window.fcfsWidth, window.fcfsHeight, window.fcfsPadX, window.fcfsPadY, fcfsNodes, progressIndex, segmentProgress, highlightedStepIndex);

    // Calculate Slider Values
    let curTrack = fcfsNodes[progressIndex].label;
    if (progressIndex + 1 < fcfsNodes.length && segmentProgress > 0) {
        let startTrack = fcfsNodes[progressIndex].label;
        let endTrack = fcfsNodes[progressIndex + 1].label;
        curTrack = Math.round(startTrack + (endTrack - startTrack) * segmentProgress);
    }

    // Update Slider UI
    const headTrackerText = document.getElementById('fcfs-head-tracker');
    if (headTrackerText) headTrackerText.textContent = curTrack;

    const sliderHead = document.getElementById('fcfs-slider-head');
    if (sliderHead) {
        let trackPerc = (curTrack / globalFCFSMaxTrack) * 100;
        sliderHead.style.left = `${trackPerc}%`;
    }
}

// ------------- FCFS Simulator Setup -------------

document.getElementById('fcfs-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const head = parseInt(document.getElementById('fcfs-head').value, 10);
    const reqsStr = document.getElementById('fcfs-requests').value;
    const reqs = parseRequests(reqsStr);

    if (isNaN(head) || reqs.length === 0) return;

    // Calculate
    const { path, movement } = calculateMovementAndPath(head, reqs, 'FCFS');

    // Unhide results
    document.getElementById('fcfs-results').classList.remove('hidden');

    // Viz (Animated)
    const runBtn = document.querySelector('#fcfs-form button[type="submit"]');
    runBtn.disabled = true; // Disable button while animating

    // Clear the calc table before animating
    const tbody = document.querySelector('#fcfs-calc-table tbody');
    tbody.innerHTML = '';

    const stepGrid = document.getElementById('fcfs-step-grid');
    stepGrid.innerHTML = '';

    // Clear formula equations list
    const mathCalcList = document.getElementById('fcfs-math-calc-list');
    if (mathCalcList) mathCalcList.innerHTML = '';

    document.getElementById('fcfs-total-score').textContent = "0";
    if (document.getElementById('fcfs-math-total')) document.getElementById('fcfs-math-total').textContent = "0";
    document.getElementById('fcfs-order-display').textContent = "...";

    document.getElementById('fcfs-avg-score').textContent = "0";
    document.getElementById('fcfs-seek-calc-text').textContent = "100 / 10 = 10 tracks";
    document.getElementById('fcfs-seek-progress').style.background = `conic-gradient(var(--accent-1) 0%, rgba(255,255,255,0.1) 0%)`;

    // Smooth scroll down to results container immediately
    document.getElementById('fcfs-results').scrollIntoView({ behavior: 'smooth' });

    // Initialize the logic without starting the animation automatically
    setTimeout(() => {
        initializeFCFSGraph('fcfs-canvas', path, 199);

        // Populate Order Display
        document.getElementById('fcfs-order-display').textContent = path.join(' \u2192 ');

        // Populate Calc Table and Step-by-Step cards
        for (let i = 0; i < path.length - 1; i++) {
            let dist = Math.abs(path[i] - path[i + 1]);

            // Calc Table
            const tr = document.createElement('tr');
            const tdDesc = document.createElement('td');
            tdDesc.textContent = `${path[i]} \u2192 ${path[i + 1]}`;
            const tdDist = document.createElement('td');
            tdDist.textContent = dist;
            tr.appendChild(tdDesc);
            tr.appendChild(tdDist);
            tbody.appendChild(tr);

            // Math Equations Calculation Entry
            if (mathCalcList) {
                const mathDiv = document.createElement('div');
                mathDiv.classList.add('fade-in');
                mathDiv.style.animationDelay = `${i * 100}ms`;
                mathDiv.innerHTML = `|${path[i + 1]} - ${path[i]}| = ${dist}`;
                mathCalcList.appendChild(mathDiv);
            }

            // Step Card
            const card = document.createElement('div');
            card.className = 'step-card fade-in';
            card.id = `fcfs-step-card-${i}`; // id for programmatic logic
            card.style.animationDelay = `${i * 100}ms`;
            card.innerHTML = `
                <div class="step-card-num">Step ${i + 1}</div>
                <div class="step-card-desc">Head moves ${path[i]} &rarr; ${path[i + 1]}</div>
                <div class="step-card-dist">Distance = ${dist}</div>
            `;

            // Allow Hovering (mouseenter/mouseleave) to preview, Click to lock
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('active-locked') && fcfsPlayback.state !== 'playing') {
                    if (window.renderFCFSGraphStep) window.renderFCFSGraphStep(i + 1);
                }
            });

            card.addEventListener('mouseleave', () => {
                if (fcfsPlayback.state === 'playing') return;
                let lockedActive = document.querySelector('.step-card.active-locked');
                if (!card.classList.contains('active-locked')) {
                    if (lockedActive) {
                        let lockedIdx = Array.from(stepGrid.children).indexOf(lockedActive);
                        if (lockedIdx > -1 && window.renderFCFSGraphStep) window.renderFCFSGraphStep(lockedIdx + 1);
                    } else {
                        // Reset to current progress
                        updateGraphAndSlider(fcfsPlayback.segmentIndex, fcfsPlayback.segmentProgress, -1);
                    }
                }
            });

            card.addEventListener('click', () => {
                if (fcfsPlayback.state === 'playing') pauseSim(); // freeze playback conceptually

                document.querySelectorAll('.step-card').forEach(c => {
                    c.classList.remove('active');
                    c.classList.remove('active-locked');
                });
                card.classList.add('active');
                card.classList.add('active-locked');
                if (window.renderFCFSGraphStep) window.renderFCFSGraphStep(i + 1);
                document.getElementById('fcfs-canvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            stepGrid.appendChild(card);
        }

        // Reset highlights when canvas is clicked
        const canvas = document.getElementById('fcfs-canvas');
        canvas.onclick = () => {
            if (fcfsPlayback.state === 'playing') return;
            document.querySelectorAll('.step-card').forEach(c => {
                c.classList.remove('active');
                c.classList.remove('active-locked');
            });
            updateGraphAndSlider(fcfsPlayback.segmentIndex, fcfsPlayback.segmentProgress, -1);
        };

        // Total Score
        document.getElementById('fcfs-total-score').textContent = movement;
        if (document.getElementById('fcfs-math-total')) document.getElementById('fcfs-math-total').textContent = movement;

        // Avg Seek Time
        let requestsCount = reqs.length;
        let avgSeek = (movement / requestsCount).toFixed(2);
        document.getElementById('fcfs-avg-score').textContent = avgSeek;
        document.getElementById('fcfs-seek-calc-text').textContent = `${movement} / ${requestsCount} = ${avgSeek} tracks`;

        // Expand circle incrementally
        let fillAmt = Math.min((avgSeek / 199) * 100, 100);
        document.getElementById('fcfs-seek-progress').style.background = `conic-gradient(var(--accent-1) ${fillAmt}%, rgba(255,255,255,0.1) 0%)`;

        runBtn.disabled = false;

        const ind = document.getElementById('fcfs-step-indicator');
        if (ind) ind.classList.add('hidden');

        // Ensure starting visual is clean
        document.getElementById('fcfs-slider-head').classList.remove('node-pulse');
    }, 100);
});

// ------------- Playback Controls Bindings -------------

function handleStepStart(idx) {
    if (idx >= fcfsNodes.length - 1) return;
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
    let activeCard = document.getElementById(`fcfs-step-card-${idx}`);
    if (activeCard) activeCard.classList.add('active');

    const stepInd = document.getElementById('fcfs-step-indicator');
    stepInd.classList.remove('hidden');
    document.getElementById('fcfs-step-count').innerText = (idx + 1);
    document.getElementById('fcfs-step-total').innerText = (fcfsNodes.length - 1);
    let dist = Math.abs(fcfsNodes[idx].label - fcfsNodes[idx + 1].label);
    document.getElementById('fcfs-step-details').innerHTML = `Moving from ${fcfsNodes[idx].label} &rarr; ${fcfsNodes[idx + 1].label} <br>Distance: ${dist} tracks`;
}

function handleStepEnd(idx) {
    // Pulse animation
    const sliderHead = document.getElementById('fcfs-slider-head');
    if (sliderHead) {
        sliderHead.classList.remove('node-pulse');
        void sliderHead.offsetWidth; // trigger reflow
        sliderHead.classList.add('node-pulse');
    }
}

function runSegmentAnimation(idx) {
    return new Promise(resolve => {
        let startTime = null;
        function step(time) {
            if (fcfsPlayback.state !== 'playing' && fcfsPlayback.state !== 'stepping') {
                // Return out early if paused directly
                fcfsPlayback.resolveStep = null;
                resolve();
                return;
            }

            if (!startTime) startTime = time;
            let elapsed = time - startTime;
            let t = Math.min(elapsed / fcfsPlayback.durationPerSegment, 1.0);

            // Allow resuming gracefully from mid-progress
            if (t < fcfsPlayback.segmentProgress) {
                // shift start time artificially 
                startTime = time - (fcfsPlayback.segmentProgress * fcfsPlayback.durationPerSegment);
                elapsed = time - startTime;
                t = Math.min(elapsed / fcfsPlayback.durationPerSegment, 1.0);
            }

            fcfsPlayback.segmentProgress = easeInOutQuad(t);
            updateGraphAndSlider(idx, fcfsPlayback.segmentProgress, -1);

            if (t < 1.0) {
                fcfsPlayback.reqAnimFrame = requestAnimationFrame(step);
            } else {
                fcfsPlayback.segmentProgress = 1.0;
                updateGraphAndSlider(idx, 1.0, -1);
                handleStepEnd(idx);
                fcfsPlayback.resolveStep = null;
                setTimeout(resolve, 300); // 300ms pause matching the pulse
            }
        }
        fcfsPlayback.resolveStep = resolve;
        fcfsPlayback.reqAnimFrame = requestAnimationFrame(step);
    });
}

function playSim() {
    if (fcfsNodes.length === 0 || fcfsPlayback.state === 'finished') return;
    fcfsPlayback.state = 'playing';

    document.getElementById('play-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;
    document.getElementById('next-btn').disabled = true;

    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active-locked'));

    (async function loop() {
        while (fcfsPlayback.segmentIndex < fcfsNodes.length - 1) {
            if (fcfsPlayback.state !== 'playing') return; // Interrupted

            if (fcfsPlayback.segmentProgress === 0.0) {
                handleStepStart(fcfsPlayback.segmentIndex);
            }

            await runSegmentAnimation(fcfsPlayback.segmentIndex);

            if (fcfsPlayback.state !== 'playing') return; // Might have paused during wait

            // Move to next logical step
            fcfsPlayback.segmentIndex++;
            fcfsPlayback.segmentProgress = 0.0;
        }

        // Finished
        fcfsPlayback.state = 'finished';
        document.getElementById('play-btn').disabled = true;
        document.getElementById('pause-btn').disabled = true;
        document.getElementById('next-btn').disabled = true;
        document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
        const stepInd = document.getElementById('fcfs-step-indicator');
        if (stepInd) stepInd.classList.add('hidden');
    })();
}

function pauseSim() {
    if (fcfsPlayback.state !== 'playing' && fcfsPlayback.state !== 'stepping') return;
    fcfsPlayback.state = 'paused';
    if (fcfsPlayback.reqAnimFrame) cancelAnimationFrame(fcfsPlayback.reqAnimFrame);
    if (fcfsPlayback.resolveStep) {
        fcfsPlayback.resolveStep();
        fcfsPlayback.resolveStep = null;
    }

    document.getElementById('play-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('next-btn').disabled = false;
}

async function nextStep() {
    if (fcfsNodes.length === 0 || fcfsPlayback.segmentIndex >= fcfsNodes.length - 1) return;
    if (fcfsPlayback.state === 'playing') pauseSim();

    fcfsPlayback.state = 'stepping';
    document.getElementById('play-btn').disabled = true;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('next-btn').disabled = true;

    if (fcfsPlayback.segmentProgress === 0.0) {
        handleStepStart(fcfsPlayback.segmentIndex);
    }

    await runSegmentAnimation(fcfsPlayback.segmentIndex);

    fcfsPlayback.segmentIndex++;
    fcfsPlayback.segmentProgress = 0.0;

    if (fcfsPlayback.segmentIndex < fcfsNodes.length - 1) {
        fcfsPlayback.state = 'paused';
        document.getElementById('play-btn').disabled = false;
        document.getElementById('pause-btn').disabled = true;
        document.getElementById('next-btn').disabled = false;
    } else {
        fcfsPlayback.state = 'finished';
        document.getElementById('play-btn').disabled = true;
        document.getElementById('pause-btn').disabled = true;
        document.getElementById('next-btn').disabled = true;
        document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
        const stepInd = document.getElementById('fcfs-step-indicator');
        if (stepInd) stepInd.classList.add('hidden');
    }
}

function resetSim() {
    pauseSim();
    fcfsPlayback.state = 'idle';
    fcfsPlayback.segmentIndex = 0;
    fcfsPlayback.segmentProgress = 0.0;

    document.getElementById('play-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('next-btn').disabled = false;

    document.querySelectorAll('.step-card').forEach(c => {
        c.classList.remove('active');
        c.classList.remove('active-locked');
    });

    const stepInd = document.getElementById('fcfs-step-indicator');
    if (stepInd) stepInd.classList.add('hidden');
    const sliderHead = document.getElementById('fcfs-slider-head');
    if (sliderHead) sliderHead.classList.remove('node-pulse');

    updateGraphAndSlider(0, 0.0, -1);
}

document.getElementById('play-btn').addEventListener('click', playSim);
document.getElementById('pause-btn').addEventListener('click', pauseSim);
document.getElementById('next-btn').addEventListener('click', nextStep);
document.getElementById('reset-btn').addEventListener('click', resetSim);


// ------------- Generic Graph Animation (Used for Comparison) -------------
window.compAnimFrames = window.compAnimFrames || {};
window.compAnimRuns = window.compAnimRuns || {};

async function drawGraphAnimated(canvasId, path, maxTrack = 199) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Concurrency protection: cancel any existing frame and register new run identity
    if (window.compAnimFrames[canvasId]) {
        cancelAnimationFrame(window.compAnimFrames[canvasId]);
    }
    const currentRunId = Symbol();
    window.compAnimRuns[canvasId] = currentRunId;

    const isComparison = canvasId.startsWith('comp-');
    if (isComparison) {
        // Compact vertical setup: Lock height and widths
        canvas.width = canvas.parentElement.clientWidth - 20; // 10px padding bounds
        canvas.height = Math.min(25 + (path.length * 8) + 10, 110);
    }

    const width = canvas.width;
    const height = canvas.height;

    const paddingX = isComparison ? 20 : 30;
    const paddingY = isComparison ? 15 : 20;
    const usableWidth = width - (paddingX * 2);
    const usableHeight = height - (paddingY * 2);
    const stepY = isComparison ? 8 : usableHeight / (path.length > 1 ? path.length - 1 : 1);
    const baseY = isComparison ? 20 : paddingY;
    const getX = (val) => paddingX + (val / maxTrack) * usableWidth;

    const nodes = path.map((val, i) => {
        let yPos;
        if (isComparison) {
            yPos = baseY + (i * 8);
        } else {
            yPos = paddingY + (i * stepY);
        }
        return {
            x: getX(val),
            y: yPos,
            label: val
        };
    });

    function renderStateComparison(progressIndex, segmentProgress) {
        ctx.clearRect(0, 0, width, height);

        // Base track line
        ctx.beginPath();
        ctx.moveTo(paddingX, paddingY);
        ctx.lineTo(width - paddingX, paddingY);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 4;
        ctx.stroke();

        if (isComparison) {
            // Faint horizontal guides
            for (let i = 0; i < nodes.length; i++) {
                let gy = baseY + (i * 8);
                ctx.beginPath();
                ctx.moveTo(paddingX, gy);
                ctx.lineTo(width - paddingX, gy);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        if (nodes.length === 0) return;

        // Lines
        for (let i = 1; i < nodes.length; i++) {
            if (i > progressIndex + 1) break;

            let startNode = nodes[i - 1];
            let endNode = nodes[i];

            let currentEndX = endNode.x;
            let currentEndY = endNode.y;

            let isCurrentSegment = (i === progressIndex + 1);
            if (isCurrentSegment) {
                currentEndX = startNode.x + (endNode.x - startNode.x) * segmentProgress;
                currentEndY = startNode.y + (endNode.y - startNode.y) * segmentProgress;
            }

            let grad = ctx.createLinearGradient(startNode.x, startNode.y, endNode.x, endNode.y);
            grad.addColorStop(0, "#FF2E63");
            grad.addColorStop(1, "#08D9D6");

            ctx.beginPath();
            ctx.moveTo(startNode.x, startNode.y);
            ctx.lineTo(currentEndX, currentEndY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isComparison ? 2.5 : 2;

            // Faint past lines
            if (!isCurrentSegment && isComparison) {
                ctx.globalAlpha = 0.5;
            } else {
                ctx.globalAlpha = 1.0;
            }

            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Pending nodes (faded)
        for (let i = progressIndex + 1; i < nodes.length; i++) {
            drawSolidNode(ctx, nodes[i].x, nodes[i].y, isComparison ? "" : nodes[i].label, "#EAEAEA", "#412653", isComparison ? 2.5 : 2, 0.4);
        }

        // Visited nodes
        for (let i = 0; i <= progressIndex; i++) {
            let isInitial = i === 0;
            let nInfo = nodes[i];
            let color = isInitial ? "#FF2E63" : "#08D9D6";

            let opacity = 1.0;
            if (isComparison && i < progressIndex) opacity = 0.5;

            let rad = isComparison ? (isInitial ? 3.5 : 3) : (isInitial ? 4 : 3);
            drawSolidNode(ctx, nInfo.x, nInfo.y, isComparison ? "" : nInfo.label, color, "#fff", rad, opacity);
        }

        // Moving head point
        if (segmentProgress > 0 && segmentProgress < 1 && progressIndex + 1 < nodes.length) {
            let startNode = nodes[progressIndex];
            let endNode = nodes[progressIndex + 1];
            let curX = startNode.x + (endNode.x - startNode.x) * segmentProgress;
            let curY = startNode.y + (endNode.y - startNode.y) * segmentProgress;
            drawSolidNode(ctx, curX, curY, "", "#FF2E63", "#fff", isComparison ? 3 : 3, 1.0);
        }
    }

    if (nodes.length <= 1) {
        renderStateComparison(0, 1.0);
        return;
    }

    const durationPerSegment = 600;

    for (let i = 0; i < nodes.length - 1; i++) {
        // Abort this animation run if a newer one was started
        if (window.compAnimRuns[canvasId] !== currentRunId) return;

        await new Promise(resolve => {
            let startTime = null;
            function step(time) {
                if (window.compAnimRuns[canvasId] !== currentRunId) {
                    resolve();
                    return;
                }

                if (!startTime) startTime = time;
                let elapsed = time - startTime;
                let t = Math.min(elapsed / durationPerSegment, 1.0);

                let easedT = easeInOutQuad(t);
                renderStateComparison(i, easedT);

                if (t < 1.0) {
                    window.compAnimFrames[canvasId] = requestAnimationFrame(step);
                } else {
                    renderStateComparison(i + 1, 0.0);
                    setTimeout(resolve, 80);
                }
            }
            window.compAnimFrames[canvasId] = requestAnimationFrame(step);
        });
    }

    if (window.compAnimRuns[canvasId] === currentRunId) {
        renderStateComparison(nodes.length - 1, 1.0);
    }
}


// ------------- Comparison Simulator Setup -------------

document.getElementById('comp-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const head = parseInt(document.getElementById('comp-head').value, 10);
    const reqsStr = document.getElementById('comp-requests').value;
    const reqs = parseRequests(reqsStr);

    if (isNaN(head) || reqs.length === 0) return;

    const algos = ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK'];
    const results = [];

    // Since comparison runs multiple concurrently, use the animated draw graph but immediately populate tables
    algos.forEach(algo => {
        const res = calculateMovementAndPath(head, reqs, algo);
        results.push({ algo, path: res.path, movement: res.movement });

        const algoId = algo.toLowerCase().replace('-', '');
        drawGraphAnimated(`comp-${algoId}-canvas`, res.path);
        document.getElementById(`comp-${algoId}-order`).textContent = res.path.join(' \u2192 ');
    });

    // Unhide Results
    document.getElementById('comp-results').classList.remove('hidden');

    // Comparison Table Update
    const tbody = document.querySelector('#comparison-table tbody');
    tbody.innerHTML = '';

    let minMove = Math.min(...results.map(r => r.movement));

    results.forEach(res => {
        const tr = document.createElement('tr');
        if (res.movement === minMove) tr.classList.add('best-algo');

        const tdAlgo = document.createElement('td');
        tdAlgo.textContent = res.algo;
        if (res.movement === minMove) tdAlgo.textContent += ' (Best)';

        const tdMove = document.createElement('td');
        tdMove.textContent = res.movement;

        tr.appendChild(tdAlgo);
        tr.appendChild(tdMove);
        tbody.appendChild(tr);
    });

    // Smooth scroll
    document.getElementById('comp-results').scrollIntoView({ behavior: 'smooth' });
});

// ------------- FCFS CPU Simulator Setup -------------
let processCount = 4;
let perfChartInstance = null;
let metricsPieInstance = null;

const addBtn = document.getElementById('add-process-btn');
const rmBtn = document.getElementById('remove-process-btn');
const cpuRunBtn = document.getElementById('run-cpu-sim-btn');
const tbodyCpu = document.querySelector('#process-table tbody');

if (addBtn) {
    addBtn.addEventListener('click', () => {
        processCount++;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>P${processCount}</td>
            <td><input type="number" class="process-arrival cpu-input" value="${Math.floor(Math.random() * 10)}" min="0"></td>
            <td><input type="number" class="process-burst cpu-input" value="${Math.floor(Math.random() * 10) + 1}" min="1"></td>
        `;
        tbodyCpu.appendChild(row);
    });
}

if (rmBtn) {
    rmBtn.addEventListener('click', () => {
        if (processCount > 1) {
            tbodyCpu.removeChild(tbodyCpu.lastElementChild);
            processCount--;
        }
    });
}

if (cpuRunBtn) {
    cpuRunBtn.addEventListener('click', () => {
        const rows = document.querySelectorAll('#process-table tbody tr');
        let processes = [];

        rows.forEach((row, index) => {
            const id = `P${index + 1}`;
            const arrival = parseInt(row.querySelector('.process-arrival').value) || 0;
            const burst = parseInt(row.querySelector('.process-burst').value) || 1;
            processes.push({ id, arrival, burst, start: 0, completion: 0, waiting: 0, turnaround: 0, response: 0 });
        });

        processes.sort((a, b) => a.arrival - b.arrival);

        let currentTime = 0;
        let totalBurst = 0;
        let totalWait = 0;
        let totalTurn = 0;
        let totalResp = 0;
        let ganttBlocks = [];

        processes.forEach(p => {
            if (currentTime < p.arrival) {
                ganttBlocks.push({ type: 'idle', start: currentTime, end: p.arrival, duration: p.arrival - currentTime });
                currentTime = p.arrival;
            }
            p.start = currentTime;
            p.completion = currentTime + p.burst;
            p.turnaround = p.completion - p.arrival;
            p.waiting = p.turnaround - p.burst;
            p.response = p.start - p.arrival;

            ganttBlocks.push({ type: 'process', id: p.id, start: p.start, end: p.completion, duration: p.burst });

            currentTime = p.completion;
            totalBurst += p.burst;
            totalWait += p.waiting;
            totalTurn += p.turnaround;
            totalResp += p.response;
        });

        const n = processes.length;
        const avgWait = (totalWait / n).toFixed(2);
        const avgTurn = (totalTurn / n).toFixed(2);
        const avgResp = (totalResp / n).toFixed(2);
        const firstArrival = processes[0].arrival;
        const finalCompletion = currentTime;
        const makespan = finalCompletion - firstArrival;
        const cpuUtil = makespan > 0 ? ((totalBurst / makespan) * 100).toFixed(2) : 100;
        const throughput = makespan > 0 ? (n / makespan).toFixed(3) : n;

        // Results table
        const resTbody = document.querySelector('#cpu-calc-table tbody');
        resTbody.innerHTML = '';
        const outProcesses = [...processes].sort((a, b) => parseInt(a.id.substring(1)) - parseInt(b.id.substring(1)));

        outProcesses.forEach(p => {
            resTbody.innerHTML += `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.arrival}</td>
                    <td>${p.burst}</td>
                    <td>${p.start}</td>
                    <td>${p.completion}</td>
                    <td>${p.waiting}</td>
                    <td>${p.turnaround}</td>
                    <td>${p.response}</td>
                </tr>
            `;
        });

        // Show panel
        const resultsPanel = document.getElementById('cpu-results-panel');
        resultsPanel.classList.remove('hidden');

        document.getElementById('dash-cpu-util').innerText = `${cpuUtil}%`;
        document.getElementById('dash-throughput').innerText = throughput;
        document.getElementById('dash-avg-wait').innerText = avgWait;
        document.getElementById('dash-avg-turn').innerText = avgTurn;
        document.getElementById('dash-avg-resp').innerText = avgResp;

        renderGanttChart(ganttBlocks, finalCompletion);
        renderCPUCharts(outProcesses, avgWait, avgTurn, avgResp);

        resultsPanel.scrollIntoView({ behavior: 'smooth' });
    });
}

function renderGanttChart(blocks, totalTime) {
    const container = document.getElementById('gantt-chart-container');
    const axis = document.getElementById('gantt-time-axis');
    container.innerHTML = '';
    axis.innerHTML = '';

    if (totalTime === 0) return;

    const colors = ['#D174D2', '#E0563F', '#58a6ff', '#3fb950', '#d29922', '#f85149'];

    blocks.forEach((bg, index) => {
        const widthPercent = (bg.duration / totalTime) * 100;
        const blockEl = document.createElement('div');
        blockEl.className = bg.type === 'idle' ? 'gantt-block gantt-idle' : 'gantt-block';
        blockEl.style.width = '0%';

        if (bg.type === 'process') {
            const colorIdx = parseInt(bg.id.substring(1)) % colors.length;
            blockEl.style.backgroundColor = colors[colorIdx];
            blockEl.innerText = bg.id;
        }

        container.appendChild(blockEl);

        setTimeout(() => {
            blockEl.style.width = `${widthPercent}%`;
        }, 100);

        if (index === 0) {
            addGanttTick(axis, bg.start, 0);
        }

        const endPercent = (bg.end / totalTime) * 100;
        addGanttTick(axis, bg.end, endPercent);
    });
}

function addGanttTick(axisContainer, time, leftPercent) {
    const tick = document.createElement('div');
    tick.className = 'gantt-tick';
    tick.style.left = `${leftPercent}%`;
    tick.innerText = time;
    axisContainer.appendChild(tick);
}

function renderCPUCharts(processes, avgWait, avgTurn, avgResp) {
    const labels = processes.map(p => p.id);
    const waitData = processes.map(p => p.waiting);
    const turnData = processes.map(p => p.turnaround);
    const respData = processes.map(p => p.response);

    Chart.defaults.color = '#fff';
    Chart.defaults.font.family = 'Inter';

    const ctxBar = document.getElementById('bar-chart-perf').getContext('2d');
    if (perfChartInstance) perfChartInstance.destroy();

    perfChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Waiting Time', data: waitData, backgroundColor: 'rgba(210, 153, 34, 0.8)' },
                { label: 'Turnaround Time', data: turnData, backgroundColor: 'rgba(209, 116, 210, 0.8)' },
                { label: 'Response Time', data: respData, backgroundColor: 'rgba(224, 86, 63, 0.8)' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { grid: { color: 'rgba(255,255,255,0.1)' } }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}
