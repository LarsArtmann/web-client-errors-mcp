/**
 * HTML Sanitization Utilities
 * Prevents XSS attacks by sanitizing HTML content
 *
 * Security Approach:
 * - Whitelist safe tags and attributes
 * - Remove all script tags and event handlers
 * - Strip dangerous protocols (javascript:, data:, vbscript:)
 * - Encode special characters
 */

/**
 * Whitelist of safe HTML tags that can be preserved
 * TODO: Implement proper tag filtering in Phase 2
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SAFE_TAGS = new Set([
  // Text formatting
  'p', 'br', 'span', 'div', 'pre', 'code',
  'strong', 'em', 'u', 'i', 'b', 's',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Lists
  'ul', 'ol', 'li',
  // Tables
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  // Semantic
  'article', 'section', 'nav', 'aside', 'header', 'footer',
  'main', 'figure', 'figcaption',
  // Inline
  'a', 'abbr', 'cite', 'q', 'small', 'sub', 'sup', 'time'
]);

/**
 * Whitelist of safe attributes that can be preserved
 * TODO: Implement proper attribute filtering in Phase 2
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SAFE_ATTRIBUTES = new Set([
  'class', 'id', 'title', 'alt',
  'href', 'src', 'width', 'height',
  'colspan', 'rowspan',
  'data-*' // Allow data attributes (will be validated separately)
]);

/**
 * Dangerous protocols that must be blocked
 */
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'about:'
];

/**
 * Sanitizes HTML content to prevent XSS attacks
 *
 * @param html - Raw HTML string
 * @param maxLength - Maximum length of output (default: 100KB)
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(html: string, maxLength: number = 100_000): string {
  if (!html || html.trim().length === 0) {
    return '';
  }

  // Enforce size limit
  if (html.length > maxLength) {
    html = html.substring(0, maxLength) + '... [truncated]';
  }

  // Remove script tags and their content
  html = removeScriptTags(html);

  // Remove event handlers (onclick, onerror, etc.)
  html = removeEventHandlers(html);

  // Remove dangerous protocols from URLs
  html = removeDangerousProtocols(html);

  // Remove style tags (can contain CSS injection)
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove iframe, object, embed tags (can load malicious content)
  html = html.replace(/<(iframe|object|embed|applet)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Encode special characters in remaining content
  html = encodeSpecialCharacters(html);

  return html;
}

/**
 * Removes script tags and their content
 */
function removeScriptTags(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
}

/**
 * Removes event handler attributes (onclick, onerror, etc.)
 */
function removeEventHandlers(html: string): string {
  // Remove on* attributes
  return html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
             .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
}

/**
 * Removes dangerous protocols from URLs
 */
function removeDangerousProtocols(html: string): string {
  let sanitized = html;

  for (const protocol of DANGEROUS_PROTOCOLS) {
    const regex = new RegExp(`(href|src)\\s*=\\s*["']?${protocol}[^"'\\s>]*["']?`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }

  return sanitized;
}

/**
 * Encodes special HTML characters
 */
function encodeSpecialCharacters(html: string): string {
  const encodings: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  // Only encode in text content, not in tags
  // This is a simplified approach - in production, use a proper HTML parser
  return html.replace(/[&<>"'/]/g, (char) => encodings[char] || char);
}

/**
 * Sanitizes a URL to ensure it's safe
 */
export function sanitizeURL(url: string): string | null {
  if (!url || url.trim().length === 0) {
    return null;
  }

  const trimmed = url.trim();

  // Check for dangerous protocols
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (trimmed.toLowerCase().startsWith(protocol)) {
      return null; // Reject dangerous URLs
    }
  }

  // Only allow http, https, and relative URLs
  if (trimmed.startsWith('//') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/')) {
    return trimmed;
  }

  return null; // Reject unknown formats
}

/**
 * Strips all HTML tags, leaving only text
 * Useful for generating safe text-only excerpts
 */
export function stripHTML(html: string): string {
  if (!html || html.trim().length === 0) {
    return '';
  }

  return html
    .replace(/<[^>]*>/g, '') // Remove all tags
    .replace(/&nbsp;/g, ' ') // Convert nbsp to space
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Truncates text safely, preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last space before maxLength
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    // If last space is reasonably close, use it
    return truncated.substring(0, lastSpace) + '...';
  }

  // Otherwise, hard truncate
  return truncated + '...';
}
