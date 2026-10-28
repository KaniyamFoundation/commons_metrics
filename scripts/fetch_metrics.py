#!/usr/bin/env python3
"""
Wikimedia Commons Contributor Metrics Fetcher
Fetches contributor upload metrics and user metadata from Wikimedia Commons API and XTools.
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.parse
from pathlib import Path
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
                        "registration": u.get("registration", "Unknown")[:10] if u.get("registration") else "Unknown",
                        "groups": [g for g in u.get("groups", []) if g not in ("*", "user", "autoconfirmed")]
                    }
        time.sleep(0.5)
    return results

def fetch_namespace6_count(username: str) -> Optional[int]:
    """Fetch exact uploaded file count (namespace 6 pages created) from XTools."""
    enc = urllib.parse.quote(username)
    url = f"https://xtools.wmcloud.org/api/user/pages_count/commons.wikimedia.org/{enc}/6"
    data = make_request(url, timeout=15)
    if data and "counts" in data and "6" in data["counts"]:
        return data["counts"]["6"].get("count", 0)
    return None

def update_all_contributors(data_path: str = "data/contributors_india.json") -> None:
    p = Path(data_path)
    if not p.exists():
        print(f"Data file {data_path} not found.")
        return

    with open(p, "r", encoding="utf-8") as f:
        contributors = json.load(f)

    print(f"Updating {len(contributors)} contributors with live Commons API & XTools data...")

    # Batch update editcounts
    usernames = [c["username"] for c in contributors]
    user_info = fetch_user_info(usernames)

    for idx, c in enumerate(contributors, 1):
        uname = c["username"]
        print(f"[{idx}/{len(contributors)}] Updating {uname}...")
        if uname in user_info:
            c["editCount"] = user_info[uname]["editCount"]
            if user_info[uname]["groups"]:
                c["groups"] = user_info[uname]["groups"]

        # Fetch upload count
        cnt = fetch_namespace6_count(uname)
        if cnt is not None and cnt > 0:
            c["uploads"] = cnt

        time.sleep(0.4)

    # Sort descending by uploads
    contributors.sort(key=lambda x: x["uploads"], reverse=True)

    with open(p, "w", encoding="utf-8") as f:
        json.dump(contributors, f, indent=2, ensure_ascii=False)

    print(f"Successfully refreshed and saved {len(contributors)} contributors to {data_path}!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Wikimedia Commons contributor metrics.")
    parser.add_argument("--update-all", action="store_true", help="Update data/contributors_india.json with live counts")
    parser.add_argument("--user", help="Lookup a single username")
    args = parser.parse_args()

    if args.update_all:
        update_all_contributors()
    elif args.user:
        info = fetch_user_info([args.user])
        count = fetch_namespace6_count(args.user)
        print(f"User info for {args.user}: {info.get(args.user)}")
        print(f"Namespace 6 upload count: {count}")
    else:
        print("Run with --update-all to update all contributor records or --user <name> to check a single user.")
