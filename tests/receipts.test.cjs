const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const NoteComposer = require('../note-composer.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const printSource = source.slice(source.indexOf('    const receiptPageStyle'), source.indexOf('    // Voltar para a página principal'));

function setup(width, ready = true, savedWidth = null, measuredHeight = 180) {
    const elements = {};
    for (const id of ['receiptAmount', 'receiptConcept', 'receiptSubtitle', 'receiptSummary', 'receiptSupply', 'receiptSeparate', 'receiptCardPix', 'receiptDate', 'receiptPaperWidth', 'printCashClosing', 'printCardPix', 'printCardPixMain', 'finalTotalContainer']) {
        elements[id] = { textContent: '', value: width, style: {}, addEventListener(event, handler) { this[event] = handler; } };
    }
    const classes = new Set();
    const measuringClasses = new Set();
    const receiptProperties = new Map();
    elements.cardPixReceipt = {
        style: { setProperty(name, value) { receiptProperties.set(name, value); } },
        classList: { add(name) { measuringClasses.add(name); }, remove(name) { measuringClasses.delete(name); } },
        get offsetHeight() {
            assert.ok(measuringClasses.has('receipt-measuring'));
            return typeof measuredHeight === 'function' ? measuredHeight(elements) : measuredHeight;
        }
    };
    const printStyle = {};
    const handlers = {};
    let calls = 0;
    const card = { textContent: 'valor antigo' };
    const closing = { textContent: 'valor antigo' };
    const supply = { textContent: 'valor antigo' };
    const separate = { textContent: 'valor antigo' };
    const storage = new Map(savedWidth ? [['receiptPaperWidth', savedWidth]] : []);
    const paperButtons = ['58', '80'].map(width => ({
        dataset: { receiptPaper: width }, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(event, callback) { this[event] = callback; }
    }));
    vm.runInNewContext(printSource, {
        NoteComposer,
        document: {
            createElement: () => printStyle, head: { appendChild() {} },
            getElementById: id => elements[id],
            querySelectorAll: () => paperButtons,
            body: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } }
        },
        totalSheetElement: card, finalTotalElement: closing,
        totalCashElement: supply, totalSeparateElement: separate,
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        updateTotals() {
            card.textContent = 'R$ 500,00'; closing.textContent = 'R$ 1.820,00';
            supply.textContent = 'R$ 300,00'; separate.textContent = 'R$ 1.020,00';
            elements.finalTotalContainer.style.display = ready ? 'flex' : 'none';
        },
        window: { print() { calls++; }, addEventListener(event, handler) { handlers[event] = handler; } }
    });
    return { elements, classes, printStyle, handlers, storage, paperButtons, measuringClasses, receiptProperties, calls: () => calls };
}

for (const width of ['58', '80']) {
    for (const button of ['printCardPix', 'printCardPixMain', 'printCashClosing']) {
        test(`${button}: bobina ${width} mm imprime o valor e o título corretos`, () => {
            const state = setup(width);
            state.elements[button].click();
            const full = button === 'printCashClosing';
            assert.equal(state.elements.receiptAmount.textContent, full ? 'R$ 1.820,00' : 'R$ 500,00');
            assert.equal(state.elements.receiptConcept.textContent, full ? 'TOTAL FECHAMENTO DO CAIXA' : 'Total em cartão e Pix');
            assert.equal(state.elements.receiptSubtitle.textContent, '');
            assert.equal(state.elements.receiptSubtitle.hidden, true);
            assert.equal(state.elements.receiptSummary.hidden, !full);
            assert.equal(state.elements.receiptSupply.textContent, full ? '300,00' : '');
            assert.equal(state.elements.receiptSeparate.textContent, full ? '1.020,00' : '');
            assert.equal(state.elements.receiptCardPix.textContent, full ? '500,00' : '');
            assert.ok(state.elements.receiptDate.textContent);
            const height = Number(width) + 1;
            assert.match(state.printStyle.textContent, new RegExp(`size: ${width}mm ${height}mm`));
            assert.match(state.printStyle.textContent, new RegExp(`font-size: ${width === '58' ? 22 : 28}pt`));
            assert.equal(state.calls(), 1);
            state.handlers.afterprint();
            assert.equal(state.classes.size, 0);
            assert.equal(state.printStyle.textContent, '');
        });
    }
}

test('altura acompanha o conteúdo e é recalculada ao alternar fechamento e cartão/Pix', () => {
    const state = setup('80', true, null, elements => elements.receiptSummary.hidden ? 132 : 350);
    state.elements.printCashClosing.click();
    assert.match(state.printStyle.textContent, /size: 80mm 94mm/);
    state.handlers.afterprint();
    state.elements.printCardPix.click();
    assert.match(state.printStyle.textContent, /size: 80mm 81mm/);
    assert.equal(state.measuringClasses.size, 0);
    assert.equal(state.receiptProperties.get('--receipt-width'), '80mm');
    assert.equal(state.receiptProperties.get('--receipt-amount-size'), '28pt');
});

