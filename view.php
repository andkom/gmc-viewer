<?php

if (empty($_REQUEST['n'])) {
    die('Bad request.');
}

$name = preg_replace('/[^A-Za-z0-9]+/', '', $_REQUEST['n']);

$data_file = './data/' . $name . '/data.csv';
$flags_file = './data/' . $name . '/flags.csv';

if (!file_exists($data_file) || !is_readable($data_file)) {
    die('File not found.');
}

date_default_timezone_set('UTC');

$data = parse_csv($data_file);

if (!$data) {
    die('No data.');
}

if (file_exists($flags_file) && is_readable($flags_file)) {
    $flags = parse_flags($flags_file);
} else {
    $flags = array();
}

function parse_csv($file) {
    $data = array();
    $lines = file($file);

    foreach ($lines as $line) {
        $line = trim($line);
        $line = trim($line, ',');

        if ($line) {
            $columns = explode(',', $line);

            if (count($columns) >= 3) {
                list($date, $col1, $col2) = $columns;
                $time = strtotime($date);

                if ($time) {
                    $cpm = 0;

                    if (in_array($col1, array('Every Second', 'Every Minute'))) {
                        $cpm = (int) $col2;
                    } else if (is_numeric($col1)) {
                        if (strstr($col1, '.') !== false) {
                            $cpm = (int) $col2;
                        } else {
                            $cpm = (int) $col1;
                        }
                    }

                    if ($cpm >= 0 && $cpm != 15300) {
                        $data[$time] = $cpm;
                    }
                }
            }
        }
    }

    ksort($data);

    return $data;
}

function parse_flags($file) {
    $flags = array();
    $lines = file($file);

    foreach ($lines as $line) {
        $line = trim($line);
        $line = trim($line, ',');

        if ($line) {
            $columns = explode(',', $line);

            if (count($columns) >= 2) {
                list($date, $text) = $columns;
                $time = strtotime($date);

                if ($time && $text) {
                    $flags[$time] = $text;
                }
            }
        }
    }

    ksort($flags);

    return $flags;
}

?>
<!DOCTYPE html>
<html>
    <head>
        <title>View Log - GMC-300 Geiger Muller Counter Online Log Viewer</title>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <script src="lib/jquery.js" type="text/javascript"></script>
        <script src="lib/highstock.js" type="text/javascript"></script>
        <script src="lib/exporting.js" type="text/javascript"></script>
        <script src="lib/gray.js" type="text/javascript"></script>
        <link rel="stylesheet" type="text/css" href="lib/style.css" />
    </head>
    <body>
        <h2>GMC-300 Geiger Muller Counter Online Log Viewer</h2>
        <p><a href="/viewer">Upload another file</a> | <a href="">Share link</a></p>
        <div id="chart" style="height: 600px;"></div>
        <div class="footer">Version 1.0</div>
        <script type="text/javascript">
            var cpm = [], usv = [], umr = [];

            <?php foreach ($data as $time => $cpm): ?>
            cpm.push([<?php echo $time * 1000; ?>, <?php echo $cpm; ?>]);
            usv.push([<?php echo $time * 1000; ?>, <?php echo round($cpm / 175.43, 2); ?>]);
            umr.push([<?php echo $time * 1000; ?>, <?php echo round($cpm / 1754.3, 3); ?>]);
            <?php endforeach; ?>

            var flags = [
                <?php foreach ($flags as $time => $text): ?>
                {x: <?php echo $time * 1000; ?>, title: '<?php echo stripslashes($text); ?>', text: '<?php echo stripslashes($text); ?>'},
                <?php endforeach; ?>
            ];

            var series = [
                {
                    id: 'cpm',
                    type: 'line',
                    name: 'CPM',
                    data: cpm
                },
                {
                    type: 'line',
                    name: 'µSv/h',
                    data: usv
                },
                {
                    type: 'line',
                    name: 'mR/h',
                    visible: false,
                    data: umr
                }
            ];

            if (flags.length) {
                series.push({
                    type: 'flags',
                    name: 'Flags',
                    shape: 'squarepin',
                    onSeries: 'cpm',
                    data: flags
                });
            }

            var chart = new Highcharts.StockChart({
                chart: {
                    renderTo: 'chart'
                },

                title: {
                    text: 'GMC-300 Geiger Muller Counter Online Log Viewer'
                },

                credits: {
                    enabled: false
                },

                rangeSelector: {
                    buttons: [
                        {
                            type: 'hour',
                            count: 1,
                            text: '1h'
                        },
                        {
                            type: 'hour',
                            count: 3,
                            text: '3h'
                        },
                        {
                            type: 'hour',
                            count: 6,
                            text: '6h'
                        },
                        {
                            type: 'hour',
                            count: 12,
                            text: '12h'
                        },
                        {
                            type: 'day',
                            count: 1,
                            text: '1d'
                        },
                        {
                            type: 'day',
                            count: 3,
                            text: '3d'
                        },
                        {
                            type: 'week',
                            count: 1,
                            text: '1w'
                        },
                        {
                            type: 'month',
                            count: 1,
                            text: '1m'
                        }, {
                            type: 'month',
                            count: 3,
                            text: '3m'
                        }, {
                            type: 'month',
                            count: 6,
                            text: '6m'
                        }, {
                            type: 'year',
                            count: 1,
                            text: '1y'
                        }, {
                            type: 'ytd',
                            text: 'YTD'
                        }, {
                            type: 'all',
                            text: 'All'
                        }
                    ]
                },

                legend: {
                    enabled: true,
                    floating: true,
                    layout: 'vertical',
                    align: 'right',
                    verticalAlign: 'top',
                    y: 80
                },

                yAxis: {
                    min: 0,
                    showFirstLabel: false,
                    title: {
                        text: 'Counts Per Minute'
                    }
                },

                series: series
            });
        </script>
    </body>
</html>


