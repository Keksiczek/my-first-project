const STAGE_ACTIONS = {
  start: 'started',
  pause: 'paused',
  resume: 'in_progress',
  complete: 'completed'
};

const STAGE_ALLOWED_TRANSITIONS = {
  pending: ['start'],
  started: ['pause', 'resume', 'complete'],
  in_progress: ['pause', 'complete'],
  paused: ['resume', 'complete'],
  completed: [],
  cancelled: []
};

function buildProductionInsert (payload, operatorId) {
  if (!payload || !payload.productCode) {
    throw new Error('Produkt musí mít kód');
  }
  if (!payload.quantityIn || payload.quantityIn <= 0) {
    throw new Error('Vstupní množství musí být kladné');
  }

  return {
    productCode: payload.productCode,
    batchNumber: payload.batchNumber || null,
    orderId: payload.orderId || null,
    quantityIn: payload.quantityIn,
    status: 'started',
    operatorId: operatorId || payload.operatorId || null,
    machineId: payload.machineId || null,
    notes: payload.notes || null,
    startTime: new Date()
  };
}

function resolveStageStatus (currentStatus, action) {
  const allowedActions = STAGE_ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedActions.includes(action)) {
    throw new Error(`Akce ${action} není ve stavu ${currentStatus} povolena`);
  }
  return STAGE_ACTIONS[action];
}

function updateQualityCounters (existingOk, existingNok, result) {
  let ok = existingOk || 0;
  let nok = existingNok || 0;

  if (result === 'OK') {
    ok += 1;
  }
  if (result === 'NOK') {
    nok += 1;
  }

  return { ok, nok };
}

function buildSubProductPayload (payload) {
  if (!payload || !payload.parentWorkOrderId) {
    throw new Error('Chybí parentWorkOrderId');
  }
  if (!payload.componentCode) {
    throw new Error('Chybí kód meziproduktu');
  }
  return {
    parentWorkOrderId: payload.parentWorkOrderId,
    parentStageId: payload.parentStageId || null,
    componentCode: payload.componentCode,
    componentName: payload.componentName || payload.componentCode,
    quantity: payload.quantity || 0,
    unit: payload.unit || 'ks',
    currentStageId: payload.currentStageId || null,
    warehouseId: payload.warehouseId || null,
    position: payload.position || null,
    status: payload.status || 'created'
  };
}

module.exports = {
  buildProductionInsert,
  resolveStageStatus,
  updateQualityCounters,
  buildSubProductPayload
};
