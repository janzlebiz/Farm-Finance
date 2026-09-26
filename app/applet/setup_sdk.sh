#!/usr/bin/env bash
set -ex

# Ensure directories exist
mkdir -p /opt/android-sdk/cmdline-tools

# Download Android cmdline tools
wget -q -O /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

# Unzip cmdline tools
unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extracted

# Move to the correct structure: cmdline-tools/latest
mv /tmp/cmdline-tools-extracted/cmdline-tools /opt/android-sdk/cmdline-tools/latest

# Clean up
rm -f /tmp/cmdline-tools.zip
rm -rf /tmp/cmdline-tools-extracted

# Accept licenses and install packages
export ANDROID_HOME=/opt/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH

yes | sdkmanager --licenses || true
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"

# Set up local.properties
echo "sdk.dir=/opt/android-sdk" > android/local.properties
echo "Android SDK setup complete!"
