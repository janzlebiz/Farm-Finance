package com.farmfinance.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val GreenPrimary = Color(0xFF1B5E20)
val GreenOnPrimary = Color(0xFFFFFFFF)
val GreenContainer = Color(0xFFA5D6A7)
val GreenOnContainer = Color(0xFF002105)

val BrownSecondary = Color(0xFF795548)
val BrownContainer = Color(0xFFD7CCC8)

val LightBackground = Color(0xFFFBFDF8)
val LightSurface = Color(0xFFFFFFFF)

private val LightColorScheme = lightColorScheme(
    primary = GreenPrimary,
    onPrimary = GreenOnPrimary,
    primaryContainer = GreenContainer,
    onPrimaryContainer = GreenOnContainer,
    secondary = BrownSecondary,
    secondaryContainer = BrownContainer,
    background = LightBackground,
    surface = LightSurface
)

private val DarkColorScheme = darkColorScheme(
    primary = GreenContainer,
    onPrimary = GreenOnContainer,
    secondary = BrownContainer,
    background = Color(0xFF121411),
    surface = Color(0xFF1A1C19)
)

@Composable
fun FarmFinanceTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
