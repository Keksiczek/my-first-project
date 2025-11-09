/**
 * Vrací bezpečné hodnoty pro paginaci.
 * @param {number|string} page
 * @param {number|string} limit
 * @returns {{limit:number, offset:number, page:number}}
 */
function getPaginationParams (page = 1, limit = 20) {
  const maxLimit = 100;
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  return {
    limit: safeLimit,
    offset,
    page: safePage
  };
}

/**
 * Staví odpověď s informacemi o paginaci.
 * @param {Array} data
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 * @returns {{success:boolean,data:Array,pagination:Object}}
 */
function buildPaginatedResponse (data, total, page, limit) {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

module.exports = {
  getPaginationParams,
  buildPaginatedResponse
};
