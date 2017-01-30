<?php
	$secret = trim(file_get_contents('../.github-secret'));
	$data = file_get_contents('php://input');
	list($algo, $hash) = explode('=', $_SERVER['HTTP_X_HUB_SIGNATURE'], 2) + array('', '');
	if($hash != hash_hmac($algo, $data, $secret))
	{
		header('HTTP/1.0 403 Forbidden');
		die('Invalid secret');
	}
	$out = [];
	$ret = 0;
	exec('git pull 2>&1', $out, $ret);
	if($ret != 0)
		header('HTTP/1.1 500 Internal error');
	echo join("\n", $out);

