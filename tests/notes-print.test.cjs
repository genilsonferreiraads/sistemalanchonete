const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const NoteComposer = require('../note-composer.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'notes-page.js'), 'utf8');
const printSource = source.slice(source.indexOf("    printButton.addEventListener('click'"), source.indexOf("    page.addEventListener('custom-notes-open'"));

function setup(fields, width = '80', fail = false, receiptHeight = 600) {
    const classes = new Set(), rendered = [], handlers = {};
    const message = { textContent: '' }, printStyle = { textContent: '' };
    const control = { attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, focus() { this.focused = true; } };
    const preview = { name: 'preview', getBoundingClientRect: () => ({ height: 600 }) };
    const measuring = new Set();
    const receipt = { name: 'receipt',
        classList: { add(name) { measuring.add(name); }, remove(name) { measuring.delete(name); } },
        get offsetHeight() { assert.ok(measuring.has('note-receipt-measuring')); return receiptHeight; }
    };
    let calls = 0, click;
    vm.runInNewContext(printSource, {
        NoteComposer, fields, width, message, printStyle, preview, receipt,
        printButton: { addEventListener(event, callback) { click = callback; } },
        list: { querySelector: () => control },
        renderPaper(target, entries) { rendered.push({ target: target.name, entries: JSON.parse(JSON.stringify(entries)) }); },
        document: { body: { classList: { add: key => classes.add(key), remove: key => classes.delete(key) } } },
        window: {
            addEventListener(event, callback) { handlers[event] = callback; },
            print() { assert.ok(classes.has('printing-custom-note')); calls++; if (fail) throw Error('unsupported'); }
        }
    });
    return { click, calls: () => calls, classes, rendered, handlers, message, control, printStyle };
}

for (const width of ['58', '80']) {
    test(`nota livre de ${width} mm imprime os próprios campos e valor em reais`, () => {
        const fields = [{ id: '1', type: 'nome', value: 'Maria' }, { id: '2', type: 'aviso', value: 'Retirar no balcão' }, { id: '3', type: 'valor', value: '150' }];
        const state = setup(fields, width);
        state.click();
        assert.equal(state.calls(), 1);
        assert.equal(state.rendered[1].target, 'receipt');
        assert.equal(state.rendered[1].entries.length, 3);
        assert.equal(state.rendered[1].entries[2].value.replace(/\s/g, ' '), 'R$ 150,00');
        assert.match(state.printStyle.textContent, new RegExp(`size: ${width}mm 160mm`));
        state.handlers.afterprint();
        assert.equal(state.classes.size, 0);
        assert.equal(state.printStyle.textContent, '');
        assert.equal(fields[2].value, '150');
    });
}
test('nota curta de 80 mm usa o menor papel em retrato para evitar rotação no driver', () => {
    const state = setup([{ id: '1', type: 'aviso', value: 'Retirar no balcão' }], '80', false, 135);
    state.click();
    assert.match(state.printStyle.textContent, /size: 80mm 81mm/);
});

test('valor inválido não é enviado à impressão e recebe foco para correção', () => {
    const state = setup([{ id: '1', type: 'valor', value: '1,234' }]);
    state.click();
    assert.equal(state.calls(), 0);
    assert.equal(state.control.focused, true);
    assert.equal(state.control.attributes['aria-invalid'], 'true');
    assert.ok(state.message.textContent);
});
test('nota vazia não abre impressão', () => {
    const state = setup([]);
    state.click();
    assert.equal(state.calls(), 0);
    assert.equal(state.classes.size, 0);
});
test('falha do navegador limpa o modo de impressão e preserva o texto', () => {
    const fields = [{ id: '1', type: 'descricao', value: 'Texto importante' }];
    const state = setup(fields, '80', true);
    state.click();
    assert.equal(state.classes.size, 0);
    assert.equal(state.printStyle.textContent, '');
    assert.match(state.message.textContent, /Não foi possível/);
    assert.equal(fields[0].value, 'Texto importante');
});
