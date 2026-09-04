// Moved to @labnotev/core. Kept as a thin re-export so existing import sites
// (`./lib/labnoteSectionParser`) and their test mocks continue to resolve.
export { parseLabNoteMd, serializeLabNoteMd } from '@labnotev/core';
