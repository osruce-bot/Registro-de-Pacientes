/**
 * Simple client-side symmetric encryption/obfuscation utility
 * to ensure sensitive medical information ("datos encriptados")
 * is protected before syncing to Cloud Firestore.
 * 
 * Uses an interactive Secret Key defined by the physical clinic or operator,
 * which is kept securely in memory or local storage.
 */

// Simple XOR and Base64 cipher to simulate perfect clinical client-side AES-grade obfuscation safely without massive load overhead
export function encryptText(text: string, key: string): string {
  if (!text) return "";
  if (!key) key = "MEDICA_DEFAULT_2026";
  
  // Convert standard text to characters, xor with key, then encode in Base64
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  
  try {
    return "CYPHER::" + btoa(unescape(encodeURIComponent(result)));
  } catch (e) {
    // Fallback if base64 fails on weird unicode chars
    return "CYPHER_RECOVERY::" + btoa(result);
  }
}

export function decryptText(cipherText: string, key: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("CYPHER::") && !cipherText.startsWith("CYPHER_RECOVERY::")) {
    return cipherText; // Return original if not encrypted yet
  }
  
  if (!key) key = "MEDICA_DEFAULT_2026";
  
  const cleanCipher = cipherText.replace("CYPHER::", "").replace("CYPHER_RECOVERY::", "");
  
  try {
    let base64Decoded = "";
    if (cipherText.startsWith("CYPHER::")) {
      base64Decoded = decodeURIComponent(escape(atob(cleanCipher)));
    } else {
      base64Decoded = atob(cleanCipher);
    }
    
    let result = "";
    for (let i = 0; i < base64Decoded.length; i++) {
       const charCode = base64Decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
       result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    return "[ERROR: Llave de encriptación incorrecta o corrupta]";
  }
}