test('conteúdo mais alto aumenta o papel, sem truncar em uma altura fixa', () => {
    const state = setup('58', true, null, 430);
    state.elements.printCashClosing.click();
    assert.match(state.printStyle.textContent, /size: 58mm 115mm/);
    assert.equal(state.measuringClasses.size, 0);
});

test('fechamento incompleto ou inválido não abre impressão, cartão/Pix continua independente', () => {
    const state = setup('80', false);
    state.elements.printCashClosing.click();
    assert.equal(state.calls(), 0);
    state.elements.printCardPix.click();
    assert.equal(state.calls(), 1);
    assert.equal(state.elements.receiptAmount.textContent, 'R$ 500,00');
});

test('imprimir fechamento preserva o botão e a função de copiar total', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(html, /id="copyFinalTotal"/);
    assert.match(html, /id="printCashClosing"/);
    assert.match(source, /copyFinalTotalBtn\.addEventListener\('click', async/);
    assert.match(source, /navigator\.clipboard\.writeText\(finalTotalElement\.textContent\.trim\(\)\)/);
});

test('restaura a largura de bobina escolhida anteriormente', () => {
    const state = setup('80', true, '58');
    assert.equal(state.elements.receiptPaperWidth.value, '58');
    state.elements.printCashClosing.click();
    assert.match(state.printStyle.textContent, /size: 58mm 59mm/);
});

test('guarda a largura de papel para as proximas impressoes', () => {
    const state = setup('80');
    state.elements.receiptPaperWidth.value = '58';
    state.elements.receiptPaperWidth.change();
    assert.equal(state.storage.get('receiptPaperWidth'), '58');
});

test('seletor de bobina destaca uma única opção e aplica a largura na impressão', () => {
    const state = setup('80');
    state.paperButtons[0].click();
    assert.equal(state.elements.receiptPaperWidth.value, '58');
    assert.equal(state.storage.get('receiptPaperWidth'), '58');
    assert.equal(state.paperButtons[0].attributes['aria-pressed'], 'true');
    assert.equal(state.paperButtons[1].attributes['aria-pressed'], 'false');
    state.elements.printCashClosing.click();
    assert.match(state.printStyle.textContent, /size: 58mm 59mm/);
    state.handlers.afterprint();
    state.paperButtons[1].click();
    assert.equal(state.storage.get('receiptPaperWidth'), '80');
    assert.equal(state.paperButtons[0].attributes['aria-pressed'], 'false');
    assert.equal(state.paperButtons[1].attributes['aria-pressed'], 'true');
});

test('imprimir cartão/Pix depois do fechamento remove o resumo e o título anterior', () => {
    const state = setup('80');
    state.elements.printCashClosing.click();
    state.handlers.afterprint();
    state.elements.printCardPix.click();
    assert.equal(state.elements.receiptSummary.hidden, true);
    assert.equal(state.elements.receiptSubtitle.hidden, true);
    assert.equal(state.elements.receiptSupply.textContent, '');
    assert.equal(state.elements.receiptSeparate.textContent, '');
    assert.equal(state.elements.receiptCardPix.textContent, '');
    assert.equal(state.elements.receiptAmount.textContent, 'R$ 500,00');
});

test('comprovante mostra o total antes dos detalhes, com rótulo Dinheiro', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(html.indexOf('id="receiptAmount"') < html.indexOf('id="receiptSummary"'));
    assert.match(html, /<h3>DETALHES<\/h3>/);
    assert.match(html, /<span>Dinheiro:<\/span><b id="receiptSeparate"/);
});

for (const target of ['copyFinalTotal', 'copyFinalTotalArea']) {
    test(`${target}: copia o valor atual uma única vez e confirma a cópia`, async () => {
        const controls = Object.fromEntries(['copyFinalTotal', 'copyFinalTotalArea', 'copyTotalStatus'].map(id => [id, {
            textContent: '', addEventListener(event, callback) { this[event] = callback; }
        }]));
        let copied;
        let copies = 0;
        const copySource = source.slice(source.indexOf('    // Confirma a cópia somente depois'), source.indexOf('    function clearCashPageFields()'));
        vm.runInNewContext(copySource, {
            document: { getElementById: id => controls[id] },
            finalTotalElement: { textContent: 'R$ 1.820,00' },
            navigator: { clipboard: { async writeText(value) { copied = value; copies++; } } },
            setTimeout() {}
        });
        await controls[target].click();
        assert.equal(copied, 'R$ 1.820,00');
        assert.equal(copies, 1);
        assert.equal(controls.copyTotalStatus.textContent, 'Total copiado');
    });
}
