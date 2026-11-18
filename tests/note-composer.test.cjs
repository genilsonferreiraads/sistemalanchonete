const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, initialFields, build, paperHeight, MAX_FIELDS, capitalizeText, formatAmount, createDraft, restoreDraft, DRAFT_TTL } = require('../note-composer.js');
const field = (type, value, label = '') => ({ type, value, label });

for (const textType of ['aviso', 'observacao', 'descricao', 'nome']) {
    test(`imprime ${textType} sem obrigar um valor monetário`, () => {
        const result = build([field(textType, 'Texto da nota')]);
        assert.equal(result.valid, true);
        assert.equal(result.entries[0].value, 'Texto da nota');
        assert.equal(result.entries[0].isAmount, false);
    });
}
for (const type of ['aviso', 'observacao', 'descricao']) {
    test(`combina nome, ${type} e valor na ordem escolhida`, () => {
        const result = build([field('nome', 'Maria'), field(type, 'Entregar no balcão'), field('valor', '1234,56')]);
        assert.equal(result.valid, true);
        assert.equal(result.entries.length, 3);
        assert.equal(result.entries[0].label, 'Nome');
        assert.equal(result.entries[2].value.replace(/\s/g, ' '), 'R$ 1.234,56');
    });
}
test('ignora campos opcionais vazios sem imprimir rótulos sem conteúdo', () => {
    const result = build([field('nome', ''), field('observacao', 'Teste'), field('valor', '')]);
    assert.equal(result.valid, true);
    assert.equal(result.entries.length, 1);
});
test('nota totalmente vazia é bloqueada', () => {
    assert.equal(build([]).valid, false);
    assert.equal(build([field('aviso', '  ')]).valid, false);
});
test('valor zero é válido e continua visível', () => {
    const result = build([field('valor', '0')]);
    assert.equal(result.valid, true);
    assert.equal(result.entries[0].value.replace(/\s/g, ' '), 'R$ 0,00');
});
for (const amount of ['1,234', '-10', 'abc', '1,2,3']) {
    test(`bloqueia impressão de valor inválido ${amount}`, () => {
        const result = build([field('valor', amount)]);
        assert.equal(result.valid, false);
        assert.equal(result.errors[0].index, 0);
    });
}
test('rótulo personalizado é impresso e exige um nome', () => {
    assert.equal(build([field('personalizado', 'Hoje', 'Entrega')]).entries[0].label, 'Entrega');
    assert.equal(build([field('personalizado', 'Hoje', '')]).valid, false);
});
test('preserva quebras de linha e texto literal, sem interpretar marcação', () => {
    const text = 'Primeira linha\n<script>alert(1)</script>\nTerceira linha';
    assert.equal(build([field('descricao', text)]).entries[0].value, text);
});
test('vários valores são campos independentes, sem somar ao caixa ou entre si', () => {
    const result = build([field('valor', '10'), field('valor', '20')]);
    assert.equal(result.entries.length, 2);
    assert.equal(result.entries[0].value.replace(/\s/g, ' '), 'R$ 10,00');
    assert.equal(result.entries[1].value.replace(/\s/g, ' '), 'R$ 20,00');
});
test('rascunhos inválidos não introduzem tipos ou identificadores inesperados', () => {
    assert.deepEqual(normalize(null), []);
    assert.equal(normalize([{ type: 'toString', value: 'abc' }]).length, 0);
    const result = normalize([{ type: 'nome', id: '<x>', value: 123 }, field('aviso', 'ok')]);
    assert.equal(result[0].id, '1');
    assert.equal(result[0].value, '');
    assert.equal(result[1].value, 'ok');
});
test('limita rascunhos grandes para manter o editor utilizável', () => {
    const result = normalize(Array.from({ length: 30 }, () => field('personalizado', 'x'.repeat(1000), 'x'.repeat(80))));
    assert.equal(result.length, MAX_FIELDS);
    assert.equal(result[0].value.length, 600);
    assert.equal(result[0].label.length, 40);
});
test('comprimento do cupom acompanha o conteúdo com margem e limite de página', () => {
    assert.equal(paperHeight(0), 1);
    assert.equal(paperHeight(100), 28);
    assert.ok(paperHeight(600) > paperHeight(300));
    assert.equal(paperHeight(100000), 2500);
});

test('nova nota já abre com observação e valor, ambos vazios', () => {
    const fields = initialFields([]);
    assert.deepEqual(fields.map(field => field.type), ['observacao', 'valor']);
    assert.ok(fields.every(field => field.value === ''));
    assert.ok(fields.every(field => field.locked));
});
test('rascunho de texto recebe valor opcional sem perder o conteúdo', () => {
    const fields = initialFields([field('aviso', 'Retirar amanhã')]);
    assert.equal(fields[0].type, 'aviso');
    assert.equal(fields[0].value, 'Retirar amanhã');
    assert.equal(fields[1].type, 'valor');
});
test('alternar rótulo preserva texto e mantém o valor independente', () => {
    const fields = initialFields([field('observacao', 'Texto importante'), field('valor', '123,45')]);
    fields[0].type = 'aviso';
    const result = build(fields);
    assert.equal(result.entries[0].label, 'Aviso');
    assert.equal(result.entries[0].value, 'Texto importante');
    assert.equal(result.entries[1].value.replace(/\s/g, ' '), 'R$ 123,45');
    assert.equal(initialFields(fields).length, 2);
    assert.ok(initialFields(fields).every(field => field.locked));
});

