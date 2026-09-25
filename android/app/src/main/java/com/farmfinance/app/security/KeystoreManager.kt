package com.farmfinance.app.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Handles hardware-backed Android Keystore cryptography for securing local secrets,
 * backup passwords, and encryption salts.
 */
class KeystoreManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "farm_finance_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveBackupKey(key: String) {
        sharedPreferences.edit().putString(KEY_BACKUP_SECRET, key).apply()
    }

    fun getBackupKey(): String? {
        return sharedPreferences.getString(KEY_BACKUP_SECRET, null)
    }

    fun clearAllSecrets() {
        sharedPreferences.edit().clear().apply()
    }

    companion object {
        private const val KEY_BACKUP_SECRET = "farm_backup_key_aes"
    }
}
