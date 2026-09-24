(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PortfolioSettings = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const LARGE_DEFAULTS = new Set(['01', '05', '10', '14', '16', '23', '30', '38']);
  const defaultSize = id => LARGE_DEFAULTS.has(id) ? 'large' : 'small';

  function cloneItems(items) {
    return items.map(item => ({ ...item, tags: Array.isArray(item.tags) ? [...item.tags] : item.tags, size: defaultSize(item.id) }));
  }

  function merge(items, settings, categories) {
    const base = cloneItems(Array.isArray(items) ? items : []);
    if (!settings || !Array.isArray(settings.items) || !Array.isArray(categories)) return base;

    const itemIds = new Set(base.map(item => item.id));
    const categoryNames = new Map(categories.filter(category => category.id !== 'all').map(category => [category.id, category.label]));
    const overrides = new Map();

    for (const setting of settings.items) {
      if (!setting || typeof setting.id !== 'string' || !itemIds.has(setting.id) || overrides.has(setting.id)) continue;
      if (typeof setting.visible !== 'boolean' || !categoryNames.has(setting.category)) continue;
      if (setting.size !== undefined && !['large', 'small'].includes(setting.size)) continue;
      if (setting.size === undefined && typeof setting.featured !== 'boolean') continue;
      overrides.set(setting.id, setting);
    }

    return base.flatMap(item => {
      const setting = overrides.get(item.id);
      if (!setting) return [item];
      if (!setting.visible) return [];
      return [{
        ...item,
        category: setting.category,
        categoryName: categoryNames.get(setting.category),
        size: setting.size || defaultSize(item.id),
      }];
    });
  }

  return { merge };
});
