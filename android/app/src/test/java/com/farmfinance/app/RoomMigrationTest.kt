package com.farmfinance.app

import com.farmfinance.app.data.local.migration.MIGRATION_1_2
import com.farmfinance.app.data.local.migration.MIGRATION_2_3
import org.junit.Assert.assertEquals
import org.junit.Test

class RoomMigrationTest {

    @Test
    fun testMigration1To2Definition() {
        assertEquals(1, MIGRATION_1_2.startVersion)
        assertEquals(2, MIGRATION_1_2.endVersion)
    }

    @Test
    fun testMigration2To3Definition() {
        assertEquals(2, MIGRATION_2_3.startVersion)
        assertEquals(3, MIGRATION_2_3.endVersion)
    }
}
