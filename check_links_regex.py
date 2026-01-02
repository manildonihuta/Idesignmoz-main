import os
import re

base_dir = r"c:/Users/user/Downloads/Compressed/Agencia-main/Agencia-main"
html_file = os.path.join(base_dir, "index.html")

with open(html_file, "r", encoding="utf-8") as f:
    content = f.read()

# simple regex for src and href
links = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', content)

for link in links:
    if link.startswith("http") or link.startswith("#") or link.startswith("mailto:") or link.startswith("tel:"):
        continue
    
    clean_path = link.split("?")[0].split("#")[0]
    # Remove leading slash if present
    if clean_path.startswith("/"):
        clean_path = clean_path[1:]
        
    full_path = os.path.join(base_dir, clean_path)
    
    if not os.path.exists(full_path):
        print(f"MISSING: {link}")

print("Done checking.")
