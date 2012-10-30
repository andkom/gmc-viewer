<?php

function get_random_string($length = 6) {
    $str = str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    return substr($str, 0, $length);
}

function upload_file($key, $path, $check_signature = false, $max_size = 1048576) {
    if ($_FILES[$key]['error'] != UPLOAD_ERR_OK) {
        throw new Exception('Unable to upload file. Please try again later.');
    }

    if ($_FILES[$key]['size'] > $max_size) {
        throw new Exception('File size too large.');

    }

    if ($check_signature) {
        $data = file_get_contents($_FILES[$key]['tmp_name']);

        if (!$data) {
            throw new Exception('Unable to read file.');
        }

        if (stristr($data, 'GQ Geiger Muller Counter Data Logger') === false) {
            throw new Exception('Bad file type or format.');
        }
    }

    if (!move_uploaded_file($_FILES[$key]['tmp_name'], $path)) {
        throw new Exception('Unable to write file. Please try again later.');
    }
}

function redirect($url) {
    header('Location: ' . $url);
    exit();
}

$error = false;


if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $name = get_random_string();
    $dir = './data/' . $name;
    $data_file = $dir . '/data.csv';
    $flags_file = $dir . '/flags.csv';

    try {
        if (!isset($_FILES['data']) || $_FILES['data']['error'] == UPLOAD_ERR_NO_FILE) {
            throw new Exception('Please select data file.');
        }

        if (!mkdir($dir)) {
            throw new Exception('Unable to create directory.');
        }

        upload_file('data', $data_file, true);

        if (isset($_FILES['flags']) && $_FILES['flags']['error'] != UPLOAD_ERR_NO_FILE) {
            upload_file('flags', $flags_file);
        }

        redirect('view.php?n=' . $name);
    } catch (Exception $exception) {
        @rmdir($name);
        $error = $exception->getMessage();
    }
}

?>
<!DOCTYPE html>
<html>
<head>
    <title>GMC-300 Online Log Viewer</title>
    <meta name="keywords" content="gmc 300 geiger muller counter online log viewer" />
    <meta name="description" content="GMC 300 Geiger Muller Counter Online Log Viewer" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <style>
        body {
            font-family: Tahoma, Verdana, Arial;
            font-size: 12px;
        }
        .error {
            color: red;
        }
    </style>
</head>
    <body>
        <h2>GMC-300 Geiger Muller Counter Online Log Viewer</h2>
        <h4>Upload data log:</h4>
        <?php if ($error): ?>
        <p class="error"><?php echo htmlspecialchars($error); ?></p>
        <?php endif; ?>
        <form action="" method="post" enctype="multipart/form-data">
            <table>
                <tr>
                    <td>Data file:</td>
                    <td><input type="file" name="data" /></td>
                </tr>
                <tr>
                    <td>Flags file:</td>
                    <td><input type="file" name="flags" /> (optional)</td>
                </tr>
                <tr>
                    <td>Data type:</td>
                    <td>
                        <label><input type="radio" name="type" value="csv" checked="checked" /> CSV</label>
                        <label><input type="radio" name="type" value="bin" disabled="disabled" /> BIN (soon)</label>
                    </td>
                </tr>
            </table>
            <p>
                <input type="submit" value="Upload" />
            </p>
        </form>
    </body>
</html>
