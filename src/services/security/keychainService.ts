// Secure Credential Management via Android Keystore / iOS Keychain
import * as Keychain from 'react-native-keychain';

export interface StoredCredentials {
  username: string;
  password?: string;
  privateKey?: string;
}

export class KeychainService {
  private static getServiceKey(target: string): string {
    return `ssh_creds_${target.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  /**
   * Securely saves SSH credentials in Android Keystore / iOS Keychain
   */
  static async saveSshCredentials(target: string, username: string, secret: string): Promise<boolean> {
    try {
      const service = this.getServiceKey(target);
      const result = await Keychain.setGenericPassword(username, secret, {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE, // Uses TEE / StrongBox on Android
      });
      return !!result;
    } catch (error) {
      console.warn('[KeychainService] Error guardando credenciales en Keystore:', error);
      // Fallback without hardware restriction if device lacks hardware TEE
      try {
        const service = this.getServiceKey(target);
        const fallbackResult = await Keychain.setGenericPassword(username, secret, { service });
        return !!fallbackResult;
      } catch (fallbackError) {
        console.error('[KeychainService] Fallo crítico guardando credenciales:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Securely retrieves SSH credentials from Keystore
   */
  static async getSshCredentials(target: string): Promise<StoredCredentials | null> {
    try {
      const service = this.getServiceKey(target);
      const credentials = await Keychain.getGenericPassword({ service });
      if (credentials) {
        return {
          username: credentials.username,
          password: credentials.password,
        };
      }
      return null;
    } catch (error) {
      console.error('[KeychainService] Error recuperando credenciales de Keystore:', error);
      return null;
    }
  }

  /**
   * Resets/deletes credentials for a target host from Keystore
   */
  static async deleteSshCredentials(target: string): Promise<boolean> {
    try {
      const service = this.getServiceKey(target);
      return await Keychain.resetGenericPassword({ service });
    } catch (error) {
      console.error('[KeychainService] Error eliminando credenciales:', error);
      return false;
    }
  }
}
