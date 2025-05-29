#!/usr/bin/env python3
import os
import re
from bs4 import BeautifulSoup

# Configuration
TEMPLATE_PATH = 'web/static/template.html'
PAGES_DIR = 'web/static'
EXCLUDE_FILES = {'login.html', 'callback.html', 'template.html', 'components/header.html'}

def load_template():
    with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def update_page(filepath, template):
    # Skip excluded files
    if any(excluded in filepath for excluded in EXCLUDE_FILES):
        print(f"Skipping excluded file: {filepath}")
        return
        
    print(f"Updating {filepath}...")
    
    # Read the page content
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse the template and the page
    soup_template = BeautifulSoup(template, 'html.parser')
    soup_page = BeautifulSoup(content, 'html.parser')
    
    # Find the main content in the page (between header and footer)
    header = soup_page.find('header')
    footer = soup_page.find('footer')
    
    # Extract the main content
    main_content = ''
    if header and footer:
        current = header.next_sibling
        while current and current != footer:
            if hasattr(current, 'name') and current.name == 'div' and 'container' in current.get('class', []):
                main_content = str(current)
                break
            current = current.next_sibling
    
    # If we couldn't find content between header and footer, try to find a container
    if not main_content:
        container = soup_page.find('div', class_='container')
        if container:
            main_content = str(container)
    
    # If we still don't have content, use the entire body
    if not main_content:
        body = soup_page.find('body')
        if body:
            main_content = str(body)
    
    # Update the template with the page content
    content_div = soup_template.find(id='content')
    if content_div and main_content:
        content_div.clear()
        content_div.append(BeautifulSoup(main_content, 'html.parser'))
    
    # Update the title if it exists in the original page
    title = soup_page.find('title')
    if title:
        title_tag = soup_template.find('title')
        if title_tag:
            title_tag.string = title.text
    
    # Write the updated content back to the file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(soup_template))
    
    print(f"Updated {filepath}")

def main():
    # Load the template
    template = load_template()
    
    # Process all HTML files in the pages directory
    for root, _, files in os.walk(PAGES_DIR):
        for filename in files:
            if filename.endswith('.html'):
                filepath = os.path.join(root, filename)
                try:
                    update_page(filepath, template)
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")

if __name__ == '__main__':
    main()
