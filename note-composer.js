const NoteComposer = (() => {
    const money = typeof module !== 'undefined' && module.exports ? require('./cash-calculator.js') : CashCalculator;
    const TYPES = Object.freeze({ nome: 'Nome', observacao: 'Observação', aviso: 'Aviso', descricao: 'Descrição', valor: 'Valor', personalizado: 'Personalizado' });
    const MAX_FIELDS = 12;
    const DRAFT_TTL = 60 * 1000;
    function capitalizeText(text) {
        return String(text).replace(/https?:\/\/[^\s]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|\p{L}[\p{L}\p{M}]*/giu, (word, offset, full) => {
            if (/^https?:\/\//i.test(word) || word.includes('@')) return word;
            if (/^r$/i.test(word) && full[offset + word.length] === '$') return 'R';
            const lower = word.toLocaleLowerCase('pt-BR');
            return (word.match(/\p{L}/gu) || []).length > 2 ? lower[0].toLocaleUpperCase('pt-BR') + lower.slice(1) : lower;
        });
    }
    function formatAmount(value) {
        if (!value.trim()) return { valid: true, value: '' };
        const cents = money.parseCurrencyCents(value);
        return cents === null ? { valid: false, value } : { valid: true, value: (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) };
    }
    function normalize(fields) {
        if (!Array.isArray(fields)) return [];
        return fields.filter(field => field && Object.hasOwn(TYPES, field.type)).slice(0, MAX_FIELDS).map((field, index) => ({
            id: String(index + 1), type: field.type,
            label: typeof field.label === 'string' ? field.label.slice(0, 40) : '',
            value: typeof field.value === 'string' ? field.value.slice(0, 600) : ''
        }));
    }
    function build(fields) {
        const entries = [], errors = [];
        fields.forEach((field, index) => {
            if (!Object.hasOwn(TYPES, field.type)) { errors.push({ index, field: 'value', message: 'Escolha um tipo de campo.' }); return; }
            const text = String(field.value || '').trim();
            if (!text) return;
            const customLabel = String(field.label || '').trim();
            const label = field.type === 'personalizado' ? customLabel : TYPES[field.type];
            if (!label) errors.push({ index, field: 'label', message: 'Informe o rótulo deste campo.' });
            let value = text;
            if (field.type === 'valor') {
                const cents = money.parseCurrencyCents(text);
                if (cents === null) errors.push({ index, field: 'value', message: 'Informe um valor válido. Exemplo: 150,00.' });
                else value = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
            entries.push({ label, value, isAmount: field.type === 'valor', customLabel: field.type === 'valor' ? customLabel : '' });
        });
        if (!entries.length) errors.push({ index: -1, field: 'value', message: 'Escreva pelo menos um campo para imprimir.' });
        return { valid: errors.length === 0, errors, entries };
    }
    function initialFields(saved) {
        const fields = normalize(saved);
        if (!fields.some(field => field.type !== 'valor') && fields.length < MAX_FIELDS) fields.unshift({ type: 'observacao', label: '', value: '' });
        if (!fields.some(field => field.type === 'valor') && fields.length < MAX_FIELDS) fields.push({ type: 'valor', label: '', value: '' });
        const protectedTypes = new Set();
        return normalize(fields).map(field => {
            const group = field.type === 'valor' ? 'valor' : 'texto';
            const locked = !protectedTypes.has(group);
            protectedTypes.add(group);
            return { ...field, locked };
        });
    }
    function paperHeight(contentPixels) {
        return Math.max(1, Math.min(2500, Math.ceil(contentPixels * 25.4 / 96) + 1));
    }
    function createDraft(fields, now = Date.now()) {
        return { fields: normalize(fields), expiresAt: now + DRAFT_TTL };
    }
    function restoreDraft(draft, now = Date.now()) {
        if (!draft || Array.isArray(draft) || !Array.isArray(draft.fields) || !Number.isFinite(draft.expiresAt) || draft.expiresAt <= now || draft.expiresAt > now + DRAFT_TTL) return null;
        return { fields: initialFields(draft.fields), expiresAt: draft.expiresAt };
    }
    return { TYPES, MAX_FIELDS, DRAFT_TTL, normalize, initialFields, build, paperHeight, capitalizeText, formatAmount, createDraft, restoreDraft };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NoteComposer;
