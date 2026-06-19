let isLoggedIn = true; // Switch to false to present presentation login screen sequence
let currentChartInstance = null;

// Mock Datasets with real-time variables
const alertLogs = [
    { time: '2026-06-19 21:12', resource: 'Block E Cluster Grid', type: 'Surge Warning (>110kW)', status: 'Active' },
    { time: '2026-06-19 14:05', resource: 'Server Array Node 4', type: 'Idle Leakage Flagged', status: 'Resolved' }
];

const telemetryData = {
    day: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        datasets: [{
            label: 'Real-time Demand (kW)',
            data: [140, 115, 290, 410, 380, 312],
            borderColor: '#00f2fe',
            backgroundColor: 'rgba(0, 242, 254, 0.05)',
            fill: true,
            tension: 0.4
        }]
    },
    week: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Aggregated Resource Draw (MWh)',
            data: [2.4, 2.8, 3.1, 2.9, 2.1, 1.4, 1.1],
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.05)',
            fill: true,
            tension: 0.4
        }]
    }
};

function checkAuth() {
    if (isLoggedIn) {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderChart('day');
        renderAlertLogs();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}

// Router for switching tabs smoothly
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('data-target');
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.view-section').forEach(section => {
            section.id === `${target}-view` ? section.classList.remove('hidden') : section.classList.add('hidden');
        });
        
        if(target === 'dashboard') {
            setTimeout(() => renderChart('day'), 30);
        }
    });
});

function renderChart(timeframe) {
    const ctx = document.getElementById('usageChart').getContext('2d');
    if (currentChartInstance) currentChartInstance.destroy();

    currentChartInstance = new Chart(ctx, {
        type: 'line',
        data: telemetryData[timeframe],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#9ca3af' } },
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

// Interactive feature: Simulating UI optimization action to show judges
window.applyOptimization = function(cardId, scoreBump) {
    const card = document.getElementById(cardId);
    card.style.opacity = '0.4';
    card.style.pointerEvents = 'none';
    
    // Dynamic update showing the system working
    const scoreEl = document.getElementById('eco-score');
    let currentScore = parseInt(scoreEl.innerText);
    scoreEl.innerText = `${currentScore + scoreBump}%`;
    
    alert(`Optimization deployed successfully. System baseline reconfigured.`);
};

function renderAlertLogs() {
    document.getElementById('alert-logs-tbody').innerHTML = alertLogs.map(log => `
        <tr>
            <td>${log.time}</td>
            <td><strong>${log.resource}</strong></td>
            <td>${log.type}</td>
            <td><span style="color: ${log.status === 'Active' ? '#f59e0b' : '#10b981'}">${log.status}</span></td>
        </tr>
    `).join('');
}

document.querySelectorAll('.toggle-chart').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.toggle-chart').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderChart(e.target.getAttribute('data-time'));
    });
});

document.getElementById('logout-btn').addEventListener('click', () => { isLoggedIn = false; checkAuth(); });
document.getElementById('auth-form').addEventListener('submit', (e) => { e.preventDefault(); isLoggedIn = true; checkAuth(); });

checkAuth();