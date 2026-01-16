
const STORAGE_KEY = 'estefania_secure_vault';
const DEFAULT_PIN = '442502';

// Un "cifrado" simple para evitar lectura plana en localStorage
// En producción se usaría un Hash real o autenticación de servidor
const encrypt = (text: string) => btoa(`salt_equitel_${text}_2.0`);
const decrypt = (hash: string) => {
  try {
    const raw = atob(hash);
    return raw.replace('salt_equitel_', '').replace('_2.0', '');
  } catch (e) {
    return null;
  }
};

export const getStoredPIN = (): string => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const encryptedDefault = encrypt(DEFAULT_PIN);
    localStorage.setItem(STORAGE_KEY, encryptedDefault);
    return DEFAULT_PIN;
  }
  return decrypt(stored) || DEFAULT_PIN;
};

export const updateStoredPIN = (newPIN: string): boolean => {
  // Updated validation for 6 digits
  if (newPIN.length !== 6 || isNaN(Number(newPIN))) return false;
  localStorage.setItem(STORAGE_KEY, encrypt(newPIN));
  return true;
};
