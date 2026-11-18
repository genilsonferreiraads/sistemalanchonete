document.addEventListener('DOMContentLoaded', () => {
    const draftKey = 'limarquesCustomNoteDraft';
    const page = document.getElementById('customNotesPage');
    const list = document.getElementById('noteFields');
    const preview = document.getElementById('notePreview');
    const receipt = document.getElementById('customNoteReceipt');
    const message = document.getElementById('noteStatus');
    const draftMessage = document.getElementById('noteDraftStatus');
    const printButton = document.getElementById('printCustomNote');
    const addButton = document.getElementById('addNoteField');
    const printStyle = document.createElement('style');
    printStyle.media = 'print';
    document.head.appendChild(printStyle);
    let fields = NoteComposer.initialFields([]);
    let nextId = fields.length + 1;
    let draftExpiryTimer = null;
    let draftExpiresAt = 0;
    function scheduleDraftExpiry(expiresAt) {
        clearTimeout(draftExpiryTimer);
        draftExpiresAt = expiresAt;
        draftExpiryTimer = setTimeout(() => {
            try { sessionStorage.removeItem(draftKey); } catch (error) { /* Sem armazenamento disponível. */ }
            draftExpiresAt = 0;
            draftMessage.textContent = 'Rascunho expirado';
        }, Math.max(0, expiresAt - Date.now()));
    }
    function restoreSavedDraft() {
        clearTimeout(draftExpiryTimer);
        draftExpiresAt = 0;
        fields = NoteComposer.initialFields([]);
        try {
            localStorage.removeItem(draftKey);
            const saved = sessionStorage.getItem(draftKey);
            const draft = saved ? NoteComposer.restoreDraft(JSON.parse(saved)) : null;
            if (draft) {
                fields = draft.fields;
                scheduleDraftExpiry(draft.expiresAt);
                draftMessage.textContent = 'Rascunho temporário: até 1 minuto';
            } else {
                sessionStorage.removeItem(draftKey);
                draftMessage.textContent = 'Rascunho temporário: até 1 minuto';
            }
        } catch (error) { /* Um rascunho inválido não bloqueia a criação de uma nota. */ }
        fields.forEach(field => {
            field.label = NoteComposer.capitalizeText(field.label);
            if (field.type !== 'valor') field.value = NoteComposer.capitalizeText(field.value);
        });
        nextId = fields.length + 1;
    }
    restoreSavedDraft();
    let width = localStorage.getItem('receiptPaperWidth') === '58' ? '58' : '80';

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (tag === 'i') node.setAttribute('aria-hidden', 'true');
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function createTypePicker(selected, id, includeAmount, onSelect) {
        const icons = { nome: 'far fa-user', observacao: 'far fa-comment-dots', aviso: 'fas fa-bullhorn', descricao: 'far fa-file-alt', valor: 'fas fa-coins', personalizado: 'fas fa-pen' };
        const wrapper = element('div', includeAmount ? 'note-type-picker note-type-picker-wide' : 'note-type-picker');
        const trigger = element('button', 'note-type-trigger');
        trigger.type = 'button';
        trigger.setAttribute('aria-label', (includeAmount ? 'Adicionar tipo: ' : 'Alterar rótulo: ') + NoteComposer.TYPES[selected]);
        trigger.setAttribute('aria-expanded', 'false');
        trigger.append(element('i', icons[selected]), element('span', '', NoteComposer.TYPES[selected]), element('i', 'fas fa-chevron-down note-type-chevron'));
        const options = element('div', 'note-type-options');
        options.id = id;
        options.popover = 'auto';
        options.setAttribute('role', 'group');
        options.setAttribute('aria-label', includeAmount ? 'Tipos de campo para adicionar' : 'Rótulos disponíveis');
        trigger.setAttribute('popovertarget', id);
        options.addEventListener('toggle', event => trigger.setAttribute('aria-expanded', String(event.newState === 'open')));
        Object.entries(NoteComposer.TYPES).filter(([type]) => includeAmount || type !== 'valor').forEach(([type, name]) => {
            const option = element('button', 'note-type-option');
            option.type = 'button';
            option.setAttribute('aria-pressed', String(type === selected));
            option.append(element('i', icons[type]), element('span', '', name));
            const check = element('i', 'fas fa-check note-type-check');
            check.style.visibility = type === selected ? 'visible' : 'hidden';
            option.append(check);
            option.addEventListener('click', () => { options.hidePopover(); onSelect(type); });
            options.append(option);
        });
        options.addEventListener('beforetoggle', event => {
            if (event.newState !== 'open') return;
            const rect = trigger.getBoundingClientRect();
            const menuHeight = options.children.length * 38 + 12;
            const menuWidth = includeAmount ? Math.max(214, Math.min(rect.width, 320)) : 214;
            options.style.width = menuWidth + 'px';
            options.style.left = Math.max(8, Math.min(rect.left, innerWidth - menuWidth - 12)) + 'px';
            options.style.top = Math.max(8, rect.bottom + menuHeight + 6 < innerHeight ? rect.bottom + 6 : rect.top - menuHeight - 6) + 'px';
        });
        wrapper.append(trigger, options);
        return wrapper;
    }
    function renderAddTypePicker() {
        const select = document.getElementById('noteAddType');
        const target = document.getElementById('noteAddTypePicker');
        target.replaceChildren(createTypePicker(select.value, 'note-add-type-options', true, type => {
            select.value = type;
            renderAddTypePicker();
            target.querySelector('button').focus();
        }));
    }
    function saveDraft() {
        try {
            const draft = NoteComposer.createDraft(fields);
            sessionStorage.setItem(draftKey, JSON.stringify(draft));
            scheduleDraftExpiry(draft.expiresAt);
            draftMessage.textContent = 'Rascunho salvo por 1 minuto';
        } catch (error) { draftMessage.textContent = 'Não foi possível guardar o rascunho.'; }
    }
    function renderPaper(target, entries) {
        target.replaceChildren();
        target.style.width = width + 'mm';
        const header = element('header', 'note-paper-header');
        header.append(element('h2', '', 'Restaurante e lanchonete Limarques'));
        header.append(element('p', '', new Date().toLocaleString('pt-BR')));
        target.append(header);
        if (!entries.length) target.append(element('p', 'note-preview-empty', 'Seu texto aparece aqui'));
        entries.forEach(entry => {
            const section = element('section', 'note-paper-field');
            section.append(element('h3', '', entry.label));
            if (entry.customLabel) section.append(element('p', 'note-paper-custom-label', entry.customLabel));
            const content = element('p', entry.isAmount ? 'note-paper-value' : 'note-paper-text', entry.value);
            if (entry.isAmount) {
                const base = width === '58' ? 22 : 28;
                content.style.fontSize = Math.min(base, base * 11 / Math.max(entry.value.length, 11)) + 'pt';
            }
            section.append(content);
            target.append(section);
        });
    }
    function updatePreview() {
        const result = NoteComposer.build(fields);
        renderPaper(preview, result.entries);
        printButton.disabled = !result.entries.length;
        addButton.disabled = fields.length >= NoteComposer.MAX_FIELDS;
        document.querySelectorAll('[data-note-paper]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.notePaper === width)));
    }
    function inputChanged(field, key, value, control, composing = false) {
        const formatted = !composing && (key === 'label' || field.type !== 'valor') ? NoteComposer.capitalizeText(value) : value;
        if (formatted !== value) {
            const start = control.selectionStart, end = control.selectionEnd, direction = control.selectionDirection;
            control.value = formatted;
            if (start !== null) control.setSelectionRange(start, end, direction);
        }
        field[key] = formatted;
        control.removeAttribute('aria-invalid');
        message.textContent = '';
        saveDraft();
        updatePreview();
    }
    function renderFields() {
        list.replaceChildren();
        fields.forEach(field => {
            const row = element('div', 'note-editor-field');
            row.dataset.fieldId = field.id;
            const head = element('div', 'note-editor-field-head');
            const label = element('label', '', NoteComposer.TYPES[field.type]);
            label.htmlFor = 'note-content-' + field.id;
            const actions = element('div', 'note-field-actions');
            let valueLabelInput;
            let valueCaption;
            if (field.type !== 'valor') {
                head.append(createTypePicker(field.type, 'note-type-options-' + field.id, false, type => {
                    field.type = type;
                    message.textContent = '';
                    saveDraft(); renderFields(); updatePreview();
                    document.getElementById('note-content-' + field.id).focus();
                }));
            } else {
                const heading = element('div', 'note-value-heading');
                valueCaption = element('span', 'note-value-caption', field.label.trim());
                valueCaption.hidden = !field.label.trim();
                heading.append(label, valueCaption);
                head.append(heading);
                const editLabel = element('button', 'note-value-label-toggle');
                editLabel.type = 'button';
                editLabel.title = 'Personalizar rótulo do valor';
                editLabel.setAttribute('aria-label', 'Personalizar rótulo do valor');
                editLabel.setAttribute('aria-expanded', String(!!field.editingLabel));
                editLabel.append(element('i', 'fas fa-pen'));
                editLabel.addEventListener('click', () => {
                    field.editingLabel = !field.editingLabel;
                    valueLabelInput.hidden = !field.editingLabel;
                    editLabel.setAttribute('aria-expanded', String(field.editingLabel));
                    if (field.editingLabel) valueLabelInput.focus();
                });
                actions.append(editLabel);
            }
            if (!field.locked) {
                const remove = element('button', 'note-remove-field');
                remove.type = 'button';
                remove.setAttribute('aria-label', 'Remover campo ' + NoteComposer.TYPES[field.type]);
                remove.append(element('i', 'fas fa-times'));
                remove.addEventListener('click', () => {
                    fields = fields.filter(item => item.id !== field.id);
                    message.textContent = '';
                    saveDraft(); renderFields(); updatePreview();
                    document.getElementById('noteAddTypePicker').querySelector('button').focus();
                });
                actions.append(remove);
            }
            if (actions.children.length) head.append(actions);
            row.append(head);
            if (field.type === 'valor') {
                valueLabelInput = element('input', 'note-value-label-input');
                valueLabelInput.type = 'text'; valueLabelInput.maxLength = 40;
                valueLabelInput.hidden = !field.editingLabel;
                valueLabelInput.value = field.label;
                valueLabelInput.placeholder = 'Rótulo opcional. Ex.: Adiantamento';
                valueLabelInput.dataset.key = 'label';
                valueLabelInput.setAttribute('aria-label', 'Rótulo do valor');
                const updateValueLabel = (composing = false) => {
                    inputChanged(field, 'label', valueLabelInput.value, valueLabelInput, composing);
                    valueCaption.textContent = field.label.trim();
                    valueCaption.hidden = !field.label.trim();
                };
                valueLabelInput.addEventListener('input', event => updateValueLabel(event.isComposing));
                valueLabelInput.addEventListener('compositionend', () => updateValueLabel());
                row.append(valueLabelInput);
            }
            if (field.type === 'personalizado') {
                const customLabel = element('input');
                customLabel.type = 'text'; customLabel.maxLength = 40;
                customLabel.value = field.label;
                customLabel.placeholder = 'Rótulo. Ex.: Entrega';
                customLabel.dataset.key = 'label';
                customLabel.setAttribute('aria-label', 'Rótulo personalizado');
                customLabel.addEventListener('input', event => inputChanged(field, 'label', customLabel.value, customLabel, event.isComposing));
                customLabel.addEventListener('compositionend', () => inputChanged(field, 'label', customLabel.value, customLabel));
                row.append(customLabel);
            }
            const input = element(field.type === 'valor' ? 'input' : 'textarea');
            input.id = label.htmlFor;
            input.setAttribute('aria-label', label.textContent);
            input.dataset.key = 'value'; input.value = field.value;
            input.maxLength = field.type === 'valor' ? 24 : 600;
            if (input.tagName === 'INPUT') input.type = 'text';
            if (field.type === 'valor') { input.inputMode = 'decimal'; input.placeholder = 'R$ 0,00'; }
            else input.placeholder = field.type === 'nome' ? 'Nome da pessoa' : 'Escreva aqui…';
            input.addEventListener('input', event => inputChanged(field, 'value', input.value, input, event.isComposing));
            input.addEventListener('compositionend', () => inputChanged(field, 'value', input.value, input));
            if (field.type === 'valor') input.addEventListener('keydown', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const formatted = NoteComposer.formatAmount(input.value);
                if (!formatted.valid) {
                    input.setAttribute('aria-invalid', 'true');
                    message.textContent = 'Informe um valor válido. Exemplo: 150,00.';
                    return;
                }
                input.value = formatted.value;
                inputChanged(field, 'value', input.value, input);
                input.setSelectionRange(input.value.length, input.value.length);
            });
            row.append(input);
            list.append(row);
        });
        if (!fields.length) list.append(element('p', 'note-editor-empty', 'Adicione um campo para começar.'));
    }
    addButton.addEventListener('click', () => {
        if (fields.length >= NoteComposer.MAX_FIELDS) return;
        const field = { id: String(nextId++), type: document.getElementById('noteAddType').value, label: '', value: '' };
        fields.push(field);
        saveDraft(); renderFields(); updatePreview();
        document.getElementById('note-content-' + field.id).focus();
    });
    document.querySelectorAll('[data-note-paper]').forEach(button => button.addEventListener('click', () => {
        width = button.dataset.notePaper;
        localStorage.setItem('receiptPaperWidth', width);
        const shared = document.getElementById('receiptPaperWidth');
        shared.value = width;
        shared.dispatchEvent(new Event('change'));
        button.closest('details').open = false;
        updatePreview();
    }));
    printButton.addEventListener('click', () => {
        const result = NoteComposer.build(fields);
        if (!result.valid) {
            const error = result.errors[0];
            message.textContent = error.message;
            if (error.index >= 0) {
                const control = list.querySelector('[data-field-id="' + fields[error.index].id + '"] [data-key="' + error.field + '"]');
                control.setAttribute('aria-invalid', 'true');
                control.focus();
            }
            return;
        }
        renderPaper(preview, result.entries);
        renderPaper(receipt, result.entries);
        receipt.classList.add('note-receipt-measuring');
        let height;
        try {
            height = NoteComposer.paperHeight(receipt.offsetHeight, width);
        } finally {
            receipt.classList.remove('note-receipt-measuring');
        }
        printStyle.textContent = '@page { size: ' + width + 'mm ' + height + 'mm; margin: 0; }';
        document.body.classList.add('printing-custom-note');
        try { window.print(); }
        catch (error) {
            document.body.classList.remove('printing-custom-note');
            printStyle.textContent = '';
            message.textContent = 'Não foi possível abrir a impressão. Tente novamente.';
        }
    });
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-custom-note');
        printStyle.textContent = '';
    });
    page.addEventListener('custom-notes-open', () => {
        if (!draftExpiresAt || Date.now() >= draftExpiresAt) {
            restoreSavedDraft();
            renderFields();
        }
        width = localStorage.getItem('receiptPaperWidth') === '58' ? '58' : '80';
        updatePreview();
        list.querySelector('input, textarea')?.focus();
    });
    renderAddTypePicker(); renderFields(); updatePreview();
});
