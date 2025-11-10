const { expect } = require('chai');
const {
  buildProductionInsert,
  resolveStageStatus,
  updateQualityCounters,
  buildSubProductPayload
} = require('../src/services/productionService');

describe('Production service helpers', () => {
  describe('buildProductionInsert', () => {
    it('prepares insert payload with defaults', () => {
      const payload = {
        productCode: 'WIDGET-01',
        quantityIn: 120,
        orderId: 5,
        machineId: 'CUTTER-1',
        notes: 'Prioritní dávka'
      };

      const result = buildProductionInsert(payload, 9);

      expect(result).to.include({
        productCode: 'WIDGET-01',
        quantityIn: 120,
        orderId: 5,
        status: 'started',
        operatorId: 9,
        machineId: 'CUTTER-1'
      });
      expect(result.startTime).to.be.instanceOf(Date);
    });

    it('throws when required fields are missing', () => {
      expect(() => buildProductionInsert({}, null)).to.throw('Produkt musí mít kód');
      expect(() => buildProductionInsert({ productCode: 'A' }, null)).to.throw('Vstupní množství musí být kladné');
    });
  });

  describe('resolveStageStatus', () => {
    it('allows valid transitions', () => {
      expect(resolveStageStatus('pending', 'start')).to.equal('started');
      expect(resolveStageStatus('started', 'pause')).to.equal('paused');
      expect(resolveStageStatus('paused', 'resume')).to.equal('in_progress');
    });

    it('rejects invalid transitions', () => {
      expect(() => resolveStageStatus('pending', 'complete')).to.throw('Akce complete není ve stavu pending povolena');
    });
  });

  describe('updateQualityCounters', () => {
    it('increments OK and NOK counters separately', () => {
      const result1 = updateQualityCounters(2, 1, 'OK');
      expect(result1).to.deep.equal({ ok: 3, nok: 1 });

      const result2 = updateQualityCounters(result1.ok, result1.nok, 'NOK');
      expect(result2).to.deep.equal({ ok: 3, nok: 2 });
    });
  });

  describe('buildSubProductPayload', () => {
    it('creates payload with defaults', () => {
      const payload = buildSubProductPayload({
        parentWorkOrderId: 10,
        componentCode: 'SUB-001',
        quantity: 4
      });

      expect(payload).to.include({
        parentWorkOrderId: 10,
        componentCode: 'SUB-001',
        componentName: 'SUB-001',
        quantity: 4,
        unit: 'ks',
        status: 'created'
      });
    });

    it('validates required fields', () => {
      expect(() => buildSubProductPayload({})).to.throw('Chybí parentWorkOrderId');
      expect(() => buildSubProductPayload({ parentWorkOrderId: 1 })).to.throw('Chybí kód meziproduktu');
    });
  });
});
