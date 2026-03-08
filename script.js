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

// ------------- Canvas Drawing Function -------------

async function drawGraphAnimated(canvasId, path, maxTrack = 199) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const paddingX = 30;
    const paddingY = 20;
    const usableWidth = width - (paddingX * 2);
    const usableHeight = height - (paddingY * 2);

    // Draw base track line
    ctx.beginPath();
    ctx.moveTo(paddingX, paddingY);
    ctx.lineTo(width - paddingX, paddingY);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 4;
    ctx.stroke();

    if (path.length === 0) return;

    // Helper to map track to X coordinate
    const getX = (val) => paddingX + (val / maxTrack) * usableWidth;

    const stepY = usableHeight / (path.length > 1 ? path.length - 1 : 1);

    // Initial node
    drawNode(ctx, getX(path[0]), paddingY, path[0], true);

    // Animate Path Lines and next nodes
    for (let i = 1; i < path.length; i++) {
        let startX = getX(path[i - 1]);
        let startY = paddingY + ((i - 1) * stepY);
        let endX = getX(path[i]);
        let endY = paddingY + (i * stepY);

        await animateLineAndNode(ctx, startX, startY, endX, endY, path[i]);
    }
}

function drawNode(ctx, x, y, label, isFirst = false) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = isFirst ? "#E0563F" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "#412653";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#ccc";
    ctx.font = "10px sans-serif";
    ctx.fillText(label.toString(), x + 8, y + 4);
}

function animateLineAndNode(ctx, startX, startY, endX, endY, nextLabel) {
    return new Promise(resolve => {
        let progress = 0;
        const speed = 0.05; // Animation speed

        function step() {
            progress += speed;
            if (progress > 1) progress = 1;

            let currentX = startX + (endX - startX) * progress;
            let currentY = startY + (endY - startY) * progress;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = "#D174D2";
            ctx.lineWidth = 2;
            ctx.stroke();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                drawNode(ctx, endX, endY, nextLabel);
                // Pause slightly between segments
                setTimeout(resolve, 300);
            }
        }
        requestAnimationFrame(step);
    });
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
    document.getElementById('fcfs-total-score').textContent = "0";
    document.getElementById('fcfs-order-display').textContent = "...";

    // Smooth scroll down to results container immediately
    document.getElementById('fcfs-results').scrollIntoView({ behavior: 'smooth' });

    // Ensure section is visible for canvas to draw properly
    setTimeout(async () => {
        await drawGraphAnimated('fcfs-canvas', path);

        // Populate Order Display after animation
        document.getElementById('fcfs-order-display').textContent = path.join(' \u2192 ');

        // Populate Calc Table after animation
        for (let i = 0; i < path.length - 1; i++) {
            const tr = document.createElement('tr');
            const tdDesc = document.createElement('td');
            tdDesc.textContent = `${path[i]} \u2192 ${path[i + 1]}`;
            const tdDist = document.createElement('td');
            tdDist.textContent = Math.abs(path[i] - path[i + 1]);
            tr.appendChild(tdDesc);
            tr.appendChild(tdDist);
            tbody.appendChild(tr);
        }

        // Total Score
        document.getElementById('fcfs-total-score').textContent = movement;
        runBtn.disabled = false;
    }, 500);
});


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
