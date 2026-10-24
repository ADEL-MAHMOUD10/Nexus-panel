/**
 * Reliably copies text to clipboard across all browser contexts:
 * - Supports navigator.clipboard when available in secure contexts
 * - Automatically falls back to document.execCommand('copy') via a hidden textarea
 *   for non-secure HTTP contexts (IP addresses like http://1.2.3.4:8443)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API if available and in secure context
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback to legacy execCommand below
    }
  }

  // 2. Fallback using execCommand for HTTP / IP addresses / legacy environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Ensure element is off-screen and does not cause layout shifts
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