test('protege só os dois campos padrão e mantém extras removíveis', () => {
    const fields = initialFields([field('aviso', 'Texto'), field('valor', '10'), field('nome', 'Maria'), field('valor', '20')]);
    assert.deepEqual(fields.map(field => field.locked), [true, true, false, false]);
});

for (const [text, expected] of [
    ['aviso de retirada', 'Aviso de Retirada'],
    ['JOÃO DA SILVA', 'João da Silva'],
    ['  nome de maria\nobservação do pedido  ', '  Nome de Maria\nObservação do Pedido  '],
    ['o eu da de do e um', 'o eu da de do e um'],
    ['R$ 1.234,56 para maria', 'R$ 1.234,56 Para Maria'],
    ['acesse https://exemplo.com/ABC ou maria@EXEMPLO.com', 'Acesse https://exemplo.com/ABC ou maria@EXEMPLO.com']
]) {
    test(`capitalização de palavras maiores que duas letras: ${JSON.stringify(text)}`, () => {
        assert.equal(capitalizeText(text), expected);
        assert.equal(capitalizeText(expected), expected);
    });
}
for (const [value, expected] of [['150', 'R$ 150,00'], ['1234,56', 'R$ 1.234,56'], ['R$ 1.234,56', 'R$ 1.234,56'], ['0,1', 'R$ 0,10'], ['0', 'R$ 0,00'], ['', '']]) {
    test(`formata valor ${JSON.stringify(value)} como moeda sem duplicar R$`, () => {
        const result = formatAmount(value);
        assert.equal(result.valid, true);
        assert.equal(result.value.replace(/\s/g, ' '), expected);
    });
}
test('formatação não arredonda nem apaga valor inválido', () => {
    for (const value of ['1,234', '-10', 'abc']) {
        const result = formatAmount(value);
        assert.equal(result.valid, false);
        assert.equal(result.value, value);
    }
});
test('valor aceita rótulo opcional sem alterar o dinheiro informado', () => {
    const result = build([field('valor', '150', 'Adiantamento')]);
    assert.equal(result.valid, true);
    assert.equal(result.entries[0].label, 'Valor');
    assert.equal(result.entries[0].customLabel, 'Adiantamento');
    assert.equal(result.entries[0].value.replace(/\s/g, ' '), 'R$ 150,00');
    assert.equal(build([field('valor', '150', ' ')]).entries[0].label, 'Valor');
});
test('rótulo do valor é preservado no rascunho e campos monetários diferentes continuam separados', () => {
    const fields = initialFields([field('observacao', ''), field('valor', '10', 'Troco'), field('valor', '20', 'Entrega')]);
    const result = build(fields);
    assert.deepEqual(result.entries.map(entry => entry.label), ['Valor', 'Valor']);
    assert.deepEqual(result.entries.map(entry => entry.customLabel), ['Troco', 'Entrega']);
    assert.equal(fields[1].locked, true);
    assert.equal(fields[2].locked, false);
});

test('rascunho dura exatamente um minuto e não pode ser restaurado no limite ou depois', () => {
    assert.equal(DRAFT_TTL, 60000);
    const draft = createDraft([field('observacao', 'Texto')], 1000);
    assert.equal(draft.expiresAt, 61000);
    assert.ok(restoreDraft(draft, 60999));
    assert.equal(restoreDraft(draft, 61000), null);
    assert.equal(restoreDraft(draft, 61001), null);
});
test('reabrir rascunho não renova o prazo da última edição', () => {
    const draft = createDraft([field('observacao', 'Texto')], 0);
    assert.equal(restoreDraft(draft, 30000).expiresAt, 60000);
    assert.equal(restoreDraft(draft, 59000).expiresAt, 60000);
});
test('nova edição inicia outro minuto, preservando o texto atualizado', () => {
    const draft = createDraft([field('aviso', 'Atualizado')], 45000);
    assert.equal(draft.expiresAt, 105000);
    assert.equal(restoreDraft(draft, 104999).fields[0].value, 'Atualizado');
});
test('rascunhos antigos sem prazo e prazos inválidos são rejeitados', () => {
    assert.equal(restoreDraft([field('nome', 'Maria')], 0), null);
    for (const expiresAt of [NaN, Infinity, '60000', -1, 60001]) {
        assert.equal(restoreDraft({ fields: [], expiresAt }, 0), null);
    }
});
test('rascunho temporário conserva título Valor, rótulo adicional e proteção dos campos', () => {
    const draft = createDraft([field('observacao', ''), field('valor', '150', 'Adiantamento')], 0);
    const restored = restoreDraft(draft, 1000);
    const entry = build(restored.fields).entries[0];
    assert.equal(entry.label, 'Valor');
    assert.equal(entry.customLabel, 'Adiantamento');
    assert.ok(restored.fields.every(field => field.locked));
});
