/**
 * Konstanty pro statusy objednávek, položek a pohybů
 */
module.exports = {
  /** Statusy objednávek (tabulka Orders) */
  ORDER_STATUS: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    COMPLETE: 'complete'
  },

  /** Statusy položek (tabulka OrderItems) */
  ITEM_STATUS: {
    PENDING: 'pending',
    PARTIAL: 'partial',
    COMPLETE: 'complete'
  },

  /** Typy pohybů (tabulka Movements) */
  MOVEMENT_TYPE: {
    RECEIVE: 'receive',
    MOVE: 'move',
    CONSUME: 'consume'
  }
};
