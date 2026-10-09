"""Tenký HTTP klient nad urllib (bez externích závislostí)."""

import json
import time
import urllib.error
import urllib.parse
import urllib.request

# Wikimedia vyžaduje popisný User-Agent, jinak vrací 403.
USER_AGENT = "social-video-pipeline/0.1 (personal project; https://github.com/Keksiczek)"


def get(url, params=None, timeout=30, retries=3, headers=None):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    hdrs = {"User-Agent": USER_AGENT}
    hdrs.update(headers or {})
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=hdrs)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as err:
            # 4xx kromě 429 nemá smysl opakovat
            if 400 <= err.code < 500 and err.code != 429:
                raise
            last_err = err
        except (urllib.error.URLError, TimeoutError) as err:
            last_err = err
        time.sleep(2 ** attempt)
    raise last_err


def get_json(url, params=None, **kwargs):
    return json.loads(get(url, params, **kwargs))


def post_json(url, payload, timeout=120):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def download(url, dest_path, timeout=60):
    with open(dest_path, "wb") as f:
        f.write(get(url, timeout=timeout))
    return dest_path
