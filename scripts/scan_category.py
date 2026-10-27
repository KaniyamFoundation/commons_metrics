#!/usr/bin/env python3
"""
Wikimedia Commons Category Metrics Analyzer
Scans a Wikimedia Commons category and aggregates:
- Contributor leaderboard (upload count, total bytes)
- MIME type breakdown
- File size statistics
- Timeline of uploads
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.parse
from collections import defaultdict
from typing import Dict, Any, List

USER_AGENT = "CommonsMetricsApp/1.0 (https://github.com/commons-metrics; wikimedia-metrics@example.org)"

def fetch_category_files(category_title: str, max_files: int = 500) -> List[Dict[str, Any]]:
    if not category_title.startswith("Category:"):
        category_title = "Category:" + category_title
        
    files = []
    cmcontinue = None
    
    print(f"Scanning category: {category_title} (max: {max_files})...")
    
    while len(files) < max_files:
        limit = min(50, max_files - len(files))
        url = (
            f"https://commons.wikimedia.org/w/api.php?action=query"
            f"&generator=categorymembers&gcmtitle={urllib.parse.quote(category_title)}"
            f"&gcmtype=file&gcmlimit={limit}&prop=imageinfo"
            f"&iiprop=user|timestamp|size|mime&format=json"
        )
        if cmcontinue:
            url += f"&gcmcontinue={urllib.parse.quote(cmcontinue)}"
            
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"Error fetching data: {e}")
            break
            
        pages = data.get("query", {}).get("pages", {})
        for page_id, page_data in pages.items():
            if "imageinfo" in page_data and page_data["imageinfo"]:
                info = page_data["imageinfo"][0]
                files.append({
                    "title": page_data.get("title"),
                    "user": info.get("user", "Anonymous"),
                    "timestamp": info.get("timestamp"),
                    "size": info.get("size", 0),
                    "mime": info.get("mime", "unknown")
                })
                
        if "continue" in data and "gcmcontinue" in data["continue"]:
            cmcontinue = data["continue"]["gcmcontinue"]
            time.sleep(0.3)
        else:
            break
            
    print(f"Scanned {len(files)} files successfully.")
    return files

def analyze_category_files(files: List[Dict[str, Any]]) -> Dict[str, Any]:
    contributor_stats = defaultdict(lambda: {"count": 0, "total_bytes": 0, "sample_files": []})
    mime_stats = defaultdict(int)
    yearly_stats = defaultdict(int)
    total_bytes = 0
    
    for f in files:
        user = f["user"]
        size = f.get("size", 0)
        mime = f.get("mime", "unknown")
        ts = f.get("timestamp", "")
        year = ts[:4] if len(ts) >= 4 else "unknown"
        
        contributor_stats[user]["count"] += 1
        contributor_stats[user]["total_bytes"] += size
        if len(contributor_stats[user]["sample_files"]) < 3:
            contributor_stats[user]["sample_files"].append(f["title"])
            
        mime_stats[mime] += 1
        yearly_stats[year] += 1
        total_bytes += size
        
    leaderboard = [
        {
            "user": u,
            "uploads": s["count"],
            "total_megabytes": round(s["total_bytes"] / (1024 * 1024), 2),
            "sample_files": s["sample_files"]
        }
        for u, s in contributor_stats.items()
    ]
    leaderboard.sort(key=lambda x: x["uploads"], reverse=True)
    
    return {
        "total_files": len(files),
        "total_contributors": len(contributor_stats),
        "total_size_mb": round(total_bytes / (1024 * 1024), 2),
        "leaderboard": leaderboard,
        "mime_distribution": dict(mime_stats),
        "timeline_by_year": dict(yearly_stats)
    }

def main():
    parser = argparse.ArgumentParser(description="Analyze Wikimedia Commons Category metrics.")
    parser.add_argument("category", help="Name of Commons category (e.g. 'Images from Wiki Loves Monuments 2023 in India')")
    parser.add_argument("--limit", type=int, default=200, help="Max files to scan")
    parser.add_argument("--output", help="Optional output JSON filepath")
    args = parser.parse_args()
    
    files = fetch_category_files(args.category, max_files=args.limit)
    analysis = analyze_category_files(files)
    
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False)
        print(f"Report saved to {args.output}")
    else:
        print("\n--- TOP CONTRIBUTORS ---")
        for idx, row in enumerate(analysis["leaderboard"][:10], 1):
            print(f"{idx}. {row['user']}: {row['uploads']} files ({row['total_megabytes']} MB)")

if __name__ == "__main__":
    main()
