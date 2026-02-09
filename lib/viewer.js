const SIGNATURE = 'GQ Geiger Muller Counter Data Logger';
const CPM_TO_USV = 175.43;
const CPM_TO_MR = 1754.3;
const ERRONEOUS_CPM = 15300;

let chart = null;

const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsText(file);
});

const parseDate = (str) => {
    const date = new Date(str);
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
    if (!text) {
        throw new Error('Empty data.');
    }

    const lines = text.split('\n');

    if (lines.length < 2) {
        throw new Error('Invalid CSV data.');
    }

    if (lines.shift() !== SIGNATURE) {
        throw new Error('Invalid signature.');
    }

    lines.shift(); // remove CVS header

    const data = new Map();

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        const [date, col1, col2] = line.split(',');
        const ts = parseDate(date);
        const cpm = parseCPM(col1, col2);

        if (ts && cpm >= 0 && cpm !== ERRONEOUS_CPM) {
            data.set(ts, cpm);
        }
    }

    return [...data.entries()].sort(([a], [b]) => a - b);
};

const parseFlags = (text) => {
    const flags = new Map();

    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;

        const [date, flagText] = line.split(',');
        const ts = parseDate(date);

        if (ts && flagText) {
            flags.set(ts, flagText);
        }
    }

    return [...flags.entries()].sort(([a], [b]) => a - b);
};

const renderChart = (data, flags) => {
    const cpm = [];
    const usv = [];
    const umr = [];

    for (const [ts, val] of data) {
        cpm.push([ts, val]);
        usv.push([ts, Math.round(val / CPM_TO_USV * 100) / 100]);
        umr.push([ts, Math.round(val / CPM_TO_MR * 1000) / 1000]);
    }

    const cpmByTs = new Map(data);
    const markPointData = flags.map(([ts, title]) => {
        let cpm = cpmByTs.get(ts);
        return {
            coord: [ts, cpm],
            name: title,
            value: cpm,
        };
    });

    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('chart-section').style.display = '';

    const container = document.getElementById('chart');
    chart = echarts.init(container);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 20,
            selected: { 'mR/h': false },
        },
        toolbox: {
            feature: {
                saveAsImage: { title: 'Save as image' },
            },
        },
        grid: {
            left: 60,
            right: 120,
            bottom: 80,
            top: 40,
        },
        xAxis: {
            type: 'time',
            min: 'dataMin',
            max: 'dataMax',
        },
        yAxis: {
            type: 'value',
            name: 'Counts Per Minute',
            min: 0,
        },
        dataZoom: [
            { type: 'slider', xAxisIndex: 0, bottom: 10, start: 0, end: 100 },
            { type: 'inside', xAxisIndex: 0, start: 0, end: 100 },
        ],
        series: [
            {
                name: 'CPM',
                type: 'line',
                data: cpm,
                symbol: 'none',
                markPoint: markPointData.length ? {
                    symbol: 'pin',
                    symbolSize: 40,
                    data: markPointData,
                    label: {
                        formatter: p => p.name,
                        fontSize: 10,
                    },
                } : undefined,
            },
            {
                name: 'µSv/h',
                type: 'line',
                data: usv,
                symbol: 'none',
            },
            {
                name: 'mR/h',
                type: 'line',
                data: umr,
                symbol: 'none',
            },
        ],
    };

    chart.setOption(option);
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
            flagsInput?.files.length ? readFile(flagsInput.files[0]) : null,
        ]);

        const data = parseCSV(dataText);
        const flags = flagsText ? parseFlags(flagsText) : [];
        renderChart(data, flags);
    } catch (err) {
        showError(err.message);
    }
});

const loadFromHash = async (hash) => {
    const name = hash.replace('#', '');
    if (!name) return;
    hideError();

    try {
        const [dataText, flagsText] = await Promise.all([
            fetch(`data/${name}/data.csv`).then(r => {
                if (!r.ok) throw new Error(`Failed to load ${name} data.`);
                return r.text();
            }),
            fetch(`data/${name}/flags.csv`).then(r => r.ok ? r.text() : null),
        ]);

        const data = parseCSV(dataText);
        const flags = flagsText ? parseFlags(flagsText) : [];
        renderChart(data, flags);
    } catch (err) {
        showError(err.message);
    }
};

document.getElementById('example-link').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = e.target.hash;
    loadFromHash(e.target.hash);
});

document.getElementById('reset-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (chart) {
        chart.dispose();
        chart = null;
    }
    document.getElementById('chart').innerHTML = '';
    document.getElementById('chart-section').style.display = 'none';
    document.getElementById('upload-section').style.display = '';
    document.getElementById('upload-form').reset();
    history.replaceState(null, '', location.pathname);
    hideError();
});

window.addEventListener('resize', () => {
    if (chart) chart.resize();
});

if (location.hash) {
    loadFromHash(location.hash);
}
