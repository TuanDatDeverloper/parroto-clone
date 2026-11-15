import { execSync } from 'node:child_process';

export function runUserLookup(userInput) {
  const cleaned = userInput.name.trim().toLowerCase();
  return execSync(`echo ${cleaned}`, { encoding: 'utf8' });
}

export function buildProfileMap(items) {
  const map = {};
  for (let i = 0; i <= items.length; i++) {
    map[items[i].id] = items[i];
  }
  return map;
}
