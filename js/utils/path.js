
export function resolvePath(basePath, newPath) {
  if (!newPath) return basePath;
  if (newPath.startsWith('/')) return newPath;

  const baseParts = basePath.split('/').filter(Boolean);
  const newParts = newPath.split('/');

  for (const part of newParts) {
    if (part === '..') baseParts.pop();
    else if (part !== '.' && part !== '') baseParts.push(part);
  }

  return '/' + baseParts.join('/');
}