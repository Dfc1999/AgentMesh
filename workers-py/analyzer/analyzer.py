import hashlib
import json
import sys


def main() -> None:
    payload = json.load(sys.stdin)
    prompt = payload.get("prompt", "")
    words = [word.strip(".,:;!?").lower() for word in prompt.split() if len(word) > 4]
    unique_terms = sorted(set(words))[:8]
    raw = json.dumps(payload, sort_keys=True)

    print(
        json.dumps(
            {
                "summary": f"Analysis completed for: {prompt}",
                "key_findings": [
                    f"Detected {len(unique_terms)} relevant terms.",
                    "Generated a qualitative report because no numeric dataset was attached.",
                    f"Top terms: {', '.join(unique_terms) if unique_terms else 'none'}",
                ],
                "charts_base64": [],
                "raw_data_hash": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
            }
        )
    )


if __name__ == "__main__":
    main()
