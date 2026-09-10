#!/usr/bin/env bash

if [ -d "$1" ]
then
  cd "$1"
fi

# Get the current directory name
DIRNAME=$(basename "$PWD")

# Generate MD5 hash of the current working directory path
HASH=$(printf '%s' "$PWD" | md5sum | awk '{print $1}')

SESSION_NAME="${DIRNAME}-${HASH}"

# Create session if it doesn't exist, then attach to it
tmux new-session -A -s "$SESSION_NAME"
