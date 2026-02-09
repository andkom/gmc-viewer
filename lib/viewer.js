const SIGNATURE = 'GQ Geiger Muller Counter Data Logger';
const CPM_TO_USV = 175.43;
const CPM_TO_MR = 1754.3;
const ERRONEOUS_CPM = 15300;

const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsText(file);
});

const parseDate = (str) => {
    const date = new Date(`${str.replace(' ', 'T')}:00Z`);
    return isNaN(date.getTime()) ? null : date.getTime();
};

const parseCPM = (col1, col2) => {
    if (col1 === 'Every Second' || col1 === 'Every Minute') {
        return parseInt(col2, 10);
    }
    if (!isNaN(Number(col1))) {
        return col1.includes('.') ? parseInt(col2, 10) : parseInt(col1, 10);
    }
    return 0;
};

const parseCSV = (text) => {
    if (!text.includes(SIGNATURE)) {
        throw new Error('Bad file type or format.');
    }

    const data = new Map();

    for (const raw of text.split('\n')) {
        const line = raw.trim().replace(/^,+|,+$/g, '');
        if (!line) continue;

        const [date, col1, col2] = line.split(',');
        if (col1 === undefined || col2 === undefined) continue;

        const ts = parseDate(date);
        if (!ts) continue;

        const cpm = parseCPM(col1, col2);
        if (cpm >= 0 && cpm !== ERRONEOUS_CPM) {
            data.set(ts, cpm);
        }
    }

    return [...data.entries()].sort(([a], [b]) => a - b);
};

const parseFlags = (text) => {
    const flags = new Map();

    for (const raw of text.split('\n')) {
        const line = raw.trim().replace(/^,+|,+$/g, '');
        if (!line) continue;

        const idx = line.indexOf(',');
        if (idx === -1) continue;

        const date = line.substring(0, idx);
        const flagText = line.substring(idx + 1);
        const ts = parseDate(date);

        if (ts && flagText) {
            flags.set(ts, flagText);
        }
    }

    return [...flags.entries()]
        .sort(([a], [b]) => a - b)
        .map(([x, text]) => ({ x, title: text, text }));
};

const buildSeries = (data, flags) => {
    const cpm = [];
    const usv = [];
    const umr = [];

    for (const [ts, val] of data) {
        cpm.push([ts, val]);
        usv.push([ts, Math.round(val / CPM_TO_USV * 100) / 100]);
        umr.push([ts, Math.round(val / CPM_TO_MR * 1000) / 1000]);
    }

    const series = [
        { id: 'cpm', type: 'line', name: 'CPM', data: cpm },
        { type: 'line', name: '\u00b5Sv/h', data: usv },
        { type: 'line', name: 'mR/h', visible: false, data: umr },
    ];

    if (flags.length) {
        series.push({
            type: 'flags',
            name: 'Flags',
            shape: 'squarepin',
            onSeries: 'cpm',
            data: flags,
        });
    }

    return series;
};

const renderChart = (data, flags) => {
    new Highcharts.StockChart({
        chart: { renderTo: 'chart' },
        title: { text: 'GMC-300 Geiger Muller Counter Online Log Viewer' },
        credits: { enabled: false },
        rangeSelector: {
            buttons: [
                { type: 'hour', count: 1, text: '1h' },
                { type: 'hour', count: 3, text: '3h' },
                { type: 'hour', count: 6, text: '6h' },
                { type: 'hour', count: 12, text: '12h' },
                { type: 'day', count: 1, text: '1d' },
                { type: 'day', count: 3, text: '3d' },
                { type: 'week', count: 1, text: '1w' },
                { type: 'month', count: 1, text: '1m' },
                { type: 'month', count: 3, text: '3m' },
                { type: 'month', count: 6, text: '6m' },
                { type: 'year', count: 1, text: '1y' },
                { type: 'ytd', text: 'YTD' },
                { type: 'all', text: 'All' },
            ],
        },
        legend: {
            enabled: true,
            floating: true,
            layout: 'vertical',
            align: 'right',
            verticalAlign: 'top',
            y: 80,
        },
        yAxis: {
            min: 0,
            showFirstLabel: false,
            title: { text: 'Counts Per Minute' },
        },
        series: buildSeries(data, flags),
    });

    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('chart-section').style.display = '';
};

const showError = (msg) => {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.style.display = '';
};

const hideError = () => {
    document.getElementById('error').style.display = 'none';
};

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const dataInput = document.getElementById('data-file');
    const flagsInput = document.getElementById('flags-file');

    if (!dataInput.files.length) {
        showError('Please select data file.');
        return;
    }

    try {
        const [dataText, flagsText] = await Promise.all([
            readFile(dataInput.files[0]),
            flagsInput.files.length ? readFile(flagsInput.files[0]) : null,
        ]);

        const data = parseCSV(dataText);
        if (!data.length) {
            showError('No data.');
            return;
        }

        const flags = flagsText ? parseFlags(flagsText) : [];
        renderChart(data, flags);
    } catch (err) {
        showError(err.message);
    }
});

document.getElementById('reset-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('chart').innerHTML = '';
    document.getElementById('chart-section').style.display = 'none';
    document.getElementById('upload-section').style.display = '';
    document.getElementById('upload-form').reset();
    hideError();
});
