const path = require('path');

const logger = {
  info: (...args) => console.log('ℹ️ ', ...args),
  success: (...args) => console.log('✅', ...args),
  warn: (...args) => console.warn('⚠️ ', ...args),
  error: (...args) => console.error('❌', ...args),
  log: (...args) => console.log(...args)
};

function normalizePath(p) {
  // Fix Windows drive letter issues if needed, similar to original code
  let normalized = p.replace(/^([a-zA-Z]):(?![\\/])/, "$1:/");
  return normalized.replace(/\\/g, "/");
}

module.exports = {
  logger,
  normalizePath
};
