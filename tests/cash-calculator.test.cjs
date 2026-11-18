const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCurrencyCents, calculateCashClosing } = require('../cash-calculator.js');

for (const [input, expected] of [
    ['0', 0], ['0,00', 0], ['0,01', 1], ['0,10', 10], ['1', 100],
    ['1,', 100], ['1,2', 120], ['1,23', 123], ['300', 30000],
    ['299,99', 29999], ['300,01', 30001], ['1.000,00', 100000],
    ['1.234.567,89', 123456789], ['R$ 1.234,56', 123456],
    ['R$\u00a0320,00', 32000], ['  320,00  ', 32000], ['0002,05', 205]
]) {
    test(`entrada monetária ${JSON.stringify(input)} = ${expected} centavos`, () => {
        assert.equal(parseCurrencyCents(input), expected);
    });
}

for (const input of ['', ' ', 'R$', '-20', '10,123', '1,2,3', '1.00', '12.34,56', 'abc10', 'NaN', 'Infinity', '1e3', ',50', '9007199254740991']) {
    test(`não interpreta silenciosamente a entrada inválida ${JSON.stringify(input)}`, () => {
        assert.equal(parseCurrencyCents(input), null);
    });
}

const calculate = (cashValues, separateValue = '0', cardPixCents = 0) =>
    calculateCashClosing({ cashValues, separateValue, cardPixCents });

test('exemplo do usuário: 320 contados + 1000 separados + 500 cartão/Pix', () => {
    const result = calculate(['20', '30', '50', '100', '100', '20'], '1000', 50000);
    assert.equal(result.valid, true);
    assert.equal(result.countedCents, 32000);
    assert.equal(result.supplyCents, 30000);
    assert.equal(result.excessCents, 2000);
    assert.equal(result.combinedSeparateCents, 102000);
    assert.equal(result.totalCents, 182000);
    assert.equal(result.ready, true);
});

for (const [amount, supply, excess, missing] of [
    ['0', 0, 0, 30000], ['0,01', 1, 0, 29999], ['299,99', 29999, 0, 1],
    ['300', 30000, 0, 0], ['300,01', 30000, 1, 0], ['320', 30000, 2000, 0],
    ['1000', 30000, 70000, 0]
]) {
    test(`suprimento e diferença com ${amount} contados`, () => {
        const result = calculate([amount]);
        assert.equal(result.supplyCents, supply);
        assert.equal(result.excessCents, excess);
        assert.equal(result.missingCents, missing);
        assert.equal(result.supplyCents + result.excessCents, result.countedCents);
    });
}

test('abaixo de 300 soma apenas o dinheiro existente, sem inventar suprimento', () => {
    const result = calculate(['200'], '100', 50000);
    assert.equal(result.totalCents, 80000);
    assert.equal(result.missingCents, 10000);
});

test('somar centavos não acumula erro de ponto flutuante', () => {
    const result = calculate(['0,10', '0,20', '0,01', '0,02', '0,03', '0,04'], '0,05', 6);
    assert.equal(result.countedCents, 40);
    assert.equal(result.totalCents, 51);
});

test('aceita vários separadores de milhar corretamente', () => {
    const result = calculate(['1.234.567,89'], '2.345.678,90', 345678901);
    assert.equal(result.totalCents, 703703580);
});

test('campos vazios contam zero sem mostrar um fechamento completo', () => {
    const result = calculate(['', '', '', '', '', ''], '');
    assert.equal(result.totalCents, 0);
    assert.equal(result.ready, false);
});

test('dinheiro separado vazio ainda não completa a conferência', () => {
    assert.equal(calculate(['320'], '').ready, false);
});

test('digitar zero explicitamente no dinheiro separado permite concluir', () => {
    assert.equal(calculate(['320'], '0').ready, true);
});

test('só cartão/Pix não substitui a contagem de dinheiro exigida pela regra existente', () => {
    const result = calculate([''], '0', 50000);
    assert.equal(result.cardPixCents, 50000);
    assert.equal(result.ready, false);
});

test('entrada inválida em uma nota bloqueia o total em vez de ignorar a nota', () => {
    const result = calculate(['300', '10,123'], '0');
    assert.equal(result.valid, false);
    assert.deepEqual(result.invalidFields, [1]);
    assert.equal(result.totalCents, undefined);
});

test('entrada inválida no dinheiro separado também bloqueia o total', () => {
    const result = calculate(['300'], '100,0,0');
    assert.equal(result.valid, false);
    assert.deepEqual(result.invalidFields, ['separate']);
});

for (const card of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`rejeita cartão/Pix em centavos inválidos: ${card}`, () => {
        assert.equal(calculate(['300'], '0', card).valid, false);
    });
}

test('bloqueia soma que excede o limite inteiro seguro', () => {
    const result = calculate(['90071992547409,90', '0,02']);
    assert.equal(result.valid, false);
    assert.deepEqual(result.invalidFields, ['overflow']);
});

test('5.000 cenários: excedente não é contado duas vezes e total conserva cada centavo', () => {
    let seed = 137;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % 1000000;
    const text = cents => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
    for (let i = 0; i < 5000; i++) {
        const amounts = Array.from({ length: 6 }, next);
        const separate = next();
        const card = next();
        const sum = amounts.reduce((a, b) => a + b, 0);
        const result = calculate(amounts.map(text), text(separate), card);
        assert.equal(result.valid, true);
        assert.equal(result.totalCents, sum + separate + card);
        assert.equal(result.supplyCents + result.excessCents, sum);
        assert.equal(result.combinedSeparateCents, separate + result.excessCents);
        assert.equal(result.supplyCents + result.combinedSeparateCents + result.cardPixCents, result.totalCents);
        assert.ok(result.supplyCents <= 30000);
        assert.ok(!(result.excessCents && result.missingCents));
    }
});

test('sem notas de 2 e 10: soma os demais grupos e retira apenas os 20 de excedente', () => {
    const result = calculate(['', '50', '', '120', '150', ''], '1000', 50000);
    assert.equal(result.valid, true);
    assert.equal(result.countedCents, 32000);
    assert.equal(result.excessCents, 2000);
    assert.equal(result.totalCents, 182000);
    assert.equal(result.ready, true);
});

for (let mask = 0; mask < 64; mask++) {
    test(`campos opcionais: combinação ${mask + 1}/64 de notas e moedas presentes ou ausentes`, () => {
        const values = ['2', '5', '10', '20', '50', '0,25'];
        const cents = [200, 500, 1000, 2000, 5000, 25];
        const cashValues = values.map((value, index) => mask & (1 << index) ? value : '');
        const expected = cents.reduce((sum, value, index) => sum + (mask & (1 << index) ? value : 0), 0);
        const result = calculate(cashValues, '0', 50000);
        assert.equal(result.valid, true);
        assert.equal(result.countedCents, expected);
        assert.equal(result.totalCents, expected + 50000);
        assert.equal(result.ready, mask !== 0);
    });
}
