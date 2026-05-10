import hashlib
import json
import sys


def main() -> None:
    payload = json.load(sys.stdin)
    prompt = payload.get("prompt", "")
    search_results = payload.get("searchResults", [])
    paid_data = payload.get("paidData", "")
    joined = json.dumps({"prompt": prompt, "search": search_results, "paid": paid_data}, sort_keys=True)
    findings = [
        item.get("snippet", "")
        for item in search_results
        if item.get("snippet")
    ]
    if not findings:
        findings = [f"Collected baseline research context for: {prompt}"]

    print(
        json.dumps(
            {
                "summary": f"Research completed for: {prompt}",
                "key_findings": findings[:5],
                "raw_data_hash": hashlib.sha256(joined.encode("utf-8")).hexdigest(),
            }
        )
    )


if __name__ == "__main__":
    main()
