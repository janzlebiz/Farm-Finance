package com.farmfinance.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.farmfinance.app.ui.screens.*
import com.farmfinance.app.ui.theme.FarmFinanceTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            FarmFinanceTheme {
                MainAppScaffold()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScaffold() {
    val navController = rememberNavController()
    var selectedItem by remember { mutableStateOf(0) }

    val navItems = listOf(
        Triple("dashboard", "Dashboard", Icons.Default.Dashboard),
        Triple("sales", "Sales", Icons.Default.AttachMoney),
        Triple("expenses", "Expenses", Icons.Default.ReceiptLong),
        Triple("receivables", "Receivables", Icons.Default.AccountBalanceWallet),
        Triple("production", "Production", Icons.Default.Agriculture),
        Triple("reports", "Reports", Icons.Default.Assessment)
    )

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar {
                navItems.forEachIndexed { index, item ->
                    NavigationBarItem(
                        icon = { Icon(item.third, contentDescription = item.second) },
                        label = { Text(item.second) },
                        selected = selectedItem == index,
                        onClick = {
                            selectedItem = index
                            navController.navigate(item.first) {
                                popUpTo("dashboard") { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "dashboard",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("dashboard") { DashboardScreen() }
            composable("sales") { SalesScreen() }
            composable("expenses") { ExpensesScreen() }
            composable("receivables") { ReceivablesScreen() }
            composable("production") { ProductionScreen() }
            composable("reports") { ReportsScreen() }
        }
    }
}
