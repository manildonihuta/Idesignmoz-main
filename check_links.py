import os
from bs4 import BeautifulSoup
import urllib.parse

base_dir = r"c:/Users/user/Downloads/Compressed/Agencia-main/Agencia-main"
html_file = os.path.join(base_dir, "index.html")

with open(html_file, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

def check_link(path, tag_name, attr_name):
    if not path or path.startswith("http") or path.startswith("#") or path.startswith("mailto:") or path.startswith("tel:"):
        return
    
    # helper for clean paths
    clean_path = path.split("?")[0].split("#")[0]
    full_path = os.path.join(base_dir, clean_path)
    # Check if path starts with / which might mean root relative in web server terms, 
    # but here we treat relative to index.html for simplicity or strip leading /
    if path.startswith("/"):
        full_path = os.path.join(base_dir, path.lstrip("/"))
        
    if not os.path.exists(full_path):
        print(f"MISSING: {tag_name} {attr_name}='{path}'")
    else:
        # print(f"FOUND: {path}")
        pass

for tag in soup.find_all(["link", "script", "img", "source"]):
    if tag.name == "link":
        check_link(tag.get("href"), "link", "href")
    elif tag.name == "script":
        check_link(tag.get("src"), "script", "src")
    elif tag.name == "img":
        check_link(tag.get("src"), "img", "src")
    elif tag.name == "source":
        check_link(tag.get("src"), "source", "src")

print("Done checking.")
