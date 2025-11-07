/**
 * Konstanty pro statusy objednávek, položek, pohybů a assembly
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

  /** Typy zakázek */
  ORDER_TYPE: {
    ZAKAZKA: 'zakazka',
    PODMONTAZ: 'podmontaz'
  },

  /** Stavy assembly/montáže */
  ASSEMBLY_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    QUALITY_CHECK: 'quality_check',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },

  /** Typy komponent */
  COMPONENT_TYPE: {
    ORDER: 'order',
    ITEM: 'item'
  },

  /** Typy reportů assembly */
  REPORT_TYPE: {
    START: 'start',
    PROGRESS: 'progress',
    COMPLETE: 'complete',
    QUALITY: 'quality',
    STATUS_CHANGE: 'status_change'
  },

  /** Výsledky kvality */
  QUALITY_RESULT: {
    OK: 'OK',
    NOK: 'NOK'
  },

  /** Typy pohybů */
  MOVEMENT_TYPE: {
    RECEIVE: 'receive',
    MOVE: 'move',
    CONSUME: 'consume',
    ASSEMBLY_USE: 'assembly_use',
    ASSEMBLY_RETURN: 'assembly_return'
  }
};
