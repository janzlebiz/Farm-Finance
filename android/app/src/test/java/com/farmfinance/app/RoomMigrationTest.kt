package com.farmfinance.app

import com.farmfinance.app.data.local.migration.MIGRATION_1_2
import org.junit.Assert.assertEquals
import org.junit.Test

class RoomMigrationTest {

    @Test
    fun testMigration1To2Definition() {
        assertEquals(1, MIGRATION_1_2.startVersion)
        assertEquals(2, MIGRATION_1_2.endVersion)
    }
}
