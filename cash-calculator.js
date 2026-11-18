/* Todos os cálculos monetários são feitos em centavos inteiros. */
const CashCalculator = (() => {
    const SUPPLY_CENTS = 30000;

    function parseCurrencyCents(value) {
        if (typeof value !== 'string') return null;
        const text = value.trim().replace(/^R\$\s*/, '');
        if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(text)) return null;
        const [integer, decimal = ''] = text.replace(/\./g, '').split(',');
        const cents = BigInt(integer) * 100n + BigInt(decimal.padEnd(2, '0'));
        return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
    }

    function calculateCashClosing({ cashValues, separateValue, cardPixCents }) {
        const invalidFields = [];
        const cashCents = cashValues.map((value, index) => {
            if (!value.trim()) return 0;
            const parsed = parseCurrencyCents(value);
            if (parsed === null) invalidFields.push(index);
            return parsed || 0;
        });
        const separateCents = separateValue.trim() ? parseCurrencyCents(separateValue) : 0;
        if (separateCents === null) invalidFields.push('separate');
        if (!Number.isSafeInteger(cardPixCents) || cardPixCents < 0) invalidFields.push('cardPix');
        if (invalidFields.length) return { valid: false, invalidFields };

        const countedCents = cashCents.reduce((sum, cents) => sum + cents, 0);
        const totalCents = countedCents + separateCents + cardPixCents;
        if (!Number.isSafeInteger(countedCents) || !Number.isSafeInteger(totalCents)) {
            return { valid: false, invalidFields: ['overflow'] };
        }
        const supplyCents = Math.min(countedCents, SUPPLY_CENTS);
        const excessCents = Math.max(0, countedCents - SUPPLY_CENTS);
        const missingCents = Math.max(0, SUPPLY_CENTS - countedCents);
        return {
            valid: true,
            countedCents, supplyCents, excessCents, missingCents,
            separateCents,
            combinedSeparateCents: separateCents + excessCents,
            cardPixCents, totalCents,
            ready: countedCents > 0 && separateValue.trim() !== ''
        };
    }
    return { SUPPLY_CENTS, parseCurrencyCents, calculateCashClosing };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CashCalculator;
