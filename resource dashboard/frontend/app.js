const resources = {
    electricity: { label: "Electricity", unit: "kWh", color: "#c98412", icon: "zap" },
    water: { label: "Water", unit: "L", color: "#2d6fd2", icon: "droplets" },
    fuel: { label: "Transport fuel", unit: "L", color: "#0f7c86", icon: "fuel" }
};

const trendData = {
    daily: {
        dates: ["2026-06-14", "2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20"],
        labels: ["Jun 14", "Jun 15", "Jun 16", "Jun 17", "Jun 18", "Jun 19", "Jun 20"],
        electricity: [28, 31, 34, 30, 37, 44, 42],
        water: [132, 148, 151, 139, 165, 188, 176],
        fuel: [5, 6, 4, 8, 7, 11, 9]
    },
    weekly: {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        electricity: [210, 238, 251, 246],
        water: [980, 1050, 1124, 1098],
        fuel: [42, 48, 52, 50]
    },
    monthly: {
        labels: ["Mar", "Apr", "May", "Jun"],
        electricity: [890, 930, 975, 945],
        water: [4100, 4260, 4390, 4252],
        fuel: [174, 188, 196, 192]
    }
};

const state = {
    activeResource: "all",
    activeTimeframe: "daily",
    signedIn: false,
    profile: {
        name: "Guest user",
        email: "",
        homeType: "Not set",
        billingArea: "Selangor"
    },
    thresholds: {
        electricity: 40,
        water: 170,
        fuel: 8
    }
};

const canvas = document.getElementById("usageChart");
const ctx = canvas ? canvas.getContext("2d") : null;

function setupCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return rect;
}

function filteredTrendData() {
    const data = trendData[state.activeTimeframe] || trendData.daily;

    return {
        labels: data.labels || [],
        electricity: data.electricity || [],
        water: data.water || [],
        fuel: data.fuel || []
    };
}

function showPage(name) {
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
    const page = document.querySelector(`[data-page="${name}"]`);
    const pageName = page ? name : 'dashboard';
    const activePage = page || document.querySelector('[data-page="dashboard"]');
    if (activePage) activePage.classList.add('active');

    document.querySelectorAll('[data-page-link]').forEach(link => {
        link.classList.toggle('active', link.dataset.pageLink === pageName);
    });

    if (pageName === 'trends') {
        requestAnimationFrame(drawChart);
    }
}

function loadDashboard() {
    const daily = trendData.daily;

    // Safety check: ensure we have data to display
    if (!daily || !daily.electricity || daily.electricity.length === 0) return;

    const lastIndex = daily.electricity.length - 1;

    // Update the main numbers
    document.getElementById('electricityValue').textContent = daily.electricity[lastIndex];
    document.getElementById('waterValue').textContent = daily.water[lastIndex];
    document.getElementById('fuelValue').textContent = daily.fuel[lastIndex];

    // Update the statuses and styling
    ['electricity', 'water', 'fuel'].forEach(r => {
        const value = daily[r][lastIndex];
        const threshold = state.thresholds[r];

        const statusEl = document.getElementById(`${r}Status`);
        if (statusEl) {
            statusEl.textContent = value > threshold ? `Above limit by ${Math.round(value - threshold)}` : 'Within limit';
        }

        const cardEl = document.querySelector(`.metric-card[data-resource="${r}"]`);
        if (cardEl) {
            cardEl.classList.toggle('over', value > threshold);
        }
    });

    renderThresholdsPage();
    renderHistory();
    renderAlerts();
    renderProfile();
    drawChart();
}

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateField(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function renderProfile() {
    const displayName = state.signedIn ? state.profile.name : 'Guest user';
    const authLabel = state.signedIn ? 'Sign out' : 'Sign in';
    const authIcon = state.signedIn ? 'log-out' : 'log-in';

    updateText('currentUserName', displayName);
    updateText('homeType', state.profile.homeType);
    updateText('billingArea', state.profile.billingArea);
    updateText('profileStatus', state.signedIn ? 'Signed in' : 'Signed out');
    updateText(
        'profileSummaryText',
        state.signedIn
            ? `${state.profile.name} is monitoring ${state.profile.homeType.toLowerCase()} usage in ${state.profile.billingArea}.`
            : 'Sign in to personalize your dashboard profile.'
    );

    updateField('profileName', state.profile.name);
    updateField('profileEmail', state.profile.email);
    updateField('profileHomeType', state.profile.homeType);
    updateField('profileBillingArea', state.profile.billingArea);

    ['profileAuthBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.innerHTML = `<i data-lucide="${authIcon}"></i><span>${authLabel}</span>`;
    });

    if (window.lucide) lucide.createIcons();
}

