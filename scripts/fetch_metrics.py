#!/usr/bin/env python3
"""
Wikimedia Commons Contributor Metrics Fetcher
Fetches contributor upload metrics and user metadata from Wikimedia Commons API and XTools.
"""

import sys
import json
import time
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional

USER_AGENT = "CommonsMetricsApp/1.0 (https://github.com/commons-metrics; wikimedia-metrics@example.org)"

def make_request(url: str, timeout: int = 15) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json"
        }
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait_time = (attempt + 1) * 3
                print(f"Rate limited (429). Backing off for {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"HTTP error {e.code} for {url}: {e.reason}")
                break
        except Exception as ex:
            print(f"Error fetching {url}: {ex}")
            time.sleep(1)
    return None

def fetch_user_info(usernames: List[str]) -> Dict[str, Dict[str, Any]]:
    """Batch fetch user registration, edit count, and rights via MediaWiki API."""
    results = {}
    chunk_size = 30
    for i in range(0, len(usernames), chunk_size):
        chunk = usernames[i:i + chunk_size]
        encoded_names = "|".join(urllib.parse.quote(u) for u in chunk)
        url = f"https://commons.wikimedia.org/w/api.php?action=query&list=users&ususers={encoded_names}&usprop=editcount|registration|groups&format=json"
        
        data = make_request(url)
        if data and "query" in data and "users" in data["query"]:
            for u in data["query"]["users"]:
                name = u["name"]
                if "missing" not in u:
                    results[name] = {
                        "userId": u.get("userid"),
                        "editCount": u.get("editcount", 0),
                        "registration": u.get("registration", "Unknown"),
                        "groups": [g for g in u.get("groups", []) if g not in ("*", "user", "autoconfirmed")]
                    }
        time.sleep(0.5)
    return results

def fetch_namespace6_count(username: str) -> Optional[int]:
    """Fetch exact uploaded file count (namespace 6 pages created) from XTools."""
    enc = urllib.parse.quote(username)
    url = f"https://xtools.wmcloud.org/api/user/pages_count/commons.wikimedia.org/{enc}/6"
    data = make_request(url, timeout=12)
    if data and "counts" in data and "6" in data["counts"]:
        return data["counts"]["6"].get("count", 0)
    return None

def fetch_recent_uploads(username: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Fetch sample recent uploads for a user."""
    enc = urllib.parse.quote(username)
    url = (
        f"https://commons.wikimedia.org/w/api.php?action=query&list=allimages"
        f"&aiuser={enc}&aisort=timestamp&aidir=descending&ailimit={limit}"
        f"&aiprop=timestamp|user|url|size|mime&format=json"
    )
    data = make_request(url)
    uploads = []
    if data and "query" in data and "allimages" in data["query"]:
        for img in data["query"]["allimages"]:
            uploads.append({
                "title": img.get("title", ""),
                "timestamp": img.get("timestamp", ""),
                "size": img.get("size", 0),
                "width": img.get("width", 0),
                "height": img.get("height", 0),
                "mime": img.get("mime", "image/jpeg"),
                "thumbUrl": img.get("url", ""),
                "url": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(img.get('title', ''))}"
            })
    return uploads

if __name__ == "__main__":
    print("Testing fetcher script...")
    user_info = fetch_user_info(["Gangulybiswarup", "Jkadavoor"])
    print("User info fetched:", user_info)
