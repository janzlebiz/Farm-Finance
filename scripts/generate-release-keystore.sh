#!/usr/bin/env bash
set -euo pipefail

# Helper script to create a secure release keystore and output Base64 for GitHub Secrets.
# IMPORTANT: Never commit the resulting .keystore file to git (protected by .gitignore).

KEYSTORE_FILE="release.keystore"
KEY_ALIAS="farmfinance"
VALIDITY_DAYS=10000

echo "=== Farm Finance Release Keystore Generator ==="
echo ""

if [ -f "$KEYSTORE_FILE" ]; then
    echo "Warning: '$KEYSTORE_FILE' already exists in the current directory."
    read -rp "Overwrite existing keystore? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -f "$KEYSTORE_FILE"
fi

# Prompt securely for keystore password
read -rsp "Enter a secure Keystore Password: " STORE_PASS
echo ""
read -rsp "Confirm Keystore Password: " STORE_PASS_CONFIRM
echo ""

if [ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]; then
    echo "Error: Passwords do not match."
    exit 1
fi

if [ ${#STORE_PASS} -lt 6 ]; then
    echo "Error: Password must be at least 6 characters."
    exit 1
fi

echo "Generating release keystore ($KEYSTORE_FILE)..."
keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY_DAYS" \
    -storepass "$STORE_PASS" \
    -keypass "$STORE_PASS" \
    -dname "CN=Farm Finance, OU=Mobile, O=FarmFinance, L=Default, ST=Default, C=US"

# Generate Base64 single-line representation
if command -v base64 >/dev/null 2>&1; then
    BASE64_KEY=$(base64 -w 0 "$KEYSTORE_FILE" 2>/dev/null || base64 "$KEYSTORE_FILE" | tr -d '\r\n')
else
    BASE64_KEY=$(openssl base64 -in "$KEYSTORE_FILE" | tr -d '\r\n')
fi

echo ""
echo "================================================================="
echo "✅ Keystore created successfully: $KEYSTORE_FILE"
echo "================================================================="
echo ""
echo "Add the following 4 secrets in your GitHub repository:"
echo "👉 GitHub Repo -> Settings -> Secrets and variables -> Actions -> New repository secret"
echo ""
echo "1. Secret Name:  RELEASE_KEYSTORE_BASE64"
echo "   Secret Value: (copy the single-line string below)"
echo "-----------------------------------------------------------------"
echo "$BASE64_KEY"
echo "-----------------------------------------------------------------"
echo ""
echo "2. Secret Name:  RELEASE_KEYSTORE_PASSWORD"
echo "   Secret Value: <your keystore password>"
echo ""
echo "3. Secret Name:  RELEASE_KEY_ALIAS"
echo "   Secret Value: $KEY_ALIAS"
echo ""
echo "4. Secret Name:  RELEASE_KEY_PASSWORD"
echo "   Secret Value: <your keystore password>"
echo ""
echo "⚠️  Store '$KEYSTORE_FILE' in a secure backup location (password manager/vault)."
echo "⚠️  Do not lose this keystore or password; Android requires the same key for app updates."