function saveProfile(event) {
    event.preventDefault();
    state.profile = {
        name: document.getElementById('profileName').value.trim() || 'Guest user',
        email: document.getElementById('profileEmail').value.trim(),
        homeType: document.getElementById('profileHomeType').value,
        billingArea: document.getElementById('profileBillingArea').value.trim() || 'Selangor'
    };
    state.signedIn = true;
    renderProfile();
    showPage('dashboard');
}

function toggleAuth() {
    state.signedIn = !state.signedIn;
    if (state.signedIn && state.profile.name === 'Guest user') {
        state.profile.name = 'Dashboard user';
    }
    renderProfile();
}

function getUsageRows(timeframe = "daily") {
    const data = trendData[timeframe] || trendData.daily;
    const labels = data.labels || [];

    return labels.flatMap((label, index) => Object.keys(resources).map(resourceId => {
        const usage = Number(data[resourceId]?.[index] || 0);
        const threshold = Number(state.thresholds[resourceId] || 0);

        return {
            period: label,
            resourceId,
            usage,
            threshold,
            exceeded: usage > threshold
        };
    }));
}

function formatNumber(value) {
    return Number.isInteger(value) ? value : Number(value.toFixed(2));
}

function renderHistory() {
    const list = document.getElementById('historyList');
    if (!list) return;

    const rows = getUsageRows("daily").reverse();

    list.innerHTML = `
        <div class="table-wrap">
            <table class="usage-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Resource</th>
                        <th>Usage</th>
                        <th>Threshold</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td>${row.period}</td>
                            <td>${resources[row.resourceId].label}</td>
                            <td>${formatNumber(row.usage)} ${resources[row.resourceId].unit}</td>
                            <td>${formatNumber(row.threshold)} ${resources[row.resourceId].unit}</td>
                            <td><span class="status-pill ${row.exceeded ? 'danger' : 'ok'}">${row.exceeded ? 'Exceeded' : 'Normal'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderAlerts() {
    const list = document.getElementById('alertsList');
    if (!list) return;

    const alerts = getUsageRows("daily").filter(row => row.exceeded).reverse();
    document.getElementById('alertStatus').textContent = alerts.length ? 'Action needed' : 'Normal';
    document.getElementById('sidebarScore').textContent = alerts.length ? `${alerts.length} limits exceeded` : 'Monitoring Active';

    if (!alerts.length) {
        list.innerHTML = '<div class="empty-state">No active alerts. All resources are within their saved thresholds.</div>';
        return;
    }

    list.innerHTML = alerts.map(row => `
        <article class="alert-item">
            <i data-lucide="triangle-alert"></i>
            <div>
                <strong>${resources[row.resourceId].label} exceeded ${formatNumber(row.threshold)} ${resources[row.resourceId].unit}</strong>
                <span>${row.period} - current usage is ${formatNumber(row.usage)} ${resources[row.resourceId].unit}</span>
            </div>
        </article>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function renderThresholdsPage() {
    const list = document.getElementById('thresholdsPageList');
    if (!list) return;

    list.innerHTML = Object.keys(resources).map(res => `
        <div class="threshold-item">
            <div class="threshold-info">
                <div class="icon-box" style="color: ${resources[res].color}; background: ${resources[res].color}15">
                    <i data-lucide="${resources[res].icon}"></i>
                </div>
                <div class="threshold-details">
                    <strong>${resources[res].label}</strong>
                    <span>Current limit: ${state.thresholds[res]} ${resources[res].unit}</span>
                </div>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="threshold-value-display">${state.thresholds[res]} <small style="font-size:12px; color:var(--muted)">${resources[res].unit}</small></span>
                <button class="ghost-button edit-threshold-btn" data-resource="${res}">Edit</button>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();

    // Attach listeners for the dynamically generated buttons on the Thresholds page
    document.querySelectorAll('.edit-threshold-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.resource));
    });
}

function openModal(resourceId) {
    document.getElementById('modalTitle').textContent = `Edit ${resources[resourceId].label} Limit`;
    document.getElementById('modalUnit').textContent = resources[resourceId].unit;
    document.getElementById('modalResource').value = resourceId;
    document.getElementById('thresholdInput').value = state.thresholds[resourceId];
    document.getElementById('thresholdModal').classList.remove('hidden');
    document.getElementById('thresholdInput').focus();
}

function closeModal() {
    document.getElementById('thresholdModal').classList.add('hidden');
}

// Async function to fetch fresh data and safely update the UI
async function refreshDashboard() {
    try {
        const [dashboardRes, thresholdsRes] = await Promise.all([
            fetch('http://127.0.0.1:5000/api/dashboard'),
            fetch('http://127.0.0.1:5000/api/thresholds')
        ]);

        if (dashboardRes.ok) {
            const data = await dashboardRes.json();
            // merge top-level timeframes into existing trendData
            Object.assign(trendData, data);
        }

        if (thresholdsRes.ok) {
            const thresholds = await thresholdsRes.json();
            Object.assign(state.thresholds, thresholds);
        }
    } catch (err) {
        console.warn("Failed to fetch backend data, falling back to local data.", err);
    }

    loadDashboard();
}

// Post new thresholds to the Flask backend (accepts explicit params)
async function saveThreshold(resourceId, newValue) {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/thresholds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource_type: resourceId, new_limit: Number(newValue) })
        });

        if (response.ok) {
            console.log("Threshold saved successfully");
            state.thresholds[resourceId] = Number(newValue);
            closeModal();
            await refreshDashboard();
        } else {
            alert("Failed to save to database.");
        }
    } catch (err) {
        console.error(err);
        alert("Could not connect to the server.");
    }
}

// Small helper to wire up page navigation links and hash routing
function attachNav() {
    document.querySelectorAll('[data-page-link]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.pageLink;
            history.replaceState(null, '', `#${page}`);
            showPage(page);
        });
    });

    // If a hash is present on load, show that page
    const initialHash = window.location.hash.replace('#', '') || 'dashboard';
    showPage(initialHash);
}

