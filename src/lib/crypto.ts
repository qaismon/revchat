

// Generate a pair of keys
export async function generateChatKeys() {
  const keys = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keys;
}

// Convert a Key object to a string (to save to DB/LocalStorage)
export async function exportKey(key: CryptoKey) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import a string back into a Key object
export async function importPublicKey(pem: string) {
  const bytes = atob(pem);
  const buf = new ArrayBuffer(bytes.length);
  const binaryDer = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binaryDer[i] = bytes.charCodeAt(i);
  return window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}