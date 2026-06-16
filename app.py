import os
import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION = 300  # Cache feed for 5 minutes
cache = {
    "data": None,
    "last_fetched": 0
}

def clean_html_to_plain_text(html_content):
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', ' ', html_content)
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def parse_feed_xml(xml_content):
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        return {"error": f"Failed to parse XML: {str(e)}"}
    
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    feed_title = "BigQuery - Release notes"
    feed_title_el = root.find('atom:title', ns)
    if feed_title_el is not None and feed_title_el.text:
        feed_title = feed_title_el.text
        
    feed_updated = ""
    feed_updated_el = root.find('atom:updated', ns)
    if feed_updated_el is not None and feed_updated_el.text:
        feed_updated = feed_updated_el.text

    entries_data = []
    
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns).text or "Release Update"
        updated = entry.find('atom:updated', ns).text or ""
        
        link_el = entry.find('atom:link[@rel="alternate"]', ns)
        link_href = link_el.attrib['href'] if link_el is not None else ""
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        # Split content by <h3> tags
        parts = re.split(r'<h3>(.*?)</h3>', content_html)
        updates = []
        
        # If we have <h3> splits, the list alternates: [pre-h3 (usually empty), type, content, type, content...]
        if len(parts) > 1:
            update_idx = 0
            for i in range(1, len(parts), 2):
                update_type = parts[i].strip()
                update_body = parts[i+1].strip() if i+1 < len(parts) else ""
                
                plain_text = clean_html_to_plain_text(update_body)
                
                updates.append({
                    "id": f"{title.replace(' ', '_')}_{update_idx}",
                    "type": update_type,
                    "html": update_body,
                    "plain_text": plain_text
                })
                update_idx += 1
        else:
            # Fallback if no <h3> tags are found
            plain_text = clean_html_to_plain_text(content_html)
            updates.append({
                "id": f"{title.replace(' ', '_')}_0",
                "type": "Update",
                "html": content_html,
                "plain_text": plain_text
            })
            
        entries_data.append({
            "date": title,
            "updated_raw": updated,
            "link": link_href,
            "updates": updates
        })
        
    return {
        "title": feed_title,
        "last_updated_feed": feed_updated,
        "entries": entries_data
    }

def get_release_notes(force_refresh=False):
    now = time.time()
    if force_refresh or not cache["data"] or (now - cache["last_fetched"] > CACHE_DURATION):
        try:
            response = requests.get(FEED_URL, timeout=10)
            if response.status_code == 200:
                parsed_data = parse_feed_xml(response.content)
                if "error" not in parsed_data:
                    cache["data"] = parsed_data
                    cache["last_fetched"] = now
                    return parsed_data, False
                else:
                    # Return cache if available, else error
                    if cache["data"]:
                        return cache["data"], True
                    return parsed_data, False
            else:
                if cache["data"]:
                    return cache["data"], True
                return {"error": f"Failed to fetch feed, HTTP status: {response.status_code}"}, False
        except Exception as e:
            if cache["data"]:
                return cache["data"], True
            return {"error": f"Error fetching feed: {str(e)}"}, False
            
    return cache["data"], False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def release_notes_api():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    data, is_stale = get_release_notes(force_refresh=force_refresh)
    
    if "error" in data:
        return jsonify(data), 500
        
    response_payload = {
        "title": data["title"],
        "last_updated_feed": data["last_updated_feed"],
        "last_fetched_server": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cache["last_fetched"])),
        "is_stale_fallback": is_stale,
        "entries": data["entries"]
    }
    return jsonify(response_payload)

if __name__ == '__main__':
    # Ensure port 5000 is available, run on localhost
    app.run(debug=True, port=5000)