function drawChart() {
    if (!canvas || !ctx) return;
    const data = filteredTrendData();
    const rect = setupCanvas();
    ctx.clearRect(0, 0, rect.width, rect.height);

    let series = ['electricity', 'water', 'fuel'];
    if (state.activeResource !== 'all') {
        series = [state.activeResource];
    }

    let values = [];
    series.forEach(s => values = values.concat(data[s].map(Number)));

    if (state.activeResource !== 'all') {
        values.push(state.thresholds[state.activeResource]);
    }

    const max = Math.max(...values, 1) * 1.2;
    const leftPad = 64;
    const rightPad = 24;
    const topPad = 28;
    const bottomPad = 58;
    const w = rect.width - leftPad - rightPad;
    const h = rect.height - topPad - bottomPad;
    const plotX = leftPad;
    const plotY = topPad;
    const xForIndex = (index) => plotX + (index / (data.labels.length - 1 || 1)) * w;
    const yForValue = (value) => plotY + (1 - value / max) * h;
    const yTicks = 4;

    ctx.strokeStyle = '#d8e3df';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#61706d';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= yTicks; i += 1) {
        const value = (max / yTicks) * i;
        const y = yForValue(value);
        ctx.beginPath();
        ctx.moveTo(plotX, y);
        ctx.lineTo(plotX + w, y);
        ctx.stroke();
        ctx.fillText(formatNumber(value), plotX - 10, y);
    }

    ctx.strokeStyle = '#17211f';
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + h);
    ctx.lineTo(plotX + w, plotY + h);
    ctx.stroke();

    if (data.labels.length) {
        ctx.fillStyle = 'var(--muted)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        data.labels.forEach((lbl, i) => {
            ctx.fillText(lbl, xForIndex(i), plotY + h + 10);
        });
    }

    ctx.fillStyle = '#17211f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.activeTimeframe[0].toUpperCase()}${state.activeTimeframe.slice(1)} period`, plotX + w / 2, rect.height - 14);

    ctx.save();
    ctx.translate(16, plotY + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Usage amount', 0, 0);
    ctx.restore();

    series.forEach(s => {
        const arr = data[s] || [];
        if (!arr.length) return;
        const pts = arr.map((value, index) => ({ x: xForIndex(index), y: yForValue(Number(value)) }));
        ctx.beginPath();
        ctx.strokeStyle = resources[s].color;
        ctx.lineWidth = 3;
        pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        pts.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    });

    // Draw the dotted threshold line if a single resource is selected
    if (state.activeResource !== 'all') {
        const threshold = state.thresholds[state.activeResource];
        if (threshold <= max) {
            const y = yForValue(threshold);
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'var(--red)';
            ctx.lineWidth = 2;
            ctx.moveTo(plotX, y);
            ctx.lineTo(plotX + w, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = 'var(--red)';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`Limit: ${formatNumber(threshold)} ${resources[state.activeResource].unit}`, plotX + w, y - 14);
        }
    }

    renderChartLegend(series);
}

