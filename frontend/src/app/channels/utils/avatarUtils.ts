export function getInitialsAvatar(name: string, size: number = 40): string {
  // Get first letter of each word
  const initials = (name || 'YT')
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
  
  // Generate a consistent color based on the name
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEEAD', '#D4A5A5', '#9B97B2', '#E8A87C',
    '#C38D9E', '#85DCB', '#E8A87C', '#41B3A3'
  ];
  
  // Simple hash function to get consistent color for same name
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  
  // Create SVG with the initials
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${colors[colorIndex]}" rx="8"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" 
            fill="white" text-anchor="middle" dy=".3em" font-weight="bold">
        ${initials}
      </text>
    </svg>
  `;
  
  // Convert SVG to data URL
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}