const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function createNoteFocusGuard('), source.indexOf('// Declarar elementos principais')), context);

function setup(getReturnInput = null) {
    const windowEvents = {};
    const documentEvents = {};
    const document = {
        body: {}, hidden: false, focused: true,
        hasFocus() { return this.focused; },
        addEventListener(event, handler) { documentEvents[event] = handler; }
    };
    const input = {
        value: '123,', selectionStart: 4, selectionEnd: 4, selectionDirection: 'none',
        isConnected: true, visible: true, focusCount: 0,
        classList: { contains: name => name === 'cell-input' },
        getClientRects() { return this.visible ? [{}] : []; },
        setSelectionRange(start, end, direction) {
            this.selectionStart = start;
            this.selectionEnd = end;
            this.selectionDirection = direction;
        },
        focus() { this.focusCount++; document.activeElement = this; }
    };
    document.activeElement = input;
    const guard = context.createNoteFocusGuard(
        { contains: element => element === input }, document,
        { addEventListener(event, handler) { windowEvents[event] = handler; } },
        getReturnInput ? () => getReturnInput({ input, document }) : null
    );
    return { input, document, guard, windowEvents, documentEvents };
}

test('retorno ao navegador troca o campo escolhido adiante pelo próximo da sequência', () => {
    const state = setup(({ document }) => document.nextInput);
    const next = { ...state.input, value: '', focusCount: 0 };
    state.document.nextInput = next;
    state.windowEvents.blur();
    state.windowEvents.focus();
    assert.equal(state.document.activeElement, next);
    assert.equal(next.focusCount, 1);
    assert.equal(state.input.value, '123,');
});

test('voltar à aba recoloca foco na sequência mesmo se o foco anterior era um botão', () => {
    const state = setup(({ input }) => input);
    state.document.activeElement = {};
    state.document.hidden = true;
    state.documentEvents.visibilitychange();
    state.document.hidden = false;
    state.documentEvents.visibilitychange();
    state.windowEvents.focus();
    assert.equal(state.document.activeElement, state.input);
    assert.equal(state.input.focusCount, 1);
});

test('retorno aguarda navegador ativo e não muda foco se outra página ou modal estiver aberto', () => {
    const state = setup(({ document }) => document.nextInput);
    state.document.nextInput = state.input;
    state.document.focused = false;
    state.documentEvents.visibilitychange();
    assert.equal(state.input.focusCount, 0);
    state.document.focused = true;
    state.document.nextInput = null;
    state.document.activeElement = {};
    const active = state.document.activeElement;
    state.windowEvents.focus();
    assert.equal(state.document.activeElement, active);
});

test('prévia externa não conclui nem formata uma digitação parcial', () => {
    const { input, document, guard, windowEvents } = setup();
    document.focused = false;
    windowEvents.blur();
    assert.equal(guard.pauseOnBlur(input), true);
    assert.equal(input.value, '123,');
    input.setSelectionRange(0, input.value.length, 'forward');
    document.focused = true;
    windowEvents.focus();
    assert.equal(input.value, '123,');
    assert.equal(input.selectionStart, 4);
    assert.equal(input.selectionEnd, 4);
});

test('retorno pelo evento do campo restaura uma seleção intermediária', () => {
    const { input, document, guard, windowEvents } = setup();
    input.value = '123,45';
    input.setSelectionRange(2, 4, 'backward');
    document.focused = false;
    windowEvents.blur();
    document.focused = true;
    assert.equal(guard.resumeOnFocus(input), true);
    windowEvents.focus();
    assert.equal(input.selectionStart, 2);
    assert.equal(input.selectionEnd, 4);
    assert.equal(input.selectionDirection, 'backward');
});

test('troca intencional de campo continua permitindo salvar a nota', () => {
    const { input, guard } = setup();
    assert.equal(guard.pauseOnBlur(input), false);
    assert.equal(guard.resumeOnFocus(input), false);
});

test('ao voltar não rouba o foco de outro botão ou campo', () => {
    const { input, document, windowEvents } = setup();
    windowEvents.blur();
    const button = {};
    document.activeElement = button;
    windowEvents.focus();
    assert.equal(document.activeElement, button);
    assert.equal(input.focusCount, 0);
});

test('restaura o campo quando o navegador devolve o foco ao corpo da página', () => {
    const { input, document, windowEvents } = setup();
    windowEvents.blur();
    document.activeElement = document.body;
    windowEvents.focus();
    assert.equal(document.activeElement, input);
    assert.equal(input.focusCount, 1);
});

for (const state of ['hidden', 'removed']) {
    test(`não reativa uma nota ${state === 'hidden' ? 'de uma página oculta' : 'removida ao trocar de página'}`, () => {
        const { input, document, windowEvents } = setup();
        windowEvents.blur();
        if (state === 'hidden') input.visible = false;
        else input.isConnected = false;
        document.activeElement = document.body;
        windowEvents.focus();
        assert.equal(input.focusCount, 0);
    });
}

test('não repõe o valor antigo após limpar ou editar a nota', () => {
    const { input, windowEvents } = setup();
    windowEvents.blur();
    input.value = '';
    input.setSelectionRange(0, 0);
    windowEvents.focus();
    assert.equal(input.value, '');
    assert.equal(input.selectionStart, 0);
});

test('troca de aba também preserva a digitação sem concluir a nota', () => {
    const { input, document, documentEvents, guard } = setup();
    document.hidden = true;
    documentEvents.visibilitychange();
    assert.equal(guard.pauseOnBlur(input), true);
    document.hidden = false;
    assert.equal(guard.resumeOnFocus(input), true);
    assert.equal(input.value, '123,');
});

test('próximo campo vazio respeita a sequência numérica das notas', () => {
    const inputs = [
        { dataset: { noteNumber: '1' }, value: 'R$ 25,00' },
        { dataset: { noteNumber: '11' }, value: '' },
        { dataset: { noteNumber: '21' }, value: '' },
        { dataset: { noteNumber: '2' }, value: '' }
    ];
    const next = context.findNextEmptyNote({ querySelectorAll: () => inputs });
    assert.equal(next.dataset.noteNumber, '2');
});

test('foco automático não escolhe uma nota com valor parcial', () => {
    const inputs = [
        { dataset: { noteNumber: '71' }, value: '123,' },
        { dataset: { noteNumber: '72' }, value: '' }
    ];
    assert.equal(context.findNextEmptyNote({ querySelectorAll: () => inputs }), inputs[1]);
});

test('uma página cheia não substitui um valor para receber foco', () => {
    const input = { dataset: { noteNumber: '1' }, value: 'R$ 25,00' };
    assert.equal(context.findNextEmptyNote({ querySelectorAll: () => [input] }), undefined);
    assert.equal(input.value, 'R$ 25,00');
});

test('controle de páginas só é liberado com todos os 70 campos preenchidos', () => {
    const values = new Map(Array.from({ length: 70 }, (_, index) => ['nota' + (index + 1), '10']));
    const storage = { getItem: key => values.get(key) ?? null };
    assert.equal(context.isFirstNotePageComplete(storage), true);
    for (let number = 1; number <= 70; number++) {
        values.delete('nota' + number);
        assert.equal(context.isFirstNotePageComplete(storage), false);
        values.set('nota' + number, '10');
    }
});

test('zero preenchido conta como campo completo; branco e valor inválido não contam', () => {
    const values = new Map(Array.from({ length: 70 }, (_, index) => ['nota' + (index + 1), '0']));
    const storage = { getItem: key => values.get(key) ?? null };
    assert.equal(context.isFirstNotePageComplete(storage), true);
    for (const invalid of ['', ' ', 'NaN', 'Infinity']) {
        values.set('nota70', invalid);
        assert.equal(context.isFirstNotePageComplete(storage), false);
    }
});