function renderChartLegend(series) {
    const legend = document.getElementById('chartLegend');
    if (!legend) return;

    const items = series.map(resourceId => `
        <span class="legend-item">
            <span class="legend-swatch" style="background:${resources[resourceId].color}"></span>
            ${resources[resourceId].label}
        </span>
    `);

    if (state.activeResource !== 'all') {
        items.push(`
            <span class="legend-item">
                <span class="legend-swatch dashed"></span>
                ${resources[state.activeResource].label} threshold
            </span>
        `);
    }

    legend.innerHTML = items.join('');
}

window.addEventListener('load', () => {
    attachNav();
    // fetch live data once on load
    refreshDashboard();

    // Hook save button to call the parameterized saveThreshold
    const saveBtn = document.getElementById('saveThresholdBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const res = document.getElementById('modalResource').value;
            const val = document.getElementById('thresholdInput').value;
            saveThreshold(res, val);
        });
    }
});
// Chart filter events
const resourceFilter = document.getElementById('resourceFilter');
if (resourceFilter) {
    resourceFilter.addEventListener('change', (e) => {
        state.activeResource = e.target.value;
        drawChart();
    });
}

const timeframeFilter = document.getElementById('timeframeFilter');
if (timeframeFilter) {
    timeframeFilter.addEventListener('change', (e) => {
        state.activeTimeframe = e.target.value;
        drawChart();
    });
}

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshDashboard);
}

const profileBtn = document.getElementById('profileBtn');
if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        history.replaceState(null, '', '#profile');
        showPage('profile');
    });
}

const profileAuthBtn = document.getElementById('profileAuthBtn');
if (profileAuthBtn) {
    profileAuthBtn.addEventListener('click', toggleAuth);
}

const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', saveProfile);
}

// Modal events
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));

// Fixed: Attaches correctly to the updated function name
// Removed duplicate listener that passed the event object into `saveThreshold`

// Fixed: Correct listener for the Edit Limit buttons on the main dashboard cards
document.querySelectorAll('.edit-threshold-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        openModal(e.currentTarget.dataset.resource);
    });
});

// Initialize the app
loadDashboard();
