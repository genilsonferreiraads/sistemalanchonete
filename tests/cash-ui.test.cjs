const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const CashCalculator = require('../cash-calculator.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const uiSource = source.slice(source.indexOf('    // Atualiza a conferência ao digitar;'), source.indexOf('    // Adicionar valor separado'));

function element() {
    const attributes = new Map();
    return {
        value: '', textContent: '', hidden: false, style: {}, listeners: {},
        addEventListener(event, callback) { this.listeners[event] = callback; },
        toggleAttribute(name, active) { active ? attributes.set(name, '') : attributes.delete(name); },
        setAttribute(name, value) { attributes.set(name, value); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        focus() { this.focused = true; }, select() {}
    };
}
function setup() {
    const ids = ['cash2', 'cash5', 'cash10', 'cash20', 'cashLarger', 'cashCoins', 'separateValue',
        'totalCashInputs', 'cashStatusInputs', 'finalTotalContainer', 'cashClosingHint', 'totalCash', 'totalSeparate', 'totalSheet', 'finalTotal'];
    const elements = Object.fromEntries(ids.map(id => [id, element()]));
    const context = vm.createContext({
        CashCalculator, total: 500,
        cashInputs: Object.fromEntries(ids.slice(0, 6).map(id => [id, elements[id]])),
        separateValueInput: elements.separateValue,
        totalCashElement: elements.totalCash, totalSeparateElement: elements.totalSeparate,
        totalSheetElement: elements.totalSheet, finalTotalElement: elements.finalTotal,
        document: { getElementById: id => elements[id] },
        formatCurrency: value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        saveValues() {}
    });
    vm.runInContext(uiSource, context);
    const fill = (id, value) => { elements[id].value = value; elements[id].listeners.input(); };
    const text = id => elements[id].textContent.replace(/\s/g, ' ');
    return { elements, context, fill, text };
}

test('digitação atualiza imediatamente total, excedente e resumo com campos vazios', () => {
    const { elements, fill, text } = setup();
    fill('cash5', '50'); fill('cash20', '120'); fill('cashLarger', '150'); fill('separateValue', '1000');
    assert.equal(text('totalCashInputs'), 'R$ 320,00');
    assert.equal(text('cashStatusInputs'), 'Retire do caixa: R$ 20,00');
    assert.equal(text('totalCash'), 'R$ 300,00');
    assert.equal(text('totalSeparate'), 'R$ 1.020,00');
    assert.equal(text('totalSheet'), 'R$ 500,00');
    assert.equal(text('finalTotal'), 'R$ 1.820,00');
    assert.equal(elements.finalTotalContainer.style.display, 'flex');
});

test('apagar uma nota recalcula o total e remove o excedente anterior', () => {
    const { fill, text } = setup();
    fill('cash20', '320'); fill('separateValue', '1000');
    fill('cash20', '300');
    assert.equal(text('totalSeparate'), 'R$ 1.000,00');
    assert.equal(text('finalTotal'), 'R$ 1.800,00');
    fill('cash20', '280');
    assert.equal(text('cashStatusInputs'), 'Adicione ao caixa: R$ 20,00');
    assert.equal(text('finalTotal'), 'R$ 1.780,00');
});

test('entrada com casas decimais extras impede imprimir um total incorreto e pode ser corrigida', () => {
    const { elements, fill, text } = setup();
    fill('cash2', '300'); fill('separateValue', '0'); fill('cashCoins', '1,234');
    assert.equal(elements.cashCoins.getAttribute('aria-invalid'), 'true');
    assert.equal(elements.finalTotalContainer.style.display, 'none');
    assert.equal(text('finalTotal'), '—');
    fill('cashCoins', '1,23');
    assert.equal(elements.cashCoins.getAttribute('aria-invalid'), null);
    assert.equal(elements.finalTotalContainer.style.display, 'flex');
    assert.equal(text('finalTotal'), 'R$ 801,23');
});

test('Enter formata moedas e permanece no campo, sem pular para dinheiro separado', () => {
    const { elements, fill } = setup();
    fill('cashCoins', '0,1');
    let prevented = false;
    elements.cashCoins.listeners.keydown({ key: 'Enter', preventDefault() { prevented = true; } });
    assert.equal(elements.cashCoins.value, '0,10');
    assert.equal(elements.separateValue.focused, undefined);
    assert.equal(prevented, true);
});

test('notas maiores continuam avançando para moedas, que não pula para dinheiro separado', () => {
    const { elements, fill } = setup();
    fill('cashLarger', '100');
    elements.cashLarger.listeners.keydown({ key: 'Enter', preventDefault() {} });
    assert.equal(elements.cashCoins.focused, true);
    elements.cashCoins.listeners.keydown({ key: 'ArrowDown', preventDefault() {} });
    assert.equal(elements.separateValue.focused, undefined);
});

test('Enter em valor inválido mantém o campo para correção', () => {
    const { elements, fill } = setup();
    fill('cash2', '-20');
    elements.cash2.listeners.keydown({ key: 'Enter', preventDefault() {} });
    assert.equal(elements.cash2.value, '-20');
    assert.equal(elements.cash5.focused, undefined);
});

test('sair do campo formata sem duplicar o símbolo R$', () => {
    const { elements, fill, text } = setup();
    fill('cashLarger', '1000000,25');
    elements.cashLarger.listeners.blur();
    assert.equal(elements.cashLarger.value, '1.000.000,25');
    assert.equal(text('totalCashInputs'), 'R$ 1.000.000,25');
});

test('zero no dinheiro separado permite fechamento; vazio continua pendente', () => {
    const { elements, fill } = setup();
    fill('cash10', '300');
    assert.equal(elements.finalTotalContainer.style.display, 'none');
    fill('separateValue', '0');
    assert.equal(elements.finalTotalContainer.style.display, 'flex');
    fill('separateValue', '');
    assert.equal(elements.finalTotalContainer.style.display, 'none');
});

test('atualizações repetidas não acumulam excedente e cartão/Pix atualizado entra no resumo', () => {
    const { context, fill, text } = setup();
    fill('cash2', '320'); fill('separateValue', '1000');
    for (let i = 0; i < 100; i++) context.updateTotals();
    assert.equal(text('finalTotal'), 'R$ 1.820,00');
    context.total = 1234.56;
    context.updateTotals();
    assert.equal(text('totalSheet'), 'R$ 1.234,56');
    assert.equal(text('finalTotal'), 'R$ 2.554,56');
});
