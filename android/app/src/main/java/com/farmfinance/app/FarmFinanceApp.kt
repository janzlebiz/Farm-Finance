package com.farmfinance.app

import android.app.Application
import com.farmfinance.app.data.local.FarmFinanceDatabase
import com.farmfinance.app.data.repository.FarmRepository
import com.farmfinance.app.security.KeystoreManager

class FarmFinanceApp : Application() {

    lateinit var database: FarmFinanceDatabase
        private set

    lateinit var repository: FarmRepository
        private set

    lateinit var keystoreManager: KeystoreManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        database = FarmFinanceDatabase.getDatabase(this)
        repository = FarmRepository(database)
        keystoreManager = KeystoreManager(this)
    }

    companion object {
        lateinit var instance: FarmFinanceApp
            private set
    }
}
