#!/bin/bash

# Professional Git Reset Script
# Resets local repo to match remote, deleting all untracked files and modifications.

set -e  # Exit immediately if a command fails
set -o pipefail  # Ensure failures propagate in pipelines
set -u  # Treat unset variables as an error

# Get the current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# Ensure this is a git repository
if [ ! -d ".git" ]; then
    echo "Error: This is not a git repository!"
    exit 1
fi

# Confirm action with user
echo "WARNING: This will RESET your repository to match the remote branch: origin/$BRANCH"
echo "All local changes and untracked files will be PERMANENTLY deleted."
read -rp "Are you sure? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 0
fi

# Fetch latest updates
echo "Fetching latest changes from remote..."
git fetch --all --prune

# Hard reset to remote branch
echo "Resetting branch '$BRANCH' to match origin/$BRANCH..."
git reset --hard "origin/$BRANCH"

# Remove untracked files and directories
echo "Cleaning untracked files and directories..."
git clean -fd

# Success message
echo "✅ Local repository successfully reset to origin/$BRANCH"

exit 0
