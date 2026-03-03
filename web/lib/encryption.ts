/**
 * Client-Side Encryption for SatyaVault Evidence
 * 
 * Uses AES-256-GCM for symmetric encryption
 * Key derivation: PBKDF2 with salt
 * 
 * Flow:
 * 1. Generate random encryption key for each evidence
 * 2. Encrypt file before uploading to IPFS
 * 3. Store encrypted key in contract (accessible only to authorized roles)
 * 4. Authorized users decrypt key from contract, then decrypt file
 */

// Generate a random 256-bit encryption key
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Export key to raw bytes (for storing in contract)
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import key from base64 string (for decryption)
export async function importKey(keyData: string): Promise<CryptoKey> {
  const binary = atob(keyData);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  
  return await window.crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );
}

// Encrypt a file before uploading to IPFS
export async function encryptFile(file: File): Promise<{
  encryptedData: ArrayBuffer;
  iv: string;
  key: string;
}> {
  const key = await generateEncryptionKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const fileBuffer = await file.arrayBuffer();
  
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    fileBuffer
  );
  
  return {
    encryptedData,
    iv: btoa(String.fromCharCode(...iv)),
    key: await exportKey(key),
  };
}

// Decrypt file data
export async function decryptFile(
  encryptedData: ArrayBuffer,
  iv: string,
  keyData: string,
  originalFilename: string
): Promise<File> {
  const key = await importKey(keyData);
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  
  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    encryptedData
  );
  
  return new File([decryptedData], originalFilename.replace('.enc', ''), {
    type: 'application/octet-stream',
  });
}

// Generate a deterministic key ID for storage
export function generateKeyId(evidenceId: number, address: string): string {
  return `key_${evidenceId}_${address.toLowerCase()}`;
}

// Convert ArrayBuffer to Blob for download
export function arrayBufferToBlob(data: ArrayBuffer, type: string = 'application/octet-stream'): Blob {
  return new Blob([data], { type });
}

// Convert ArrayBuffer to base64 (for storage/transfer)
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to ArrayBuffer (for decryption)
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return bytes.buffer;
}
