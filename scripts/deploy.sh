#!/bin/sh
# Builds the app and publishes the build to the gh-pages branch, which GitHub Pages serves.
# Usage: npm run deploy
set -e
cd "$(dirname "$0")/.."

npm run build

# Turn the dist folder into a commit of its own, without touching the working tree or main.
export GIT_INDEX_FILE="$PWD/.git/pages-index"
git --git-dir="$PWD/.git" --work-tree="$PWD/dist" read-tree --empty
git --git-dir="$PWD/.git" --work-tree="$PWD/dist" add --all --force .
tree=$(git write-tree)
unset GIT_INDEX_FILE

commit=$(git commit-tree "$tree" -m "Publish site from $(git rev-parse --short HEAD)")
git push --force origin "$commit:refs/heads/gh-pages"
echo "Published. GitHub Pages usually updates within a minute."
