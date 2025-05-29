#!/bin/bash

# Directory containing HTML files
HTML_DIR="web/static"
HEADER_FILE="web/static/components/header.html"

# Check if the header file exists
if [ ! -f "$HEADER_FILE" ]; then
    echo "Error: Header file not found at $HEADER_FILE"
    exit 1
fi

# Read the header content
HEADER_CONTENT=$(cat "$HEADER_FILE")

# Find all HTML files except login.html, callback.html, and components/header.html
find "$HTML_DIR" -name "*.html" -type f ! -name "login.html" ! -name "callback.html" ! -path "*/components/*" | while read -r file; do
    echo "Updating $file..."
    
    # Create a temporary file
    TMP_FILE=$(mktemp)
    
    # Process the file
    awk -v header="$HEADER_CONTENT" '
    BEGIN {header_printed=0} 
    /<header/,/<\/header>/ { 
        if (!header_printed) { 
            print header; 
            header_printed=1 
        }; 
        next 
    } 
    /<\/header>/ { next }
    {print}' "$file" > "$TMP_FILE"
    
    # Replace the original file
    mv "$TMP_FILE" "$file"
    
    # Ensure the file has the correct doctype and head section
    if ! grep -q "<!DOCTYPE html>" "$file"; then
        sed -i '' '1i\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YukLive!</title>
    <meta name="description" content="YukLive! Stream Manager">
    <meta name="author" content="YukLive!">
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" type="image/png" href="/static/favicon.png">
    <link rel="shortcut icon" type="image/x-icon" href="/static/favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <link rel="stylesheet" href="/static/css/header.css">
</head>
<body>' "$file"
    fi
    
    # Ensure the header.css is included in the head
    if ! grep -q "header\.css" "$file"; then
        sed -i '' '/<\/title>/a\    <link rel="stylesheet" href="/static/css/header.css">' "$file"
    fi
    
    # Ensure the header component is included
    if ! grep -q "<header" "$file"; then
        sed -i '' '/<body>/a\
<!--#include virtual="/static/components/header.html" -->' "$file"
    fi
    
    # Ensure the body and html tags are closed
    if ! grep -q "<\/body>" "$file"; then
        echo -e "\n</body>\n</html>" >> "$file"
    fi
    
    echo "Updated $file"
done

echo "Header update complete!"
