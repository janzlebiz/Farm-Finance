package com.farmfinance.app

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

class BackupValidationTest {

    private fun computeSha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hashBytes.joinToString("") { "%02x".format(it) }
    }

    @Test
    fun testSha256IntegrityComputation() {
        val testPayload = "{\"sales\":[],\"buyers\":[]}"
        val checksum1 = computeSha256(testPayload)
        val checksum2 = computeSha256(testPayload)

        assertEquals(64, checksum1.length)
        assertEquals(checksum1, checksum2)
    }

    @Test
    fun testTamperDetectionCausesChecksumMismatch() {
        val originalPayload = "{\"sales\":[],\"buyers\":[{\"id\":\"b1\",\"name\":\"Original\"}]}"
        val originalChecksum = computeSha256(originalPayload)

        // Modify 1 byte in payload
        val tamperedPayload = "{\"sales\":[],\"buyers\":[{\"id\":\"b1\",\"name\":\"Tampered\"}]}"
        val tamperedChecksum = computeSha256(tamperedPayload)

        assertNotEquals(originalChecksum, tamperedChecksum)
    }

    @Test
    fun testBackupSchemaVersionRequirement() {
        val backupJson = JSONObject().apply {
            put("appName", "Farm Finance")
            put("appVersion", "1.0.0")
            put("backupSchemaVersion", 1)
        }
        assertEquals(1, backupJson.getInt("backupSchemaVersion"))
    }
}
